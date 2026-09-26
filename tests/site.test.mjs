// Static checks of the site: translations are complete, the offline cache covers every script,
// and server-side helpers clean untrusted input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { ROOT, read } from './helpers.mjs';
import { str, int, norm, isCode, randomCode, safeEqual } from '../src/util.js';
import { cleanGloss, cleanWord } from '../src/prompts.js';

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
  assert.ok(used.length > 20);
  for (const p of used) assert.ok(core.includes(p), `sw.js CORE lacks ${p}`);
  for (const p of core) if (p !== '/') assert.ok(existsSync(new URL('public' + p, ROOT)), `${p} does not exist`);
});

test('every deploy has a version the app can compare with the server', () => {
  const build = read('public/js/build.js'); // written by scripts/build.mjs (npm runs it before the tests)
  const pattern = /\.build = '(\w+)'/; // the one app.js reads the server's version with
  assert.ok(read('public/js/app.js').includes(String(pattern)));
  assert.match(build, pattern);
  assert.match(read('wrangler.jsonc'), /"command": "node scripts\/build\.mjs"/, 'wrangler writes it before every deploy');
  assert.match(read('public/sw.js'), /importScripts\('\/js\/build\.js'\)/, 'a new version updates the service worker');
  const html = read('public/index.html');
  assert.ok(html.indexOf('js/build.js') < html.indexOf('js/app.js'));
});

/* ---------- pages for search engines ---------- */

test('the pages about the site are up to date, linked to each other and readable without JavaScript', async () => {
  const L = await import('../scripts/landing.mjs');
  const sitemap = read('public/sitemap.xml');
  assert.equal(sitemap, L.sitemap(), 'public/sitemap.xml is out of date: run npm run landing');
  for (const code of L.CODES) {
    const html = read(`public/${code}/index.html`);
    assert.equal(html, L.render(code), `public/${code}/index.html is out of date: run npm run landing`);
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
});
