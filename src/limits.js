/* Лимиты. Один общий ключ Groq на всех, поэтому:
   1) всплески запросов режутся в памяти изолята (без записи в базу);
   2) генерации ИИ считаются по «отпечатку» IP (хэш с солью, меняющейся каждый день) — в час и в сутки;
   3) общий суточный бюджет ИИ на весь сайт, чтобы не упереться в лимит Groq.
   Всё, что уже есть в общей базе, отдаётся без траты лимита. */
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

/* Отпечаток клиента: IPv4 целиком, у IPv6 — сеть /64. Сам IP нигде не сохраняется. */
export async function clientKey(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const net = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
  const salt = env.IP_SALT || env.GROQ_API_KEY || 'ordkort';
  return (await hmac(salt, `${today()}|${net}`)).slice(0, 24);
}

/* Всплески: не больше `limit` запросов за `windowMs` с одного отпечатка в пределах изолята */
const buckets = new Map();
export function burst(key, limit = 45, windowMs = 10000) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.t > windowMs) { b = { t: now, n: 0 }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.t > windowMs) buckets.delete(k);
  if (b.n > limit) throw new HttpError(429, 'slow_down');
}

/* Списать одну генерацию ИИ. Возвращает остаток и функцию возврата (если генерация не удалась). */
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

/* Простой счётчик для синхронизации и кодов привязки (защита от перебора) */
export async function takeSimple(env, name, key, limit, ttlMs) {
  const n = await bump(env.DB, `${name}:${key}:${Math.floor(Date.now() / ttlMs)}`, ttlMs * 2);
  if (n > limit) throw new HttpError(429, 'slow_down');
}
