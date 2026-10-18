// Static checks of the site: translations are complete, the offline cache covers every script,
// and server-side helpers clean untrusted input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ROOT, read } from './helpers.mjs';
import { str, int, norm, isCode, randomCode, safeEqual } from '../src/core/util.js';
import { cleanGloss, cleanWord, fillManyPrompt } from '../src/ai/prompts.js';

/* ---------- interface translations ---------- */

await import('../public/js/i18n/en.js');
const BUILT_IN = ['en', 'ru', 'uk', 'nb', 'ar', 'zh'];
for (const l of BUILT_IN.slice(1)) await import(`../public/js/i18n/${l}.js`);
const D = globalThis.App.i18nData;
const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '');

test('every built-in language has every interface string, with the same placeholders', () => {
  const en = D.en;
  for (const l of BUILT_IN.slice(1)) {
    const missing = Object.keys(en).filter((k) => !(k in D[l]) && !/_(one|two|few|many|zero)$/.test(k));
    assert.deepEqual(missing, [], `${l} is missing keys`);
    for (const [k, v] of Object.entries(D[l])) {
      const ref = en[k] ?? en[base(k) + '_other'];
      if (ref === undefined) continue;
      // plural forms may spell the number out ("one day"), so {n} is optional there
      const plural = base(k) !== k;
      const cut = (s) => (plural ? holes(s).split(',').filter((x) => x !== '{n}').join() : holes(s));
      assert.equal(cut(v), cut(ref), `${l}: ${k} placeholders`);
    }
  }
});

test('every string the code asks for exists in English', () => {
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
      if (f.isDirectory()) { if (f.name !== 'i18n') walk(dir + f.name + '/'); } else if (f.name.endsWith('.js')) files.push(dir + f.name);
    }
  };
  walk('public/js/');
  const missing = [];
  for (const f of files) {
    for (const [, key] of read(f).matchAll(/\bt[n]?\(\s*'([a-z0-9_]+\.[a-z0-9_]+)'/g)) {
      if (key.endsWith('_')) continue; // a prefix completed at run time, e.g. 'sync.err_' + kind
      if (!(key in D.en) && !(key + '_other' in D.en)) missing.push(`${f}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

/* ---------- offline cache ---------- */

test('the service worker caches every script and stylesheet of the page, and all of them exist', () => {
  const html = read('public/index.html');
  const sw = read('public/sw.js');
  const core = [...sw.match(/const CORE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const used = [...html.matchAll(/(?:src|href)="\/?((?:js|css)\/[^"?]+)"/g)].map((m) => '/' + m[1]);
  assert.ok(used.length >= 5);
  for (const p of used) assert.ok(core.includes(p), `sw.js CORE lacks ${p}`);
  for (const p of core) if (p !== '/') assert.ok(existsSync(new URL('public' + p, ROOT)), `${p} does not exist`);
});

test('the page loads the app as one bundle of every script, in order, and the bundle is up to date', async () => {
  const B = await import('../scripts/bundle.mjs');
  const html = read('public/index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['js/boot.js', 'js/build.js', 'js/bundle.js']);
  // every script in public/js/ is in the bundle, except the three the page loads itself
  const all = [];
  (function walk(dir) {
    for (const f of readdirSync(new URL('public/' + dir, ROOT), { withFileTypes: true })) {
      if (f.isDirectory()) walk(dir + f.name + '/'); else if (f.name.endsWith('.js')) all.push(dir + f.name);
    }
  })('js/');
  const own = ['js/boot.js', 'js/build.js', 'js/bundle.js'];
  assert.deepEqual(all.filter((f) => !own.includes(f)).sort(), [...B.APP_SCRIPTS].sort());
  assert.ok(B.APP_SCRIPTS.indexOf('js/config.js') === 0 && B.APP_SCRIPTS.at(-1) === 'js/app.js', 'config first, app last');
  new vm.Script(B.joined(), { filename: 'bundle-src.js' }); // joined as one script, the files still parse
  assert.equal(read('public/js/bundle.js'), (await B.bundle()).code, 'public/js/bundle.js is out of date: run node scripts/build.mjs');
});

test('every deploy has a version the app can compare with the server', () => {
  const build = read('public/js/build.js'); // written by scripts/build.mjs (npm runs it before the tests)
  const pattern = /\.build = '(\w+)'/; // the one app.js reads the server's version with
  assert.ok(read('public/js/app.js').includes(String(pattern)));
  assert.match(build, pattern);
  assert.match(read('wrangler.jsonc'), /"command": "node scripts\/build\.mjs"/, 'wrangler writes it before every deploy');
  assert.match(read('public/sw.js'), /importScripts\('\/js\/build\.js'\)/, 'a new version updates the service worker');
  const html = read('public/index.html');
  assert.ok(html.indexOf('js/build.js') < html.indexOf('js/bundle.js'));
});

/* ---------- pages for search engines ---------- */

const L = await import('../scripts/landing.mjs');
const S = await import('../scripts/seo-pages.mjs');
const built = S.build();
const SITE = 'https://ordkort.com';
const pathOf = (u) => u.slice(SITE.length); // "https://ordkort.com/ru/" → "/ru/"
const fileOf = (p) => p.replace(/^\//, '') + (p.endsWith('/') ? 'index.html' : ''); // "/ru/" → "ru/index.html"
const seoPages = [...built.pages].filter(([f]) => !L.CODES.some((c) => f === `${c}/index.html`));
const one = (html, re) => re.exec(html)?.[1];
const text = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('the pages about the site are up to date, linked to each other and readable without JavaScript', async () => {
  const sitemap = read('public/sitemap.xml');
  for (const code of L.CODES) {
    const html = read(`public/${code}/index.html`);
    assert.equal(html, L.render(code), `public/${code}/index.html is out of date: run npm run seo`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://ordkort.com/${code}/">`));
    for (const other of L.CODES) assert.ok(html.includes(`href="https://ordkort.com/${other}/"`), `${code} → ${other}`);
    assert.match(html, /hreflang="x-default"/);
    assert.ok(sitemap.includes(`<loc>https://ordkort.com/${code}/</loc>`));
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(ld['@graph'].map((x) => x['@type']), ['WebApplication', 'WebPage', 'FAQPage']);
    assert.ok(ld['@graph'][2].mainEntity.length >= 5);
    assert.ok(html.includes('href="/#/"'), 'a way into the app');
    assert.doesNotMatch(html, /<script(?! type="application\/ld\+json")/, 'no scripts: plain HTML');
    const title = html.match(/<title>([^<]+)<\/title>/)[1], desc = html.match(/name="description" content="([^"]+)"/)[1];
    // search engines cut or ignore longer titles (Bing: over 70 characters)
    assert.ok(title.length <= 70 && desc.length >= 70 && desc.length <= 200, `${code}: title ${title.length}, description ${desc.length}`);
  }
  // the app's page has a real <h1> and links to these pages in its source, for crawlers without JavaScript
  const app = read('public/index.html');
  assert.match(app, /<div id="app">\s*<!--[^>]*-->\s*<main class="static-intro"[^>]*>\s*<h1>[^<]+<\/h1>[\s\S]*href="\/ru\/"[\s\S]*<\/main>\s*<\/div>/);
  assert.ok(app.indexOf('js/boot.js') < app.indexOf('<body>'), 'the page is marked before the description could be drawn');
  assert.match(read('public/js/boot.js'), /classList\.add\('js'\)/);
  assert.match(read('public/css/style.css'), /\.js \.static-intro \{ display: none; \}/);
  assert.ok(app.match(/<title>([^<]+)<\/title>/)[1].length <= 70);
  assert.match(read('public/robots.txt'), /Sitemap: https:\/\/ordkort\.com\/sitemap\.xml/);
});

/* ---------- Norwegian topics and words (scripts/seo-pages.mjs) ---------- */

test('the topic and word pages on disk are exactly what the generator writes, with nothing left over', () => {
  for (const [f, html] of [...built.pages, ...built.embeds]) {
    assert.ok(existsSync(new URL('public/' + f, ROOT)), `public/${f} is missing: run npm run seo`);
    assert.equal(read('public/' + f), html, `public/${f} is out of date: run npm run seo`);
  }
  for (const [f, xml] of built.sitemaps) assert.equal(read('public/' + f), xml, `public/${f} is out of date: run npm run seo`);
  // a page that is no longer published must not stay behind
  const onDisk = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL('public/' + dir, ROOT), { withFileTypes: true })) {
      if (e.isDirectory()) walk(dir + e.name + '/'); else onDisk.push(dir + e.name);
    }
  };
  for (const d of S.OWNED) if (existsSync(new URL('public/' + d, ROOT))) walk(d);
  assert.deepEqual(onDisk.filter((f) => !built.pages.has(f) && !built.embeds.has(f)), []);
  assert.ok(seoPages.length > 2000, `only ${seoPages.length} pages`);
  // Arabic topic names are romanized by hand: every address stays plain ASCII
  assert.deepEqual([...built.pages.keys(), ...built.embeds.keys()].filter((f) => /[^\x21-\x7e]/.test(f)), []);
  for (const ui of ['en', 'ru', 'uk', 'nb']) {
    assert.equal(built.live.topics[ui].size, 29, `${ui}: every topic has a page`);
    assert.ok(built.live.words[ui].size >= 500, `${ui}: ${built.live.words[ui].size} words`);
  }
});

test('the topic pages offer their Anki decks, and the decks on disk are what scripts/anki-decks.mjs writes', async () => {
  const { decks } = await import('../scripts/anki-decks.mjs');
  const made = await decks(built.live);
  const linked = new Set();
  for (const [, html] of built.pages) for (const m of html.matchAll(/href="(\/anki\/[^"]+)" download/g)) linked.add(m[1]);
  assert.deepEqual([...linked].sort(), [...made.keys()].sort(), 'every deck is linked, and every link has its deck');
  for (const [p, bytes] of made) {
    assert.ok(existsSync(new URL('public' + p, ROOT)), `public${p} is missing: run npm run decks`);
    assert.ok(Buffer.from(bytes).equals(readFileSync(new URL('public' + p, ROOT))), `public${p} is out of date: run npm run decks`);
  }
  assert.deepEqual(readdirSync(new URL('public/anki/', ROOT)).map((f) => '/anki/' + f).filter((p) => !made.has(p)), []);
  // the Polish deck with every topic: one note for each word of the pages, a guid that stays, a link back in the description
  const { default: initSqlJs } = await import('sql.js');
  const pkg = await globalThis.App.apkg.read(made.get(S.deckPath('pl')), { SQL: await initSqlJs(), zstd: () => { throw new Error('not zstd'); } });
  const words = S.TOPIC_IDS.filter((id) => built.live.topics.pl.has(id)).reduce((n, id) => n + S.topicWords('pl', id).filter((x) => x.tr).length, 0);
  assert.equal(pkg.notes.length, words);
  assert.equal(Object.values(pkg.decks).filter((d) => d.length === 2).length, built.live.topics.pl.size);
  const hus = pkg.notes.find((n) => n.fields[0] === 'et hus');
  assert.deepEqual(hus.fields.slice(0, 7), ['et hus', 'dom', '', 'rzeczownik', 'huset, hus, husene', 'De bor i et rødt hus.', 'Mieszkają w czerwonym domu.']);
});

test('the ready Norwegian topics on disk are what scripts/anki-decks.mjs writes, and the app reads them when the AI fails', async () => {
  const { ready, readyPath } = await import('../scripts/anki-decks.mjs');
  const made = ready(built.live);
  for (const ui of ['en', 'ru', 'uk', 'pl', 'ar']) assert.ok(made.has(readyPath(ui, 'food')), `${ui}: food`);
  for (const [p, text] of made) {
    assert.ok(existsSync(new URL('public' + p, ROOT)), `public${p} is missing: run npm run decks`);
    assert.equal(readFileSync(new URL('public' + p, ROOT), 'utf8'), text, `public${p} is out of date: run npm run decks`);
  }
  const onDisk = readdirSync(new URL('public/ready/nb/', ROOT)).flatMap((ui) => readdirSync(new URL(`public/ready/nb/${ui}/`, ROOT)).map((f) => `/ready/nb/${ui}/${f}`));
  assert.deepEqual(onDisk.filter((p) => !made.has(p)), []);
  const hus = JSON.parse(made.get(readyPath('pl', 'home'))).words.find((w) => w.term === 'et hus');
  assert.deepEqual(hus, { term: 'et hus', tr: 'dom', pos: 'noun', forms: 'huset, hus, husene', ex: 'De bor i et rødt hus.', ex_tr: 'Mieszkają w czerwonym domu.', chk: 1 });

  // public/js/ai.js: only Norwegian, only a topic, nothing when the file is missing or the network fails
  const ctx = { window: {}, location: { protocol: 'https:' }, fetched: [] };
  ctx.window.App = { store: { settings: { target: 'nb', native: 'pl' } } };
  ctx.fetch = async (url) => {
    ctx.fetched.push(url);
    if (url.includes('home')) return { ok: true, json: async () => JSON.parse(made.get(readyPath('pl', 'home'))) };
    if (url.includes('food')) throw new TypeError('offline');
    return { ok: false, json: async () => null };
  };
  vm.runInNewContext(read('public/js/ai.js'), ctx);
  const R = ctx.window.App.ai.ready;
  assert.ok((await R('home')).some((w) => w.term === 'et hus'));
  assert.deepEqual([...await R('food')], []);
  assert.deepEqual([...await R('nothing')], []);
  assert.deepEqual([...await R('../x')], []);
  ctx.window.App.store.settings.target = 'de';
  assert.deepEqual([...await R('home')], []);
  assert.deepEqual(ctx.fetched, ['/ready/nb/pl/home.json', '/ready/nb/pl/food.json', '/ready/nb/pl/nothing.json']);
});

test('the cards for other sites: one frame per topic, framable anywhere, not indexed, linked from their topic', () => {
  const headers = read('public/_headers');
  const rule = headers.slice(headers.indexOf('/embed/*'));
  assert.match(rule, /! Content-Security-Policy/);
  assert.match(rule, /! X-Frame-Options/);
  assert.match(rule, /frame-ancestors \*/);
  assert.doesNotMatch(rule.split('frame-ancestors')[0], /'unsafe-inline'/, 'the frame runs no inline script or style');
  for (const ui of ['en', 'ru', 'uk', 'pl', 'ar']) assert.equal([...built.embeds.keys()].filter((f) => f.startsWith(`embed/${ui}/`)).length, built.live.topics[ui].size);
  for (const [f, html] of built.embeds) {
    assert.match(html, /<meta name="robots" content="noindex">/, f);
    assert.doesNotMatch(html, /<script>|style="/, `${f}: the frame's own rules allow no inline script or style`);
    const words = JSON.parse(one(html, /<script type="application\/json" id="data">([^<]*)<\/script>/));
    assert.ok(words.length >= 10 && words.every((w) => w.term && w.tr), f);
    const home = one(html, /<link rel="canonical" href="([^"]+)">/);
    const topic = built.pages.get(fileOf(pathOf(home)));
    assert.ok(topic, `${f}: its topic page is published`);
    assert.ok(topic.includes(SITE + '/' + f.replace(/index\.html$/, '')), `${f}: the topic page gives the code with this frame`);
  }
  assert.ok(!read('public/sitemap.xml').includes('/embed/'));
});

test('every page has its own title, description, canonical address and a single h1', () => {
  const seen = { title: new Map(), desc: new Map(), canonical: new Map() };
  for (const [f, html] of built.pages) {
    const title = text(one(html, /<title>([^<]+)<\/title>/));
    const desc = text(one(html, /<meta name="description" content="([^"]+)">/));
    const canonical = one(html, /<link rel="canonical" href="([^"]+)">/);
    assert.ok(title && desc && canonical, f);
    assert.equal(fileOf(pathOf(canonical)), f, `${f}: canonical points elsewhere`);
    const landing = L.CODES.some((c) => f === `${c}/index.html`);
    // Google shows about 60 characters of a title; the pages about the site keep their older 70
    assert.ok(title.length <= (landing ? 70 : 60), `${f}: title is ${title.length} characters: ${title}`);
    assert.ok(desc.length >= 70 && desc.length <= 200, `${f}: description is ${desc.length} characters`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${f}: one h1`);
    for (const [k, v] of [['title', title], ['desc', desc], ['canonical', canonical]]) {
      assert.ok(!seen[k].has(v), `${f} repeats the ${k} of ${seen[k].get(v)}: ${v}`);
      seen[k].set(v, f);
    }
    for (const p of ['og:title', 'og:description', 'og:url', 'og:image', 'og:locale']) assert.ok(html.includes(`property="${p}"`), `${f}: ${p}`);
  }
});

test('hreflang alternates exist, point back to each other and use valid codes', () => {
  const codes = new Set(['en', 'ru', 'uk', 'nb', 'ar', 'zh-Hans', 'pl', 'x-default']);
  const alt = (html) => [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
  for (const [f, html] of built.pages) {
    const own = one(html, /<link rel="canonical" href="([^"]+)">/);
    const list = alt(html);
    assert.ok(list.length >= 2, `${f}: alternates`);
    assert.ok(list.some(([, u]) => u === own), `${f}: lists itself among its translations`);
    assert.equal(new Set(list.map(([h]) => h)).size, list.length, `${f}: one link per language`);
    for (const [h, u] of list) {
      assert.ok(codes.has(h), `${f}: hreflang ${h}`);
      const other = built.pages.get(fileOf(pathOf(u)));
      assert.ok(other, `${f}: ${h} → ${u} is not a page`);
      assert.ok(alt(other).some(([, v]) => v === own), `${u} does not link back to ${own}`);
    }
    const lang = one(html, /<html lang="([^"]+)"/);
    assert.ok(list.some(([h, u]) => h === lang && u === own), `${f}: hreflang ${lang} for itself`);
    if (list.some(([h]) => h === 'en')) assert.ok(list.some(([h]) => h === 'x-default'), `${f}: x-default`);
  }
});

test('no internal link is broken', () => {
  const broken = [];
  for (const [f, html] of built.pages) {
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      if (href === '/' || href.startsWith('/#')) continue;
      const file = fileOf(decodeURI(href));
      if (!built.pages.has(file) && !existsSync(new URL('public/' + file, ROOT))) broken.push(`${f} → ${href}`);
    }
    // anchors inside the page (the letters of the dictionary index) exist
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`), `${f}: #${id}`);
  }
  assert.deepEqual(broken.slice(0, 20), []);
});

test('the sitemap lists every page with its translations, and splits into an index when it grows', () => {
  const xml = [...built.sitemaps.values()].join('');
  const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  for (const [f, html] of built.pages) {
    const canonical = one(html, /<link rel="canonical" href="([^"]+)">/);
    assert.ok(locs.has(canonical), `${f} is not in the sitemap`);
  }
  for (const u of locs) assert.ok(u === `${SITE}/` || built.pages.has(fileOf(pathOf(u))), `${u} in the sitemap is not a page`);
  assert.ok(built.pages.size + 1 < S.SITEMAP_LIMIT ? built.sitemaps.size === 1 : built.sitemaps.has('sitemap-1.xml'));
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="ru" href="https:\/\/ordkort\.com\/ru\/ordbok\/nb\/hus\/"\/>/);
  // more entries than the limit: sitemap.xml becomes an index of numbered sitemaps
  const entries = Array.from({ length: 7 }, (_, i) => ({ loc: `${SITE}/p${i}/`, alternates: [] }));
  const split = S.sitemaps(entries, 3);
  assert.deepEqual([...split.keys()], ['sitemap-1.xml', 'sitemap-2.xml', 'sitemap-3.xml', 'sitemap.xml']);
  assert.match(split.get('sitemap.xml'), /<sitemapindex[\s\S]*<loc>https:\/\/ordkort\.com\/sitemap-3\.xml<\/loc>/);
  assert.equal((split.get('sitemap-3.xml').match(/<url>/g) || []).length, 1);
});

test('no thin pages: each has 150 words of its own, and no paragraph is repeated across pages', () => {
  const paragraphs = new Map(); // language → paragraph → first page
  for (const [f, html] of seoPages) {
    const n = S.contentWords(html);
    assert.ok(n >= S.MIN_WORDS, `${f}: ${n} words of its own`);
    const lang = one(html, /<html lang="([^"]+)"/);
    if (!paragraphs.has(lang)) paragraphs.set(lang, new Map());
    const main = /<main>([\s\S]*)<\/main>/.exec(html)[1];
    for (const [, attrs, text] of main.matchAll(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/g)) {
      if (/class="t[\s"]/.test(attrs || '')) continue; // labels every page of a kind shares
      // a short line may repeat with reason ("to work" translates both jobbe and arbeide); a template paragraph may not
      if (text.split(/\s+/).length < 6) continue;
      const seen = paragraphs.get(lang);
      assert.ok(!seen.has(text), `${f} repeats a paragraph of ${seen.get(text)}: ${text.slice(0, 80)}`);
      seen.set(text, f);
    }
  }
  // the counter leaves out the labels and the navigation every page of a kind repeats
  const html = '<main><h2 class="t">Examples</h2><p>Huset er gult og stort.</p><nav class="t pager"><a>Next word</a></nav></main>';
  assert.equal(S.contentWords(html), 5);
});

test('the page for teachers gives every topic a link into the app, and the pages about the site link to it', async () => {
  const { TEACH } = await import('../scripts/teachers-text.mjs');
  const topics = (await import('../public/js/topics.js'), globalThis.App.topics.list);
  for (const [ui, T] of Object.entries(TEACH)) {
    const html = built.pages.get(fileOf(T.path));
    assert.ok(html, `${T.path} is built`);
    for (const x of topics) {
      const href = `/#/?${T.from ? `from=${ui}&amp;` : ''}learn=nb&amp;topic=${x.id}`;
      assert.ok(html.includes(`href="${href}"`), `${T.path}: ${x.id}`);
    }
    assert.ok(read(`public/${ui}/index.html`).includes(`href="${T.path}"`), `/${ui}/ links to ${T.path}`);
  }
});

test('structured data: a DefinedTerm for each word, an ItemList for each topic, breadcrumbs everywhere', () => {
  for (const [f, html] of seoPages) {
    const ld = JSON.parse(one(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/));
    const types = ld['@graph'].map((x) => x['@type']);
    assert.ok(types.includes('BreadcrumbList'), `${f}: breadcrumbs`);
    const crumbs = ld['@graph'].find((x) => x['@type'] === 'BreadcrumbList').itemListElement;
    assert.ok(crumbs.length >= 2 && crumbs.every((c, i) => c.position === i + 1 && built.pages.has(fileOf(pathOf(c.item)))), `${f}: breadcrumb links`);
    if (f.includes('/ordbok/nb/') && !f.endsWith('/ordbok/nb/index.html')) {
      const term = ld['@graph'].find((x) => x['@type'] === 'DefinedTerm');
      assert.ok(term?.name && term.inLanguage === 'nb' && term.inDefinedTermSet, `${f}: DefinedTerm`);
    } else if (!f.includes('/ordbok/') && f.split('/').length === 4) { // <ui>/<learn>/<topic>/index.html
      const list = ld['@graph'].find((x) => x['@type'] === 'ItemList');
      assert.ok(list?.itemListElement.length >= 15, `${f}: ItemList`);
    }
    assert.doesNotMatch(html, /<script(?! type="application\/ld\+json")/, `${f}: no scripts`);
    assert.ok(html.includes('href="/#/'), `${f}: a way into the app`);
    // the way into the app carries the page's language pair, so the first-run setup starts from it
    const ui = f.split('/')[0];
    const pair = ui === 'nb' ? 'learn=nb' : `from=${ui}&amp;learn=nb`;
    if (/\/ordbok\/nb\/[^/]+\/index\.html$/.test(f)) assert.match(html, new RegExp(`class="t btn" href="/#/dict/[^"?]+\\?${pair}"`), `${f}: app link`);
    else if (/<ul class="words">/.test(html)) assert.match(html, new RegExp(`class="t btn" href="/#/\\?${pair}&amp;topic=[a-z]+"`), `${f}: app link`);
  }
  const onb = read('public/js/views/onboarding.js');
  assert.match(onb, /lang\('from'\)/);
  assert.match(onb, /location\.hash = inv\.after \|\| '#\/'/);
});

test('the static pages stay out of the offline cache, and the Worker still runs only for the API and MCP', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /if \(req\.mode === 'navigate' && !app\) return;/, 'pages other than the app are not cached by the service worker');
  assert.match(read('wrangler.jsonc'), /"run_worker_first": \["\/api\/\*", "\/mcp", "\/mcp\/\*", "\/s\/\*", "\/look\/\*", "\/\.well-known\/ai-catalog\.json", "\/\.well-known\/mcp-registry-auth"\]/);
  // the pages about the site link to both Norwegian hubs
  for (const [code, learn] of [['en', 'norwegian'], ['ru', 'norvezhskij'], ['uk', 'norvezka'], ['nb', 'norsk']]) {
    const html = read(`public/${code}/index.html`);
    assert.ok(html.includes(`href="/${code}/${learn}/"`) && html.includes(`href="/${code}/ordbok/nb/"`), `${code}: links to the hubs`);
    // so does the app's own page (its text for crawlers) and llms.txt
    for (const hub of [`/${code}/${learn}/`, `/${code}/ordbok/nb/`]) {
      assert.ok(read('public/index.html').includes(`href="${hub}"`), `index.html → ${hub}`);
      assert.ok(read('public/llms.txt').includes(`https://ordkort.com${hub}`), `llms.txt → ${hub}`);
      assert.ok(built.pages.has(fileOf(hub)), `${hub} is a page`);
    }
  }
});

/* ---------- server-side input cleaning ---------- */

test('untrusted strings are trimmed, cut and stripped of control characters', () => {
  assert.equal(str('  hei\u0000\u0007 ', 10), 'hei');
  assert.equal(str({ evil: 1 }), '');
  assert.equal(str(42), '42');
  assert.equal(str('x'.repeat(500), 5), 'xxxxx');
  assert.equal(int('7', 1, 5, 3), 5);
  assert.equal(int('nope', 1, 5, 3), 3);
});

test('word normalisation matches the browser (articles, punctuation, case)', () => {
  assert.equal(norm('Et hus'), 'hus');
  assert.equal(norm('å løpe'), 'løpe');
  assert.equal(norm("l'eau"), 'eau');
  assert.equal(norm('Der Hund!'), 'hund');
});

test('codes and comparisons', () => {
  const c = randomCode(8);
  assert.ok(isCode(c, 8));
  assert.ok(!isCode(c.toLowerCase() + '!', 8));
  assert.ok(!isCode('ILOU0000', 8), 'ambiguous letters are not part of the alphabet');
  assert.ok(safeEqual('abc', 'abc'));
  assert.ok(!safeEqual('abc', 'abd'));
  assert.ok(!safeEqual('abc', null));
});

test('AI answers keep only the expected fields', () => {
  assert.equal(cleanGloss(null), null);
  assert.equal(cleanGloss({ words: 'nope' }), null);
  const g = cleanGloss({ translation: 'Hi', words: [{ w: 'HEI', tr: 'hi', term: 'hei', pos: 'Interjection', extra: 1 }, { w: '', tr: 'x' }] });
  assert.deepEqual(g.words, [{ w: 'hei', term: 'hei', tr: 'hi', pos: 'interjection', note: '' }]);
  const w = cleanWord({ term: ' et hus ', tr: 'house', pos: 'noun', html: '<b>' });
  assert.equal(w.term, 'et hus');
  assert.equal(w.html, undefined);
  assert.equal(w.img_url, undefined, 'no picture, no field');
  const p = cleanWord({ term: 'et hus', tr: 'house', img_url: 'https://example.org/hus.jpg', img_by: 'Kari, CC BY 4.0' });
  assert.equal(p.img_url, 'https://example.org/hus.jpg');
  assert.equal(p.img_by, 'Kari, CC BY 4.0');
  for (const bad of ['http://example.org/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://a b.jpg']) {
    assert.equal(cleanWord({ term: 'x', tr: 'y', img_url: bad, img_by: 'z' }).img_url, undefined, bad);
  }
});

/* ---------- the design guide the MCP server gives to people's AI ---------- */

test('every class the design guide names is one the site really has', async () => {
  const { _test } = await import('../src/mcp.js');
  const css = read('public/css/style.css');
  const js = ['public/js/ui.js', 'public/js/app.js', ...readdirSync(new URL('public/js/views/', ROOT)).map((f) => 'public/js/views/' + f)].map(read).join('\n');
  const example = ['pic', 'word', 'ex', 'jpg']; // the guide's own example and a file name
  const named = new Set([..._test.DESIGN_GUIDE.matchAll(/(?<![\w-])\.([a-z][a-z0-9-]+)/g)].map((m) => m[1]));
  const missing = [...named].filter((n) => !example.includes(n)
    && !new RegExp(`\\.${n}(?![\\w-])`).test(css) && !new RegExp(`['\\s]${n}['\\s]`).test(js));
  assert.deepEqual(missing, []);
  for (const v of _test.DESIGN_GUIDE.match(/--[a-z][a-z0-9-]+/g)) {
    if (!['--card-image', '--bg', '--fg', '--edge'].includes(v)) assert.match(css, new RegExp(`${v}:`), v);
  }
});

test('filling in many cards: one request lists each card with its number and keeps a given example', () => {
  const p = fillManyPrompt({ target: 'nb', native: 'ru', level: 'A2', items: [
    { term: 'Hun er ikke så ung som hun ser ut.', tr: 'y', ex: '' },
    { term: 'et hus', tr: 'дом', ex: 'Vi bor i et hus.' },
  ] });
  assert.match(p.user, /\{"i":0,"term":"Hun er ikke så ung som hun ser ut\.","tr":"y"\}/);
  assert.match(p.user, /"i":1,"term":"et hus","tr":"дом","ex":"Vi bor i et hus\."/);
  assert.match(p.user, /\{"words":\[\{"i":0,"term":""/, 'the answer keeps the numbers');
  assert.match(p.user, /keep it exactly/);
  assert.ok(p.max >= 600 + 2 * 330);
});

test('a look cannot move the phone’s tab bar or pin it to the header', () => {
  const css = read('public/css/style.css');
  const guard = css.slice(css.indexOf('@layer guard'));
  assert.ok(guard.length > 100, 'the guard layer is there, after the rest');
  assert.match(guard, /html, body, #app, \.top, \.top-in \{[^}]*transform: none !important;[^}]*filter: none !important;/);
  assert.match(guard, /@media \(max-width: 760px\)[\s\S]*\.top \{ backdrop-filter: none !important;[\s\S]*\.tabs \{[^}]*position: fixed !important; inset: auto 0 0 0 !important;/);
  assert.doesNotMatch(css.slice(0, css.indexOf('@layer guard')), /@layer/, 'the guard is the only layer');
});
