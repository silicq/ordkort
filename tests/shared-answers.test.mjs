// What everybody is served (src/ai/routes.js): a fresh answer counts against the day only when one was made, and a
// shared answer is dropped by reports from people in two networks, never from one network alone. On a real SQLite
// (sql.js behind a D1-shaped wrapper); Groq is faked: it refuses the key, so nothing is generated.
import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { initDB, cacheSet } from '../src/core/db.js';
import { App } from '../src/core/shared.js';
import { today, sha256 } from '../src/core/util.js';
import * as api from '../src/ai/routes.js';

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
const req = (body) => new Request('https://ordkort.test/api/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const id = App.topics.chapters[0].id;
// one database for the file: initDB makes the schema once per process
const DB = d1();
await initDB(DB);

test('a fresh answer that could not be made costs nothing of the day; past the day’s fresh answers, none is asked', async () => {
  const env = { DB, GROQ_API_KEY: 'k' };
  const real = globalThis.fetch;
  let asked = 0;
  globalThis.fetch = async () => { asked++; return new Response('{}', { status: 401 }); };
  try {
    for (let i = 0; i < 3; i++) await assert.rejects(api.chapter(req({ target: 'nb', native: 'en', id, fresh: true }), env, 'kari.home'), (e) => e.status === 503);
    const row = await env.DB.prepare('SELECT n FROM hits WHERE k = ?').bind(`fresh:kari.home:${today()}`).first();
    assert.equal(row?.n ?? 0, 0, 'three failed tries, nothing counted');
    await env.DB.prepare('INSERT INTO hits (k, n, exp) VALUES (?, 20, ?)').bind(`fresh:kari.home:${today()}`, Date.now() + 864e5).run();
    asked = 0;
    await assert.rejects(api.chapter(req({ target: 'nb', native: 'en', id, fresh: true }), env, 'kari.home'), (e) => e.status === 429 && e.code === 'slow_down');
    assert.equal(asked, 0, 'refused before the AI is asked');
  } finally { globalThis.fetch = real; }
});

test('a shared answer is dropped by reports from two networks, never by addresses of one network', async () => {
  const env = { DB };
  const k = `g1:nb:en:${id}`;
  await cacheSet(env.DB, k, { title: 'x' });
  const report = (who) => api.report(req({ target: 'nb', native: 'en', kind: 'chapter', id }), env, who).then((r) => r.json());
  // keys are an address's own fingerprint, then its network's after the dot (src/core/limits.js clientKey)
  assert.deepEqual(await report('a1.server'), { dropped: false });
  assert.deepEqual(await report('a2.server'), { dropped: false }, 'two addresses, one network');
  assert.deepEqual(await report('a3.server'), { dropped: false });
  assert.ok(await env.DB.prepare('SELECT 1 FROM cache WHERE k = ?').bind(k).first(), 'still served');
  assert.deepEqual(await report('kari.home'), { dropped: true }, 'a second network');
  assert.equal(await env.DB.prepare('SELECT 1 FROM cache WHERE k = ?').bind(k).first(), null);
});

test('a saved entry whose note and origin are in the language being learnt is served without them', async () => {
  const env = { DB };
  // a Russian speaker learning Chinese asked about "закономерность"; the note and the origin came in Chinese
  const k = `d1:zh:ru:${(await sha256('закономерность')).slice(0, 32)}`;
  await cacheSet(env.DB, k, {
    found: true, lemma: '规律', pos_label: 'существительное', tr: 'закономерность',
    note: '“规律”是名词，没有复数形式，常与有、无等动词连用。', etymology: '由“规”和“律”组合而成。',
  });
  const e = await (await api.lookup(req({ target: 'zh', native: 'ru', q: 'закономерность' }), env, 'kari.home')).json();
  assert.equal(e.lemma, '规律');
  assert.equal(e.tr, 'закономерность');
  assert.equal(e.pos_label, 'существительное', 'what is in Russian stays');
  assert.equal(e.note, '');
  assert.equal(e.etymology, '');
});

test('a new entry whose note came in the language being learnt is asked for once more, then left without it', async () => {
  // models of its own: the first test of this file has the AI refuse the key, which keeps its models aside a while
  const env = { DB, GROQ_API_KEY: 'k', GROQ_MODELS: 'z1' };
  const entry = (note) => ({ found: true, lemma: '规则', pos: 'noun', pos_label: 'существительное', tr: 'правило', senses: [], note, etymology: '' });
  const real = globalThis.fetch;
  let notes = [];
  let asked = 0;
  globalThis.fetch = async (url) => {
    if (!String(url).includes('groq')) throw new TypeError('offline'); // the dictionaries for the ground
    asked++;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(entry(notes.shift())) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const ask = async (q) => (await api.lookup(req({ target: 'zh', native: 'ru', q }), env, 'ola.home')).json();
  try {
    notes = ['“规则”是名词，常与“遵守”连用。', 'Не путайте с «规矩» — это скорее обычаи.'];
    assert.equal((await ask('правило')).note, 'Не путайте с «规矩» — это скорее обычаи.', 'the second answer, in Russian');
    assert.equal(asked, 2);
    notes = ['“规则”是名词。', '“规则”常与“遵守”连用。'];
    asked = 0;
    assert.equal((await ask('регламент')).note, '', 'Chinese twice: no note rather than one the reader may not read');
    assert.equal(asked, 2);
    notes = ['Слово нейтральное.'];
    asked = 0;
    assert.equal((await ask('норма')).note, 'Слово нейтральное.');
    assert.equal(asked, 1, 'a note in Russian is not asked for again');
  } finally { globalThis.fetch = real; }
});
