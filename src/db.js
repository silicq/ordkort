/* D1: общий кэш ответов ИИ, банк слов, счётчики лимитов, синхронизация.
   Схема создаётся автоматически при первом запросе — миграции не нужны. */

const SCHEMA = [
  // Общий кэш: словарные статьи, главы, переводы, строки интерфейса. Без привязки к людям.
  'CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL)',
  // Банк слов по темам: «бесконечный словарь», растёт с каждым запросом.
  'CREATE TABLE IF NOT EXISTS words (id INTEGER PRIMARY KEY AUTOINCREMENT, grp TEXT NOT NULL, norm TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(grp, norm))',
  // Счётчики лимитов. Ключи — хэши IP с ежедневно меняющейся солью, живут не дольше двух суток.
  'CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL)',
  // Одноразовые коды привязки устройств: зашифрованы на устройстве, живут 3 минуты.
  'CREATE TABLE IF NOT EXISTS pair (id TEXT PRIMARY KEY, d TEXT NOT NULL, exp INTEGER NOT NULL)',
  // Синхронизация: зашифрованные на устройстве копии. Сервер не знает ключа.
  'CREATE TABLE IF NOT EXISTS sync (id TEXT PRIMARY KEY, auth TEXT NOT NULL, v INTEGER NOT NULL, d TEXT NOT NULL, t INTEGER NOT NULL)',
];

let ready = null;
export function initDB(db) {
  if (!ready) ready = db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => { ready = null; throw e; });
  return ready;
}

/* ---------- кэш ---------- */
const memo = new Map(); // маленький кэш внутри изолята, экономит чтения D1
const MEMO_MAX = 300;

export async function cacheGet(db, k, maxAgeMs = 0) {
  const m = memo.get(k);
  if (m && (!maxAgeMs || Date.now() - m.t < maxAgeMs)) return m.v;
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

function remember(k, v, t) {
  memo.delete(k);
  memo.set(k, { v, t });
  if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value);
}

/* ---------- счётчики ---------- */
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

/* ---------- уборка (раз в сутки по cron) ---------- */
export async function cleanup(db) {
  const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM hits WHERE exp < ?').bind(now),
    db.prepare('DELETE FROM pair WHERE exp < ?').bind(now),
    // синхронизация, к которой не обращались больше 400 дней
    db.prepare('DELETE FROM sync WHERE t < ?').bind(now - 400 * 864e5),
  ]);
}
