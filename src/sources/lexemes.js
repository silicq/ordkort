/* Wikidata Lexemes (www.wikidata.org, CC0): a free dictionary of words for hundreds of languages, kept by the same
   community as Wiktionary but as data — every form of a word with its grammatical features ("Hundes": singular,
   genitive), the gender, the pronunciation in IPA and the senses with short glosses. It knows words Wiktionary
   has no table for (a Finnish noun's 22 cases, a Spanish verb's 68 forms) and is a second opinion where both have one.

   Three requests for a word nobody looked up before: the search, the lexemes, and the English names of the
   features and categories they use. The result is kept in the shared cache for a month, so Wikidata sees each
   word once and never a visitor (the server asks it, with a User-Agent, as Wikimedia's rules ask). */
import { UA } from '../core/util.js';
import { plain } from './wiktionary.js';

const API = 'https://www.wikidata.org/w/api.php';
const MONTH = 30 * 864e5;
export const NAME = 'Wikidata';
export const LICENSE = 'CC0';

async function call(params, { signal, budget } = {}) {
  if (budget && budget.left-- <= 0) throw new Error('wikidata budget');
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`;
  const r = await fetch(url, { signal, headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (!r.ok) throw new Error('wikidata ' + r.status);
  return r.json();
}

// a lemma or form in this language: Serbian is written "sr-ec" and "sr-el", Chinese "zh-hans"…
const ofLang = (reps, lang) => Object.entries(reps || {}).filter(([k]) => k === lang || k.startsWith(lang + '-')).map(([, v]) => v.value);
const ids = (claims, p) => (claims?.[p] || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
const strings = (claims, p) => (claims?.[p] || []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => typeof v === 'string');

// the grammatical gender of a feature's English name: "masculine inanimate" is masculine
export function genderOf(label) {
  const l = String(label || '').toLowerCase();
  return /masculine/.test(l) ? 'm' : /feminine/.test(l) ? 'f' : /neuter/.test(l) ? 'n' : /common/.test(l) ? 'c' : '';
}

/* The lexemes of `lang` whose lemma is `word`, from the answers of the API → the shape the dictionary page shows
   (like Wiktionary's: { lemma, cls, pron, table, senses }) plus what checking a card needs ({ cat, genders, forms }).
   labels: Q-id → English name. Exported for the tests, which feed it recorded answers. */
export function articles(entities, labels, lang, word, { max = 4 } = {}) {
  const want = plain(word, lang);
  const out = [];
  for (const e of entities) {
    const lemma = ofLang(e.lemmas, lang).find((x) => plain(x, lang) === want);
    if (!lemma) continue;
    const cat = labels[e.lexicalCategory] || '';
    const genders = ids(e.claims, 'P5185').map((q) => labels[q]).filter(Boolean);
    // forms with the same features in one row; a form spelt two ways shows both ("Hunds / Hundes")
    const rows = new Map();
    const forms = new Set([want]);
    let pron = strings(e.claims, 'P898')[0] || '';
    for (const f of e.forms || []) {
      const written = ofLang(f.representations, lang);
      if (!written.length) continue;
      written.forEach((x) => forms.add(plain(x, lang)));
      // "singular genitive case" → "singular genitive"
      const label = (f.grammaticalFeatures || []).map((q) => labels[q]).filter(Boolean).join(' ').replace(/ (case|tense)\b/g, '');
      if (!pron && written.some((x) => plain(x, lang) === want)) pron = strings(f.claims, 'P898')[0] || '';
      if (!label) continue;
      const row = rows.get(label) || [];
      for (const x of written) if (!row.includes(x)) row.push(x);
      rows.set(label, row);
    }
    // a gloss in English like Wiktionary's, else in the word's own language (the cache is shared by every learner)
    const senses = (e.senses || []).map((s) => {
      const g = s.glosses || {};
      const gloss = (g.en || g[lang] || Object.values(g)[0])?.value;
      return gloss ? { expl: [gloss], ex: [], sub: [] } : null;
    }).filter(Boolean).slice(0, 8);
    const table = rows.size > 1 ? { headers: null, rows: [...rows].slice(0, 30).map(([l, f]) => [l, f.join(' / ')]) } : null;
    if (!table && !senses.length && !genders.length) continue; // a bare lemma says nothing the AI entry does not
    out.push({
      id: e.id, lemma, cat,
      cls: [cat, ...genders].filter(Boolean).join(', '),
      pron: pron ? `/${pron.replace(/^\/|\/$/g, '')}/` : '',
      table, senses, etym: '',
      genders: genders.map(genderOf).filter(Boolean),
      forms: [...forms],
    });
    if (out.length === max) break;
  }
  return out;
}

/* What Wikidata has on a word in `lang` → { url, articles } or null — from the shared cache, or three requests.
   cache: { get(key, maxAge), set(key, value) }; opts: { signal, budget: { left } }. */
export async function lookup(cache, lang, word, opts = {}) {
  const key = `lx1:${lang}:${plain(word, lang)}`;
  const hit = await cache.get(key, MONTH);
  if (hit) return hit.none ? null : hit;
  const found = await call({ action: 'wbsearchentities', type: 'lexeme', language: lang, uselang: 'en', search: word, limit: '12' }, opts);
  const lx = (found.search || []).map((x) => x.id).filter((x) => /^L\d+$/.test(x));
  let out = null;
  if (lx.length) {
    const got = await call({ action: 'wbgetentities', ids: lx.join('|') }, opts);
    const entities = Object.values(got.entities || {}).filter((e) => !e.missing);
    const want = plain(word, lang);
    const mine = entities.filter((e) => ofLang(e.lemmas, lang).some((x) => plain(x, lang) === want));
    if (mine.length) {
      const q = new Set();
      for (const e of mine) {
        if (e.lexicalCategory) q.add(e.lexicalCategory);
        ids(e.claims, 'P5185').forEach((x) => q.add(x));
        for (const f of e.forms || []) (f.grammaticalFeatures || []).forEach((x) => q.add(x));
      }
      const labels = {};
      const all = [...q];
      for (let i = 0; i < all.length; i += 50) {
        const r = await call({ action: 'wbgetentities', ids: all.slice(i, i + 50).join('|'), props: 'labels', languages: 'en' }, opts);
        for (const [id, x] of Object.entries(r.entities || {})) if (x.labels?.en?.value) labels[id] = x.labels.en.value;
      }
      const a = articles(mine, labels, lang, word);
      if (a.length) out = { url: `https://www.wikidata.org/wiki/Lexeme:${a[0].id}`, articles: a };
    }
  }
  await cache.set(key, out || { none: 1 });
  return out;
}
