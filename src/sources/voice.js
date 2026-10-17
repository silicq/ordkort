/* A voice for cards that have no recording of their own: GET /api/tts?l=nb&q=et%20hus → audio, or 404.

   1. A native speaker: the recording on the word's Wiktionary page (Lingua Libre and others on Wikimedia Commons,
      under free licences), for a single word. "et hus" is looked up as "hus".
   2. A synthetic voice, when the GOOGLE_TTS_KEY secret is set: Google Cloud Text-to-Speech, within a daily budget of
      characters for the whole site (TTS_DAILY_CHARS), so the free tier is not overrun.
   3. Nothing: the browser then uses the system's voice.

   Whatever is found is kept in the shared cache for a year, so a word costs at most one lookup for everybody, and
   the browser keeps the answer too. Only the text and its language reach the server. */
import { App } from '../core/shared.js';
import { cacheGet, cacheSet, cacheOf, bump } from '../core/db.js';
import { takeSimple, takeStore } from '../core/limits.js';
import { HttpError, str, sha256, readBytes, UA } from '../core/util.js';
import * as W from './wiktionary.js';

const YEAR = 365 * 864e5;
const MAX_BYTES = 1024 * 1024;
// Google's name for a voice's language where it differs from the browser's (js/langs.js)
const GOOGLE_LANG = { ar: 'ar-XA', zh: 'cmn-CN', nn: 'nb-NO', prs: 'fa-IR', kmr: 'ku', tl: 'fil-PH', he: 'he-IL' };

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

// → a voice; null when Google has no voice for the language (kept); { later } when it cannot speak now (not kept:
// no key yet, the day's budget spent, a failure)
async function synthetic(env, lang, text) {
  if (!env.GOOGLE_TTS_KEY) return { later: true };
  const budget = Number(env.TTS_DAILY_CHARS) || 30000;
  const used = await bump(env.DB, `tts:c:${new Date().toISOString().slice(0, 10)}`, 26 * 36e5, text.length);
  if (used > budget) return { later: true }; // the day's characters are spent: not cached, tomorrow it works again
  const languageCode = GOOGLE_LANG[lang] || App.langs.get(lang).tts;
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env.GOOGLE_TTS_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { text }, voice: { languageCode }, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 } }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!r) return { later: true };
  if (r.status === 400) return null; // a language Google has no voice for: nothing to come back for
  if (!r.ok) return { later: true };
  const data = await r.json().catch(() => null);
  return typeof data?.audioContent === 'string' && data.audioContent.length < MAX_BYTES * 1.4 ? { t: 'audio/mpeg', d: data.audioContent, by: 'Google Text-to-Speech' } : { later: true };
}

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
  await takeSimple(env, 'tts', key, 300, 36e5);
  const word = singleWord(text);
  let v = word ? await speaker(env, lang, word) : null;
  if (!v) v = await synthetic(env, lang, text);
  if (v?.later) return none();
  if (v) await takeStore(env, key, v.d.length); // a voice is kept for a year: up to 1 MB
  await cacheSet(env.DB, k, v || { none: 1 });
  return v ? answer(v) : none();
}
