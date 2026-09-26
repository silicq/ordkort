/* AI request handlers. The order is always the same:
   validate the input → look in the shared base → only if it is not there, take one from the limit and ask Groq →
   check the answer → save it to the shared base for everyone who asks next. */
import { App } from './shared.js';
import { groq } from './groq.js';
import { cacheGet, cacheSet, cacheForget } from './db.js';
import { takeAI, aiLeft, takeSimple } from './limits.js';
import { HttpError, json, readJSON, str, arr, int, sha256, norm, randomCode, isCode } from './util.js';
import * as P from './prompts.js';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const BUILT_IN_UI = ['en', 'ru', 'uk', 'nb', 'nn', 'ar', 'zh'];
const UI_CHUNK = 90;
const WEEK = 7 * 864e5;

const lang = (v) => (typeof v === 'string' && App.langs.has(v) ? v : null);
function pairOf(b) {
  const target = lang(b.target), native = lang(b.native);
  if (!target || !native || target === native) throw new HttpError(400, 'bad_lang');
  return { target, native };
}
const h32 = async (s) => (await sha256(s)).slice(0, 32);

/* Cache keys — one place, so that reports can find exactly the entry that was served */
const KEYS = {
  lookup: async (t, n, b) => `d1:${t}:${n}:${await h32(str(b.q, 60).toLowerCase())}`,
  chapter: async (t, n, b) => `g1:${t}:${n}:${b.id}`,
  ask: async (t, n, b) => `a1:${t}:${n}:${await h32(str(b.q, 300).toLowerCase())}`,
  translate: async (t, n, b) => `t1:${t}:${n}:${b.from === 'auto' ? 'auto' : lang(b.from)}:${lang(b.to)}:${await h32(str(b.text, 600))}`,
};
async function groupOf(b, target, native) {
  const level = LEVELS.includes(b.level) ? b.level : 'A1';
  const tp = typeof b.topic === 'string' ? App.topics.get(b.topic) : null;
  const custom = tp ? '' : str(b.custom, 80);
  if (!tp && !custom) throw new HttpError(400, 'bad_topic');
  return { tp, custom, level, grp: `${target}:${native}:${tp ? tp.id : 'c:' + (await h32(norm(custom)))}:${level}` };
}

const quotaHeaders = (q) => (q ? { 'X-AI-Left': String(q.left), 'X-AI-Limit': String(q.limit) } : { 'X-Cache': 'hit' });

/* identical requests arriving at the same time share one generation */
const inflight = new Map();
function once(k, fn) {
  if (inflight.has(k)) return inflight.get(k);
  const p = fn().finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

async function generate(env, key, cacheKey, { fresh, prompt, clean, keep = () => true }) {
  if (!fresh) {
    const hit = await cacheGet(env.DB, cacheKey);
    if (hit) return json(hit, 200, quotaHeaders(null));
  }
  const { data, q } = await once(cacheKey + (fresh ? ':fresh' : ''), async () => {
    const quota = await takeAI(env, key);
    try {
      const out = clean(await groq(env, await prompt()));
      if (!out) throw new HttpError(502, 'bad_ai');
      if (keep(out)) await cacheSet(env.DB, cacheKey, out);
      return { data: out, q: quota };
    } catch (e) {
      await quota.refund();
      throw e;
    }
  });
  return json(data, 200, quotaHeaders(q));
}

/* ---------- words for a deck: the word bank first, then the AI ---------- */
export async function words(request, env, key) {
  const b = await readJSON(request, 60000);
  const { target, native } = pairOf(b);
  const n = int(b.n, 5, 30, 20);
  const { tp, custom, level, grp } = await groupOf(b, target, native);

  const have = new Set(arr(b.have, 3000).map((x) => norm(str(x, 80))).filter(Boolean));
  // topics that are a word class ("prepositions and adverbs") get only words of that class — also from the bank,
  // which may still hold words generated before this rule (verbs such as "å ligge" among prepositions)
  const fits = (w) => !tp?.pos || tp.pos.includes(w.pos);
  const bank = (await env.DB.prepare('SELECT norm, data FROM words WHERE grp = ? ORDER BY id LIMIT 500').bind(grp).all()).results || [];
  const avail = bank.filter((r) => !have.has(r.norm)).map((r) => JSON.parse(r.data)).filter(fits);
  if (avail.length >= n) return json({ words: avail.slice(0, n), source: 'bank' }, 200, quotaHeaders(null));

  const quota = await takeAI(env, key);
  try {
    const avoid = [...new Set([...bank.map((r) => r.norm), ...have])].slice(-220);
    const raw = await groq(env, P.wordsPrompt({ target, native, topic: tp ? tp.en : custom, hint: tp?.hint, only: tp?.pos, level, n, avoid }));
    const seen = new Set([...have, ...bank.map((r) => r.norm)]);
    const fresh = [];
    for (const w of arr(raw.words, 40).map((x) => P.aiWord(x, target))) {
      const k = norm(w.term);
      if (!w.term || !w.tr || !k || seen.has(k) || !fits(w)) continue;
      seen.add(k);
      fresh.push({ k, w });
    }
    // into the bank in one statement (up to 30 rows × 3 parameters ≤ 100 D1 parameters)
    for (let i = 0; i < fresh.length; i += 30) {
      const part = fresh.slice(i, i + 30);
      await env.DB.prepare(`INSERT OR IGNORE INTO words (grp, norm, data) VALUES ${part.map(() => '(?, ?, ?)').join(', ')}`)
        .bind(...part.flatMap(({ k, w }) => [grp, k, JSON.stringify(w)])).run();
    }
    return json({ words: [...avail, ...fresh.map((f) => f.w)].slice(0, n), source: 'ai' }, 200, quotaHeaders(quota));
  } catch (e) {
    await quota.refund();
    throw e;
  }
}

/* ---------- card autofill (personal, not cached) ---------- */
export async function fill(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const term = str(b.term, 80), tr = str(b.tr, 120);
  if (!term && !tr) throw new HttpError(400, 'empty');
  const quota = await takeAI(env, key);
  try {
    const w = P.aiWord(await groq(env, P.fillPrompt({ target, native, level: LEVELS.includes(b.level) ? b.level : 'A1', term, tr })), target);
    return json(w, 200, quotaHeaders(quota));
  } catch (e) {
    await quota.refund();
    throw e;
  }
}

/* ---------- dictionary entry (for Norwegian, grounded in ordbokene.no) ---------- */
export async function lookup(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const q = str(b.q, 60);
  if (!q) throw new HttpError(400, 'empty');
  const cacheKey = await KEYS.lookup(target, native, b);
  return generate(env, key, cacheKey, {
    fresh: !!b.fresh,
    prompt: async () => ({ ...P.lookupPrompt({ target, native, q, ground: await officialSummary(env, target, q) }) }),
    clean: P.cleanEntry,
    keep: (e) => e.found !== false,
  });
}

async function officialSummary(env, target, q) {
  if (!App.ordbok.supports(target)) return '';
  const k = `o1:${target}:${await h32(q.toLowerCase())}`;
  const hit = await cacheGet(env.DB, k, WEEK);
  if (hit !== null) return hit.s;
  try {
    const r = await Promise.race([App.ordbok.lookup(q, target), new Promise((res) => setTimeout(() => res(null), 4000))]);
    const s = App.ordbok.summary(r);
    await cacheSet(env.DB, k, { s });
    return s;
  } catch {
    return '';
  }
}

/* ---------- textbook chapter ---------- */
export async function chapter(request, env, key) {
  const b = await readJSON(request, 2000);
  const { target, native } = pairOf(b);
  if (!App.topics.chapter(b.id)) throw new HttpError(400, 'bad_chapter');
  return generate(env, key, await KEYS.chapter(target, native, b), {
    fresh: !!b.fresh,
    prompt: () => P.chapterPrompt({ target, native, id: b.id }),
    clean: P.cleanChapter,
  });
}

/* ---------- grammar question ---------- */
export async function ask(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const q = str(b.q, 300);
  if (q.length < 3) throw new HttpError(400, 'empty');
  return generate(env, key, await KEYS.ask(target, native, b), {
    fresh: !!b.fresh,
    prompt: () => P.askPrompt({ target, native, q }),
    clean: P.cleanChapter,
  });
}

/* ---------- translation with explanations ---------- */
export async function translate(request, env, key) {
  const b = await readJSON(request, 8000);
  const { target, native } = pairOf(b);
  const text = str(b.text, 600);
  if (!text) throw new HttpError(400, 'empty');
  const from = b.from === 'auto' ? 'auto' : lang(b.from);
  const to = lang(b.to);
  if (!from || !to) throw new HttpError(400, 'bad_lang');
  return generate(env, key, await KEYS.translate(target, native, b), {
    fresh: false,
    prompt: () => P.translatePrompt({ target, native, from, to, text }),
    clean: P.cleanTranslation,
  });
}

/* ---------- interface translation into a language without a hand-made one ---------- */
export async function ui(request, env, key) {
  const b = await readJSON(request, 1000);
  const code = lang(b.lang);
  if (!code || BUILT_IN_UI.includes(code)) throw new HttpError(400, 'bad_lang');
  const keys = Object.keys(App.i18nData.en);
  const parts = Math.ceil(keys.length / UI_CHUNK);
  const part = int(b.part, 0, parts - 1, 0);
  const chunk = Object.fromEntries(keys.slice(part * UI_CHUNK, (part + 1) * UI_CHUNK).map((k) => [k, App.i18nData.en[k]]));
  const cacheKey = `u1:${code}:${await h32(JSON.stringify(chunk))}`;
  const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
  const res = await generate(env, key, cacheKey, {
    fresh: false,
    prompt: () => P.uiPrompt({ lang: code, strings: chunk }),
    clean: (raw) => {
      const out = {};
      for (const [k, v] of Object.entries(chunk)) {
        const t = raw && typeof raw[k] === 'string' ? str(raw[k], 600) : '';
        out[k] = t && holes(t) === holes(v) ? t : v;
      }
      return out;
    },
  });
  res.headers.set('X-UI-Parts', String(parts));
  return res;
}

/* ---------- "report a mistake": after REPORTS_TO_DROP independent reports the entry is regenerated ---------- */
export async function report(request, env, key) {
  await takeSimple(env, 'report', key, 30, 36e5);
  const b = await readJSON(request, 8000);
  const { target, native } = pairOf(b);
  let k, drop;
  if (b.kind === 'word') {
    const { grp } = await groupOf(b, target, native);
    const w = norm(str(b.term, 80));
    if (!w) throw new HttpError(400, 'empty');
    k = `w:${grp}:${w}`;
    drop = () => env.DB.prepare('DELETE FROM words WHERE grp = ? AND norm = ?').bind(grp, w).run();
  } else if (KEYS[b.kind]) {
    if (b.kind === 'chapter' && !App.topics.chapter(b.id)) throw new HttpError(400, 'bad_chapter');
    k = await KEYS[b.kind](target, native, b);
    drop = async () => { await env.DB.prepare('DELETE FROM cache WHERE k = ?').bind(k).run(); cacheForget(k); };
  } else {
    throw new HttpError(400, 'bad_kind');
  }
  await env.DB.prepare('INSERT OR IGNORE INTO reports (k, who, t) VALUES (?, ?, ?)').bind(k, key, Date.now()).run();
  const row = await env.DB.prepare('SELECT count(*) AS n FROM reports WHERE k = ?').bind(k).first();
  if ((row?.n || 0) >= (Number(env.REPORTS_TO_DROP) || 2)) {
    await drop();
    await env.DB.prepare('DELETE FROM reports WHERE k = ?').bind(k).run();
    return json({ dropped: true });
  }
  return json({ dropped: false });
}

/* ---------- reading mode: gloss a piece of text (≤ 600 chars; longer texts come in parts) ---------- */
export async function gloss(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const text = str(b.text, 600);
  if (text.length < 2) throw new HttpError(400, 'empty');
  return generate(env, key, `r1:${target}:${native}:${await h32(text)}`, {
    fresh: false,
    prompt: () => P.glossPrompt({ target, native, text }),
    clean: P.cleanGloss,
  });
}

/* ---------- decks shared by link ---------- */
export async function shareCreate(request, env, key) {
  await takeSimple(env, 'share', key, 20, 36e5);
  const b = await readJSON(request, 400000);
  const d = b.deck || {};
  const { target, native } = pairOf(d);
  const words = arr(d.words, 500).map(P.cleanWord).filter((w) => w.term && w.tr);
  if (!words.length) throw new HttpError(400, 'empty');
  const deck = {
    title: str(d.title, 80), emoji: str(d.emoji, 8), level: LEVELS.includes(d.level) ? d.level : '',
    topic: typeof d.topic === 'string' && App.topics.get(d.topic) ? d.topic : '',
    group: str(d.group, 12), target, native, words,
  };
  for (let i = 0; i < 5; i++) {
    const id = randomCode(8);
    const r = await env.DB.prepare('INSERT OR IGNORE INTO shares (id, d, t) VALUES (?, ?, ?)').bind(id, JSON.stringify(deck), Date.now()).run();
    if (r.meta.changes) return json({ id });
  }
  throw new HttpError(503, 'busy');
}

export async function shareGet(env, id) {
  if (!isCode(id, 8)) throw new HttpError(404, 'gone');
  const row = await env.DB.prepare('SELECT d FROM shares WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'gone');
  return json({ deck: JSON.parse(row.d) });
}

export async function limits(request, env, key) {
  return json(await aiLeft(env, key));
}
