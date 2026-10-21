// What the browser tells people when a request to the site's API fails (public/js/ai.js): no connection at all,
// a filter's page in place of the answer (a school's network), or the site's own limits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser, read } from './helpers.mjs';

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
