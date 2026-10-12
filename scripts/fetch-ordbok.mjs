// Fetches the official Bokmålsordboka entries (ord.uib.no, the open API of ordbokene.no, CC BY 4.0)
// for every word of the static Norwegian pages and keeps what they show into data/seo/ordbok-nb.json:
// word class, gender, the full set of forms, definitions with short examples, fixed expressions, compounds.
// Run it by hand after adding words (it needs the network; `npm run seo` and the tests do not), then commit the file.
//   node scripts/fetch-ordbok.mjs
// Answers are cached in the system temp folder, so a second run asks the API only about new words.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import '../public/js/ordbok.js';

const DATA = new URL('../data/seo/', import.meta.url);
const CACHE = join(tmpdir(), 'ordkort-ordbok-cache');
mkdirSync(CACHE, { recursive: true });

/* ---------- which words ---------- */
const words = new Set();
const alias = new Map(); // a page word → the headword Bokmålsordboka files it under ("penger" → "penge")
for (const line of readFileSync(new URL('nb-frequent.txt', DATA), 'utf8').split('\n')) {
  const [w, , head] = line.trim().split(/\s+/);
  if (!w || line.startsWith('#')) continue;
  words.add(w);
  if (head) alias.set(w, head);
}
const lemmaOf = (term) => term.replace(/^(en|ei|et|å)\s+/i, '').trim();
const topicsDir = new URL('topics/', DATA);
if (existsSync(topicsDir)) {
  for (const f of readdirSync(topicsDir).filter((f) => f.endsWith('.json'))) {
    for (const topic of [JSON.parse(readFileSync(new URL(f, topicsDir), 'utf8'))].flat()) for (const w of topic.words || []) words.add(lemmaOf(w.nb));
  }
}
const bankFile = new URL('bank.json', DATA);
if (existsSync(bankFile)) {
  for (const topics of Object.values(JSON.parse(readFileSync(bankFile, 'utf8')).words)) {
    for (const list of Object.values(topics)) for (const w of list) words.add(lemmaOf(w.term));
  }
}

/* ---------- a polite, cached fetch ---------- */
const raw = new Map(); // url → JSON, for the forms below
// App.ordbok.lookup reads only the first three hits of a search; to reach the others ("tre" the numeral
// after "tre" the verb and the tree) the search answer is shifted: headword → how many hits to skip
const skip = new Map();
let asked = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.fetch = ((orig) => async (url) => {
  url = String(url).replace('scope=ei', 'scope=e'); // the headword itself, not words it is a form of
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');
  const shift = (j) => {
    const w = /\/api\/articles\?w=([^&]+)/.exec(url);
    const n = w ? skip.get(decodeURIComponent(w[1])) : 0;
    return n ? { ...j, articles: { ...j.articles, bm: (j.articles?.bm || []).slice(n) } } : j;
  };
  if (existsSync(file)) {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    raw.set(url, j);
    return { ok: true, json: async () => shift(j) };
  }
  for (let attempt = 0; ; attempt++) {
    await sleep(150);
    asked++;
    const r = await orig(url, { headers: { 'User-Agent': 'Ordkort static pages builder (https://ordkort.com; github.com/silicq/ordkort)' } });
    if (r.ok) {
      const j = await r.json();
      writeFileSync(file, JSON.stringify(j));
      raw.set(url, j);
      return { ok: true, json: async () => shift(j) };
    }
    if (attempt >= 3 || r.status === 404) return r;
    await sleep(2000 * (attempt + 1));
  }
})(globalThis.fetch);

/* ---------- forms of one article: tag → forms, standard paradigms only ---------- */
function formsOf(article, lemma) {
  const f = {};
  for (const l of article?.lemmas || []) {
    if (String(l.lemma).toLowerCase() !== lemma.toLowerCase()) continue;
    for (const p of l.paradigm_info || []) {
      if (p.to || (p.standardisation && p.standardisation !== 'STANDARD')) continue;
      for (const i of p.inflection || []) {
        if (!i.word_form) continue;
        const k = (i.tags || []).join('+');
        (f[k] ||= []).includes(i.word_form) || f[k].push(i.word_form);
      }
    }
  }
  return f;
}
const genderOf = (article, lemma) => [...new Set((article?.lemmas || [])
  .filter((l) => String(l.lemma).toLowerCase() === lemma.toLowerCase())
  .flatMap((l) => (l.paradigm_info || []).filter((p) => !p.to && (!p.standardisation || p.standardisation === 'STANDARD')).map((p) => p.tags?.[1]))
  .filter((g) => ['Masc', 'Fem', 'Neuter'].includes(g)))];
const wcOf = (article) => article?.lemmas?.[0]?.paradigm_info?.[0]?.tags?.[0] || '';

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
const senses = (list) => list.slice(0, 5).map((s) => ({
  def: cut(s.expl.join('; '), 220),
  ex: s.ex.slice(0, 2).map((x) => cut(x, 120)),
})).filter((s) => s.def || s.ex.length);

/* ---------- run ---------- */
const out = {};
const todo = [...words].sort((a, b) => a.localeCompare(b, 'nb'));
let i = 0, missing = [];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (i < todo.length) {
    const w = todo[i++];
    const head = alias.get(w) || w;
    try {
      const found = [];
      for (let n = 0; n < 9; n += 3) { // up to nine homonyms, three at a time
        skip.set(head, n);
        const r = await globalThis.App.ordbok.lookup(head, 'nb');
        found.push(...(r?.articles || []));
        if ((r?.articles || []).length < 3) break;
      }
      const arts = found.filter((a, k) => found.findIndex((b) => b.id === a.id) === k)
        .filter((a) => a.lemma.split(', ').some((x) => x.toLowerCase() === head.toLowerCase()));
      if (!arts.length) { missing.push(w); continue; }
      out[w] = arts.map((a) => {
        const json = [...raw.entries()].find(([u]) => u.endsWith(`/bm/article/${a.id}.json`))?.[1];
        return {
          id: a.id, wc: wcOf(json), g: genderOf(json, head), forms: formsOf(json, head),
          senses: senses(a.senses), expr: a.expr.slice(0, 6).map((x) => ({ text: x.text, meaning: cut(x.meaning, 160) })),
          compounds: [...new Set(a.compounds)].slice(0, 12), etym: cut(a.etym, 200),
        };
      });
    } catch (e) {
      missing.push(`${w} (${e.message})`);
    }
  }
}));
const sorted = Object.fromEntries(Object.keys(out).sort((a, b) => a.localeCompare(b, 'nb')).map((k) => [k, out[k]]));
writeFileSync(fileURLToPath(new URL('ordbok-nb.json', DATA)), JSON.stringify(sorted, null, 0).replace(/\],"/g, '],\n"') + '\n');
console.log(`ordbok-nb.json: ${Object.keys(sorted).length} words, ${asked} requests${missing.length ? `; not in Bokmålsordboka: ${missing.join(', ')}` : ''}`);
