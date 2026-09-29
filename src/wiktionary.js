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

/* The HTML of a page, or '' when there is no such page. budget: { left } requests allowed (a Worker may make only 50). */
async function page(word, { signal, budget } = {}) {
  if (budget && budget.left-- <= 0) throw new Error('wiktionary budget');
  const url = `${API}?action=parse&format=json&formatversion=2&prop=text&redirects=1&page=${encodeURIComponent(word)}`;
  const r = await fetch(url, { signal, headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (!r.ok) throw new Error('wiktionary ' + r.status);
  const data = await r.json();
  return data.parse?.text || '';
}

/* A word's entry for one language and part of speech — from the shared cache, or one request to Wikimedia.
   cache: { get(key, maxAge), set(key, value) }. */
export async function entry(cache, lang, word, pos, opts) {
  const key = `wk2:${lang}:${pos}:${plain(word, lang)}`;
  const hit = await cache.get(key, MONTH);
  if (hit) return hit.none ? null : { genders: new Set(hit.g), forms: new Set(hit.f) };
  const html = await page(word, opts);
  const e = html ? parsePage(html, lang, word, pos) : null;
  await cache.set(key, e ? { g: [...e.genders], f: [...e.forms] } : { none: 1 });
  return e;
}

/* ---------- the entry shown in the dictionary next to the AI one ---------- */

/* For every language without an official dictionary here the dictionary page shows what Wiktionary says:
   each part of speech with its gender and key forms from the headword line, the pronunciation, the senses
   with their short usage examples (not the long quotations) and the origin. Everything is in English, the
   language of en.wiktionary.org. The same data grounds the AI entry, as ordbokene.no does for Norwegian. */
export const hasEntries = (lang) => App.langs.has(lang) && !App.ordbok.supports(lang);

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#'
  ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
  : ENTITIES[e.toLowerCase()] ?? m));
// readable text of a piece of HTML: no readings over characters, footnote marks or Mandarin/Cantonese marks
export const clean = (html) => decode(String(html || '')
  .replace(/<(rp|rt|sup|style)\b[\s\S]*?<\/\1>/g, '')
  .replace(/<span style="border-bottom[^"]*"[^>]*title="[^"]*"><i>[^<]*<\/i><\/span>/g, '')
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ').replace(/\s+([,;:.!?)\]])/g, '$1').replace(/([([])\s+/g, '$1').replace(/;(\s*;)+/g, ';').trim();

// the element that opens at `at` with <tag …>, up to its own closing tag
function block(html, at, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = at;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (!depth) return html.slice(at, m.index + m[0].length);
  }
  return html.slice(at);
}
// the inner HTML of the direct <li> children of a list
function items(list) {
  const inner = list.replace(/^<[ou]l\b[^>]*>/, '');
  const out = [];
  const re = /<li\b[^>]*>/g;
  let m;
  while ((m = re.exec(inner))) {
    const li = block(inner, m.index, 'li');
    out.push(li.slice(m[0].length).replace(/<\/li>$/, ''));
    re.lastIndex = m.index + li.length;
  }
  return out;
}

// the Chinese entry covers every variety; a sense labelled only for another one than Mandarin is left out
const OTHER_CHINESE = /^\((?![^)]*Mandarin)[^)]*\b(Cantonese|Hokkien|Min|Hakka|Wu|Teochew|Shanghainese|Xiang|Gan|Jin)\b[^)]*\)/;

// one sense: its gloss, its short usage examples ({ text, tr }) and its sub-senses; `keep` picks the senses to show
function sense(li, keep, depth = 0) {
  const nested = li.search(/<ol\b/);
  const own = nested >= 0 ? li.slice(0, nested) : li;
  const cut = own.search(/<(ul|dl|ol|div)\b/);
  const ex = [];
  for (const m of own.matchAll(/<span class="h-usage-example">/g)) {
    const u = block(own, m.index, 'span');
    const e = /<(i|span) class="[^"]*\be-example\b[^"]*"[^>]*>/.exec(u);
    const t = /<span class="e-translation">/.exec(u);
    const text = e ? clean(block(u, e.index, e[1])) : '';
    if (text) ex.push({ text, tr: t ? clean(block(u, t.index, 'span')) : '' });
    if (ex.length === 2) break;
  }
  return {
    expl: [clean(cut >= 0 ? own.slice(0, cut) : own)].filter(Boolean),
    ex,
    sub: nested >= 0 && !depth ? items(block(li, nested, 'ol')).map((x) => sense(x, keep, 1)).filter(keep).slice(0, 4) : [],
  };
}

const lastBefore = (list, at) => list.filter((x) => x.at < at).pop();

// the headword line after the word: its gender, tags such as "strong" or "transitive", and key forms by label
function headwordLine(rest, code) {
  const g = /<span class="gender">([\s\S]*?)<\/span>/.exec(rest);
  const firstForm = rest.search(/<b /);
  const gender = g && (firstForm < 0 || g.index < firstForm)
    ? [...g[1].matchAll(/<abbr title="([^"]+)">/g)].map((a) => a[1].replace(/ gender$/, '')) : [];
  const rows = [];
  let row = null;
  const re = new RegExp(`<i>([\\s\\S]*?)</i>|<b class="[^"]*" lang="${code}"[^>]*>([\\s\\S]*?)</b>`, 'g');
  for (const m of rest.matchAll(re)) {
    if (m[1] !== undefined) {
      const label = clean(m[1]);
      if (label && label !== 'or') rows.push((row = { label, forms: [] }));
    } else {
      const f = clean(m[2]);
      if (!f) continue;
      if (!row) rows.push((row = { label: '', forms: [] }));
      if (row.forms.length < 3) row.forms.push(f);
    }
  }
  const tr = /<span [^>]*class="headword-tr[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(rest);
  return {
    gender,
    tags: rows.filter((r) => !r.forms.length).map((r) => r.label),
    forms: rows.filter((r) => r.forms.length).slice(0, 6).map((r) => [r.label, r.forms.join(' / ')]),
    translit: tr ? clean(tr[1]) : '',
  };
}

// pronunciation near the headword: pinyin for Chinese, the kana over the characters for Japanese, else IPA
function pronOf(html, from, to, code, strong) {
  const part = html.slice(from, to);
  if (code === 'zh') {
    const p = /<span class="[^"]*\bpinyin-t?s?-form-of\b[^"]*"[^>]*>/.exec(part);
    if (!p) return '';
    const spans = [...block(part, p.index, 'span').matchAll(/<span class="Latn" lang="cmn">([\s\S]*?)<\/span>/g)];
    return spans.filter((s) => !/<sup/.test(s[1])).map((s) => clean(s[1])).join(', ');
  }
  if (code === 'ja' && /<rt>/.test(strong)) return clean(strong.replace(/<ruby>[\s\S]*?<rt>([\s\S]*?)<\/rt>[\s\S]*?<\/ruby>/g, '$1'));
  const ipa = /<span class="IPA[^"]*">([\s\S]*?)<\/span>/.exec(part);
  return ipa ? clean(ipa[1]) : '';
}

/* The entry of `lang` on a page → { section, articles } (none when the page has nothing in this language), or
   { see } when a simplified Chinese character sends to its traditional page for the definitions. */
export function article(html, lang) {
  const code = WIKT_LANG[lang] || lang;
  const h2s = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => ({ at: m.index, id: m[1] }));
  const heads = [...html.matchAll(/<h[3-6] id="([^"]+)"/g)].map((m) => ({ at: m.index, id: m[1] }));
  const line = new RegExp(`<span class="headword-line"><strong class="[^"]*headword[^"]*" lang="${code}"[^>]*>([\\s\\S]*?)</strong>([\\s\\S]*?)</p>`, 'g');
  const articles = [];
  let section = ''; // the language's heading on the page, for a link straight to it
  for (const m of html.matchAll(line)) {
    const sec = lastBefore(h2s, m.index);
    const secStart = sec ? sec.at : 0;
    const pos = lastBefore(heads, m.index);
    if (!pos || pos.at < secStart) continue;
    const kind = pos.id.replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase().replace(/^definitions$/, ''); // a Chinese character
    const hw = headwordLine(m[2], code);

    // the senses: the list right after the headword line
    const after = m.index + m[0].length;
    const ol = html.slice(after, after + 400).search(/<ol\b/);
    const keep = (s) => s.expl.length > 0 && !(code === 'zh' && OTHER_CHINESE.test(s.expl[0]));
    const senses = ol >= 0 ? items(block(html, after + ol, 'ol')).map((li) => sense(li, keep)).filter(keep).slice(0, 8) : [];
    if (!senses.length) continue;

    const byKind = (re) => heads.filter((x) => x.at >= secStart && re.test(x.id));
    const pr = lastBefore(byKind(/^Pronunciation/), m.index);
    const ety = lastBefore(byKind(/^Etymology/), m.index);
    let etym = '';
    if (ety) {
      const p = /<p>([\s\S]*?)<\/p>/.exec(html.slice(ety.at, pos.at));
      etym = p ? clean(p[1]).replace(/^See the etymology of the (corresponding )?(lemma|main) (form|entry)\.?$/i, '') : '';
      if (etym.length > 300) etym = etym.slice(0, 300).replace(/\s+\S*$/, '') + ' …';
    }
    section ||= sec?.id || '';
    articles.push({
      lemma: clean(m[1]),
      cls: [kind, ...hw.gender, ...hw.tags].filter(Boolean).join(', '),
      pron: [pronOf(html, pr ? pr.at : secStart, m.index, code, m[1]), code === 'ja' ? hw.translit : ''].filter(Boolean).join(' · ') || hw.translit,
      table: hw.forms.length ? { headers: null, rows: hw.forms } : null,
      senses,
      etym,
    });
    if (articles.length === 4) break;
  }
  if (!articles.length && code === 'zh') {
    const see = /<table class="wikitable zh-see[\s\S]*?<span class="Hant" lang="zh">([\s\S]*?)<\/span>/.exec(html);
    if (see) return { see: clean(see[1]), articles };
  }
  return { section, articles };
}

/* What Wiktionary has on a word in `lang` → { page, section, articles } or null — from the shared cache, or a request or
   two: the word as typed, then with the first letter's case changed ("hund" → "Hund"), and for a simplified
   Chinese character the traditional page it points to. */
export async function lookup(cache, lang, word, opts = {}) {
  const key = `wk3:${lang}:${plain(word, lang)}`;
  const hit = await cache.get(key, MONTH);
  if (hit) return hit.none ? null : hit;
  const first = word[0], flipped = first === first.toLowerCase() ? first.toUpperCase() : first.toLowerCase();
  const tries = [word, flipped === first ? '' : flipped + word.slice(1)].filter(Boolean);
  let out = null;
  for (let i = 0; i < tries.length && !out; i++) {
    const html = await page(tries[i], opts);
    const e = html ? article(html, lang) : null;
    if (e?.see) {
      const trad = await page(e.see, opts);
      const t = trad ? article(trad, lang) : null;
      if (t?.articles.length) out = { page: e.see, section: t.section, articles: t.articles };
    } else if (e?.articles.length) out = { page: tries[i], section: e.section, articles: e.articles };
  }
  await cache.set(key, out || { none: 1 });
  return out;
}

/* A short summary — ground for the AI entry, so that the gender, forms and meanings are Wiktionary's */
export function summary(r) {
  if (!r?.articles?.length) return '';
  const out = r.articles.slice(0, 3).map((a) => {
    const lines = [`• ${a.lemma}${a.cls ? ` (${a.cls})` : ''}${a.pron ? ' ' + a.pron : ''}`];
    if (a.table) lines.push('  Forms: ' + a.table.rows.map(([l, f]) => (l ? `${l}: ${f}` : f)).join('; '));
    a.senses.slice(0, 6).forEach((s, i) => {
      const ex = s.ex.map((x) => `"${x.text}"${x.tr ? ` (${x.tr})` : ''}`).join(', ');
      const sub = s.sub.map((x) => x.expl.join('; ')).join('; ');
      lines.push(`  ${i + 1}) ${s.expl.join('; ')}${sub ? ` (${sub})` : ''}${ex ? ' — e.g. ' + ex : ''}`);
    });
    return lines.join('\n');
  });
  return `Wiktionary (en.wiktionary.org, glosses in English):\n${out.join('\n')}`.slice(0, 2600);
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
