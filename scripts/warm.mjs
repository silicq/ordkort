/* Fills the shared word bank ahead of time, so that new visitors get their first decks from the bank
   without waiting for the AI and without using the site's daily AI budget. The Worker's cron does this on its own,
   slowly and only while the site is quiet (src/warm.js); this script is a quicker push by hand, before a launch.
   It asks the live API exactly as the app does, so it is held to the same limits as one person:
   40 generations an hour, 120 a day. It stops after --max generations (25 by default): Groq's free plan gives
   each model 200,000 tokens in any 24 hours, about 100–150 AI answers a day for the whole site, and a list of
   words takes 5,000–7,000, so a long run leaves visitors with "the AI is overloaded" for the rest of the day.
   Run it again on another day to go on; groups already in the bank cost nothing.

     npm run warm                         the default plan (first decks for popular pairs, then all topics)
     npm run warm -- --pairs nb:en,nb:uk --topics greetings,core --levels A1,A2
     npm run warm -- --dry                print the plan and stop

   A pair is target:native, as in the app (nb:en = an English speaker learning Norwegian). */
import '../public/js/topics.js';

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const list = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
const BASE = arg('base', 'https://ordkort.com');
const N = 30; // the most one request may ask for; one generation then fills a group for 30 words
const MAX = Number(arg('max', 25)); // AI generations in one run (the bank ones are free)
const ALL = App.topics.list.map((t) => t.id);
const FIRST = ['greetings', 'core', 'numbers']; // what the setup picks for a newcomer

// the decks a newcomer gets first, for the pairs launch posts are most likely to bring, then every topic
// for the pairs the site is built around
const POPULAR = [
  'nb:en', 'nb:ru', 'nb:uk', 'en:ru', 'en:uk', 'de:ru', 'de:uk', 'pl:uk', 'es:ru',
  'es:en', 'fr:en', 'de:en', 'it:en', 'ja:en', 'ko:en', 'zh:en', 'pt:en', 'sv:en', 'nl:en', 'pl:en', 'ru:en',
];
const CORE = ['nb:en', 'nb:ru', 'nb:uk', 'en:ru', 'en:uk', 'es:en', 'de:en', 'fr:en'];

let plan = [];
if (process.argv.includes('--pairs') || process.argv.includes('--topics')) {
  const topics = list(arg('topics', FIRST.join(',')));
  for (const pair of list(arg('pairs', 'nb:en'))) for (const level of list(arg('levels', 'A1'))) for (const topic of topics) plan.push({ pair, topic, level });
} else {
  for (const level of ['A1', 'A2']) for (const pair of POPULAR) for (const topic of FIRST) plan.push({ pair, topic, level });
  for (const pair of CORE) for (const topic of ALL) plan.push({ pair, topic, level: 'A1' });
}
plan = plan.filter((p, i) => plan.findIndex((q) => q.pair === p.pair && q.topic === p.topic && q.level === p.level) === i);

if (process.argv.includes('--dry')) {
  console.log(plan.length + ' groups');
  for (const p of plan) console.log(p.pair, p.level, p.topic);
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ask({ pair, topic, level }) {
  const [target, native] = pair.split(':');
  const res = await fetch(BASE + '/api/words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'ordkort-warm' },
    body: JSON.stringify({ target, native, topic, level, n: N, have: [] }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const done = { bank: 0, ai: 0, failed: 0 };
for (const [i, p] of plan.entries()) {
  const tag = `${String(i + 1).padStart(3)}/${plan.length} ${p.pair} ${p.level} ${p.topic}`;
  let r;
  for (let tries = 0; ; tries++) {
    r = await ask(p).catch(() => ({ status: 0, data: {} }));
    // the AI is busy or the network failed: wait and ask again, a few times
    if ((r.status === 503 || r.status === 0 || (r.status === 429 && r.data.error === 'slow_down')) && tries < 4) { await sleep(60e3); continue; }
    break;
  }
  // the hourly and the daily limit answer alike: wait for the next hour once, and if it is still used up, it is the day's
  if (r.status === 429 && r.data.error === 'quota' && !p.waited) {
    const next = Math.ceil(Date.now() / 36e5) * 36e5 + 60e3;
    console.log(`${tag}: the hourly limit is used up, waiting until ${new Date(next).toISOString().slice(11, 16)} UTC`);
    await sleep(next - Date.now());
    p.waited = true;
    plan.splice(i + 1, 0, p);
    continue;
  }
  if (r.status === 429 && (r.data.error === 'quota' || r.data.error === 'budget')) {
    console.log(`${tag}: ${r.data.error === 'quota' ? 'the limit for today is used up' : 'the site budget for today is used up'}; run again tomorrow`);
    break;
  }
  if (r.status !== 200) { done.failed++; console.log(`${tag}: HTTP ${r.status} ${r.data.error || ''}`); continue; }
  const src = r.data.source;
  done[src === 'bank' ? 'bank' : 'ai']++;
  if (done.ai >= MAX) { console.log(`${tag}: ${MAX} generations, the most for one run (--max)`); break; }
  console.log(`${tag}: ${r.data.words?.length ?? 0} words from the ${src === 'bank' ? 'bank' : 'AI'}`);
  if (src !== 'bank') await sleep(8e3); // keep well inside the AI's per-minute limit, which the site shares
}
console.log(`\nalready in the bank: ${done.bank}, generated now: ${done.ai}, failed: ${done.failed}`);
