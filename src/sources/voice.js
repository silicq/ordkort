/* A voice for cards that have no recording of their own: GET /api/tts?l=nb&q=et%20hus → audio, or 404.

   1. A native speaker: the recording on the word's Wiktionary page (Lingua Libre and others on Wikimedia Commons,
      under free licences), for a single word. "et hus" is looked up as "hus".
   2. A synthetic voice from Workers AI (MeloTTS, on the site's own Cloudflare account: nothing goes to another
      company), for the languages it speaks: English, Spanish, French, Chinese, Japanese and Korean. Within a daily
      budget of characters for the whole site (TTS_DAILY_CHARS), well inside Workers AI's free daily allowance.
   3. Nothing: the browser then uses the system's voice.

   A native speaker's recording is kept in the shared cache for a year, so a word costs at most one lookup for
   everybody. A synthetic voice is not: it is a WAV several times the size of a recording, and making it again costs
   a fraction of the free allowance, so it is kept in Cloudflare's cache of the place it was asked from. The browser
   keeps every answer too. Only the text and its language reach the server. */
import { App } from '../core/shared.js';
import { cacheGet, cacheSet, cacheOf, bump } from '../core/db.js';
import { takeSimple, takeStore } from '../core/limits.js';
import { HttpError, str, sha256, readBytes, UA } from '../core/util.js';
import * as W from './wiktionary.js';

const YEAR = 365 * 864e5;
const MAX_BYTES = 1024 * 1024;
// the languages MeloTTS speaks, by its own codes (it says 'jp' and 'kr' where the site says 'ja' and 'ko')
export const MELO = { en: 'en', es: 'es', fr: 'fr', zh: 'zh', ja: 'jp', ko: 'kr' };
const MELO_MODEL = '@cf/myshell-ai/melotts';

const ARTICLES = /^(?:en|ei|et|ein|eit|der|die|das|le|la|les|el|los|las|il|lo|gli|un|une|una|uno|the|an?|to|å|att|ett|de|het|o|a|ο|η|το)\s+/i;
// the word itself when the text is one word (with its article or "to" at most)
export function singleWord(text) {
  const w = text.replace(ARTICLES, '').trim();
  return w && !/\s/.test(w) && w.length <= 40 ? w : '';
}

const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function speaker(env, lang, word) {
  const rec = await W.recording(cacheOf(env), lang, word, { budget: { left: 2 } }).catch(() => null);
  if (!rec) return null;
  const r = await fetch(rec.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) return null;
  const bytes = await readBytes(r.body, MAX_BYTES).catch(() => null); // stopped at 1 MB, not read whole
  if (!bytes?.length) return null;
  return { t: 'audio/mpeg', d: b64(bytes), by: rec.file ? `${rec.file} (Wikimedia Commons)` : 'Wikimedia Commons' };
}

/* MeloTTS answers a WAV at 44.1 kHz, 16-bit mono, with about half a second of silence around the word. The silence
   is cut (leaving a little, so the start is not clipped) and every two samples become one (22.05 kHz, enough for a
   voice): about a quarter of the size. A WAV of another shape is left as it is; anything else → null. */
const QUIET = 300, PAD = 0.08;
export function smallWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let fmt = null, data = null;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const size = v.getUint32(at + 4, true);
    if (tag(at) === 'fmt ') fmt = { format: v.getUint16(at + 8, true), channels: v.getUint16(at + 10, true), rate: v.getUint32(at + 12, true), bits: v.getUint16(at + 22, true) };
    if (tag(at) === 'data') { data = { at: at + 8, size: Math.min(size, bytes.length - at - 8) }; break; }
    at += 8 + size + (size & 1);
  }
  if (!fmt || !data) return null;
  if (fmt.format !== 1 || fmt.channels !== 1 || fmt.bits !== 16) return bytes;
  const n = data.size >> 1, sample = (i) => v.getInt16(data.at + 2 * i, true);
  let from = 0, to = n;
  while (from < n && Math.abs(sample(from)) < QUIET) from++;
  while (to > from && Math.abs(sample(to - 1)) < QUIET) to--;
  if (from >= to) return null; // silence only
  const pad = Math.round(fmt.rate * PAD);
  from = Math.max(0, from - pad); to = Math.min(n, to + pad);
  const half = fmt.rate >= 32000, rate = half ? fmt.rate / 2 : fmt.rate, count = half ? (to - from) >> 1 : to - from;
  const out = new Uint8Array(44 + count * 2), w = new DataView(out.buffer);
  const put = (at, text) => { for (let i = 0; i < 4; i++) out[at + i] = text.charCodeAt(i); };
  put(0, 'RIFF'); w.setUint32(4, 36 + count * 2, true); put(8, 'WAVE');
  put(12, 'fmt '); w.setUint32(16, 16, true); w.setUint16(20, 1, true); w.setUint16(22, 1, true);
  w.setUint32(24, rate, true); w.setUint32(28, rate * 2, true); w.setUint16(32, 2, true); w.setUint16(34, 16, true);
  put(36, 'data'); w.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    w.setInt16(44 + 2 * i, half ? (sample(from + 2 * i) + sample(from + 2 * i + 1)) >> 1 : sample(from + i), true);
  }
  return out;
}

// → a synthetic voice, or { later } when there is none now (not kept: a language MeloTTS does not speak, no Workers AI
// here, the day's budget spent, a failure)
async function synthetic(env, lang, text) {
  if (!MELO[lang] || !env.AI) return { later: true };
  const budget = Number(env.TTS_DAILY_CHARS) || 100000;
  const used = await bump(env.DB, `tts:c:${new Date().toISOString().slice(0, 10)}`, 26 * 36e5, text.length);
  if (used > budget) return { later: true }; // the day's characters are spent: tomorrow it works again
  const out = await env.AI.run(MELO_MODEL, { prompt: text, lang: MELO[lang] }).catch(() => null);
  if (typeof out?.audio !== 'string' || out.audio.length > MAX_BYTES * 8) return { later: true };
  let wav;
  try { wav = smallWav(unb64(out.audio)); } catch { wav = null; }
  return wav && wav.length <= MAX_BYTES ? { t: 'audio/wav', d: b64(wav), by: 'MeloTTS (Workers AI)', made: true } : { later: true };
}

// Cloudflare's cache of this place, for synthetic voices (absent in tests and on workers.dev: then nothing is kept)
const edge = () => globalThis.caches?.default || null;
const edgeKey = (k) => new Request(`https://ordkort.com/api/tts-cache/${k}`);

const answer = (v) => new Response(unb64(v.d), {
  headers: {
    'Content-Type': v.t,
    'Cache-Control': 'public, max-age=2592000',
    'X-Voice-By': encodeURIComponent(v.by || ''),
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
  },
});
const none = () => new Response(JSON.stringify({ error: 'none' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });

export async function tts(request, env, key) {
  const u = new URL(request.url);
  const lang = u.searchParams.get('l') || '';
  const text = str(u.searchParams.get('q'), 200).replace(/\s+/g, ' ').trim();
  if (!App.langs.has(lang) || !text) throw new HttpError(400, 'bad_request');
  const k = 'tts1:' + (await sha256(lang + '\n' + text.toLowerCase())).slice(0, 32);
  const hit = await cacheGet(env.DB, k, YEAR);
  if (hit) return hit.none ? none() : answer(hit);
  const made = await edge()?.match(edgeKey(k)).catch(() => null);
  if (made) return made;
  await takeSimple(env, 'tts', key, 300, 36e5);
  const word = singleWord(text);
  let v = word ? await speaker(env, lang, word) : null;
  if (!v) v = await synthetic(env, lang, text);
  if (v.later) return none();
  if (v.made) {
    const res = answer(v);
    await edge()?.put(edgeKey(k), res.clone()).catch(() => {});
    return res;
  }
  await takeStore(env, key, v.d.length); // a recording is kept for a year: up to 1 MB
  await cacheSet(env.DB, k, v);
  return answer(v);
}
