// Static pages for search engines: everything a crawler can read without JavaScript.
//   /<ui>/                          the pages about the site (scripts/landing.mjs)
//   /<ui>/<learn>/                  Norwegian word lists by topic, and one page per topic
//   /<ui>/ordbok/nb/                the most common Norwegian words from A to Å, and one page per word
//   /<ui>/<learn>/flashcards/       straight into practising a topic, for "Norwegian flashcards" (scripts/flashcards-text.mjs)
//   /<ui>/about/ (in its language)  who makes Ordkort and where the words come from (scripts/about-text.mjs)
//   /sitemap.xml                    an index of sitemaps by section and language, every page with its translations
// The content comes from data/seo/ (see data/seo/README.md); the words around it from scripts/seo-text.mjs.
// A page is published only with at least MIN_WORDS words of its own content, so no thin pages reach the index.
// Run `npm run seo` after changing any of them and commit the result (a test checks that the files are up to date).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Landing from './landing.mjs';
import { UI, UIS, LEARN, slug, translit } from './seo-text.mjs';
import { TEACH } from './teachers-text.mjs';
import { ABOUT } from './about-text.mjs';
import { FLASH } from './flashcards-text.mjs';
import '../public/js/topics.js';
import '../public/js/i18n/en.js';
import '../public/js/i18n/ru.js';
import '../public/js/i18n/uk.js';
import '../public/js/i18n/nb.js';
import '../public/js/i18n/ar.js';

export const SITE = 'https://ordkort.com';
export const MIN_WORDS = 150;
export const SITEMAP_LIMIT = 5000;
const App = globalThis.App;
const DATA = new URL('../data/seo/', import.meta.url);
const PUBLIC = new URL('../public/', import.meta.url);
const json = (name) => JSON.parse(readFileSync(new URL(name, DATA), 'utf8'));
const dir = (name) => (existsSync(new URL(name, DATA)) ? readdirSync(new URL(name, DATA)).filter((f) => f.endsWith('.json')).sort() : []);
export const t = (ui, key) => App.i18nData[ui]?.[key] ?? UI[ui].names?.[key]; // Polish has no app interface of its own: its names are in seo-text.mjs
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const collator = new Intl.Collator('nb');

/* ---------- data ---------- */

const FREQ = readFileSync(new URL('nb-frequent.txt', DATA), 'utf8').split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l, rank) => { const [w, pos] = l.trim().split(/\s+/); return { w, pos, rank }; });
const ORDBOK = json('ordbok-nb.json');
const DICT = new Map(dir('dict').flatMap((f) => json('dict/' + f)).map((e) => [e.w, e]));
const TOPICS = new Map(dir('topics').flatMap((f) => [json('topics/' + f)].flat()).map((d) => [d.id, d])); // one file per group of topics
// when each kind of page last changed (data/seo/README.md): shown on the pages, in their schema and in the sitemap
const UPDATED = json('checked.json');

/* ---------- Bokmålsordboka: the article, its forms ---------- */

const WC = {
  noun: ['NOUN'], verb: ['VERB'], adjective: ['ADJ'], adverb: ['ADV', 'ADJ'], preposition: ['ADP'], pronoun: ['PRON', 'DET'],
  determiner: ['DET', 'ADJ', 'PRON'], conjunction: ['CCONJ', 'SCONJ'], numeral: ['DET', 'NUM'], interjection: ['INTJ'], particle: ['SCONJ', 'INFM'],
};
const ART = { Masc: 'en', Fem: 'ei', Neuter: 'et' };
const GENDER_OF = { en: 'Masc', ei: 'Fem', et: 'Neuter' };
const lemmaOf = (term) => term.replace(/^(en|ei|et|å)\s+/i, '').trim();

// Words spelt alike ("hete" to be called, "hete" to heat): which article, by its id, is the one these pages mean.
// "lemma pos" → ids; with two ids the page shows the senses of both and the forms of the first.
const HOMOGRAPHS = json('homographs.json');
const candidates = (lemma, pos, gender) => {
  const arts = (ORDBOK[lemma] || []).filter((a) => WC[pos]?.includes(a.wc));
  const byGender = gender ? arts.filter((a) => a.g.includes(gender)) : [];
  return byGender.length ? byGender : arts;
};
// the article of this word with this word class (and, for a noun, this gender)
function article(lemma, pos, gender) {
  const ids = HOMOGRAPHS[`${lemma} ${pos}`];
  if (ids) {
    const chosen = ids.map((id) => (ORDBOK[lemma] || []).find((a) => a.id === id)).filter(Boolean);
    if (chosen.length) {
      return { ...chosen[0], senses: chosen.flatMap((a) => a.senses), expr: chosen.flatMap((a) => a.expr), compounds: [...new Set(chosen.flatMap((a) => a.compounds))] };
    }
  }
  return candidates(lemma, pos, gender)[0] || null;
}
// words with more than one possible article and no choice in homographs.json: a test keeps this empty
export function unresolvedHomographs() {
  const out = new Set();
  const check = (term, pos) => {
    const lemma = lemmaOf(term);
    const given = /^(en|ei|et)\s/.exec(term)?.[1];
    if (!HOMOGRAPHS[`${lemma} ${pos}`] && candidates(lemma, pos, GENDER_OF[given]).length > 1) out.add(`${lemma} ${pos}`);
  };
  for (const f of FREQ) check(f.w, f.pos);
  for (const d of TOPICS.values()) for (const x of d.words) check(x.nb, x.pos);
  return [...out];
}
// of two correct forms, the one textbooks teach first leads: "husene" before "husa", "snakket" before "snakka"
const taught = (x) => /(ene|et)$/.test(x);
const lead = (list) => [...list.filter(taught), ...list.filter((x) => !taught(x))];
const get = (a, ...keys) => { for (const k of keys) if (a.forms[k]?.length) return lead(a.forms[k]).join(' / '); return ''; };
const articleOf = (a) => a.g.map((g) => ART[g]).join('/');
// words used in the plural (klær, penger): no article, no singular column
const plural = (a, lemma) => a?.wc === 'NOUN' && !a.forms['Sing+Ind'] || (a?.forms['Plur+Ind']?.includes(lemma) && !a.forms['Sing+Ind']?.includes(lemma));

function formsTable(ui, a, lemma) {
  if (!a) return null;
  const L = UI[ui].table;
  if (a.wc === 'NOUN' && plural(a, lemma)) {
    return { headers: ['', L.pl], rows: [[L.ind, get(a, 'Plur+Ind') || lemma], [L.def, get(a, 'Plur+Def')]].filter((r) => r[1]) };
  }
  if (a.wc === 'NOUN') {
    return { headers: ['', L.sg, L.pl], rows: [[L.ind, `${articleOf(a)} ${get(a, 'Sing+Ind') || lemma}`.trim(), get(a, 'Plur+Ind')], [L.def, get(a, 'Sing+Def'), get(a, 'Plur+Def')]] };
  }
  const rows = a.wc === 'VERB'
    ? [[L.inf, get(a, 'Inf') && `å ${get(a, 'Inf')}`], [L.pres, get(a, 'Pres')], [L.past, get(a, 'Past')],
      [L.perf, get(a, '<PerfPart>') && `har ${get(a, '<PerfPart>')}`], [L.imp, get(a, 'Imp') && `${get(a, 'Imp')}!`], [L.pass, get(a, 'Inf+Pass')]]
    : a.wc === 'ADJ'
      ? [[L.mf, get(a, 'Pos+Masc/Fem+Ind+Sing', 'Pos+Masc/Fem')], [L.n, get(a, 'Pos+Neuter+Ind+Sing', 'Pos+Neuter')], [L.defsg, get(a, 'Pos+Def+Sing')],
        [L.plur, get(a, 'Pos+Plur')], [L.cmp, get(a, 'Cmp')], [L.sup, get(a, 'Sup+Ind')], [L.supdef, get(a, 'Sup+Def')]]
      : (() => { const all = [...new Set(Object.values(a.forms).flat())]; return all.length > 1 ? [[L.forms, all.join(', ')]] : []; })();
  const kept = rows.filter((r) => r[1]);
  return kept.length ? { headers: null, rows: kept } : null;
}

// the few forms a flashcard shows: "huset, hus, husene", "er, var, har vært", "stort, store, større, størst"
export function keyForms(a, lemma) {
  if (!a) return '';
  const first = (...k) => get(a, ...k).split(' / ')[0];
  const list = a.wc === 'NOUN' ? (plural(a, lemma) ? [first('Plur+Def')] : [first('Sing+Def'), first('Plur+Ind'), first('Plur+Def')])
    : a.wc === 'VERB' ? [first('Pres'), first('Past'), first('<PerfPart>') && `har ${first('<PerfPart>')}`]
      : a.wc === 'ADJ' ? [first('Pos+Neuter+Ind+Sing', 'Pos+Neuter'), first('Pos+Plur'), first('Cmp'), first('Sup+Ind')]
        : [];
  return list.filter(Boolean).join(', ');
}

// the same forms with their names, for an English description: "Definite: huset; plural: hus, husene"
export function namedForms(a, lemma) {
  if (!a) return '';
  const first = (...k) => get(a, ...k).split(' / ')[0];
  const parts = a.wc === 'NOUN'
    ? (plural(a, lemma) ? [['Definite', first('Plur+Def')]] : [['Definite', first('Sing+Def')], ['plural', [first('Plur+Ind'), first('Plur+Def')].filter(Boolean).join(', ')]])
    : a.wc === 'VERB' ? [['Present', first('Pres')], ['past', first('Past')], ['perfect', first('<PerfPart>') && `har ${first('<PerfPart>')}`]]
      : a.wc === 'ADJ' ? [['Neuter', first('Pos+Neuter+Ind+Sing', 'Pos+Neuter')], ['plural', first('Pos+Plur')], ['comparative', first('Cmp')], ['superlative', first('Sup+Ind')]]
        : [];
  const kept = parts.filter(([, f]) => f);
  if (!kept.length) return '';
  kept[0][0] = kept[0][0][0].toUpperCase() + kept[0][0].slice(1);
  return kept.map(([n, f]) => `${n}: ${f}`).join('; ');
}

// headword as a learner sees it: "et hus", "å være", "stor"
function headword(lemma, pos, a) {
  if (pos === 'noun' && a?.g.length && !plural(a, lemma)) return `${articleOf(a)} ${lemma}`;
  if (pos === 'verb') return `å ${lemma}`;
  return lemma;
}

// ordbokene writes some abbreviations as item ids ("e_l", "f_eks"): spelled out
const ABBR = {
  e_l: 'eller lignende', o_l: 'og lignende', f_eks: 'for eksempel', sm_o_s: 'samme ord som', t_forsk_f: 'til forskjell fra', t_forskj_fra: 'til forskjell fra',
  sms_er: 'sammensetninger', fork_ing: 'forkorting', s_adv: 'som adverb', s_adj: 'som adjektiv', pf_pt: 'perfektum partisipp', o_a: 'og annet',
  i_astron: 'i astronomi', i_zool: 'i zoologi', i_bot: 'i botanikk', i_dial: 'i dialekter', i_idr: 'i idrett', i_bibl: 'i Bibelen', i_rel: 'i religion',
  i_gramm: 'i grammatikk', i_med: 'i medisin', saerl: 'særlig', besl: 'beslektet med', trol: 'trolig', mots: 'motsatt', jf: 'jf.', el: 'eller', osv: 'osv.',
};
const clean = (s) => String(s || '').replace(/(?<![\p{L}])([\p{L}]+(?:_[\p{L}]+)*)(?![\p{L}])/gu, (m) => ABBR[m] ?? m.replace(/_/g, ' '));

/* ---------- pages and their addresses ---------- */

export const topicsHubPath = (ui) => `/${ui}/${UI[ui].learn}/`;
// the topic's name in the address, transliterated, or romanized by hand where a script has no ASCII form (Arabic)
export const topicPath = (ui, id) => `/${ui}/${UI[ui].learn}/${UI[ui].slugs?.[id] ?? slug(translit(t(ui, 'topic.' + id), ui))}/`;
const dictHubPath = (ui) => `/${ui}/ordbok/${LEARN}/`;
const wordPath = (ui, w) => `/${ui}/ordbok/${LEARN}/${slug(w)}/`;
// the Anki decks of the topics, made by scripts/anki-decks.mjs: one per topic, and one with them all
export const deckPath = (ui, id) => `/anki/ordkort-norsk-${ui}${id ? '-' + id : ''}.apkg`;
const abs = (p) => SITE + p;
// into the app with the language pair of the page: the first-run setup starts from it (public/js/views/onboarding.js)
const invite = (ui) => (ui === LEARN ? `learn=${LEARN}` : `from=${ui}&amp;learn=${LEARN}`);
const lang = (ui) => Landing.PAGES[ui];
// where each language's translation stands in an example: [nb, en, ru, uk, pl, ar]
const EX = { en: 1, ru: 2, uk: 3, pl: 4, ar: 5 };
// a link to the dictionary, if this interface language has one (Polish does not yet)
const dictA = (ui, label) => (UI[ui].noDict ? '' : `<a href="${dictHubPath(ui)}">${esc(label)}</a>`);

// topic word lists: the hand-made, checked words only, the same in every language (the AI words of the
// shared bank stay in the app: unchecked, they would put a wrong form or an unnatural sentence in front of a search)
export function topicWords(ui, id) {
  return TOPICS.get(id).words.map((x) => {
    const lemma = lemmaOf(x.nb);
    const given = /^(en|ei|et)\s/.exec(x.nb)?.[1];
    const a = article(lemma, x.pos, GENDER_OF[given]);
    // the article Bokmålsordboka gives the noun wins over the one in the seed
    const term = given && x.pos === 'noun' && a?.g.length && !a.g.includes(GENDER_OF[given]) ? `${ART[a.g[0]]} ${lemma}` : x.nb;
    return { term, lemma, pos: x.pos, a, tr: ui === 'nb' ? '' : x[ui], ex: x.ex[0], exTr: ui === 'nb' ? '' : x.ex[EX[ui]] };
  });
}

// which topics a dictionary word appears in
const TOPICS_OF = new Map();
for (const [id, d] of TOPICS) for (const x of d.words) {
  const l = lemmaOf(x.nb);
  if (!TOPICS_OF.has(l)) TOPICS_OF.set(l, []);
  if (!TOPICS_OF.get(l).includes(id)) TOPICS_OF.get(l).push(id);
}
const RANK = new Map(FREQ.map((f) => [f.w, f]));
export const TOPIC_IDS = App.topics.list.map((x) => x.id).filter((id) => TOPICS.has(id));

/* ---------- counting a page's own words ---------- */

// words inside <main>, without the parts every page of its kind repeats: elements whose class starts
// with "t" (headings, labels, buttons, navigation between pages)
export function contentWords(html) {
  let m = /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] || '';
  m = m.replace(/<(\w+)\b[^>]*\sclass="t(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/\1>/g, ' ');
  return m.replace(/<[^>]+>/g, ' ').replace(/&[#\w]+;/g, ' ').split(/\s+/).filter((x) => /\p{L}/u.test(x)).length;
}

/* ---------- the frame of every page ---------- */

const LOGO = '<svg class="logo" viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">'
  + '<rect x="9" y="5" width="24" height="30" rx="5" transform="rotate(12 21 20)" fill="var(--blue)"/>'
  + '<rect x="7" y="6" width="24" height="30" rx="5" transform="rotate(-6 19 21)" fill="var(--card)" stroke="var(--ink)" stroke-width="2.4"/>'
  + '<path d="M11.2 14.2 26.6 12.6" stroke="var(--red)" stroke-width="2.4" stroke-linecap="round"/>'
  + '<path d="M12 20.6l12.8-1.35M12.6 26.2l9-.95" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" opacity=".28"/></svg>';

const ld = (graph) => JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
const crumbsLd = (path, crumbs) => ({
  '@type': 'BreadcrumbList', '@id': abs(path) + '#crumbs',
  itemListElement: crumbs.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(p) })),
});

// the fonts a page draws its text with, fetched before the stylesheet asks for them: the interface font and the
// serif of the headings and Norwegian words, in the alphabet of the page's language (css/fonts.css)
const FONTS = {
  latin: ['geologica-latin-wght-normal', 'literata-latin-opsz-normal'],
  cyrillic: ['geologica-cyrillic-wght-normal', 'literata-latin-opsz-normal'],
  arabic: ['readex-pro-arabic-wght-normal', 'literata-latin-opsz-normal'],
};
const fontsOf = (ui) => FONTS[{ ru: 'cyrillic', uk: 'cyrillic', ar: 'arabic' }[ui] || 'latin'];
const aboutA = (ui) => (ABOUT[ui] ? `<a href="${ABOUT[ui].path}">${esc(ABOUT[ui].nav)}</a>` : '');

function frame({ ui, path, title, desc, alternates, crumbs, graph, body }) {
  const L = lang(ui), U = UI[ui];
  const nb = L.rtl ? ' lang="nb" dir="ltr"' : ' lang="nb"';
  const alt = UIS.filter((u) => alternates[u]);
  return `<!doctype html>
<html lang="${L.htmlLang}" dir="${L.rtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${abs(path)}">
${alt.map((u) => `  <link rel="alternate" hreflang="${lang(u).hreflang}" href="${abs(alternates[u])}">`).join('\n')}
${alternates.en ? `  <link rel="alternate" hreflang="x-default" href="${abs(alternates.en)}">\n` : ''}  <meta name="theme-color" content="#f4efe6">
  <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Ordkort">
  <meta property="og:url" content="${abs(path)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${SITE}/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="${L.locale}">
${alt.filter((u) => u !== ui).map((u) => `  <meta property="og:locale:alternate" content="${lang(u).locale}">`).join('\n')}
  <meta name="twitter:card" content="summary_large_image">
${fontsOf(ui).map((f) => `  <link rel="preload" href="/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join('\n')}
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/css/pages.css">
  <script type="application/ld+json">${ld([...graph, crumbsLd(path, crumbs), ...Landing.SITE_NODES])}</script>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="/${ui}/">${LOGO}<span>ordkort</span></a>
      <nav class="sections" aria-label="Ordkort"><a href="${topicsHubPath(ui)}">${esc(U.topicsHub)}</a>${dictA(ui, U.dictHub)}</nav>
      ${alt.length > 1 ? `<ul class="langs">${alt.map((u) => `<li><a href="${alternates[u]}" hreflang="${lang(u).hreflang}" lang="${lang(u).htmlLang}"${u === ui ? ' aria-current="page"' : ''}>${esc(lang(u).name)}</a></li>`).join('')}</ul>` : ''}
    </header>
    <nav class="crumbs" aria-label="${esc(U.crumbs)}"><ol>${crumbs.map(([name, p], i) => (i === crumbs.length - 1
    ? `<li><span aria-current="page"${p.includes('/ordbok/') && i === 2 ? nb : ''}>${esc(name)}</span></li>`
    : `<li><a href="${p}">${esc(name)}</a></li>`)).join('')}</ol></nav>
    <main>
${body}
    </main>
    <footer>
      <a href="/${ui}/">Ordkort</a>
      <a href="${topicsHubPath(ui)}">${esc(U.topicsHub)}</a>
      ${dictA(ui, U.dictHub)}
      ${aboutA(ui)}
      <a href="/#/about">${esc(t(ui, 'foot.about') || 'About')}</a>
      <a href="https://github.com/silicq/ordkort" rel="noopener">GitHub</a>
      <a href="mailto:${Landing.MAIL}">${Landing.MAIL}</a>
    </footer>
  </div>
</body>
</html>
`;
}

/* ---------- a word ---------- */

// the date of the page's last update and a way to report a mistake in it (by e-mail: no account needed)
function updatedLine(ui, date, path) {
  const U = UI[ui], L = lang(ui);
  const shown = new Intl.DateTimeFormat(L.htmlLang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
  const mail = `mailto:${Landing.MAIL}?subject=${encodeURIComponent(`${U.report}: ${abs(path)}`)}`;
  return `        <p class="t updated">${esc(U.updated)}: <time datetime="${date}">${esc(shown)}</time> · <a href="${esc(mail)}">${esc(U.report)}</a></p>\n`;
}

function wordPage(ui, w, live) {
  const U = UI[ui], e = DICT.get(w), f = RANK.get(w);
  const a = article(w, f.pos, null);
  const head = headword(w, f.pos, a);
  const posLabel = [U.pos[f.pos], ...(f.pos === 'noun' && a ? a.g.map((g) => U.gender[g]) : [])].join(U.comma || ', ');
  const tr = ui === 'nb' ? e.nb : e.tr[ui];
  const forms = keyForms(a, w);
  const table = formsTable(ui, a, w);
  const nbA = lang(ui).rtl ? ' lang="nb" dir="ltr"' : ' lang="nb"';
  const exIdx = EX[ui];
  const ofc = a ? { senses: a.senses.slice(0, 5), expr: a.expr.slice(0, 5), compounds: a.compounds.slice(0, 8) } : null;

  // related: words of the same topics first, then words of the same class close in frequency
  const pool = live.words[ui];
  const related = [];
  for (const id of TOPICS_OF.get(w) || []) for (const x of TOPICS.get(id).words) {
    const l = lemmaOf(x.nb);
    if (l !== w && pool.has(l) && !related.includes(l)) related.push(l);
  }
  const near = FREQ.filter((x) => x.w !== w && x.pos === f.pos && pool.has(x.w) && !related.includes(x.w))
    .sort((x, y) => Math.abs(x.rank - f.rank) - Math.abs(y.rank - f.rank)).map((x) => x.w);
  const rel = [...related.slice(0, 5), ...near].slice(0, 8);
  const topics = (TOPICS_OF.get(w) || []).filter((id) => live.topics[ui].has(id));
  const order = [...pool].sort(collator.compare);
  const at = order.indexOf(w), prev = order[at - 1], next = order[at + 1];

  const path = wordPath(ui, w);
  // the English word for titles and descriptions: its first meaning, "to follow; to accompany" → "follow"
  const enFull = String(e.tr?.en || '').split(';')[0].trim();
  const x = { verb: f.pos === 'verb', forms: !!forms, en: enFull.split(/[,(]/)[0].replace(/^to /, '').trim(), enFull };
  const title = U.wordTitle(w, x);
  // search engines show about 160 characters: first the English word alone instead of its whole meaning, then drop
  // the forms (unless the language keeps them: Norwegian searches ask for them), then shorten the meaning
  const meaning = tr.replace(/\.$/, '');
  const d = (m, fm, en) => U.wordDesc(w, U.pos[f.pos], m, fm, { ...x, en });
  const descForms = U.namedForms ? namedForms(a, w) : forms;
  let desc = d(meaning, descForms, enFull);
  if (desc.length > 160) desc = d(meaning, descForms, x.en);
  const kept = U.descKeepsForms ? descForms : '';
  if (desc.length > 160) desc = d(meaning, kept, x.en);
  if (desc.length > 160) desc = d(meaning.slice(0, meaning.length - (desc.length - 159)).replace(/[\s,;]+\S*$/, '') + '…', kept, x.en);
  const body = `      <article class="entry">
        <h1${nbA}>${esc(head)}</h1>
        <p class="t pos">${esc(posLabel)}</p>
        <p class="tr">${esc(tr)}</p>
        <a class="t btn" href="/#/dict/${encodeURIComponent(w)}?${invite(ui)}">${esc(U.ctaWord(w))}</a>
${table ? `        <section>
          <h2 class="t">${esc(U.formsH)}</h2>
          <div class="scroll"><table class="forms">${table.headers ? `<thead class="t"><tr>${table.headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${table.rows.map((r) => `<tr><th class="t" scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td${nbA}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        </section>
` : ''}${ui === 'nb' ? `        <section>
          <h2 class="t">${esc(U.trLang)}</h2>
          <dl class="trs">${['en', 'ru', 'uk'].map((l) => `<dt class="t">${{ en: 'engelsk', ru: 'russisk', uk: 'ukrainsk' }[l]}</dt><dd lang="${l}">${esc(e.tr[l])}</dd>`).join('')}</dl>
        </section>
` : `        <section>
          <h2 class="t">${esc(U.plain)}</h2>
          <p${nbA}>${esc(e.nb)}</p>
        </section>
`}        <section>
          <h2 class="t">${esc(U.examplesH)}</h2>
          <ul class="examples">${e.ex.map((x) => `<li><span${nbA}>${esc(x[0])}</span>${exIdx ? `<span class="ex-tr">${esc(x[exIdx])}</span>` : ''}</li>`).join('')}</ul>
        </section>
${e.ph?.length ? `        <section>
          <h2 class="t">${esc(U.phH)}</h2>
          <ul class="phrases">${e.ph.map((x) => `<li><b${nbA}>${esc(x[0])}</b>${exIdx ? ` <span>${esc(x[exIdx])}</span>` : ''}</li>`).join('')}</ul>
        </section>
` : ''}        <section class="note">
          <h2 class="t">${esc(U.noteH)}</h2>
          <p>${esc(e.note[ui])}</p>
        </section>
${ofc && (ofc.senses.length || ofc.expr.length) ? `        <section class="official"${nbA}>
          <h2 class="t">${esc(U.officialH)}</h2>
          <ol class="senses">${ofc.senses.map((s) => `<li>${esc(clean(s.def))}${s.ex.length ? ` <i>${s.ex.map((x) => esc(clean(x))).join(' · ')}</i>` : ''}</li>`).join('')}</ol>
${ofc.expr.length ? `          <h3 class="t">${esc(U.exprH)}</h3>
          <ul class="expr">${ofc.expr.map((x) => `<li><b>${esc(clean(x.text))}</b>${x.meaning ? ` – ${esc(clean(x.meaning))}` : ''}</li>`).join('')}</ul>
` : ''}${ofc.compounds.length ? `          <h3 class="t">${esc(U.compoundsH)}</h3>
          <p class="compounds">${ofc.compounds.map(esc).join(', ')}</p>
` : ''}          <p class="t source"><a href="https://ordbokene.no/nob/bm/${encodeURIComponent(w)}" rel="noopener">${esc(U.source)}</a></p>
        </section>
` : ''}${updatedLine(ui, UPDATED.words, path)}      </article>
${rel.length ? `      <nav class="related" aria-label="${esc(U.relatedH)}">
        <h2 class="t">${esc(U.relatedH)}</h2>
        <ul class="index">${rel.map((r) => `<li><a href="${wordPath(ui, r)}"${nbA}>${esc(r)}</a> <span>${esc(ui === 'nb' ? DICT.get(r).nb : DICT.get(r).tr[ui])}</span></li>`).join('')}</ul>
      </nav>
` : ''}${topics.length ? `      <nav class="t intopics" aria-label="${esc(U.inTopicsH)}">
        <h2>${esc(U.inTopicsH)}</h2>
        <ul class="chips">${topics.map((id) => `<li><a href="${topicPath(ui, id)}">${esc(t(ui, 'topic.' + id))}</a></li>`).join('')}</ul>
      </nav>
` : ''}      <nav class="t pager">${prev ? `<a rel="prev" href="${wordPath(ui, prev)}"><small>${esc(U.prev)}</small><span${nbA}>${esc(prev)}</span></a>` : ''}${next ? `<a rel="next" href="${wordPath(ui, next)}"><small>${esc(U.next)}</small><span${nbA}>${esc(next)}</span></a>` : ''}</nav>`;

  const alternates = Object.fromEntries(UIS.filter((u) => live.words[u].has(w)).map((u) => [u, wordPath(u, w)]));
  const graph = [
    { '@type': 'WebPage', '@id': abs(path), url: abs(path), name: title, description: desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, mainEntity: { '@id': abs(path) + '#term' }, dateModified: UPDATED.words, publisher: { '@id': `${SITE}/#org` } },
    {
      '@type': 'DefinedTerm', '@id': abs(path) + '#term', name: w, inLanguage: 'nb', description: tr, url: abs(path),
      inDefinedTermSet: { '@id': abs(dictHubPath(ui)) + '#set' },
    },
  ];
  return { path, title, desc, alternates, body, graph, updated: UPDATED.words, crumbs: [[U.home, `/${ui}/`], [U.dictHub, dictHubPath(ui)], [w, path]] };
}

/* ---------- a topic ---------- */

function topicPage(ui, id, live) {
  const U = UI[ui], d = TOPICS.get(id), name = t(ui, 'topic.' + id);
  const words = topicWords(ui, id);
  const nbA = lang(ui).rtl ? ' lang="nb" dir="ltr"' : ' lang="nb"';
  const tp = App.topics.get(id);
  const sameGroup = App.topics.groups.find((g) => g.id === tp.group).items.map((x) => x.id).filter((x) => x !== id && live.topics[ui].has(x));
  const path = topicPath(ui, id);
  const sample = words.slice(0, 6).map((x) => x.term).join(', ');
  const title = U.topicTitle(name);
  let desc = U.topicDesc(name, words.length, sample);
  for (let k = 5; desc.length > 160 && k > 1; k--) desc = U.topicDesc(name, words.length, words.slice(0, k).map((x) => x.term).join(', '));
  const usesOrdbok = words.some((x) => x.a);

  const body = `      <h1>${esc(U.topicH1(name))}</h1>
      ${d.intro[ui].map((p) => `<p class="lede">${esc(p)}</p>`).join('\n      ')}
      <a class="t btn" href="/#/?${invite(ui)}&amp;topic=${id}">${esc(U.ctaTopic)}</a>
      <section>
        <h2 class="t">${esc(U.words(words.length))}</h2>
        <ul class="words">${words.map((x) => {
    const f = keyForms(x.a, x.lemma) || '';
    const link = live.words[ui].has(x.lemma) ? wordPath(ui, x.lemma) : '';
    const term = `<span${nbA}>${esc(x.term)}</span>`;
    return `
          <li><div class="w">${link ? `<a href="${link}">${term}</a>` : term}${x.tr ? ` <span class="w-tr">${esc(x.tr)}</span>` : ''}</div>${f ? `<div class="w-forms"${nbA}>${esc(f)}</div>` : ''}<div class="w-ex"><span${nbA}>${esc(x.ex)}</span>${x.exTr ? ` <span class="ex-tr">${esc(x.exTr)}</span>` : ''}</div></li>`;
  }).join('')}
        </ul>
${usesOrdbok ? `        <p class="t source">${esc(UI[ui].table.forms)}: <a href="https://ordbokene.no" rel="noopener">${esc(U.source)}</a></p>\n` : ''}${ankiLinks(ui, id, live)}${embedBlock(ui, id)}${updatedLine(ui, UPDATED.topics, path)}      </section>
${sameGroup.length ? `      <nav class="t more" aria-label="${esc(U.otherTopics(t(ui, 'group.' + tp.group)))}">
        <h2>${esc(U.otherTopics(t(ui, 'group.' + tp.group)))}</h2>
        <ul class="chips">${sameGroup.map((x) => `<li><a href="${topicPath(ui, x)}">${App.topics.get(x).emoji} ${esc(t(ui, 'topic.' + x))}</a></li>`).join('')}</ul>
        <p class="t links"><a href="${topicsHubPath(ui)}">${esc(U.allTopics)}</a>${dictA(ui, U.alsoDict)}</p>
      </nav>` : ''}`;

  const alternates = Object.fromEntries(UIS.filter((u) => live.topics[u].has(id)).map((u) => [u, topicPath(u, id)]));
  const graph = [
    {
      '@type': ['WebPage', 'LearningResource'], '@id': abs(path), url: abs(path), name: title, description: desc, inLanguage: lang(ui).hreflang,
      isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, mainEntity: { '@id': abs(path) + '#words' },
      learningResourceType: 'vocabulary list', teaches: `${App.topics.get(id).en} in Norwegian`, isAccessibleForFree: true,
      audience: { '@type': 'EducationalAudience', educationalRole: 'student' }, dateModified: UPDATED.topics, publisher: { '@id': `${SITE}/#org` },
    },
    {
      '@type': 'ItemList', '@id': abs(path) + '#words', name: U.topicH1(name), numberOfItems: words.length,
      itemListElement: words.map((x, i) => ({
        '@type': 'ListItem', position: i + 1,
        // a word with a page of its own is the same thing as the term on that page
        item: live.words[ui].has(x.lemma)
          ? { '@type': 'DefinedTerm', '@id': abs(wordPath(ui, x.lemma)) + '#term', name: x.term, inLanguage: 'nb', ...(x.tr ? { description: x.tr } : {}), url: abs(wordPath(ui, x.lemma)), inDefinedTermSet: { '@id': abs(dictHubPath(ui)) + '#set' } }
          : { '@type': 'DefinedTerm', name: x.term, inLanguage: 'nb', ...(x.tr ? { description: x.tr } : {}) },
      })),
    },
  ];
  return { path, title, desc, alternates, body, graph, updated: UPDATED.topics, crumbs: [[U.home, `/${ui}/`], [U.topicsHub, topicsHubPath(ui)], [name, path]] };
}

// a topic's deck and the deck of every topic, for the languages that have deck names
function ankiLinks(ui, id, live) {
  const U = UI[ui];
  if (!U.ankiRoot) return '';
  const own = id ? `<a href="${deckPath(ui, id)}" download>${esc(U.ankiTopic)}</a>` : '';
  return `        <p class="t links">${own}<a href="${deckPath(ui)}" download>${esc(U.ankiAll(live.topics[ui].size))}</a></p>
        <p class="t source">${esc(U.ankiNote)}</p>
`;
}

/* ---------- cards for other sites ---------- */

// a topic's cards in a frame on any site: /embed/<ui>/<topic>/, with the script and look in public/widget/
export const embedPath = (ui, id) => `/embed/${ui}/${id}/`;
// what a teacher pastes: the frame, and a plain link to the topic under it
function embedCode(ui, id) {
  const name = t(ui, 'topic.' + id);
  return `<iframe src="${abs(embedPath(ui, id))}" title="${esc(UI[ui].embed.title(name))}" width="100%" height="380" style="border:0;max-width:560px" loading="lazy"></iframe>\n`
    + `<p><a href="${abs(topicPath(ui, id))}">${esc(UI[ui].topicH1(name))}</a> · Ordkort</p>`;
}
function embedBlock(ui, id) {
  const E = UI[ui].embed;
  if (!E) return '';
  return `        <details class="t embed"><summary>${esc(E.h)}</summary>
          <p class="t">${esc(E.p)}</p>
          <pre class="code"><code>${esc(embedCode(ui, id))}</code></pre>
        </details>
`;
}

function embedPage(ui, id) {
  const E = UI[ui].embed, L = lang(ui), name = t(ui, 'topic.' + id), home = abs(topicPath(ui, id));
  const words = topicWords(ui, id).filter((x) => x.tr).map((x) => ({ term: x.term, tr: x.tr, forms: keyForms(x.a, x.lemma) || '', ex: x.ex || '', exTr: x.exTr || '' }));
  // the words travel as data the script reads: "<" written as <, so nothing in them can close the element
  const data = JSON.stringify(words).replace(/</g, '\u003c');
  // Norwegian runs left to right on a right-to-left page, and the arrows point the way the cards go
  const nb = L.rtl ? 'lang="nb" dir="ltr"' : 'lang="nb"';
  const [back, on] = L.rtl ? ['→', '←'] : ['←', '→'];
  return `<!doctype html>
<html lang="${L.htmlLang}" dir="${L.rtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(E.title(name))}</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${home}">
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/widget/embed.css">
  <script src="/widget/embed.js" defer></script>
</head>
<body>
  <main class="w">
    <header><b>${esc(name)}</b><span id="n"${L.rtl ? ' dir="ltr"' : ''}>1 / ${words.length}</span></header>
    <button class="card" id="card" type="button">
      <span class="front"><span class="term" id="term" ${nb}>${esc(words[0].term)}</span><span class="hint">${esc(E.flip)}</span></span>
      <span class="back"><span class="tr" id="tr"></span><span class="forms" id="forms" ${nb}></span><span class="ex" id="ex" ${nb}></span><span class="extr" id="extr"></span></span>
    </button>
    <nav>
      <button type="button" id="prev" aria-label="${esc(E.prev)}" title="${esc(E.prev)}">${back}</button>
      <button type="button" id="shuffle">${esc(E.shuffle)}</button>
      <button type="button" id="next" aria-label="${esc(E.next)}" title="${esc(E.next)}">${on}</button>
    </nav>
    <footer><a href="${home}" target="_blank" rel="noopener">${esc(E.more)} ${on}</a></footer>
  </main>
  <script type="application/json" id="data">${data}</script>
</body>
</html>
`;
}

/* ---------- the two hubs ---------- */

function topicsHub(ui, live) {
  const U = UI[ui], path = topicsHubPath(ui);
  const ids = TOPIC_IDS.filter((id) => live.topics[ui].has(id));
  const total = ids.reduce((s, id) => s + topicWords(ui, id).length, 0);
  const body = `      <h1>${esc(U.topicsH1)}</h1>
      ${U.topicsIntro.map((p) => `<p class="lede">${esc(p)}</p>`).join('\n      ')}
${App.topics.groups.map((g) => {
    const items = g.items.filter((x) => live.topics[ui].has(x.id));
    if (!items.length) return '';
    return `      <section>
        <h2 class="t">${esc(t(ui, 'group.' + g.id))}</h2>
        <ul class="topics">${items.map((x) => {
    const ws = topicWords(ui, x.id);
    return `
          <li><a href="${topicPath(ui, x.id)}"><span class="t emoji" aria-hidden="true">${x.emoji}</span><b>${esc(t(ui, 'topic.' + x.id))}</b><small class="t">${esc(U.words(ws.length))}</small></a><p class="sample"${lang(ui).rtl ? ' dir="ltr"' : ''} lang="nb">${esc(ws.slice(0, 5).map((w) => w.term).join(', '))}</p></li>`;
  }).join('')}
        </ul>
      </section>`;
  }).filter(Boolean).join('\n')}
${ankiLinks(ui, null, live)}      ${FLASH[ui] || !U.noDict ? `<p class="t links">${FLASH[ui] ? `<a href="${flashPath(ui)}">${esc(FLASH[ui].nav)}</a>` : ''}${dictA(ui, U.alsoDict)}</p>` : ''}`;
  const title = U.topicsTitle(ids.length);
  const desc = U.topicsDesc(ids.length, total);
  const alternates = Object.fromEntries(UIS.filter((u) => live.topics[u].size).map((u) => [u, topicsHubPath(u)]));
  const graph = [
    { '@type': 'CollectionPage', '@id': abs(path), url: abs(path), name: title, description: desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, mainEntity: { '@id': abs(path) + '#topics' }, dateModified: UPDATED.topics },
    { '@type': 'ItemList', '@id': abs(path) + '#topics', name: U.topicsH1, itemListElement: ids.map((id, i) => ({ '@type': 'ListItem', position: i + 1, name: t(ui, 'topic.' + id), url: abs(topicPath(ui, id)) })) },
  ];
  return { path, title, desc, alternates, body, graph, updated: UPDATED.topics, crumbs: [[U.home, `/${ui}/`], [U.topicsHub, path]] };
}

/* ---------- for teachers ---------- */

function teachersPage(ui) {
  const T = TEACH[ui], U = UI[ui], path = T.path;
  // the learners choose their own language, unless the page is for a class that shares the teacher's
  const into = (id) => `/#/?${T.from ? `from=${ui}&amp;` : ''}learn=${LEARN}&amp;topic=${id}`;
  const body = `      <h1>${esc(T.h1)}</h1>
      ${T.lede.map((p) => `<p class="lede">${esc(p)}</p>`).join('\n      ')}
      <p><a class="t btn" href="/#/?${T.from ? `from=${ui}&amp;` : ''}learn=${LEARN}">${esc(T.cta)}</a></p>
      <section>
        <h2 class="t">${esc(T.getH)}</h2>
        <ul>${T.get.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>
      <section>
        <h2 class="t">${esc(T.topicH)}</h2>
        <p>${esc(T.topicP)}</p>
        <ul class="topics">${App.topics.list.map((x) => `
          <li><a href="${into(x.id)}"><span class="t emoji" aria-hidden="true">${x.emoji}</span><b>${esc(t(ui, 'topic.' + x.id))}</b></a></li>`).join('')}
        </ul>
        <p class="note">${esc(T.topicNote)}</p>
      </section>
      <section>
        <h2 class="t">${esc(T.ownH)}</h2>
        <ol>${T.own.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <p>${esc(T.ownNote)}</p>
      </section>
      ${T.printH ? `<section>
        <h2 class="t">${esc(T.printH)}</h2>
        <p>${esc(T.printP)}</p>
        <p><a href="/print/ordkort-plakat-nb.pdf" download>${esc(T.printLink)}</a></p>
      </section>` : ''}
      ${U.embed ? `<section>
        <h2 class="t">${esc(U.embed.h)}</h2>
        <p>${esc(U.embed.p)}</p>
        <iframe class="embed-demo" src="${embedPath(ui, 'greetings')}" title="${esc(U.embed.title(t(ui, 'topic.greetings')))}" loading="lazy"></iframe>
        <pre class="code"><code>${esc(embedCode(ui, 'greetings'))}</code></pre>
      </section>` : ''}
      <section>
        <h2 class="t">${esc(T.privacyH)}</h2>
        ${T.privacy.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </section>
      <section>
        <h2 class="t">${esc(T.limitsH)}</h2>
        ${T.limits.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
        ${T.mailP ? `<p>${esc(T.mailP).replace(Landing.MAIL, `<a href="mailto:${Landing.MAIL}">${Landing.MAIL}</a>`)}</p>` : ''}
      </section>
      <p class="t links"><a href="${topicsHubPath(ui)}">${esc(U.alsoTopics)}</a><a href="${dictHubPath(ui)}">${esc(U.alsoDict)}</a></p>`;
  const alternates = Object.fromEntries(UIS.filter((u) => TEACH[u]).map((u) => [u, TEACH[u].path]));
  const graph = [
    { '@type': 'WebPage', '@id': abs(path), url: abs(path), name: T.title, description: T.desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, audience: { '@type': 'EducationalAudience', educationalRole: 'teacher' }, about: { '@id': `${SITE}/#app` } },
  ];
  return { path, title: T.title, desc: T.desc, alternates, body, graph, updated: UPDATED.pages, crumbs: [[U.home, `/${ui}/`], [T.nav, path]] };
}

/* ---------- Norwegian flashcards: a topic, and straight into the app ---------- */

export const flashPath = (ui) => `/${ui}/${UI[ui].learn}/${FLASH[ui].slug}/`;
function flashcardsPage(ui, live) {
  const F = FLASH[ui], U = UI[ui], path = flashPath(ui);
  const ids = TOPIC_IDS.filter((id) => live.topics[ui].has(id));
  const body = `      <h1>${esc(F.h1)}</h1>
      ${F.lede.map((p) => `<p class="lede">${esc(p)}</p>`).join('\n      ')}
      <a class="t btn" href="/#/?${invite(ui)}">${esc(U.ctaTopic)}</a>
      <section>
        <h2 class="t">${esc(F.startH)}</h2>
        <ul class="index">${ids.map((id) => `
          <li><a href="/#/?${invite(ui)}&amp;topic=${id}"><span class="t" aria-hidden="true">${App.topics.get(id).emoji}</span> ${esc(t(ui, 'topic.' + id))}</a> <span class="t">· <a href="${topicPath(ui, id)}">${esc(F.list)}</a></span></li>`).join('')}
        </ul>
      </section>
      <section>
        <h2 class="t">${esc(F.moreH)}</h2>
        <ul>${F.more.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${ankiLinks(ui, null, live)}        <p class="t links"><a href="${topicsHubPath(ui)}">${esc(U.alsoTopics)}</a>${dictA(ui, U.alsoDict)}${TEACH[ui] ? `<a href="${TEACH[ui].path}">${esc(TEACH[ui].nav)}</a>` : ''}</p>
      </section>`;
  const alternates = Object.fromEntries(UIS.filter((u) => FLASH[u] && live.topics[u].size).map((u) => [u, flashPath(u)]));
  const graph = [
    {
      '@type': 'WebPage', '@id': abs(path), url: abs(path), name: F.title, description: F.desc, inLanguage: lang(ui).hreflang,
      isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, about: { '@id': `${SITE}/#app` }, dateModified: UPDATED.pages,
      mainEntity: { '@id': abs(path) + '#topics' },
    },
    { '@type': 'ItemList', '@id': abs(path) + '#topics', name: F.startH, itemListElement: ids.map((id, i) => ({ '@type': 'ListItem', position: i + 1, name: t(ui, 'topic.' + id), url: abs(topicPath(ui, id)) })) },
  ];
  return { path, title: F.title, desc: F.desc, alternates, body, graph, updated: UPDATED.pages, crumbs: [[U.home, `/${ui}/`], [U.topicsHub, topicsHubPath(ui)], [F.nav, path]] };
}

/* ---------- about Ordkort ---------- */

function aboutPage(ui) {
  const A = ABOUT[ui], U = UI[ui], path = A.path;
  const body = `      <h1>${esc(A.h1)}</h1>
      ${A.lede.map((p) => `<p class="lede">${esc(p)}</p>`).join('\n      ')}
${A.sections.map(([h, ps]) => `      <section>
        <h2 class="t">${esc(h)}</h2>
        ${ps.map((p) => `<p>${esc(p).replace(Landing.MAIL, `<a href="mailto:${Landing.MAIL}">${Landing.MAIL}</a>`)}</p>`).join('\n        ')}
      </section>`).join('\n')}
      <section>
        <h2 class="t">${esc(A.contactH)}</h2>
        <p class="t links"><a href="mailto:${Landing.MAIL}">${Landing.MAIL}</a><a href="https://github.com/silicq/ordkort" rel="noopener">${esc(A.source)}</a></p>
      </section>
      <p class="t links"><a href="${topicsHubPath(ui)}">${esc(U.alsoTopics)}</a>${dictA(ui, U.alsoDict)}</p>`;
  const alternates = Object.fromEntries(UIS.filter((u) => ABOUT[u]).map((u) => [u, ABOUT[u].path]));
  const graph = [
    { '@type': 'AboutPage', '@id': abs(path), url: abs(path), name: A.title, description: A.desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, about: { '@id': `${SITE}/#org` }, dateModified: UPDATED.pages },
  ];
  return { path, title: A.title, desc: A.desc, alternates, body, graph, updated: UPDATED.pages, crumbs: [[U.home, `/${ui}/`], [A.nav, path]] };
}

const letterOf = (w) => w[0].toUpperCase();
const letterId = (l) => 'l-' + slug(l);

function dictHub(ui, live) {
  const U = UI[ui], path = dictHubPath(ui);
  const words = [...live.words[ui]].sort(collator.compare);
  const letters = [...new Set(words.map(letterOf))];
  const nbA = lang(ui).rtl ? ' lang="nb" dir="ltr"' : ' lang="nb"';
  const body = `      <h1>${esc(U.dictH1(words.length))}</h1>
      ${U.dictIntro.map((p) => `<p class="lede">${esc(p)}</p>`).join('\n      ')}
      <nav class="t letters" aria-label="${esc(U.letters)}">${letters.map((l) => `<a href="#${letterId(l)}">${l}</a>`).join('')}</nav>
${letters.map((l) => `      <section id="${letterId(l)}">
        <h2 class="t">${l}</h2>
        <ul class="index">${words.filter((w) => letterOf(w) === l).map((w) => `<li><a href="${wordPath(ui, w)}"${nbA}>${esc(w)}</a> <span>${esc(ui === 'nb' ? DICT.get(w).nb : DICT.get(w).tr[ui])}</span></li>`).join('')}</ul>
      </section>`).join('\n')}
      <p class="t links"><a href="${topicsHubPath(ui)}">${esc(U.alsoTopics)}</a></p>`;
  const title = U.dictTitle(words.length);
  const desc = U.dictDesc(words.length);
  const alternates = Object.fromEntries(UIS.filter((u) => live.words[u].size).map((u) => [u, dictHubPath(u)]));
  const graph = [
    { '@type': 'CollectionPage', '@id': abs(path), url: abs(path), name: title, description: desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, mainEntity: { '@id': abs(path) + '#set' }, dateModified: UPDATED.words },
    { '@type': 'DefinedTermSet', '@id': abs(path) + '#set', name: U.dictH1(words.length), url: abs(path), inLanguage: ['nb', lang(ui).hreflang] },
  ];
  return { path, title, desc, alternates, body, graph, updated: UPDATED.words, crumbs: [[U.home, `/${ui}/`], [U.dictHub, path]] };
}

/* ---------- building everything ---------- */

const render = (ui, p) => frame({ ui, ...p });

export function build() {
  // what has data, per interface language; then drop pages below MIN_WORDS. The related words of a page
  // count as its content and depend on which pages are published, so this repeats until nothing changes.
  const live = { words: {}, topics: {} };
  for (const ui of UIS) {
    live.words[ui] = new Set(FREQ.filter((f) => DICT.has(f.w) && (ui === 'nb' ? DICT.get(f.w).nb : DICT.get(f.w).tr?.[ui])).map((f) => f.w));
    live.topics[ui] = new Set(TOPIC_IDS.filter((id) => TOPICS.get(id).intro?.[ui]));
  }
  const thin = new Map();
  for (let changed = true; changed;) {
    changed = false;
    for (const ui of UIS) {
      for (const w of [...live.words[ui]]) {
        const n = contentWords(render(ui, wordPage(ui, w, live)));
        if (n < MIN_WORDS) { live.words[ui].delete(w); thin.set(`${ui}:${w}`, n); changed = true; }
      }
      for (const id of [...live.topics[ui]]) {
        const n = contentWords(render(ui, topicPage(ui, id, live)));
        if (n < MIN_WORDS) { live.topics[ui].delete(id); thin.set(`${ui}:${id}`, n); changed = true; }
      }
    }
  }

  const pages = new Map(); // public path ("ru/ordbok/nb/hus/index.html") → html
  const entries = []; // for the sitemap: { loc, alternates, lastmod, map: the sitemap file it goes into }
  const add = (ui, p, map) => {
    pages.set(p.path.slice(1) + 'index.html', render(ui, p));
    entries.push({ loc: abs(p.path), alternates: Object.entries(p.alternates).map(([u, q]) => [lang(u).hreflang, abs(q)]), xdefault: p.alternates.en && abs(p.alternates.en), lastmod: p.updated, map });
  };
  // the app and the pages about the site
  entries.push({ loc: `${SITE}/`, alternates: [], lastmod: UPDATED.pages, map: 'pages' });
  const landingAlt = Landing.CODES.map((c) => [Landing.PAGES[c].hreflang, Landing.url(c)]);
  for (const c of Landing.CODES) {
    pages.set(`${c}/index.html`, Landing.render(c));
    entries.push({ loc: Landing.url(c), alternates: landingAlt, xdefault: Landing.url('en'), lastmod: UPDATED.pages, map: 'pages' });
  }
  for (const ui of UIS) {
    if (live.topics[ui].size) add(ui, topicsHub(ui, live), 'pages');
    for (const id of TOPIC_IDS) if (live.topics[ui].has(id)) add(ui, topicPage(ui, id, live), 'topics');
    if (live.words[ui].size) add(ui, dictHub(ui, live), 'pages');
    for (const f of FREQ) if (live.words[ui].has(f.w)) add(ui, wordPage(ui, f.w, live), `words-${ui}`);
  }
  for (const ui of UIS) if (TEACH[ui]) add(ui, teachersPage(ui), 'pages');
  for (const ui of UIS) if (ABOUT[ui]) add(ui, aboutPage(ui), 'pages');
  for (const ui of UIS) if (FLASH[ui] && live.topics[ui].size) add(ui, flashcardsPage(ui, live), 'pages');
  const embeds = new Map(); // the cards for other sites: not in the sitemap, not indexed
  for (const ui of UIS) if (UI[ui].embed) for (const id of TOPIC_IDS) if (live.topics[ui].has(id)) embeds.set(embedPath(ui, id).slice(1) + 'index.html', embedPage(ui, id));
  return { pages, embeds, sitemaps: sitemaps(entries), redirects: redirects(live), thin: [...thin].map(([k, n]) => `${k} (${n})`), live };
}

/* ---------- addresses with Norwegian letters ----------
   The address of "gå" is /ordbok/nb/gaa/; someone (or an AI) who types /ordbok/nb/gå/ is sent there for good.
   Written to public/_redirects (Cloudflare's static redirects), with the letters as a browser sends them. */
function redirects(live) {
  const lines = [];
  for (const ui of UIS) {
    for (const w of [...live.words[ui]].sort(collator.compare)) {
      const to = wordPath(ui, w), raw = `/${ui}/ordbok/${LEARN}/${encodeURIComponent(w.toLowerCase())}`;
      if (raw + '/' !== to) lines.push(`${raw}/ ${to} 301`, `${raw} ${to} 301`);
    }
    // a word whose page is no longer published here (too little of its own): its address leads to the dictionary
    for (const f of FREQ) if (DICT.has(f.w) && !live.words[ui].has(f.w) && live.words[ui].size) lines.push(`${wordPath(ui, f.w)} ${dictHubPath(ui)} 301`);
  }
  return `# Written by scripts/seo-pages.mjs: words with æ, ø or å, by the letters themselves, to their ASCII address\n${lines.join('\n')}\n`;
}

/* ---------- sitemap ---------- */

function urlset(entries) {
  const lastmod = (e) => (e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map((e) => `  <url>\n    <loc>${esc(e.loc)}</loc>${lastmod(e)}\n${e.alternates.map(([h, href]) => `    <xhtml:link rel="alternate" hreflang="${h}" href="${esc(href)}"/>\n`).join('')}${e.xdefault ? `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(e.xdefault)}"/>\n` : ''}  </url>`).join('\n')}
</urlset>
`;
}

// sitemap.xml is an index of one sitemap per section and language (sitemap-pages.xml, sitemap-topics.xml,
// sitemap-words-ru.xml…), so Search Console shows how much of each is indexed; one past `limit` URLs is split
export function sitemaps(entries, limit = SITEMAP_LIMIT) {
  const groups = new Map();
  for (const e of entries) groups.set(e.map || 'pages', [...(groups.get(e.map || 'pages') || []), e]);
  const out = new Map();
  for (const [name, list] of groups) {
    const parts = Math.ceil(list.length / limit);
    for (let i = 0; i < parts; i++) out.set(`sitemap-${name}${parts > 1 ? '-' + (i + 1) : ''}.xml`, urlset(list.slice(i * limit, (i + 1) * limit)));
  }
  const newest = (f) => [...out.get(f).matchAll(/<lastmod>([^<]+)</g)].map((m) => m[1]).sort().pop();
  out.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...out.keys()].map((f) => `  <sitemap><loc>${SITE}/${f}</loc>${newest(f) ? `<lastmod>${newest(f)}</lastmod>` : ''}</sitemap>`).join('\n')}
</sitemapindex>
`);
  return out;
}

// folders this script owns: removed before writing, so a page that is no longer published disappears
export const OWNED = [...UIS.flatMap((ui) => [`${ui}/${UI[ui].learn}/`, `${ui}/ordbok/`]), ...Object.values(ABOUT).map((a) => a.path.slice(1)), 'embed/'];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { pages, embeds, sitemaps: maps, redirects: moved, thin, live } = build();
  const pub = fileURLToPath(PUBLIC);
  for (const d of OWNED) rmSync(pub + d, { recursive: true, force: true });
  for (const f of readdirSync(pub)) if (/^sitemap-.+\.xml$/.test(f)) rmSync(pub + f);
  for (const [p, html] of [...pages, ...embeds]) {
    mkdirSync(pub + p.replace(/[^/]+$/, ''), { recursive: true });
    writeFileSync(pub + p, html);
  }
  for (const [f, xml] of maps) writeFileSync(pub + f, xml);
  writeFileSync(pub + '_redirects', moved);
  const n = (ui) => `${ui}: ${live.topics[ui].size} topics, ${live.words[ui].size} words`;
  console.log(`${pages.size} pages (${UIS.map(n).join('; ')}) + ${[...maps.keys()].join(', ')} + ${embeds.size} cards for other sites`);
  if (thin.length) console.log(`not published, under ${MIN_WORDS} words of their own: ${thin.join(', ')}`);
}
