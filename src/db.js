/* D1: the shared cache of AI answers, the word bank, limit counters, sync.
   The schema is created automatically on the first request — no migrations needed. */

const SCHEMA = [
  // Shared cache: dictionary entries, chapters, translations, interface strings. Not linked to anyone.
  'CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL)',
  // Word bank by topic: an "endless dictionary" that grows with every request.
  'CREATE TABLE IF NOT EXISTS words (id INTEGER PRIMARY KEY AUTOINCREMENT, grp TEXT NOT NULL, norm TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(grp, norm))',
  // Limit counters. Keys are IP hashes with a salt that changes daily; they live two days at most.
  'CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL)',
  // One-time device link codes: encrypted on the device, live for 3 minutes.
  'CREATE TABLE IF NOT EXISTS pair (id TEXT PRIMARY KEY, d TEXT NOT NULL, exp INTEGER NOT NULL)',
  // Sync: copies encrypted on the device. The server does not know the key.
  'CREATE TABLE IF NOT EXISTS sync (id TEXT PRIMARY KEY, auth TEXT NOT NULL, v INTEGER NOT NULL, d TEXT NOT NULL, t INTEGER NOT NULL)',
  // Reports about wrong AI answers: after a few independent reports the shared entry is regenerated.
  'CREATE TABLE IF NOT EXISTS reports (k TEXT NOT NULL, who TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (k, who))',
  // Decks shared by link (public to anyone who has the link, deleted after a year).
  'CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, d TEXT NOT NULL, t INTEGER NOT NULL)',
];

let ready = null;
export function initDB(db) {
  if (!ready) ready = db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => { ready = null; throw e; });
  return ready;
}

/* ---------- cache ---------- */
const memo = new Map(); // a small per-isolate cache that saves D1 reads
const MEMO_MAX = 300;

export async function cacheGet(db, k, maxAgeMs = 0) {
  const m = memo.get(k);
  // the in-isolate copy lives 10 minutes, so a regenerated entry reaches every isolate soon
  if (m && Date.now() - m.at < 600000 && (!maxAgeMs || Date.now() - m.t < maxAgeMs)) return m.v;
  const row = await db.prepare('SELECT v, t FROM cache WHERE k = ?').bind(k).first();
  if (!row) return null;
  if (maxAgeMs && Date.now() - row.t > maxAgeMs) return null;
  const v = JSON.parse(row.v);
  remember(k, v, row.t);
  return v;
}

export async function cacheSet(db, k, v) {
  const t = Date.now();
  await db.prepare('INSERT INTO cache (k, v, t) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = ?2, t = ?3')
    .bind(k, JSON.stringify(v), t).run();
  remember(k, v, t);
}

export function cacheForget(k) { memo.delete(k); }

function remember(k, v, t) {
  memo.delete(k);
  memo.set(k, { v, t, at: Date.now() });
  if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value);
}

/* ---------- counters ---------- */
export async function bump(db, k, ttlMs, by = 1) {
  const row = await db.prepare(
    'INSERT INTO hits (k, n, exp) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET n = n + ?2 RETURNING n',
  ).bind(k, by, Date.now() + ttlMs).first();
  return row?.n ?? by;
}
export async function peek(db, k) {
  const row = await db.prepare('SELECT n FROM hits WHERE k = ?').bind(k).first();
  return row?.n ?? 0;
}

/* ---------- cleanup (once a day, by cron) ---------- */
export async function cleanup(db) {
  const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM hits WHERE exp < ?').bind(now),
    db.prepare('DELETE FROM pair WHERE exp < ?').bind(now),
    // sync copies nobody has touched for more than 400 days
    db.prepare('DELETE FROM sync WHERE t < ?').bind(now - 400 * 864e5),
    db.prepare('DELETE FROM reports WHERE t < ?').bind(now - 30 * 864e5),
    db.prepare('DELETE FROM shares WHERE t < ?').bind(now - 365 * 864e5),
  ]);
}
