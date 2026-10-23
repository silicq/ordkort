/* Sync without accounts.
   Everything is encrypted in the browser (AES-256-GCM). The server stores only opaque bytes and a hash
   of the write token: it cannot read the data, because the key exists only on the devices.

   /api/pair  — a one-time "mailbox" for 3 minutes, for a link code or a one-off transfer;
                its content can be taken exactly once.
   /api/sync  — the encrypted copy for continuous sync between linked devices.
   /api/media — the files that copy refers to but cannot hold (recordings from Anki, photos of your own), one by one,
                each encrypted on the device with the copy's key; only who holds the copy's token reaches them. */
import { HttpError, json, readJSON, sha256, safeEqual, randomCode, isCode } from '../core/util.js';
import { takeSimple, takeStore } from '../core/limits.js';

const PAIR_TTL = 180 * 1000;
const MAX_BLOB = 1_900_000; // D1 stores strings of up to 2 MB
const HOUR = 36e5;

const b64ok = (s) => typeof s === 'string' && s.length > 16 && s.length <= MAX_BLOB && /^[A-Za-z0-9+/=]+$/.test(s);

/* ---------- one-time codes ---------- */

export async function pairCreate(request, env, key) {
  await takeSimple(env, 'pair-new', key, 20, HOUR);
  const body = await readJSON(request, MAX_BLOB + 1000);
  if (!b64ok(body.d)) throw new HttpError(400, 'bad_data');
  await takeStore(env, key, body.d.length);
  const exp = Date.now() + PAIR_TTL;
  // codes that were never taken are cleared here too, not only by the daily cron: they are up to 2 MB each
  await env.DB.prepare('DELETE FROM pair WHERE exp < ?').bind(Date.now()).run();
  for (let i = 0; i < 5; i++) {
    const id = randomCode(6);
    const r = await env.DB.prepare('INSERT OR IGNORE INTO pair (id, d, exp) VALUES (?, ?, ?)').bind(id, body.d, exp).run();
    if (r.meta.changes) return json({ id, ttl: PAIR_TTL / 1000 });
  }
  throw new HttpError(503, 'busy');
}

export async function pairTake(env, key, id, peekOnly) {
  if (!isCode(id, 6)) throw new HttpError(404, 'gone');
  if (peekOnly) {
    // the device that made the code asks every few seconds whether it was taken; trying codes this way is limited too
    await takeSimple(env, 'pair-peek', key, 600, HOUR);
    const row = await env.DB.prepare('SELECT exp FROM pair WHERE id = ? AND exp > ?').bind(id, Date.now()).first();
    return json({ alive: !!row });
  }
  // protection against guessing codes: at most 30 attempts per hour from one fingerprint
  await takeSimple(env, 'pair-get', key, 30, HOUR);
  const row = await env.DB.prepare('DELETE FROM pair WHERE id = ? RETURNING d, exp').bind(id).first();
  if (!row || row.exp < Date.now()) throw new HttpError(404, 'gone');
  return json({ d: row.d });
}

/* ---------- continuous sync ---------- */

async function authOf(request) {
  const token = request.headers.get('X-Sync-Token') || '';
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new HttpError(401, 'no_token');
  return sha256(token);
}

export async function syncGet(request, env, key, id) {
  const auth = await authOf(request);
  const row = await env.DB.prepare('SELECT auth, v, d FROM sync WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'none' }, 404);
  if (!safeEqual(row.auth, auth)) throw new HttpError(403, 'forbidden');
  const since = Number(new URL(request.url).searchParams.get('since'));
  if (since === row.v) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  return json({ v: row.v, d: row.d });
}

export async function syncPut(request, env, key, id) {
  await takeSimple(env, 'sync-put', key, 240, HOUR);
  const auth = await authOf(request);
  const body = await readJSON(request, MAX_BLOB + 1000);
  if (!b64ok(body.d)) throw new HttpError(400, 'bad_data');
  const expected = Number(body.v) || 0;
  const now = Date.now();

  const row = await env.DB.prepare('SELECT auth, v, length(d) AS n FROM sync WHERE id = ?').bind(id).first();
  if (row && !safeEqual(row.auth, auth)) throw new HttpError(403, 'forbidden');
  if (!row && expected === 0) {
    await takeStore(env, key, body.d.length);
    const r = await env.DB.prepare('INSERT OR IGNORE INTO sync (id, auth, v, d, t) VALUES (?, ?, 1, ?, ?)').bind(id, auth, body.d, now).run();
    if (r.meta.changes) return json({ v: 1 });
  } else if (row && row.v === expected) {
    // only what makes the copy bigger counts against the room in the database
    await takeStore(env, key, body.d.length - row.n);
    const r = await env.DB.prepare('UPDATE sync SET d = ?, v = v + 1, t = ? WHERE id = ? AND auth = ? AND v = ?')
      .bind(body.d, now, id, auth, expected).run();
    if (r.meta.changes) return json({ v: expected + 1 });
  }
  // nothing written: no copy, or someone else wrote first (version conflict)
  const cur = await env.DB.prepare('SELECT auth, v FROM sync WHERE id = ?').bind(id).first();
  if (!cur) throw new HttpError(404, 'none');
  if (!safeEqual(cur.auth, auth)) throw new HttpError(403, 'forbidden');
  return json({ error: 'conflict', v: cur.v }, 409);
}

export async function syncDelete(request, env, key, id) {
  await takeSimple(env, 'sync-put', key, 240, HOUR);
  const auth = await authOf(request);
  const r = await env.DB.prepare('DELETE FROM sync WHERE id = ? AND auth = ?').bind(id, auth).run();
  if (r.meta.changes) await env.DB.prepare('DELETE FROM media WHERE sid = ?').bind(id).run();
  return json({ deleted: !!r.meta.changes });
}

/* ---------- files of a copy ---------- */
const MEDIA_NAME = /^[pa][0-9a-f]{24}$/; // js/media.js: 'p' a picture, 'a' a recording, then a hash of the bytes
const MEDIA_MAX_FILES = 5000;
const MEDIA_MAX_BYTES = 150_000_000; // what one copy may keep, encrypted (about 110 MB of files)

// the copy must exist and the token must be its own
async function owner(request, env, id) {
  const auth = await authOf(request);
  const row = await env.DB.prepare('SELECT auth FROM sync WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'none');
  if (!safeEqual(row.auth, auth)) throw new HttpError(403, 'forbidden');
}

export async function mediaList(request, env, key, id) {
  await owner(request, env, id);
  const rows = (await env.DB.prepare('SELECT name FROM media WHERE sid = ?').bind(id).all()).results || [];
  return json({ names: rows.map((r) => r.name) });
}

export async function mediaGet(request, env, key, id, name) {
  if (!MEDIA_NAME.test(name)) throw new HttpError(404, 'gone');
  await takeSimple(env, 'media-get', key, 3000, HOUR);
  await owner(request, env, id);
  const row = await env.DB.prepare('SELECT d FROM media WHERE sid = ? AND name = ?').bind(id, name).first();
  if (!row) throw new HttpError(404, 'gone');
  return json({ d: row.d });
}

export async function mediaPut(request, env, key, id, name) {
  if (!MEDIA_NAME.test(name)) throw new HttpError(400, 'bad_name');
  await takeSimple(env, 'media-put', key, 1500, HOUR);
  await owner(request, env, id);
  const body = await readJSON(request, MAX_BLOB + 1000);
  if (!b64ok(body.d)) throw new HttpError(400, 'bad_data');
  const use = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(d)), 0) AS bytes FROM media WHERE sid = ?').bind(id).first();
  if ((use?.n || 0) >= MEDIA_MAX_FILES || (use?.bytes || 0) + body.d.length > MEDIA_MAX_BYTES) throw new HttpError(413, 'too_large');
  // a copy may hold 150 MB, and anyone can make copies: the bytes come from the room in the database (src/core/limits.js)
  if (!(await env.DB.prepare('SELECT 1 FROM media WHERE sid = ? AND name = ?').bind(id, name).first())) await takeStore(env, key, body.d.length);
  // a file's name is a hash of its bytes: the same name is the same file, so a second upload changes nothing
  await env.DB.prepare('INSERT OR IGNORE INTO media (sid, name, d, t) VALUES (?, ?, ?, ?)').bind(id, name, body.d, Date.now()).run();
  return json({ ok: true });
}
