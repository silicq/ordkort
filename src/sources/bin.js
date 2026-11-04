/* Icelandic: BÍN, Beygingarlýsing íslensks nútímamáls (bin.arnastofnun.is, the Árni Magnússon Institute, CC BY-SA 4.0),
   the official inflection of modern Icelandic: every form of a word, with its case, number, article, tense, person.
   One request a word, kept in the shared cache for a month. */
import { UA } from '../core/util.js';
import { plain } from './wiktionary.js';

const MONTH = 30 * 864e5;
export const NAME = 'BÍN';
export const LICENSE = 'CC BY-SA 4.0';
export const supports = (lang) => lang === 'is';
export const link = (word) => `https://bin.arnastofnun.is/leit/?q=${encodeURIComponent(word)}`;

const CAT = { no: 'noun', so: 'verb', lo: 'adjective', ao: 'adverb', fn: 'pronoun', to: 'numeral', fs: 'preposition', st: 'conjunction', uh: 'interjection' };
const GENDER = { kk: 'm', kvk: 'f', hk: 'n' };
const GENDER_NAME = { m: 'masculine', f: 'feminine', n: 'neuter' };
const CASE = { NF: 'nominative', ÞF: 'accusative', ÞGF: 'dative', EF: 'genitive' };
const NUMBER = { ET: 'singular', FT: 'plural' };
// the pieces of a verb's or adjective's tag ("GM-FH-NT-3P-ET": active, indicative, present, 3rd person, singular)
const PART = {
  GM: 'active', MM: 'middle', NH: 'infinitive', FH: 'indicative', VH: 'subjunctive', BH: 'imperative', NT: 'present',
  ÞT: 'past', '1P': '1st person', '2P': '2nd person', '3P': '3rd person', ET: 'singular', FT: 'plural', SAGNB: 'supine',
  LHNT: 'present participle', LHÞT: 'past participle', OP: 'impersonal', SP: 'question form', ST: 'clipped',
  FSB: 'strong positive', FVB: 'weak positive', MST: 'comparative', ESB: 'strong superlative', EVB: 'weak superlative',
  KK: 'masculine', KVK: 'feminine', HK: 'neuter', SB: 'strong', VB: 'weak', FST: 'positive', EST: 'superlative',
};
// "NFETgr" → "nominative singular definite"; "GM-FH-NT-3P-ET" → "active indicative present 3rd person singular"
export function label(tag) {
  return String(tag || '').split('-').map((t) => {
    const m = /^(NF|ÞF|ÞGF|EF)(ET|FT)(gr)?$/.exec(t);
    if (m) return [CASE[m[1]], NUMBER[m[2]], m[3] ? 'definite' : ''].filter(Boolean).join(' ');
    return PART[t] || t;
  }).join(' ');
}

/* The answer of the API for a word → articles shaped like Wiktionary's, with what checking a card needs */
export function articles(list, word) {
  const want = plain(word, 'is');
  return (Array.isArray(list) ? list : []).filter((x) => plain(x.ord, 'is') === want).slice(0, 4).map((x) => {
    const cat = CAT[x.ofl] || x.ofl_heiti || '';
    const g = GENDER[x.kyn] || '';
    const rows = new Map();
    for (const b of x.bmyndir || []) {
      const l = label(b.g);
      rows.set(l, [...new Set([...(rows.get(l) || []), b.b])]);
    }
    return {
      lemma: x.ord, cat, cls: [cat, GENDER_NAME[g]].filter(Boolean).join(', '), pron: '',
      table: rows.size > 1 ? { headers: null, rows: [...rows].slice(0, 30).map(([l, f]) => [l, f.join(' / ')]) } : null,
      senses: [], etym: '',
      genders: g ? [g] : [],
      forms: [...new Set([want, ...(x.bmyndir || []).map((b) => plain(b.b, 'is'))])],
    };
  }).filter((a) => a.table);
}

export async function lookup(cache, lang, word, { signal, budget } = {}) {
  if (!supports(lang)) return null;
  const key = `bin1:${plain(word, 'is')}`;
  const hit = await cache.get(key, MONTH);
  if (hit) return hit.none ? null : hit;
  if (budget && budget.left-- <= 0) throw new Error('bin budget');
  const r = await fetch(`https://bin.arnastofnun.is/api/ord/${encodeURIComponent(word)}`, { signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok && r.status !== 404) throw new Error('bin ' + r.status);
  const a = r.ok ? articles(await r.json().catch(() => []), word) : [];
  const out = a.length ? { url: link(word), articles: a } : null;
  await cache.set(key, out || { none: 1 });
  return out;
}
