/* A base of ready decks: every 15 minutes, while nobody is using the AI, the cron fills one more group of the shared
   word bank (target language, native language, topic, level) with up to 30 words. A newcomer's first decks then come from
   the bank at once, with no wait and no AI call, even when many arrive together. The plan below goes from the decks
   used most to the rarer ones and ends when every group has its words.
   It never competes with visitors: it skips a turn when anyone made an AI request since the last one, or once
   40% of the site's daily budget is used, and it makes at most WARM_PER_DAY generations a day (24 by default).
   That cap matters most: Groq's free plan allows each model 200,000 tokens in any 24 hours, about 100–150 AI
   answers a day for the whole site, and one list of words takes 5,000–7,000. It goes through the same code and
   the same limits as a visitor's request (api.words), under its own key. */
import { words } from './routes.js';
import { limitsOf } from '../core/limits.js';
import { peek, bump } from '../core/db.js';
import { today } from '../core/util.js';

const FIRST = ['greetings', 'core', 'numbers']; // what the setup picks for every newcomer
const LEVELS = ['A1', 'A2', 'B1'];
// the pairs the site is built around: Norwegian for the people who move to Norway, English and the big languages
export const CORE = [
  'nb:en', 'nb:uk', 'nb:ru', 'nb:ar', 'nb:pl', 'nb:so', 'nb:ti', 'nb:prs', 'nb:es', 'nb:de',
  'en:ru', 'en:uk', 'en:es', 'en:zh', 'en:ar', 'en:pt', 'en:pl', 'en:tr', 'en:de', 'en:fr',
  'es:en', 'de:en', 'fr:en', 'it:en', 'ja:en', 'ko:en', 'zh:en', 'pt:en', 'de:ru', 'de:uk', 'pl:uk', 'es:ru',
];
const TARGETS = ['en', 'nb', 'es', 'de', 'fr', 'it', 'pt', 'ja', 'ko', 'zh', 'pl', 'sv', 'nl', 'tr', 'ru', 'uk', 'ar'];
const NATIVES = ['en', 'ru', 'uk', 'es', 'de', 'fr', 'pt', 'zh', 'ar', 'pl', 'tr', 'it'];
export const PER_DAY = 24; // generations a day, unless WARM_PER_DAY says otherwise
export const READY = 20; // words a group needs before the bank serves it (the app asks for 20 at a time)
const N = 30; // words one generation asks for

export function plan(topics) {
  const out = [], seen = new Set();
  const add = (pair, topic, level) => {
    const [target, native] = pair.split(':');
    const grp = `${target}:${native}:${topic}:${level}`; // as api.js names a group of the bank
    if (target === native || seen.has(grp)) return;
    seen.add(grp);
    out.push({ target, native, topic, level, grp });
  };
  const ALL = topics.map((x) => x.id);
  const pairs = TARGETS.flatMap((t) => NATIVES.map((n) => `${t}:${n}`));
  for (const p of CORE) for (const t of FIRST) add(p, t, 'A1');
  for (const p of CORE) for (const t of ALL) add(p, t, 'A1');
  for (const p of pairs) for (const t of FIRST) add(p, t, 'A1');
  for (const p of CORE) for (const t of FIRST) for (const l of LEVELS.slice(1)) add(p, t, l);
  for (const p of pairs) for (const t of FIRST) add(p, t, 'A2');
  for (const p of CORE) for (const t of ALL) add(p, t, 'A2');
  for (const p of CORE) for (const t of ALL) add(p, t, 'B1');
  return out;
}

/* the first group of the plan from `from` on that has fewer than READY words; its index, or -1 when all are ready */
export async function nextGroup(db, list, from = 0) {
  for (let i = from; i < list.length; i += 90) {
    const part = list.slice(i, i + 90);
    const { results } = await db.prepare(`SELECT grp, count(*) AS n FROM words WHERE grp IN (${part.map(() => '?').join(',')}) GROUP BY grp`)
      .bind(...part.map((x) => x.grp)).all();
    const n = new Map((results || []).map((r) => [r.grp, r.n]));
    const j = part.findIndex((x) => (n.get(x.grp) || 0) < READY);
    if (j >= 0) return i + j;
  }
  return -1;
}

/* whether to fill a group now: nobody used the AI since the last turn, and most of today's budget is untouched */
export function quiet(state, used, budget) {
  if (used > budget * 0.4) return false;
  return !state || state.day !== today() || used <= state.used;
}

const STATE = 'warm:state';
async function getState(db) {
  const row = await db.prepare('SELECT v FROM cache WHERE k = ?').bind(STATE).first();
  try { return row ? JSON.parse(row.v) : null; } catch { return null; }
}
async function setState(db, v) {
  await db.prepare('INSERT INTO cache (k, v, t) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = ?2, t = ?3')
    .bind(STATE, JSON.stringify(v), Date.now()).run();
}

export async function warmOne(env) {
  const db = env.DB;
  const state = await getState(db);
  const used = await peek(db, `ai:g:${today()}`);
  if (state?.done === today()) return 'done'; // a finished plan is looked at again the next day
  const cap = Number(env.WARM_PER_DAY ?? PER_DAY);
  if ((await peek(db, `warm:n:${today()}`)) >= cap) return 'enough for today';
  if (!quiet(state, used, limitsOf(env).budget)) {
    await setState(db, { ...state, day: today(), used });
    return 'busy';
  }
  const list = plan(App.topics.list);
  const at = await nextGroup(db, list, state?.at || 0);
  if (at < 0) { await setState(db, { at: 0, day: today(), used, done: today() }); return 'done'; }
  const g = list[at];
  const req = new Request('https://ordkort.com/api/words', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: g.target, native: g.native, topic: g.topic, level: g.level, n: N, have: [] }),
  });
  let result = 'filled ' + g.grp, next = at + 1;
  await bump(db, `warm:n:${today()}`, 26 * 36e5);
  try { await words(req, env, 'warm'); } catch (e) {
    result = `failed ${g.grp}: ${e.code || e.message}`;
    // the AI was busy or a limit was reached: the same group next time; anything else: move on
    if (['busy', 'quota', 'budget', 'slow_down'].includes(e.code)) {
      next = at;
      await bump(db, `warm:n:${today()}`, 26 * 36e5, -1); // refused before any tokens were spent: not counted
    }
  }
  // a group the AI could not fill to READY (a small topic) is not asked again on every turn: the cursor moves on.
  // The count after this turn's own generation is kept, so the next turn notices only visitors.
  await setState(db, { at: next, day: today(), used: await peek(db, `ai:g:${today()}`) });
  return result;
}
