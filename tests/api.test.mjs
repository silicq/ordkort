// The Worker API end to end, in Wrangler's local runtime with a local D1 (no Groq calls: only endpoints that don't use the AI).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createTestHarness } from 'wrangler';
import { ROOT } from './helpers.mjs';

let harness;
const BASE = 'http://ordkort.test';

before(async () => {
  harness = createTestHarness({
    root: fileURLToPath(ROOT),
    // test secrets replace .dev.vars, so a real Groq key is never used here
    workers: [{ configPath: './wrangler.jsonc', secrets: { GROQ_API_KEY: 'test-key-not-used', IP_SALT: 'test' } }],
  });
  await harness.listen();
});
after(() => harness?.close());

const call = (path, { method = 'GET', body, headers = {} } = {}) => harness.fetch(BASE + '/api/' + path, {
  method,
  headers: { 'CF-Connecting-IP': '203.0.113.7', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const blob = (n = 64) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('base64');

test('non-API paths go to the static files', async () => {
  const r = await harness.fetch(BASE + '/');
  assert.match(await r.text(), /<title>Ordkort/);
});

test('other sites cannot call the API and bodies must be JSON', async () => {
  let r = await call('share', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
  r = await harness.fetch(BASE + '/api/share', { method: 'POST', body: 'a=1', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(r.status, 415);
  r = await call('nothing-here');
  assert.equal(r.status, 404);
});

test('shared decks: create, open, unknown ids are gone, junk is cleaned', async () => {
  const deck = {
    title: 'Mat', emoji: '🍎', level: 'A1', target: 'nb', native: 'en',
    words: [
      { term: 'et brød', tr: 'bread', pos: 'noun', ex: 'Jeg spiser brød.' },
      { term: 'en ost', tr: 'cheese', evil: '<script>' },
      { term: '', tr: 'no term' },
    ],
  };
  let r = await call('share', { method: 'POST', body: { deck } });
  assert.equal(r.status, 200);
  const { id } = await r.json();
  assert.match(id, /^[0-9A-Z]{8}$/);

  r = await call('share/' + id);
  const got = (await r.json()).deck;
  assert.equal(got.title, 'Mat');
  assert.equal(got.words.length, 2);
  assert.equal(got.words[1].evil, undefined);

  assert.equal((await call('share/ZZZZZZZZ')).status, 404);
  assert.equal((await call('share/../../x')).status, 404);
  assert.equal((await call('share', { method: 'POST', body: { deck: { target: 'nb', native: 'en', words: [] } } })).status, 400);
});

test('pairing codes can be taken exactly once', async () => {
  let r = await call('pair', { method: 'POST', body: { d: blob() } });
  const { id, ttl } = await r.json();
  assert.equal(ttl, 180);

  assert.deepEqual(await (await call(`pair/${id}?peek`)).json(), { alive: true });
  r = await call('pair/' + id);
  assert.equal(r.status, 200);
  assert.ok((await r.json()).d);
  assert.equal((await call('pair/' + id)).status, 404, 'second read fails');
  assert.deepEqual(await (await call(`pair/${id}?peek`)).json(), { alive: false });
});

test('sync: versioned writes, token check, conflicts, delete', async () => {
  const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex'); // fresh copy every run
  const token = 'T'.repeat(43), other = 'X'.repeat(43);
  const put = (v, tok = token) => call('sync/' + id, { method: 'PUT', body: { v, d: blob() }, headers: { 'X-Sync-Token': tok } });

  assert.equal((await call('sync/' + id, { headers: { 'X-Sync-Token': token } })).status, 404);
  assert.deepEqual(await (await put(0)).json(), { v: 1 });
  assert.deepEqual(await (await put(1)).json(), { v: 2 });

  const stale = await put(1);
  assert.equal(stale.status, 409, 'an outdated device must merge first');
  assert.equal((await stale.json()).v, 2);

  assert.equal((await put(2, other)).status, 403, 'a wrong token cannot overwrite');
  assert.equal((await call('sync/' + id, { headers: { 'X-Sync-Token': other } })).status, 403, 'nor read');
  assert.equal((await call('sync/' + id)).status, 401);

  const r = await call('sync/' + id, { headers: { 'X-Sync-Token': token } });
  assert.equal((await r.json()).v, 2);
  assert.equal((await call(`sync/${id}?since=2`, { headers: { 'X-Sync-Token': token } })).status, 204);

  assert.deepEqual(await (await call('sync/' + id, { method: 'DELETE', headers: { 'X-Sync-Token': other } })).json(), { deleted: false });
  assert.deepEqual(await (await call('sync/' + id, { method: 'DELETE', headers: { 'X-Sync-Token': token } })).json(), { deleted: true });
});

test('limits endpoint reports the daily allowance', async () => {
  const r = await call('limits');
  const q = await r.json();
  assert.equal(r.status, 200);
  assert.equal(typeof q.left, 'number');
  assert.ok(q.limit > 0);
});
