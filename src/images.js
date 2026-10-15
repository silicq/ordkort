/* Pictures for cards.
   search — free, openly licensed images for a word, from Openverse (api.openverse.org). The answers are kept in the
            shared cache for 30 days, so a word someone looked up before costs Openverse nothing.
   proxy  — fetches one picture for the browser, which then shrinks it and keeps it on the device. The page may load
            nothing from other sites (CSP), and the person's IP never reaches them. Only https, only raster images
            (no SVG), at most 5 MB, under a per-person hourly limit. */
import { cacheGet, cacheSet } from './db.js';
import { takeSimple } from './limits.js';
import { HttpError, json, readJSON, str, sha256 } from './util.js';

const UA = 'Ordkort (https://ordkort.com; a free language-learning site)';
const MONTH = 30 * 864e5;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const license = (r) => `${r.license === 'cc0' || r.license === 'pdm' ? r.license.toUpperCase() : 'CC ' + String(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim();

export async function search(request, env, key) {
  const b = await readJSON(request, 2000);
  return json(await find(env, key, b.q));
}

// { results: [{ thumb, by, license, page }] } for a word or phrase (also used by the MCP server)
export async function find(env, key, query) {
  const q = str(query, 80);
  if (!q) throw new HttpError(400, 'empty');
  const k = 'img1:' + (await sha256(q.toLowerCase())).slice(0, 32);
  const hit = await cacheGet(env.DB, k, MONTH);
  if (hit) return hit;
  await takeSimple(env, 'imgq', key, 60, 36e5);
  // licences that allow changes: the picture is shrunk and re-encoded on the device
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=18&mature=false&license_type=modification`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) throw new HttpError(503, 'busy');
  const data = await res.json().catch(() => null);
  const out = {
    results: (Array.isArray(data?.results) ? data.results : [])
      .filter((r) => r.thumbnail && /^https:\/\//.test(r.thumbnail))
      .slice(0, 18)
      .map((r) => ({
        thumb: r.thumbnail,
        by: str([r.title ? `“${r.title}”` : '', r.creator ? `${r.creator}` : ''].filter(Boolean).join(', '), 160),
        license: license(r),
        page: str(r.foreign_landing_url || '', 400),
      })),
  };
  await cacheSet(env.DB, k, out);
  return out;
}

export async function proxy(request, env, key) {
  const u = new URL(request.url).searchParams.get('u') || '';
  let target;
  try { target = new URL(u); } catch { throw new HttpError(400, 'bad_url'); }
  if (target.protocol !== 'https:' || target.username || target.password) throw new HttpError(400, 'bad_url');
  await takeSimple(env, 'img', key, 300, 36e5);
  const res = await fetch(target.href, {
    headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' }, // Openverse refuses a narrower list (406); the type is checked below
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
    cf: { cacheTtl: 7 * 86400, cacheEverything: true },
  }).catch(() => null);
  if (!res?.ok) throw new HttpError(502, 'unavailable');
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!TYPES.includes(type)) throw new HttpError(415, 'not_image');
  if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) throw new HttpError(413, 'too_large');
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_BYTES) throw new HttpError(413, 'too_large');
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=604800',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
