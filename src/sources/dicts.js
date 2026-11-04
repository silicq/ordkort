/* The free dictionaries beside Wiktionary, for the languages without an official dictionary here. Wiktionary has
   no entry, or no table, for many words; these fill the gaps:
   - Wikidata Lexemes (CC0), every language: the forms with their features, the gender, IPA and short senses
   - BÍN (CC BY-SA 4.0) for Icelandic: the official inflection
   - SALDO (CC BY 4.0) for Swedish: the morphology of Språkbanken
   Each gives articles shaped like Wiktionary's, so the dictionary page shows them the same way, the AI entry is
   grounded in them too, and a card's gender and forms are checked against them where Wiktionary cannot tell. */
import * as Lexemes from './lexemes.js';
import * as Bin from './bin.js';
import * as Saldo from './saldo.js';
import { plain } from './wiktionary.js';

// the dictionaries of a language, the one made for it first
const SOURCES = [
  { name: Bin.NAME, license: Bin.LICENSE, supports: Bin.supports, lookup: Bin.lookup },
  { name: Saldo.NAME, license: Saldo.LICENSE, supports: Saldo.supports, lookup: Saldo.lookup },
  { name: Lexemes.NAME, license: Lexemes.LICENSE, supports: () => true, lookup: Lexemes.lookup },
];
export const sourcesOf = (lang) => SOURCES.filter((s) => s.supports(lang));

/* What the free dictionaries have on a word → { found: [{ name, license, url, articles }], checked: [names] }:
   `checked` names every dictionary that answered, with the word or without it, so the page can say where it is
   missing; one that is slow or down is left out of both, never the others. opts: { signal, budget } */
export async function search(cache, lang, word, opts = {}) {
  const got = await Promise.all(sourcesOf(lang).map(async (s) => {
    try {
      const r = await s.lookup(cache, lang, word, opts);
      return { name: s.name, hit: r?.articles?.length ? { name: s.name, license: s.license, url: r.url, articles: r.articles } : null };
    } catch {
      return null;
    }
  }));
  const answered = got.filter(Boolean);
  return { found: answered.map((x) => x.hit).filter(Boolean), checked: answered.map((x) => x.name) };
}
// only what they have → [{ name, license, url, articles }]
export const lookup = async (cache, lang, word, opts = {}) => (await search(cache, lang, word, opts)).found;

// what the page shows of an article: not the lists the checks use
export const shown = (list) => list.map((d) => ({ ...d, articles: d.articles.map(({ lemma, cls, pron, table, senses, etym }) => ({ lemma, cls, pron, table, senses, etym })) }));

/* A short summary for the AI entry, after Wiktionary's */
export function summary(list) {
  const out = list.map((d) => {
    const lines = d.articles.slice(0, 2).map((a) => {
      const l = [`• ${a.lemma}${a.cls ? ` (${a.cls})` : ''}${a.pron ? ' ' + a.pron : ''}`];
      if (a.table) l.push('  Forms: ' + a.table.rows.slice(0, 16).map(([k, f]) => `${k}: ${f}`).join('; '));
      a.senses.slice(0, 4).forEach((s, i) => l.push(`  ${i + 1}) ${s.expl.join('; ')}`));
      return l.join('\n');
    });
    return `${d.name} (${d.license}):\n${lines.join('\n')}`;
  });
  return out.join('\n').slice(0, 2000);
}

/* For checking a card: the genders and forms these dictionaries know for a noun or verb → { genders: Set, forms: Set }
   or null when none of them has it */
export async function entry(cache, lang, word, pos, opts = {}) {
  const genders = new Set(), forms = new Set();
  let found = false;
  for (const d of await lookup(cache, lang, word, opts)) {
    for (const a of d.articles) {
      if (a.cat !== pos) continue;
      found = true;
      a.genders.forEach((g) => genders.add(g));
      a.forms.forEach((f) => forms.add(plain(f, lang)));
    }
  }
  return found ? { genders, forms } : null;
}
