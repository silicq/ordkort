/* Sync without accounts.
   Everything is encrypted in the browser (AES-256-GCM). The server stores only opaque bytes and a hash
   of the write token: it cannot read the data, because the key exists only on the devices.

   /api/pair  — a one-time "mailbox" for 3 minutes, for a link code or a one-off transfer;
                its content can be taken exactly once.
   /api/sync  — the encrypted copy for continuous sync between linked devices. */
import { HttpError, json, readJSON, sha256, safeEqual, randomCode, isCode } from './util.js';
import { takeSimple } from './limits.js';

const PAIR_TTL = 180 * 1000;
const MAX_BLOB = 1_900_000; // D1 stores strings of up to 2 MB
const HOUR = 36e5;

const b64ok = (s) => typeof s === 'string' && s.length > 16 && s.length <= MAX_BLOB && /^[A-Za-z0-9+/=]+$/.test(s);

/* ---------- one-time codes ---------- */

export async function pairCreate(request, env, key) {
  await takeSimple(env, 'pair-new', key, 20, HOUR);
  const body = await readJSON(request, MAX_BLOB + 1000);
  if (!b64ok(body.d)) throw new HttpError(400, 'bad_data');
  const exp = Date.now() + PAIR_TTL;
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

  if (expected === 0) {
    const r = await env.DB.prepare('INSERT OR IGNORE INTO sync (id, auth, v, d, t) VALUES (?, ?, 1, ?, ?)').bind(id, auth, body.d, now).run();
    if (r.meta.changes) return json({ v: 1 });
  } else {
    const r = await env.DB.prepare('UPDATE sync SET d = ?, v = v + 1, t = ? WHERE id = ? AND auth = ? AND v = ?')
      .bind(body.d, now, id, auth, expected).run();
    if (r.meta.changes) return json({ v: expected + 1 });
  }
  // nothing written: either a wrong token, or someone else wrote first (version conflict)
  const row = await env.DB.prepare('SELECT auth, v FROM sync WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'none');
  if (!safeEqual(row.auth, auth)) throw new HttpError(403, 'forbidden');
  return json({ error: 'conflict', v: row.v }, 409);
}

export async function syncDelete(request, env, key, id) {
  await takeSimple(env, 'sync-put', key, 240, HOUR);
  const auth = await authOf(request);
  const r = await env.DB.prepare('DELETE FROM sync WHERE id = ? AND auth = ?').bind(id, auth).run();
  return json({ deleted: !!r.meta.changes });
}
