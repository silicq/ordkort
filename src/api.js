/* Обработчики ИИ-запросов. Порядок всегда один:
   проверить ввод → поискать в общей базе → только если нет, списать лимит и спросить Groq →
   проверить ответ → сохранить в общую базу для всех следующих. */
import { App } from './shared.js';
import { groq } from './groq.js';
import { cacheGet, cacheSet } from './db.js';
import { takeAI, aiLeft } from './limits.js';
import { HttpError, json, readJSON, str, arr, int, sha256, norm } from './util.js';
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

const quotaHeaders = (q) => (q ? { 'X-AI-Left': String(q.left), 'X-AI-Limit': String(q.limit) } : { 'X-Cache': 'hit' });

/* одинаковые запросы, пришедшие одновременно, делят одну генерацию */
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

/* ---------- слова для колоды: сначала банк, потом ИИ ---------- */
export async function words(request, env, key) {
  const b = await readJSON(request, 60000);
  const { target, native } = pairOf(b);
  const level = LEVELS.includes(b.level) ? b.level : 'A1';
  const n = int(b.n, 5, 30, 20);
  const tp = typeof b.topic === 'string' ? App.topics.get(b.topic) : null;
  const custom = tp ? '' : str(b.custom, 80);
  if (!tp && !custom) throw new HttpError(400, 'bad_topic');
  const topicKey = tp ? tp.id : 'c:' + (await h32(norm(custom)));
  const grp = `${target}:${native}:${topicKey}:${level}`;

  const have = new Set(arr(b.have, 3000).map((x) => norm(str(x, 80))).filter(Boolean));
  const bank = (await env.DB.prepare('SELECT norm, data FROM words WHERE grp = ? ORDER BY id LIMIT 500').bind(grp).all()).results || [];
  const avail = bank.filter((r) => !have.has(r.norm)).map((r) => JSON.parse(r.data));
  if (avail.length >= n) return json({ words: avail.slice(0, n), source: 'bank' }, 200, quotaHeaders(null));

  const quota = await takeAI(env, key);
  try {
    const avoid = [...new Set([...bank.map((r) => r.norm), ...have])].slice(-220);
    const raw = await groq(env, P.wordsPrompt({ target, native, topic: tp ? tp.en : custom, hint: tp?.hint, level, n, avoid }));
    const seen = new Set([...have, ...bank.map((r) => r.norm)]);
    const fresh = [];
    for (const w of arr(raw.words, 40).map(P.cleanWord)) {
      const k = norm(w.term);
      if (!w.term || !w.tr || !k || seen.has(k)) continue;
      seen.add(k);
      fresh.push({ k, w });
    }
    // в банк — одной командой (до 30 строк × 3 параметра ≤ 100 параметров D1)
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

/* ---------- автозаполнение карточки (личное, не кэшируется) ---------- */
export async function fill(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const term = str(b.term, 80), tr = str(b.tr, 120);
  if (!term && !tr) throw new HttpError(400, 'empty');
  const quota = await takeAI(env, key);
  try {
    const w = P.cleanWord(await groq(env, P.fillPrompt({ target, native, level: LEVELS.includes(b.level) ? b.level : 'A1', term, tr })));
    return json(w, 200, quotaHeaders(quota));
  } catch (e) {
    await quota.refund();
    throw e;
  }
}

/* ---------- словарная статья (для норвежского — с опорой на ordbokene.no) ---------- */
export async function lookup(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const q = str(b.q, 60);
  if (!q) throw new HttpError(400, 'empty');
  const cacheKey = `d1:${target}:${native}:${await h32(q.toLowerCase())}`;
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

/* ---------- глава учебника ---------- */
export async function chapter(request, env, key) {
  const b = await readJSON(request, 2000);
  const { target, native } = pairOf(b);
  if (!App.topics.chapter(b.id)) throw new HttpError(400, 'bad_chapter');
  return generate(env, key, `g1:${target}:${native}:${b.id}`, {
    fresh: !!b.fresh,
    prompt: () => P.chapterPrompt({ target, native, id: b.id }),
    clean: P.cleanChapter,
  });
}

/* ---------- вопрос по грамматике ---------- */
export async function ask(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const q = str(b.q, 300);
  if (q.length < 3) throw new HttpError(400, 'empty');
  return generate(env, key, `a1:${target}:${native}:${await h32(q.toLowerCase())}`, {
    fresh: !!b.fresh,
    prompt: () => P.askPrompt({ target, native, q }),
    clean: P.cleanChapter,
  });
}

/* ---------- перевод с разбором ---------- */
export async function translate(request, env, key) {
  const b = await readJSON(request, 8000);
  const { target, native } = pairOf(b);
  const text = str(b.text, 600);
  if (!text) throw new HttpError(400, 'empty');
  const from = b.from === 'auto' ? 'auto' : lang(b.from);
  const to = lang(b.to);
  if (!from || !to) throw new HttpError(400, 'bad_lang');
  return generate(env, key, `t1:${target}:${native}:${from}:${to}:${await h32(text)}`, {
    fresh: false,
    prompt: () => P.translatePrompt({ target, native, from, to, text }),
    clean: P.cleanTranslation,
  });
}

/* ---------- перевод интерфейса на язык без ручного перевода ---------- */
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

export async function limits(request, env, key) {
  return json(await aiLeft(env, key));
}
