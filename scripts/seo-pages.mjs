// Static pages for search engines: everything a crawler can read without JavaScript.
//   /<ui>/                          the pages about the site (scripts/landing.mjs)
//   /<ui>/<learn>/                  Norwegian word lists by topic, and one page per topic
//   /<ui>/ordbok/nb/                the most common Norwegian words from A to Å, and one page per word
//   /sitemap.xml                    every page with its translations (a sitemap index past 5000 pages)
// The content comes from data/seo/ (see data/seo/README.md); the words around it from scripts/seo-text.mjs.
// A page is published only with at least MIN_WORDS words of its own content, so no thin pages reach the index.
// Run `npm run seo` after changing any of them and commit the result (a test checks that the files are up to date).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Landing from './landing.mjs';
import { UI, UIS, LEARN, slug, translit } from './seo-text.mjs';
import '../public/js/topics.js';
import '../public/js/i18n/en.js';
import '../public/js/i18n/ru.js';
import '../public/js/i18n/uk.js';
import '../public/js/i18n/nb.js';

export const SITE = 'https://ordkort.com';
export const MIN_WORDS = 150;
export const SITEMAP_LIMIT = 5000;
const App = globalThis.App;
const DATA = new URL('../data/seo/', import.meta.url);
const PUBLIC = new URL('../public/', import.meta.url);
const json = (name) => JSON.parse(readFileSync(new URL(name, DATA), 'utf8'));
const dir = (name) => (existsSync(new URL(name, DATA)) ? readdirSync(new URL(name, DATA)).filter((f) => f.endsWith('.json')).sort() : []);
const t = (ui, key) => App.i18nData[ui][key];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const collator = new Intl.Collator('nb');

/* ---------- data ---------- */

const FREQ = readFileSync(new URL('nb-frequent.txt', DATA), 'utf8').split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l, rank) => { const [w, pos] = l.trim().split(/\s+/); return { w, pos, rank }; });
const ORDBOK = json('ordbok-nb.json');
const DICT = new Map(dir('dict').flatMap((f) => json('dict/' + f)).map((e) => [e.w, e]));
const TOPICS = new Map(dir('topics').flatMap((f) => [json('topics/' + f)].flat()).map((d) => [d.id, d])); // one file per group of topics
const BANK = existsSync(new URL('bank.json', DATA)) ? json('bank.json').words : {};

/* ---------- Bokmålsordboka: the article, its forms ---------- */

const WC = {
  noun: ['NOUN'], verb: ['VERB'], adjective: ['ADJ'], adverb: ['ADV', 'ADJ'], preposition: ['ADP'], pronoun: ['PRON', 'DET'],
  determiner: ['DET', 'ADJ', 'PRON'], conjunction: ['CCONJ', 'SCONJ'], numeral: ['DET', 'NUM'], interjection: ['INTJ'], particle: ['SCONJ', 'INFM'],
};
const ART = { Masc: 'en', Fem: 'ei', Neuter: 'et' };
const GENDER_OF = { en: 'Masc', ei: 'Fem', et: 'Neuter' };
const lemmaOf = (term) => term.replace(/^(en|ei|et|å)\s+/i, '').trim();

// the article of this word with this word class (and, for a noun, this gender) — homonyms are left out
function article(lemma, pos, gender) {
  const arts = (ORDBOK[lemma] || []).filter((a) => WC[pos]?.includes(a.wc));
  return (gender && arts.find((a) => a.g.includes(gender))) || arts[0] || null;
}
const get = (a, ...keys) => { for (const k of keys) if (a.forms[k]?.length) return a.forms[k].join(' / '); return ''; };
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
function keyForms(a, lemma) {
  if (!a) return '';
  // of two correct forms, the one textbooks teach first: "husene" rather than "husa"
  const first = (...k) => { const v = get(a, ...k).split(' / '); return v.find((x) => /ene$/.test(x)) || v[0]; };
  const list = a.wc === 'NOUN' ? (plural(a, lemma) ? [first('Plur+Def')] : [first('Sing+Def'), first('Plur+Ind'), first('Plur+Def')])
    : a.wc === 'VERB' ? [first('Pres'), first('Past'), first('<PerfPart>') && `har ${first('<PerfPart>')}`]
      : a.wc === 'ADJ' ? [first('Pos+Neuter+Ind+Sing', 'Pos+Neuter'), first('Pos+Plur'), first('Cmp'), first('Sup+Ind')]
        : [];
  return list.filter(Boolean).join(', ');
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

const topicsHubPath = (ui) => `/${ui}/${UI[ui].learn}/`;
const topicPath = (ui, id) => `/${ui}/${UI[ui].learn}/${slug(translit(t(ui, 'topic.' + id), ui))}/`;
const dictHubPath = (ui) => `/${ui}/ordbok/${LEARN}/`;
const wordPath = (ui, w) => `/${ui}/ordbok/${LEARN}/${slug(w)}/`;
const abs = (p) => SITE + p;
// into the app with the language pair of the page: the first-run setup starts from it (public/js/views/onboarding.js)
const invite = (ui) => (ui === LEARN ? `learn=${LEARN}` : `from=${ui}&amp;learn=${LEARN}`);
const lang = (ui) => Landing.PAGES[ui];

// topic word lists: the hand-made seed first, then words of the shared word bank it does not have yet
function topicWords(ui, id) {
  const seed = TOPICS.get(id).words.map((x) => {
    const lemma = lemmaOf(x.nb);
    const given = /^(en|ei|et)\s/.exec(x.nb)?.[1];
    const a = article(lemma, x.pos, GENDER_OF[given]);
    // the article Bokmålsordboka gives the noun wins over the one in the seed
    const term = given && x.pos === 'noun' && a?.g.length && !a.g.includes(GENDER_OF[given]) ? `${ART[a.g[0]]} ${lemma}` : x.nb;
    return { term, lemma, pos: x.pos, a, tr: ui === 'nb' ? '' : x[ui], ex: x.ex[0], exTr: ui === 'nb' ? '' : x.ex[['en', 'ru', 'uk'].indexOf(ui) + 1] };
  });
  const seen = new Set(seed.map((x) => x.lemma.toLowerCase()));
  const natives = ui === 'nb' ? Object.keys(BANK) : [ui];
  const bank = [];
  for (const n of natives) {
    for (const c of BANK[n]?.[id] || []) {
      const lemma = lemmaOf(c.term);
      if (seen.has(lemma.toLowerCase()) || !c.term || !c.ex) continue;
      seen.add(lemma.toLowerCase());
      const a = article(lemma, c.pos, GENDER_OF[/^(en|ei|et)\s/.exec(c.term)?.[1]]);
      bank.push({ term: c.term, lemma, pos: c.pos, a, tr: ui === 'nb' ? '' : c.tr, ex: c.ex, exTr: ui === 'nb' ? '' : c.ex_tr });
    }
  }
  return [...seed, ...bank].slice(0, 45);
}

// which topics a dictionary word appears in
const TOPICS_OF = new Map();
for (const [id, d] of TOPICS) for (const x of d.words) {
  const l = lemmaOf(x.nb);
  if (!TOPICS_OF.has(l)) TOPICS_OF.set(l, []);
  if (!TOPICS_OF.get(l).includes(id)) TOPICS_OF.get(l).push(id);
}
const RANK = new Map(FREQ.map((f) => [f.w, f]));
const TOPIC_IDS = App.topics.list.map((x) => x.id).filter((id) => TOPICS.has(id));

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
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/css/pages.css">
  <script type="application/ld+json">${ld([...graph, crumbsLd(path, crumbs)])}</script>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="/${ui}/">${LOGO}<span>ordkort</span></a>
      <nav class="sections" aria-label="Ordkort"><a href="${topicsHubPath(ui)}">${esc(U.topicsHub)}</a><a href="${dictHubPath(ui)}">${esc(U.dictHub)}</a></nav>
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
      <a href="${dictHubPath(ui)}">${esc(U.dictHub)}</a>
      <a href="/#/about">${esc(t(ui, 'foot.about') || 'About')}</a>
      <a href="https://github.com/silicq/ordkort" rel="noopener">GitHub</a>
    </footer>
  </div>
</body>
</html>
`;
}

/* ---------- a word ---------- */

function wordPage(ui, w, live) {
  const U = UI[ui], e = DICT.get(w), f = RANK.get(w);
  const a = article(w, f.pos, null);
  const head = headword(w, f.pos, a);
  const posLabel = [U.pos[f.pos], ...(f.pos === 'noun' && a ? a.g.map((g) => U.gender[g]) : [])].join(', ');
  const tr = ui === 'nb' ? e.nb : e.tr[ui];
  const forms = keyForms(a, w);
  const table = formsTable(ui, a, w);
  const nbA = lang(ui).rtl ? ' lang="nb" dir="ltr"' : ' lang="nb"';
  const exIdx = { en: 1, ru: 2, uk: 3 }[ui];
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
  const title = U.wordTitle(w);
  // search engines show about 160 characters: drop the forms first, then shorten the meaning
  const meaning = tr.replace(/\.$/, '');
  let desc = U.wordDesc(w, U.pos[f.pos], meaning, forms);
  if (desc.length > 160) desc = U.wordDesc(w, U.pos[f.pos], meaning, '');
  if (desc.length > 160) desc = U.wordDesc(w, U.pos[f.pos], meaning.slice(0, meaning.length - (desc.length - 159)).replace(/[\s,;]+\S*$/, '') + '…', '');
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
` : ''}      </article>
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
    { '@type': 'WebPage', '@id': abs(path), url: abs(path), name: title, description: desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, mainEntity: { '@id': abs(path) + '#term' } },
    {
      '@type': 'DefinedTerm', '@id': abs(path) + '#term', name: w, inLanguage: 'nb', description: tr, url: abs(path),
      inDefinedTermSet: { '@type': 'DefinedTermSet', '@id': abs(dictHubPath(ui)) + '#set', name: U.dictH1(live.words[ui].size), url: abs(dictHubPath(ui)) },
    },
  ];
  return { path, title, desc, alternates, body, graph, crumbs: [[U.home, `/${ui}/`], [U.dictHub, dictHubPath(ui)], [w, path]] };
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
${usesOrdbok ? `        <p class="t source">${esc(UI[ui].table.forms)}: <a href="https://ordbokene.no" rel="noopener">${esc(U.source)}</a></p>\n` : ''}      </section>
${sameGroup.length ? `      <nav class="t more" aria-label="${esc(U.otherTopics(t(ui, 'group.' + tp.group)))}">
        <h2>${esc(U.otherTopics(t(ui, 'group.' + tp.group)))}</h2>
        <ul class="chips">${sameGroup.map((x) => `<li><a href="${topicPath(ui, x)}">${App.topics.get(x).emoji} ${esc(t(ui, 'topic.' + x))}</a></li>`).join('')}</ul>
        <p class="t links"><a href="${topicsHubPath(ui)}">${esc(U.allTopics)}</a><a href="${dictHubPath(ui)}">${esc(U.alsoDict)}</a></p>
      </nav>` : ''}`;

  const alternates = Object.fromEntries(UIS.filter((u) => live.topics[u].has(id)).map((u) => [u, topicPath(u, id)]));
  const graph = [
    { '@type': 'WebPage', '@id': abs(path), url: abs(path), name: title, description: desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, mainEntity: { '@id': abs(path) + '#words' } },
    {
      '@type': 'ItemList', '@id': abs(path) + '#words', name: U.topicH1(name), numberOfItems: words.length,
      itemListElement: words.map((x, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'DefinedTerm', name: x.term, inLanguage: 'nb', ...(x.tr ? { description: x.tr } : {}), ...(live.words[ui].has(x.lemma) ? { url: abs(wordPath(ui, x.lemma)) } : {}) },
      })),
    },
  ];
  return { path, title, desc, alternates, body, graph, crumbs: [[U.home, `/${ui}/`], [U.topicsHub, topicsHubPath(ui)], [name, path]] };
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
      <p class="t links"><a href="${dictHubPath(ui)}">${esc(U.alsoDict)}</a></p>`;
  const title = U.topicsTitle(ids.length);
  const desc = U.topicsDesc(ids.length, total);
  const alternates = Object.fromEntries(UIS.filter((u) => live.topics[u].size).map((u) => [u, topicsHubPath(u)]));
  const graph = [
    { '@type': 'CollectionPage', '@id': abs(path), url: abs(path), name: title, description: desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' } },
    { '@type': 'ItemList', '@id': abs(path) + '#topics', itemListElement: ids.map((id, i) => ({ '@type': 'ListItem', position: i + 1, name: t(ui, 'topic.' + id), url: abs(topicPath(ui, id)) })) },
  ];
  return { path, title, desc, alternates, body, graph, crumbs: [[U.home, `/${ui}/`], [U.topicsHub, path]] };
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
    { '@type': 'CollectionPage', '@id': abs(path), url: abs(path), name: title, description: desc, inLanguage: lang(ui).hreflang, isPartOf: { '@id': `${SITE}/#site` }, breadcrumb: { '@id': abs(path) + '#crumbs' }, mainEntity: { '@id': abs(path) + '#set' } },
    { '@type': 'DefinedTermSet', '@id': abs(path) + '#set', name: U.dictH1(words.length), url: abs(path), inLanguage: ['nb', lang(ui).hreflang] },
  ];
  return { path, title, desc, alternates, body, graph, crumbs: [[U.home, `/${ui}/`], [U.dictHub, path]] };
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
  const entries = []; // for the sitemap: { loc, alternates }
  const add = (ui, p) => {
    pages.set(p.path.slice(1) + 'index.html', render(ui, p));
    entries.push({ loc: abs(p.path), alternates: Object.entries(p.alternates).map(([u, q]) => [lang(u).hreflang, abs(q)]), xdefault: p.alternates.en && abs(p.alternates.en) });
  };
  // the app and the pages about the site
  entries.push({ loc: `${SITE}/`, alternates: [] });
  const landingAlt = Landing.CODES.map((c) => [Landing.PAGES[c].hreflang, Landing.url(c)]);
  for (const c of Landing.CODES) {
    pages.set(`${c}/index.html`, Landing.render(c));
    entries.push({ loc: Landing.url(c), alternates: landingAlt, xdefault: Landing.url('en') });
  }
  for (const ui of UIS) {
    if (live.topics[ui].size) add(ui, topicsHub(ui, live));
    for (const id of TOPIC_IDS) if (live.topics[ui].has(id)) add(ui, topicPage(ui, id, live));
    if (live.words[ui].size) add(ui, dictHub(ui, live));
    for (const f of FREQ) if (live.words[ui].has(f.w)) add(ui, wordPage(ui, f.w, live));
  }
  return { pages, sitemaps: sitemaps(entries), thin: [...thin].map(([k, n]) => `${k} (${n})`), live };
}

/* ---------- sitemap ---------- */

function urlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map((e) => (e.alternates.length
    ? `  <url>\n    <loc>${esc(e.loc)}</loc>\n${e.alternates.map(([h, href]) => `    <xhtml:link rel="alternate" hreflang="${h}" href="${esc(href)}"/>`).join('\n')}\n${e.xdefault ? `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(e.xdefault)}"/>\n` : ''}  </url>`
    : `  <url><loc>${esc(e.loc)}</loc></url>`)).join('\n')}
</urlset>
`;
}

// one sitemap.xml while it fits, otherwise sitemap.xml becomes an index of sitemap-1.xml, sitemap-2.xml…
export function sitemaps(entries, limit = SITEMAP_LIMIT) {
  if (entries.length <= limit) return new Map([['sitemap.xml', urlset(entries)]]);
  const out = new Map();
  for (let i = 0; i * limit < entries.length; i++) out.set(`sitemap-${i + 1}.xml`, urlset(entries.slice(i * limit, (i + 1) * limit)));
  out.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...out.keys()].map((f) => `  <sitemap><loc>${SITE}/${f}</loc></sitemap>`).join('\n')}
</sitemapindex>
`);
  return out;
}

// folders this script owns: removed before writing, so a page that is no longer published disappears
export const OWNED = UIS.flatMap((ui) => [`${ui}/${UI[ui].learn}/`, `${ui}/ordbok/`]);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { pages, sitemaps: maps, thin, live } = build();
  const pub = fileURLToPath(PUBLIC);
  for (const d of OWNED) rmSync(pub + d, { recursive: true, force: true });
  for (const f of readdirSync(pub)) if (/^sitemap-\d+\.xml$/.test(f)) rmSync(pub + f);
  for (const [p, html] of pages) {
    mkdirSync(pub + p.replace(/[^/]+$/, ''), { recursive: true });
    writeFileSync(pub + p, html);
  }
  for (const [f, xml] of maps) writeFileSync(pub + f, xml);
  const n = (ui) => `${ui}: ${live.topics[ui].size} topics, ${live.words[ui].size} words`;
  console.log(`${pages.size} pages (${UIS.map(n).join('; ')}) + ${[...maps.keys()].join(', ')}`);
  if (thin.length) console.log(`not published, under ${MIN_WORDS} words of their own: ${thin.join(', ')}`);
}
