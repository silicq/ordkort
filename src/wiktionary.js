/* Wiktionary (en.wiktionary.org) as ground truth for the languages without an official dictionary here:
   the gender of a noun and the real forms of a noun or verb. Only the server asks Wikimedia's API (with a
   User-Agent, as their rules ask) and keeps what it learnt in the shared cache, so a word is looked up once
   for everybody and Wikimedia never sees a visitor.

   On every page the headword line is drawn by the same code for all languages: the word, then its gender
   (<span class="gender"><abbr title="masculine gender">m</abbr>), then key forms in <b lang="…">.
   Forms in inflection tables carry the class "form-of … origin-<word>". Only that shared markup is read. */
import { App } from './shared.js';

const API = 'https://en.wiktionary.org/w/api.php';
const UA = 'Ordkort/1.0 (https://ordkort.com; https://github.com/silicq/ordkort) language-learning flashcards';

// Wiktionary's language codes where they differ from ours
const WIKT_LANG = { sr: 'sh', hr: 'sh', bs: 'sh', prs: 'fa' };
// languages whose words hardly inflect: nothing to check there
const SKIP = ['zh', 'ja', 'th', 'vi', 'ms', 'id', 'tl', 'nb', 'nn']; // Norwegian has the official dictionary
const POS_HEADING = { noun: /^(Noun|Proper_noun)(_\d+)?$/, verb: /^Verb(_\d+)?$/ };
const GENDER = { 'masculine gender': 'm', 'feminine gender': 'f', 'neuter gender': 'n', 'common gender': 'c' };
const MONTH = 30 * 864e5;

const text = (html) => html.replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/[*^]+$/, '').trim(); // "домы^*" — a note mark, not part of the word

// Wiktionary writes marks that ordinary spelling leaves out: stress in Russian (до́ма), tones in Serbo-Croatian
// (kȕća), vowel signs in Arabic (بَيْت). Only those go before comparing — an umlaut or an accent is spelling
// ("Hünde" is not "Hunde"), and so is a mark on a consonant (ć). Case never counts.
const VOWEL_MARKS = {
  ru: /[̀́]/, uk: /[̀́]/, be: /[̀́]/, bg: /[̀́]/,
  sr: /[̀-̄̏̑]/, hr: /[̀-̄̏̑]/, bs: /[̀-̄̏̑]/, sl: /[̀-̄̏̑]/,
  lt: /[̀́̃]/, la: /[̄̆]/,
};
const SIGNS = { ar: /[ً-ٰٟ]/gu, fa: /[ً-ٰٟ]/gu, prs: /[ً-ٰٟ]/gu, ur: /[ً-ٰٟ]/gu, he: /[֑-ׇ]/gu };
export function plain(s, lang = '') {
  let x = String(s || '').normalize('NFD').replace(/\p{Cf}/gu, '');
  const marks = VOWEL_MARKS[lang];
  if (marks) x = x.replace(new RegExp(`([aeiouyrаеёиоуыэюяіїєѣ])(?:${marks.source})+`, 'giu'), '$1');
  if (SIGNS[lang]) x = x.replace(SIGNS[lang], '');
  x = x.normalize('NFC').toLowerCase().trim();
  return lang === 'ru' || lang === 'be' ? x.replace(/ё/g, 'е') : x;
}

export const supports = (lang) => App.langs.has(lang) && !SKIP.includes(lang);

/* From the HTML of a page: what it says about `word` in `lang` as a noun or verb →
   { genders: Set of 'm' | 'f' | 'n' | 'c', forms: Set of plain forms } or null if the page has no such entry. */
export function parsePage(html, lang, word, pos) {
  const code = WIKT_LANG[lang] || lang;
  const want = plain(word, lang);
  const headings = [...html.matchAll(/<h[3-6] id="([^"]+)"/g)].map((m) => ({ at: m.index, id: m[1] }));
  const genders = new Set(), forms = new Set();
  let found = false;
  const line = new RegExp(`<span class="headword-line"><strong class="[^"]*headword[^"]*" lang="${code}"[^>]*>([\\s\\S]*?)</strong>([\\s\\S]*?)</p>`, 'g');
  for (const m of html.matchAll(line)) {
    if (plain(text(m[1]), lang) !== want) continue;
    const heading = headings.filter((h) => h.at < m.index).pop();
    if (!heading || !POS_HEADING[pos].test(heading.id)) continue;
    found = true;
    const rest = m[2];
    // the word's own gender is the first gender mark, before any of its forms ("Hündchen n" is the diminutive's)
    const g = /<span class="gender">([\s\S]*?)<\/span>/.exec(rest);
    const firstForm = rest.search(/<b /);
    if (g && (firstForm < 0 || g.index < firstForm)) {
      for (const a of g[1].matchAll(/<abbr title="([^"]+)">/g)) if (GENDER[a[1]]) genders.add(GENDER[a[1]]);
    }
    for (const f of rest.matchAll(new RegExp(`<b class="[^"]*" lang="${code}"[^>]*>([\\s\\S]*?)</b>`, 'g'))) forms.add(plain(text(f[1]), lang));
  }
  if (!found) return null;
  const table = new RegExp(`<span class="[^"]*form-of[^"]*origin-([^"\\s]+)[^"]*" lang="${code}"[^>]*>([\\s\\S]*?)</span>`, 'g');
  for (const m of html.matchAll(table)) if (plain(m[1].replace(/_/g, ' '), lang) === want) forms.add(plain(text(m[2]), lang));
  forms.add(want);
  forms.delete('');
  return { genders, forms };
}

/* A word's entry for one language and part of speech — from the shared cache, or one request to Wikimedia.
   cache: { get(key, maxAge), set(key, value) }; budget: { left } requests allowed (a Worker may make only 50). */
export async function entry(cache, lang, word, pos, { signal, budget } = {}) {
  const key = `wk2:${lang}:${pos}:${plain(word, lang)}`;
  const hit = await cache.get(key, MONTH);
  if (hit) return hit.none ? null : { genders: new Set(hit.g), forms: new Set(hit.f) };
  if (budget && budget.left-- <= 0) throw new Error('wiktionary budget');
  const url = `${API}?action=parse&format=json&formatversion=2&prop=text&redirects=1&page=${encodeURIComponent(word)}`;
  const r = await fetch(url, { signal, headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (!r.ok) throw new Error('wiktionary ' + r.status);
  const data = await r.json();
  const e = data.parse?.text ? parsePage(data.parse.text, lang, word, pos) : null; // no such page at all
  await cache.set(key, e ? { g: [...e.genders], f: [...e.forms] } : { none: 1 });
  return e;
}

/* ---------- checking a card ---------- */

// the article for a gender (Italian and French elide it before a vowel, see articleFor)
const ARTICLE = {
  de: { m: 'der', f: 'die', n: 'das' },
  sv: { c: 'en', m: 'en', f: 'en', n: 'ett' },
  da: { c: 'en', m: 'en', f: 'en', n: 'et' },
  nl: { c: 'de', m: 'de', f: 'de', n: 'het' },
  fr: { m: 'le', f: 'la' },
  es: { m: 'el', f: 'la' },
  it: { m: 'il', f: 'la' },
  pt: { m: 'o', f: 'a' },
  el: { m: 'ο', f: 'η', n: 'το' },
};
const VOWEL = /^[aeiouàâäéèêëíìîïóòôöúùûüœæ]/i;
function articleFor(lang, g, lemma) {
  if ((lang === 'fr' || lang === 'it') && VOWEL.test(lemma)) return 'l’';
  if (lang === 'it' && g === 'm' && /^(s[^aeiou]|z|gn|ps|pn|x|y|i[aeiou])/i.test(lemma)) return 'lo';
  return ARTICLE[lang]?.[g] || '';
}
// does the article's gender agree with what Wiktionary knows? A common-gender article fits masculine and
// feminine; Spanish feminine nouns that start with a stressed a take "el": "el agua"
function fits(lang, want, genders, lemma) {
  if (genders.has(want)) return true;
  if (want === 'c' && (genders.has('m') || genders.has('f'))) return true;
  if ((want === 'm' || want === 'f') && genders.has('c')) return true;
  return lang === 'es' && want === 'm' && genders.has('f') && /^h?[aá]/i.test(lemma);
}

/* Checks a noun or verb card: a noun's article must fit its gender ("die Hund" → "der Hund"); a noun in a
   language without articles (or with an elided one, "l’école") gets its gender `g` from Wiktionary; and forms
   Wiktionary has never heard of are dropped — only when it knows the word's forms well and at least one of the
   card's forms, so a gap in its tables never wipes a card. → { term, forms, g } (unchanged when all is right)
   or null when Wiktionary cannot tell (no entry, a phrase, a language that hardly inflects). */
export async function check(cache, lang, { term, pos, forms }, opts) {
  if (!supports(lang) || (pos !== 'noun' && pos !== 'verb')) return null;
  const t = String(term || '').trim();
  const want = pos === 'noun' ? App.langs.articleGender(lang, t) : '';
  const elided = pos === 'noun' && (lang === 'fr' || lang === 'it') && /^l['’]/i.test(t);
  const lemma = want ? t.split(/\s+/).slice(1).join(' ')
    : elided ? t.replace(/^l['’]\s*/i, '')
      : pos === 'verb' ? t.replace(/^(to|att|at)\s+/i, '') : t;
  if (!lemma) return null;
  const e = await entry(cache, lang, lemma, pos, opts);
  if (!e) return null;

  let out = t, g = '';
  const known = [...e.genders];
  if (want && known.length) {
    const ok = fits(lang, want, e.genders, lemma);
    const gender = ok ? want : ['m', 'f', 'n', 'c'].find((x) => e.genders.has(x) && articleFor(lang, x, lemma));
    // a wrong article is replaced; in French and Italian the right one also depends on the sound: "lo zio",
    // "l’école" (Spanish "el agua" is right as it is)
    const art = gender && (!ok || lang === 'fr' || lang === 'it') ? articleFor(lang, gender, lemma) : '';
    if (art) out = art.endsWith('’') ? art + lemma : `${art} ${lemma}`;
    if (gender && !App.langs.articleGender(lang, out)) g = gender; // "l’école" does not show its gender
  } else if (pos === 'noun' && known.length === 1) {
    g = known[0]; // a language without articles, or an elided one
  }

  let kept = String(forms || '').split(/\s*,\s*/).filter(Boolean);
  if (e.forms.size >= 5 && kept.length) {
    // a form counts if Wiktionary has it, or any of its words: "des Hundes", "hat gesehen"
    const ok = (f) => [f, ...f.split(/\s+/)].some((x) => e.forms.has(plain(x, lang)));
    const good = kept.map((f) => f.split('/').map((x) => x.trim()).filter(ok).join('/')).filter(Boolean);
    if (good.length) kept = good;
  }
  return { term: out, forms: kept.join(', '), g };
}
