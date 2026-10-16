// The library (src/library.js) on a real SQLite (sql.js behind a D1-shaped wrapper), with Llama Guard faked:
// a deck is listed only after the check, an unsafe one is refused, and votes, adds, reports and take-downs work.
import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { initDB } from '../src/db.js';
import * as L from '../src/library.js';

const SQL = await initSqlJs();
function d1() {
  const db = new SQL.Database();
  const stmt = (sql, args = []) => ({
    first: async () => { const s = db.prepare(sql); s.bind(args); const row = s.step() ? s.getAsObject() : null; s.free(); return row; },
    all: async () => { const s = db.prepare(sql); s.bind(args); const results = []; while (s.step()) results.push(s.getAsObject()); s.free(); return { results }; },
    run: async () => { db.run(sql, args); return { meta: { changes: db.getRowsModified() } }; },
  });
  return {
    prepare: (sql) => ({ ...stmt(sql), bind: (...a) => stmt(sql, a) }),
    batch: async (list) => { for (const p of list) await p.run(); return []; },
  };
}

// what the moderating models answer: the policy model reads text, a vision model looks at a cover
let policy = '{"safe": true}';
let down = false; // every model fails
let pictures = 'ok'; // 'gone': no model that sees pictures answers
const seen = [];
const sees = (body) => Array.isArray(body.messages.at(-1).content);
function fakeGuard() {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    seen.push(body);
    if (down) return new Response('{}', { status: 500 });
    if (body.model.includes('llama-guard')) return new Response(JSON.stringify({ error: { code: 'model_decommissioned' } }), { status: 400 });
    if (sees(body) && pictures === 'gone') return new Response(JSON.stringify({ error: { code: 'model_decommissioned' } }), { status: 404 });
    // a piece too long for the plan's minute: refused while it is long
    if (!sees(body) && body.messages[1].content.length > 3000) return new Response(JSON.stringify({ error: { message: 'Request too large: tokens per minute (TPM): Limit 8000, Requested 9000' } }), { status: 413 });
    return new Response(JSON.stringify({ choices: [{ message: { content: policy } }] }));
  };
  return () => { globalThis.fetch = real; };
}

const env = { DB: d1(), GROQ_API_KEY: 'k', ADMIN_TOKEN: 'admin-secret-token' };
await initDB(env.DB);
const req = (path, { method = 'GET', body, headers = {} } = {}) => new Request('https://ordkort.test/api/' + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
const words = (n, t = 'ord') => Array.from({ length: n }, (_, i) => ({ term: `${t} ${i}`, tr: `word ${i}` }));
const deck = (title, extra = {}) => ({ deck: { title, emoji: '📚', level: 'A2', target: 'nb', native: 'en', words: words(8), ...extra } });
const jsonOf = async (r) => [r.status, await r.json()];

test('a checked deck is listed for its pair, found by its title, and opens', async () => {
  const restore = fakeGuard();
  try {
    policy = '{"safe": true}';
    const [s, pub] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Kjøkkenet', { cover: 'data:image/jpeg;base64,AAAA' }) }), env, 'k1'));
    assert.equal(s, 200);
    assert.match(pub.id, /^[0-9A-Z]{8}$/);
    assert.ok(pub.token.length >= 24, 'the publisher’s token to take it down');
    const words = seen.at(-2);
    assert.equal(words.model, 'openai/gpt-oss-safeguard-20b', 'a model told the policy reads the words');
    assert.match(words.messages[0].content, /vocabulary decks/);
    assert.match(words.messages[1].content, /Kjøkkenet/);
    assert.match(words.messages[1].content, /ord 7 — word 7/, 'the words are read');
    const look = seen.at(-1);
    assert.match(look.model, /qwen/, 'a model that sees pictures looks at the cover');
    assert.equal(look.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,AAAA');

    await L.publish(req('library', { method: 'POST', body: deck('Familien') }), env, 'k1');
    let [, page] = await jsonOf(await L.list(req('library?target=nb&native=en'), env));
    assert.deepEqual(page.decks.map((d) => d.title).sort(), ['Familien', 'Kjøkkenet']);
    [, page] = await jsonOf(await L.list(req('library?target=nb&native=en&q=kjøk'), env));
    assert.deepEqual(page.decks.map((d) => d.title), ['Kjøkkenet']);
    [, page] = await jsonOf(await L.list(req('library?target=nb&native=ru'), env));
    assert.equal(page.decks.length, 0, 'another pair sees nothing');
    const [, got] = await jsonOf(await L.get(env, pub.id));
    assert.equal(got.deck.words.length, 8);
  } finally { restore(); }
});

test('an unsafe deck is refused, and without the check nothing is published', async () => {
  const restore = fakeGuard();
  try {
    policy = '{"safe": false, "cats": ["S12"]}';
    const [s, r] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Bad') }), env, 'k2'));
    assert.equal(s, 422);
    assert.deepEqual(r.cats, ['S12']);
    policy = '{"safe": true}';
    down = true;
    await assert.rejects(L.publish(req('library', { method: 'POST', body: deck('Unchecked') }), env, 'k2'), (e) => e.status === 503);
    down = false;
    const [, page] = await jsonOf(await L.list(req('library?target=nb&native=en&q=bad'), env));
    assert.equal(page.decks.length, 0);
    await assert.rejects(L.publish(req('library', { method: 'POST', body: { deck: { title: 'Tiny', target: 'nb', native: 'en', words: words(3) } } }), env, 'k2'), (e) => e.status === 400, 'too few words');
  } finally { restore(); }
});

test('a big deck is read in pieces, halved when a piece is too long; a cover nobody can look at is left out', async () => {
  const restore = fakeGuard();
  try {
    pictures = 'gone';
    const from = seen.length;
    const long = Array.from({ length: 120 }, (_, i) => ({ term: `et langt ord nummer ${i}`, tr: `a long word number ${i}`, ex: `Dette er en ganske lang eksempelsetning nummer ${i}.`, img_url: i ? 'https://upload.wikimedia.org/a.jpg' : 'https://example.com/x.jpg' }));
    const [s, pub] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Huset', { cover: 'data:image/jpeg;base64,AAAA', words: long }) }), env, 'k5'));
    assert.equal(s, 200);
    assert.equal(pub.cover, false, 'the publisher is told the cover was left out');
    const read = seen.slice(from).filter((b) => !sees(b) && b.messages[1].content.length <= 3000).map((b) => b.messages[1].content).join('\n');
    assert.match(read, /nummer 0 —/);
    assert.match(read, /nummer 119 —/, 'every word is read, the last ones too');
    const [, got] = await jsonOf(await L.get(env, pub.id));
    assert.equal(got.deck.cover, undefined);
    assert.equal(got.deck.words[0].img_url, undefined, 'a picture from anywhere is dropped');
    assert.equal(got.deck.words[1].img_url, 'https://upload.wikimedia.org/a.jpg', 'one from the site’s sources stays');

    policy = 'nonsense';
    await assert.rejects(L.publish(req('library', { method: 'POST', body: deck('Unclear') }), env, 'k5'), (e) => e.status === 503 && /^policy: /.test(e.extra.why));
  } finally { restore(); pictures = 'ok'; policy = '{"safe": true}'; }
});

test('a Llama Guard named in GUARD_MODEL is asked first; when it is gone the policy model answers', async () => {
  const restore = fakeGuard();
  try {
    const from = seen.length;
    const [s] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Guarded') }), { ...env, GUARD_MODEL: 'meta-llama/llama-guard-4-12b' }, 'k6'));
    assert.equal(s, 200);
    assert.deepEqual(seen.slice(from).map((b) => b.model).slice(0, 2), ['meta-llama/llama-guard-4-12b', 'openai/gpt-oss-safeguard-20b']);
  } finally { restore(); }
});

test('votes and adds count once a day per person; reports from three people hide a deck', async () => {
  const restore = fakeGuard();
  try {
        const [, pub] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Tall') }), env, 'k3'));
    const act = (who, what, body = {}) => L.act(req(`library/${pub.id}/${what}`, { method: 'POST', body }), env, who, pub.id, what);
    await act('a', 'vote', { v: 1 });
    await act('a', 'vote', { v: 1 });
    await act('b', 'vote', { v: -1 });
    await act('a', 'add');
    await act('a', 'add');
    const [, got] = await jsonOf(await L.get(env, pub.id));
    assert.deepEqual([got.up, got.down, got.adds], [1, 1, 1]);

    await assert.rejects(act('a', 'report', { why: 'nonsense' }), (e) => e.status === 400);
    await act('a', 'report', { why: 'adult' });
    await act('a', 'report', { why: 'adult' }); // the same person again: once
    await act('b', 'report', { why: 'drugs' });
    assert.equal((await L.get(env, pub.id)).status, 200, 'two people: still listed');
    await act('c', 'report', { why: 'spam' });
    await assert.rejects(L.get(env, pub.id), (e) => e.status === 404, 'three people: hidden');
    const [, list] = await jsonOf(await L.hidden(req('library/hidden', { headers: { 'X-Admin-Token': 'admin-secret-token' } }), env));
    assert.ok(list.decks.some((d) => d.id === pub.id), 'waiting for the owner’s look');
  } finally { restore(); }
});

test('the publisher or the site’s owner takes a deck down; nobody else', async () => {
  const restore = fakeGuard();
  try {
        const [, a] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Mine') }), env, 'k4'));
    const [, b] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Other') }), env, 'k4'));
    const del = (id, headers) => L.remove(req('library/' + id, { method: 'DELETE', headers }), env, id);
    await assert.rejects(del(a.id, { 'X-Lib-Token': b.token }), (e) => e.status === 403, 'not with another deck’s token');
    await assert.rejects(del(a.id, { 'X-Admin-Token': 'wrong' }), (e) => e.status === 401);
    assert.equal((await del(a.id, { 'X-Lib-Token': a.token })).status, 200);
    assert.equal((await del(b.id, { 'X-Admin-Token': 'admin-secret-token' })).status, 200);
    await assert.rejects(L.get(env, b.id), (e) => e.status === 404);
    await assert.rejects(L.removeShare(req('share/ABCDEFGH', { method: 'DELETE' }), env, 'ABCDEFGH'), (e) => e.status === 403, 'shared links: the owner only');
  } finally { restore(); }
});
