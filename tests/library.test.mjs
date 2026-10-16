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

let verdict = 'safe';
const seen = [];
function fakeGuard() {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    seen.push(body);
    if (verdict === 'down') return new Response('{}', { status: 500 });
    return new Response(JSON.stringify({ choices: [{ message: { content: verdict } }] }));
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
    verdict = 'safe';
    const [s, pub] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Kjøkkenet', { cover: 'data:image/jpeg;base64,AAAA' }) }), env, 'k1'));
    assert.equal(s, 200);
    assert.match(pub.id, /^[0-9A-Z]{8}$/);
    assert.ok(pub.token.length >= 24, 'the publisher’s token to take it down');
    const sent = seen.at(-1).messages[0].content;
    assert.match(sent[0].text, /Kjøkkenet/);
    assert.match(sent[0].text, /ord 7 — word 7/, 'the words are read');
    assert.equal(sent[1].image_url.url, 'data:image/jpeg;base64,AAAA', 'and the cover is looked at');

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
    verdict = 'unsafe\nS12';
    const [s, r] = await jsonOf(await L.publish(req('library', { method: 'POST', body: deck('Bad') }), env, 'k2'));
    assert.equal(s, 422);
    assert.deepEqual(r.cats, ['S12']);
    verdict = 'down';
    await assert.rejects(L.publish(req('library', { method: 'POST', body: deck('Unchecked') }), env, 'k2'), (e) => e.status === 503);
    verdict = 'safe';
    const [, page] = await jsonOf(await L.list(req('library?target=nb&native=en&q=bad'), env));
    assert.equal(page.decks.length, 0);
    await assert.rejects(L.publish(req('library', { method: 'POST', body: { deck: { title: 'Tiny', target: 'nb', native: 'en', words: words(3) } } }), env, 'k2'), (e) => e.status === 400, 'too few words');
  } finally { restore(); }
});

test('votes and adds count once a day per person; reports from three people hide a deck', async () => {
  const restore = fakeGuard();
  try {
    verdict = 'safe';
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
    verdict = 'safe';
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
