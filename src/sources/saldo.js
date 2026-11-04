/* Swedish: SALDO's morphology (Språkbanken Text, University of Gothenburg, CC BY 4.0), asked through Karp, their
   open lexicon service: every form of a Swedish word with its features, and a noun's gender from its paradigm
   ("nn_6n_hus" is neuter, "nn_2u_bil" common). One request a word, kept in the shared cache for a month. */
import { UA } from '../core/util.js';
import { plain } from './wiktionary.js';

const API = 'https://spraakbanken4.it.gu.se/karp/v7/query/saldom';
const MONTH = 30 * 864e5;
export const NAME = 'SALDO';
export const LICENSE = 'CC BY 4.0';
export const supports = (lang) => lang === 'sv';
export const link = () => 'https://spraakbanken.gu.se/resurs/saldom';

const CAT = { nn: 'noun', vb: 'verb', av: 'adjective', ab: 'adverb', pn: 'pronoun', nl: 'numeral', pp: 'preposition', kn: 'conjunction', in: 'interjection' };
const GENDER = { u: 'c', n: 'n', v: '' }; // utrum (common), neutrum; "v" (vacklande) is either
const GENDER_NAME = { c: 'common', n: 'neuter' };
const PART = {
  sg: 'singular', pl: 'plural', indef: 'indefinite', def: 'definite', nom: 'nominative', gen: 'genitive',
  pres: 'present', pret: 'past', ind: 'indicative', konj: 'subjunctive', aktiv: 'active', 's-form': 'passive',
  imper: 'imperative', inf: 'infinitive', sup: 'supine', pres_part: 'present participle', pret_part: 'past participle',
  pos: 'positive', komp: 'comparative', super: 'superlative', u: 'common', n: 'neuter', masc: 'masculine', no_masc: 'not masculine',
};
// the parts of compounds ("ci", "cm", "sms") are no forms a learner meets on their own
const COMPOUND = /^(c|ci|cm|sms)$/;
export const label = (msd) => String(msd || '').split(' ').map((x) => PART[x] || x).join(' ');

/* The hits of a query → articles shaped like Wiktionary's, with what checking a card needs */
export function articles(hits, word) {
  const want = plain(word, 'sv');
  return (hits || []).map((h) => h.entry).filter((e) => e && plain(e.baseform, 'sv') === want && CAT[e.partOfSpeech]).slice(0, 4).map((e) => {
    const cat = CAT[e.partOfSpeech];
    const g = cat === 'noun' ? GENDER[/^nn_\d*([unv])/.exec(e.paradigm || '')?.[1]] || '' : '';
    const rows = new Map();
    const forms = new Set([want]);
    for (const f of e.inflectionTable || []) {
      if (COMPOUND.test(f.msd)) continue;
      forms.add(plain(f.writtenForm, 'sv'));
      const l = label(f.msd);
      rows.set(l, [...new Set([...(rows.get(l) || []), f.writtenForm])]);
    }
    return {
      lemma: e.baseform, cat, cls: [cat, GENDER_NAME[g]].filter(Boolean).join(', '), pron: '',
      table: rows.size > 1 ? { headers: null, rows: [...rows].slice(0, 30).map(([l, f]) => [l, f.join(' / ')]) } : null,
      senses: [], etym: '',
      genders: g ? [g] : [],
      forms: [...forms],
    };
  }).filter((a) => a.table);
}

export async function lookup(cache, lang, word, { signal, budget } = {}) {
  if (!supports(lang)) return null;
  const key = `sal1:${plain(word, 'sv')}`;
  const hit = await cache.get(key, MONTH);
  if (hit) return hit.none ? null : hit;
  if (budget && budget.left-- <= 0) throw new Error('saldo budget');
  const r = await fetch(`${API}?${new URLSearchParams({ q: `equals|baseform.raw|${word}` })}`, { signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error('saldo ' + r.status);
  const a = articles((await r.json()).hits, word);
  const out = a.length ? { url: link(word), articles: a } : null;
  await cache.set(key, out || { none: 1 });
  return out;
}
