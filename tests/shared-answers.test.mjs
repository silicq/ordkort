// What everybody is served (src/ai/routes.js): a fresh answer counts against the day only when one was made, and a
// shared answer is dropped by reports from people in two networks, never from one network alone. On a real SQLite
// (sql.js behind a D1-shaped wrapper); Groq is faked: it refuses the key, so nothing is generated.
import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { initDB, cacheSet } from '../src/core/db.js';
import { App } from '../src/core/shared.js';
import { today } from '../src/core/util.js';
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
