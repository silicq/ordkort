// What the browser tells people when a request to the site's API fails (public/js/ai.js): no connection at all,
// a filter's page in place of the answer (a school's network), or the site's own limits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { browser, read, ROOT } from './helpers.mjs';

await import('../public/js/i18n/en.js');
const EN = globalThis.App.i18nData.en;

// the API as ai.js sees it, with every request answered by `answer`
function client(answer) {
  const { App, ctx } = browser(['public/js/ai.js']);
  ctx.location = { protocol: 'https:' };
  ctx.fetch = async () => answer();
  return App;
}
const ours = (status, body, headers = {}) => () => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'CF-Ray': '8d1f2e3a4b5c6d7e-OSL', ...headers },
});
const page = (status, headers = {}) => () => new Response('<html><body>Access denied by your network</body></html>', {
  status, headers: { 'Content-Type': 'text/html', ...headers },
});
const kind = async (App) => (await App.ai.api('lookup', { q: 'hus' }).then(() => null, (e) => e)).kind;

test('a request that never reaches the site is "network"', async () => {
  assert.equal(await kind(client(() => { throw new TypeError('Failed to fetch'); })), 'network');
});

test('a filter’s page in place of the answer is "blocked", whatever its status', async () => {
  for (const status of [200, 403, 451, 302, 503]) assert.equal(await kind(client(page(status))), 'blocked', String(status));
});

test('the site’s own answers keep their meaning', async () => {
  assert.equal(await kind(client(ours(429, { error: 'slow_down' }))), 'rate');
  assert.equal(await kind(client(ours(429, { error: 'budget' }))), 'budget');
  assert.equal(await kind(client(ours(503, { error: 'busy' }))), 'busy');
  const App = client(ours(429, { error: 'quota', left: 0, limit: 600 }));
  assert.equal(await kind(App), 'quota');
  assert.deepEqual({ ...App.ai.quota }, { left: 0, limit: 600 });
  // Cloudflare's own error page (a Worker that failed) is the site's trouble, not the network's
  assert.equal(await kind(client(page(502, { 'CF-Ray': '8d1f2e3a4b5c6d7e-OSL' }))), 'server');
  // a copy of the site without its server answers 404 with a page
  assert.equal(await kind(client(page(404))), 'offline');
  const ok = client(ours(200, { found: true }, { 'X-AI-Left': '41', 'X-AI-Limit': '600' }));
  assert.deepEqual({ ...(await ok.ai.api('lookup', { q: 'hus' })).data }, { found: true });
  assert.deepEqual({ ...ok.ai.quota }, { left: 41, limit: 600 });
});

test('every kind of error the browser may show has its text, and none of them blames the AI for the network', () => {
  const kinds = new Set();
  for (const f of ['public/js/ai.js', 'public/js/views/library.js']) {
    for (const [, k] of read(f).matchAll(/AIError\(\s*'([a-z_]+)'/g)) kinds.add(k);
  }
  assert.ok(kinds.has('blocked') && kinds.has('network'));
  for (const k of kinds) assert.ok(EN['err.' + k], `err.${k} has no text`);
  assert.doesNotMatch(EN['err.network'], /\bAI\b/);
  assert.match(EN['err.blocked'], /school/);
});

/* ---------- the API's spare address (the same Worker at workers.dev) ---------- */

// a page at `origin` with the site's own config; every request answered by `answer(url)`, what was asked kept
function at(origin, answer) {
  const { App, ctx } = browser(['public/js/config.js', 'public/js/ai.js']);
  ctx.location = { protocol: 'https:', origin };
  const asked = [];
  ctx.fetch = async (url, opts) => { asked.push({ url, body: opts?.body }); return answer(url); };
  return { App, asked, urls: () => asked.map((a) => a.url) };
}
const SITE = 'https://ordkort.com';
const SPARE = 'https://ordkort.monkeyminiversion.workers.dev';
const dns = () => { throw new TypeError('Failed to fetch'); };
const spareOnly = (blockedThere) => (url) => (url.startsWith(SPARE) ? ours(200, { found: true })() : blockedThere());

test('the site’s page asks the spare address when ordkort.com does not get through, and stays there for the visit', async () => {
  const p = at(SITE, spareOnly(dns));
  assert.equal((await p.App.ai.api('lookup', { q: 'hus' })).data.found, true);
  assert.deepEqual(p.urls(), ['/api/lookup', SPARE + '/api/lookup']);
  assert.equal(p.asked[1].body, p.asked[0].body, 'the same request, body and all');
  await p.App.ai.api('limits');
  assert.deepEqual(p.urls().slice(2), [SPARE + '/api/limits'], 'straight there the next time');
});

test('a filter’s page in place of the answer is asked again at the spare address', async () => {
  const p = at(SITE, spareOnly(page(403)));
  assert.equal((await p.App.ai.api('lookup', { q: 'hus' })).data.found, true);
  assert.deepEqual(p.urls(), ['/api/lookup', SPARE + '/api/lookup']);
});

test('when the spare address does not get through either, the first failure is what people are told', async () => {
  assert.equal(await kind(at(SITE, dns).App), 'network');
  assert.equal(await kind(at(SITE, (url) => (url.startsWith(SPARE) ? dns() : page(403)())).App), 'blocked');
});

test('the spare address is not asked for the site’s own answers, a cancelled request, or by any other page', async () => {
  let p = at(SITE, ours(429, { error: 'quota', left: 0, limit: 120 }));
  assert.equal(await kind(p.App), 'quota');
  assert.deepEqual(p.urls(), ['/api/lookup']);
  p = at(SITE, () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); });
  await assert.rejects(p.App.ai.api('lookup', { q: 'hus' }), { name: 'AbortError' });
  assert.deepEqual(p.urls(), ['/api/lookup']);
  // a branch preview or a copy on a computer has an API of its own: it never spends the site's limits
  for (const origin of ['https://claude-x-ordkort.monkeyminiversion.workers.dev', 'http://localhost:8787']) {
    p = at(origin, dns);
    assert.equal(await kind(p.App), 'network');
    assert.deepEqual(p.urls(), ['/api/lookup'], origin);
  }
});

test('every request to the API goes through the one client, the page may connect to the spare address, and it is on', () => {
  const files = [];
  (function walk(dir) {
    for (const f of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
      if (f.isDirectory()) walk(dir + f.name + '/'); else if (/\.js$/.test(f.name) && f.name !== 'bundle.js') files.push(dir + f.name);
    }
  })('public/js/');
  const direct = files.filter((f) => /fetch\(\s*['"`]\/api\/|src: ['"`]\/api\//.test(read(f)));
  assert.deepEqual(direct, [], 'these ask /api/ by themselves and would not try the spare address');
  const csp = read('public/_headers').split('\n').find((l) => l.includes('Content-Security-Policy: default-src'));
  assert.match(csp.split('connect-src')[1].split(';')[0], new RegExp(SPARE.replace(/\./g, '\\.')));
  assert.match(read('src/worker.js'), new RegExp(`const SITE = '${SITE}'`));
  assert.match(read('wrangler.jsonc'), /"workers_dev": true/);
});
