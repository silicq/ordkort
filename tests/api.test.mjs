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

test('a shared deck keeps its cover: a small data: URL or an https address, nothing else', async () => {
  const words = [{ term: 'et brød', tr: 'bread' }];
  let n = 0; // each share from its own address, so the limits of the other tests stay untouched
  const share = async (cover) => {
    const headers = { 'CF-Connecting-IP': `198.51.100.${++n}` };
    const r = await call('share', { method: 'POST', body: { deck: { title: 'Mat', target: 'nb', native: 'en', words, cover, cover_by: 'Kari, CC0' } }, headers });
    const { id } = await r.json();
    return (await (await call('share/' + id, { headers })).json()).deck;
  };
  const jpeg = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
  assert.equal((await share(jpeg)).cover, jpeg);
  assert.equal((await share(jpeg)).cover_by, 'Kari, CC0');
  assert.equal((await share('https://example.org/bread.jpg')).cover, 'https://example.org/bread.jpg');
  for (const bad of ['http://example.org/a.jpg', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,' + 'A'.repeat(50000)]) {
    const d = await share(bad);
    assert.equal(d.cover, undefined, bad.slice(0, 30));
    assert.equal(d.cover_by, undefined, 'no cover, no credit');
  }
});

test('the files of a sync copy: only its own token reaches them, and they go with the copy', async () => {
  const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');
  const token = 'M'.repeat(43), other = 'N'.repeat(43);
  const headers = (tok = token) => ({ 'X-Sync-Token': tok, 'CF-Connecting-IP': '198.51.100.200' });
  const name = 'a' + '0123456789abcdef01234567';
  assert.equal((await call(`media/${id}`, { headers: headers() })).status, 404, 'no copy, no files');
  await call('sync/' + id, { method: 'PUT', body: { v: 0, d: blob() }, headers: headers() });

  assert.deepEqual(await (await call(`media/${id}`, { headers: headers() })).json(), { names: [] });
  const file = blob(300);
  assert.equal((await call(`media/${id}/${name}`, { method: 'PUT', body: { d: file }, headers: headers() })).status, 200);
  assert.equal((await call(`media/${id}/${name}`, { method: 'PUT', body: { d: blob() }, headers: headers() })).status, 200, 'the same name again changes nothing');
  assert.deepEqual(await (await call(`media/${id}`, { headers: headers() })).json(), { names: [name] });
  assert.equal((await (await call(`media/${id}/${name}`, { headers: headers() })).json()).d, file, 'the first upload stays');

  assert.equal((await call(`media/${id}/${name}`, { headers: headers(other) })).status, 403, 'another token reads nothing');
  assert.equal((await call(`media/${id}/${name}`, { method: 'PUT', body: { d: blob() }, headers: headers(other) })).status, 403);
  assert.equal((await call(`media/${id}/x${name.slice(1)}`, { method: 'PUT', body: { d: blob() }, headers: headers() })).status, 400, 'only names of pictures and recordings');
  assert.equal((await call(`media/${id}/${name}`, { method: 'PUT', body: { d: 'not base64!' }, headers: headers() })).status, 400);

  await call('sync/' + id, { method: 'DELETE', headers: headers() });
  assert.equal((await call(`media/${id}/${name}`, { headers: headers() })).status, 404, 'deleting the copy deletes its files');
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

test('dictionary check: only languages that inflect, at most 10 words, no AI limit used', async () => {
  let r = await call('check', { method: 'POST', body: { target: 'zh', native: 'en', words: [{ term: '书', pos: 'noun' }] } });
  assert.equal(r.status, 400);
  r = await call('check', { method: 'POST', body: { target: 'de', native: 'en', words: [] } });
  assert.deepEqual(await r.json(), { words: [] });
  r = await call('check', { method: 'POST', body: { target: 'de', native: 'en', words: [{ term: 'guten Tag', pos: 'phrase' }] } });
  assert.deepEqual(await r.json(), { words: [null] }, 'a phrase is not checked');
  assert.equal(r.headers.get('X-AI-Left'), null);
});

test('Wiktionary entries: not for Norwegian (it has the official dictionary), not for an empty query', async () => {
  let r = await call('wikt', { method: 'POST', body: { target: 'nb', native: 'en', q: 'hus' } });
  assert.equal(r.status, 400);
  r = await call('wikt', { method: 'POST', body: { target: 'de', native: 'en', q: ' ' } });
  assert.equal(r.status, 400);
});

test('filling in many cards needs words, at most 20 of them', async () => {
  let r = await call('fillmany', { method: 'POST', body: { target: 'nb', native: 'en', words: [] } });
  assert.equal(r.status, 400);
  r = await call('fillmany', { method: 'POST', body: { target: 'nb', native: 'en', words: [{ term: '', tr: '' }] } });
  assert.equal(r.status, 400, 'a card with neither a word nor a translation');
  r = await call('fillmany', { method: 'POST', body: { target: 'xx', native: 'en', words: [{ term: 'hus', tr: '' }] } });
  assert.equal(r.status, 400, 'an unknown language');
});

test('pictures: the proxy takes only https addresses, the search needs a word', async () => {
  for (const u of ['', 'not a url', 'http://example.com/a.jpg', 'javascript:alert(1)', 'https://user:pw@example.com/a.jpg']) {
    const r = await call('img?u=' + encodeURIComponent(u));
    assert.equal(r.status, 400, u);
  }
  const r = await call('images', { method: 'POST', body: { q: '  ' } });
  assert.equal(r.status, 400);
});

/* ---------- MCP: Ordkort for people's own AI ---------- */
const rpc = async (msg, headers = {}) => {
  const r = await harness.fetch(BASE + '/mcp', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(msg) });
  return { status: r.status, body: r.status === 202 ? null : await r.json() };
};

test('MCP: handshake, tools, and a version the client asked for', async () => {
  let r = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  assert.equal(r.body.result.protocolVersion, '2025-03-26');
  assert.equal(r.body.result.serverInfo.name, 'ordkort');
  assert.ok(r.body.result.capabilities.tools);
  r = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(r.status, 202, 'a notification gets no answer');
  r = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(r.body.result.tools.map((x) => x.name), ['list_languages', 'list_topics', 'ready_words', 'find_pictures', 'design_guide', 'create_deck', 'create_design']);
  for (const tool of r.body.result.tools) assert.equal(tool.inputSchema.type, 'object', tool.name);
  r = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_languages', arguments: {} } });
  assert.ok(r.body.result.structuredContent.languages.some((l) => l.code === 'nb'));
  r = await rpc({ jsonrpc: '2.0', id: 4, method: 'nope' });
  assert.equal(r.body.error.code, -32601);
  r = await rpc([{ jsonrpc: '2.0', id: 5, method: 'ping' }, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_topics' } }]);
  assert.equal(r.body.length, 2, 'a batch gets a batch');
  assert.ok(r.body[1].result.structuredContent.topics.some((x) => x.id === 'greetings'));
  // other sites may call it (an AI's servers have no Origin of ours), and a GET is not a stream here
  r = await rpc({ jsonrpc: '2.0', id: 7, method: 'ping' }, { Origin: 'https://claude.ai' });
  assert.equal(r.status, 200);
  const g = await harness.fetch(BASE + '/mcp');
  assert.equal(g.status, 405);
});

test('MCP: a deck with pictures and a look become links that open them', async () => {
  let r = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_deck', arguments: {
    title: 'Kjøkken', target: 'nb', native: 'en', level: 'A1', cover_url: 'https://example.org/kitchen.jpg', cover_credit: 'Ola, CC BY 4.0',
    cards: [{ term: 'en gaffel', translation: 'fork', image_url: 'https://example.org/fork.jpg', image_credit: 'Kari, CC BY 4.0' }, { term: 'en kniv', translation: 'knife' }, { term: '', translation: 'nothing' }],
  } } });
  const url = r.body.result.structuredContent.url;
  assert.match(url, /^https:\/\/ordkort\.com\/#\/s\/[A-Za-z0-9]{8}$/);
  assert.equal(r.body.result.structuredContent.cards, 2, 'a card without a word is dropped');
  let s = await call('share/' + url.slice(-8));
  const { deck } = await s.json();
  assert.equal(deck.title, 'Kjøkken');
  assert.equal(deck.words[0].img_url, 'https://example.org/fork.jpg');
  assert.equal(deck.words[0].img_by, 'Kari, CC BY 4.0');
  assert.equal(deck.cover, 'https://example.org/kitchen.jpg', 'the AI can give the deck a cover');
  assert.equal(deck.cover_by, 'Ola, CC BY 4.0');

  r = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'create_design', arguments: { name: 'Calm', front_html: '<b>{{term}}</b>', card_css: '.tpl b { color: teal; }' } } });
  const look = r.body.result.structuredContent.url;
  assert.match(r.body.result.content[0].text, /Powered by ordkort\.com/, 'the AI is asked to name the site');
  assert.equal(r.body.result.structuredContent.notes.length, 0, 'a tidy design has nothing to note');
  assert.match(look, /#\/look\/[A-Za-z0-9]{8}$/);
  s = await call('share/' + look.slice(-8));
  const d = (await s.json()).deck;
  assert.equal(d.kind, 'look');
  assert.equal(d.front, '<b>{{term}}</b>');

  r = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'create_deck', arguments: { title: 'x', target: 'xx', native: 'en', cards: [{ term: 'a', translation: 'b' }] } } });
  assert.equal(r.body.result.isError, true, 'an unknown language is an error the AI can read');
  r = await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'create_design', arguments: { name: 'Loud', site_css: 'button, a { color: red !important; }' } } });
  assert.equal(r.body.result.structuredContent.notes.length, 1, 'wide selectors with !important are pointed out');
  r = await rpc({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'create_design', arguments: { name: 'Blur', site_css: 'header.top { backdrop-filter: blur(8px); }\n.tabs { position: absolute; top: 0; }' } } });
  assert.equal(r.body.result.structuredContent.notes.length, 2, 'what would move the phone’s tab bar is pointed out');
  r = await rpc({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'design_guide' } });
  assert.match(r.body.result.content[0].text, /var\(--card-image\)/);
  r = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_design', arguments: { name: 'Empty' } } });
  assert.equal(r.body.result.isError, true);
  r = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'ready_words', arguments: { target: 'nb', native: 'en', topic: 'greetings' } } });
  assert.ok(Array.isArray(r.body.result.structuredContent.words), 'the bank may be empty here, but the answer has a list');
});

test('limits endpoint reports the daily allowance', async () => {
  const r = await call('limits');
  const q = await r.json();
  assert.equal(r.status, 200);
  assert.equal(typeof q.left, 'number');
  assert.ok(q.limit > 0);
});
