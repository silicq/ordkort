/* Shared server utilities: responses, errors, reading bodies, hashes, normalisation. */

export class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function errorResponse(e) {
  if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status);
  console.error('internal', e?.stack || e);
  return json({ error: 'internal' }, 500);
}

export async function readJSON(request, maxBytes) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'too_large');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large');
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('shape');
    return v;
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

/* A string from untrusted input: strings only, cut to length, without control characters */
export function str(v, max = 200) {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
export const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
export const int = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}
export async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
/* Constant-time comparison */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* The same normalisation as in the browser (store.js): for finding duplicate words */
const ART = /^(a|an|the|to|en|ei|et|ein|eit|å|der|die|das|ein|eine|le|la|les|un|une|el|los|las|il|lo|gli|uno|o|os|as|um|uma|het|ett|att|at|ο|η|το)\s+/i;
export const norm = (s) => String(s || '').toLowerCase().normalize('NFC')
  .replace(/[.,!?;:"«»“”„()[\]¿¡]/g, '').replace(/^l['’]/, '').trim().replace(ART, '').trim();

export const today = () => new Date().toISOString().slice(0, 10);
export const hourStamp = () => new Date().toISOString().slice(0, 13);

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function randomCode(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (const b of bytes) s += B32[b & 31];
  return s;
}
export const isCode = (s, len) => typeof s === 'string' && s.length === len && [...s].every((c) => B32.includes(c));
