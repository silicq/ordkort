/* Limits. There is one shared Groq key for everybody, so:
   1) request bursts are cut in the isolate's memory (no database writes);
   2) AI generations are counted per IP "fingerprint" (a hash with a salt that changes daily) — per hour and per day;
   3) there is a daily AI budget for the whole site, so that we never hit Groq's own limit.
   Anything already in the shared base is served without touching the limit. */
import { HttpError, hmac, today, hourStamp } from './util.js';
import { bump, peek } from './db.js';

const HOUR = 36e5;

export function limitsOf(env) {
  return {
    perHour: Number(env.AI_PER_HOUR) || 40,
    perDay: Number(env.AI_PER_DAY) || 120,
    budget: Number(env.AI_DAILY_BUDGET) || 2500,
  };
}

/* Client fingerprint: the full IPv4 address, or the /64 network for IPv6. The IP itself is never stored. */
export async function clientKey(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const net = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
  const salt = env.IP_SALT || env.GROQ_API_KEY || 'ordkort';
  return (await hmac(salt, `${today()}|${net}`)).slice(0, 24);
}

/* Bursts: at most `limit` requests per `windowMs` from one fingerprint, within this isolate */
const buckets = new Map();
export function burst(key, limit = 45, windowMs = 10000) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.t > windowMs) { b = { t: now, n: 0 }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.t > windowMs) buckets.delete(k);
  if (b.n > limit) throw new HttpError(429, 'slow_down');
}

/* Take one AI generation. Returns what is left and a function that gives it back (if the generation failed). */
export async function takeAI(env, key) {
  const { perHour, perDay, budget } = limitsOf(env);
  const db = env.DB;
  const kh = `ai:h:${key}:${hourStamp()}`, kd = `ai:d:${key}:${today()}`, kg = `ai:g:${today()}`;
  const [h, d, g] = await Promise.all([bump(db, kh, 2 * HOUR), bump(db, kd, 26 * HOUR), bump(db, kg, 26 * HOUR)]);
  const refund = () => Promise.all([bump(db, kh, 2 * HOUR, -1), bump(db, kd, 26 * HOUR, -1), bump(db, kg, 26 * HOUR, -1)]).catch(() => {});
  if (g > budget) { await refund(); throw new HttpError(429, 'budget'); }
  if (h > perHour || d > perDay) { await refund(); throw new HttpError(429, 'quota', { left: 0, limit: perDay }); }
  return { left: Math.max(0, perDay - d), limit: perDay, refund };
}

export async function aiLeft(env, key) {
  const { perDay } = limitsOf(env);
  const used = await peek(env.DB, `ai:d:${key}:${today()}`);
  return { left: Math.max(0, perDay - used), limit: perDay };
}

/* A simple counter for sync and link codes (protection against guessing) */
export async function takeSimple(env, name, key, limit, ttlMs) {
  const n = await bump(env.DB, `${name}:${key}:${Math.floor(Date.now() / ttlMs)}`, ttlMs * 2);
  if (n > limit) throw new HttpError(429, 'slow_down');
}
