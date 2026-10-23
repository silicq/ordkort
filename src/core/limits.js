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
    shared: Number(env.AI_SHARED_TIMES) || 5,
  };
}

/* A school or an office is one address for a whole class, and a class spends one person's limits in minutes.
   Nothing tells a class from one busy person without knowing who is who, so the room is given by the site's state
   instead: while less than half of today's budget is spent, an address may go on up to `shared` times its own
   limits. Once the site is that busy, everyone is back to the ordinary limits, so the other half of the day is
   shared as before, however many addresses went past theirs. */
const SPARE = 0.5;
function capsOf(env, site) {
  const { perHour, perDay, budget, shared } = limitsOf(env);
  const k = site < budget * SPARE ? shared : 1;
  return { hour: perHour * k, day: perDay * k, perDay };
}
// what the browser is told: the ordinary limit, or the room past it while that room is open
const shown = ({ day, perDay }, used) => {
  const limit = used >= perDay ? day : perDay;
  return { left: Math.max(0, limit - used), limit };
};

export function network(ip) {
  if (!ip.includes(':')) return ip;
  if (ip.includes('.')) return ip.slice(ip.lastIndexOf(':') + 1); // ::ffff:203.0.113.7 is an IPv4 client
  const [head, tail] = ip.split('%')[0].toLowerCase().split('::');
  const a = head ? head.split(':') : [], b = tail ? tail.split(':') : [];
  const all = tail === undefined ? a : [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
  return all.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':');
}

/* The wider network an address belongs to: the /48 of an IPv6 one, which a script gets thousands of /64s from (one
   server's), while the people in it may be many too (a mobile operator gives each phone a /64 out of one). An IPv4
   address is its own network: the addresses beside it are other people's homes, and every one of them costs. */
export function wideNetwork(ip) {
  const n = network(ip);
  return n.includes(':') ? n.split(':').slice(0, 3).join(':') : n;
}

/* Client fingerprint: the full IPv4 address, or the /64 network for IPv6, then its wider network after a dot
   (networkOf). The IP itself is never stored. */
export async function clientKey(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const salt = env.IP_SALT || env.GROQ_API_KEY || 'ordkort';
  const [own, wide] = await Promise.all([hmac(salt, `${today()}|${network(ip)}`), hmac(salt, `${today()}|net|${wideNetwork(ip)}`)]);
  return `${own.slice(0, 24)}.${wide.slice(0, 16)}`;
}
// the fingerprint of a key's wider network (a key without one is its own network)
export const networkOf = (key) => String(key).split('.')[1] || String(key);
// the same for a key kept in a column named `who`, in SQL
export const NET_OF_WHO = "CASE WHEN instr(who, '.') THEN substr(who, instr(who, '.') + 1) ELSE who END";

/* Bursts: at most `limit` requests per `windowMs` from one fingerprint, within this isolate. A class opening the
   same deck at once is one fingerprint asking for every card's picture, so the limit is for floods, not people. */
const buckets = new Map();
export function burst(key, limit = 150, windowMs = 10000) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.t > windowMs) { b = { t: now, n: 0 }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.t > windowMs) buckets.delete(k);
  if (b.n > limit) throw new HttpError(429, 'slow_down');
}

/* What one wider network may take of the site's day, however many /64s it has: a quarter of the budget, and never
   less than a class behind one address may take while the site is quiet. Without it a script with a server's IPv6
   /48 would count as thousands of people and spend the whole day's budget for everyone. */
const NET_SHARE = 0.25;
const netCap = ({ budget, perDay, shared }) => Math.max(budget * NET_SHARE, perDay * shared);
/* The last part of the day's budget is kept for people who have hardly used the AI today (a twelfth of one person's
   day), and a network takes only a few of them from it, whatever it used before. On a day a script with many
   addresses spends the rest, someone who comes to look up a word still can, and to spend this part too the script
   needs many more addresses, from many networks. Nothing new is kept: daily counters like the others decide. */
const RESERVE = 0.2;
const lightOf = ({ perDay }) => Math.max(1, Math.round(perDay / 12));

/* Take one AI generation. Returns what is left and a function that gives it back (if the generation failed). */
const aiKeys = (key) => {
  const net = networkOf(key);
  return { kh: `ai:h:${key}:${hourStamp()}`, kd: `ai:d:${key}:${today()}`, kg: `ai:g:${today()}`, kn: `ai:n:${net}:${today()}`, kr: `ai:r:${net}:${today()}` };
};

export async function takeAI(env, key) {
  const lim = limitsOf(env);
  const db = env.DB;
  const { kh, kd, kg, kn, kr } = aiKeys(key);
  const taken = [[kh, 2 * HOUR], [kd, 26 * HOUR], [kg, 26 * HOUR], [kn, 26 * HOUR]];
  const [h, d, g, n] = await Promise.all(taken.map(([k, ttl]) => bump(db, k, ttl)));
  const refund = () => Promise.all(taken.map(([k, ttl]) => bump(db, k, ttl, -1))).catch(() => {});
  const refuse = async (code, extra) => { await refund(); throw new HttpError(429, code, extra); };
  if (g > lim.budget) await refuse('budget');
  if (g > lim.budget * (1 - RESERVE)) {
    const light = lightOf(lim);
    if (d > light) await refuse('budget');
    taken.push([kr, 26 * HOUR]);
    if ((await bump(db, kr, 26 * HOUR)) > light * 4) await refuse('budget');
  }
  // the site's count before this generation: the one that crosses half the budget is still let through
  const caps = capsOf(env, g - 1);
  if (h > caps.hour || d > caps.day || n > netCap(lim)) await refuse('quota', { left: 0, limit: shown(caps, d - 1).limit });
  return { ...shown(caps, d), refund };
}

// what the browser is told is left: the same rules as takeAI, read without taking anything
export async function aiLeft(env, key) {
  const lim = limitsOf(env);
  const { kd, kg, kn, kr } = aiKeys(key);
  const [used, site, n, r] = await Promise.all([kd, kg, kn, kr].map((k) => peek(env.DB, k)));
  const out = shown(capsOf(env, site), used);
  if (site >= lim.budget || n >= netCap(lim)) return { ...out, left: 0 };
  if (site >= lim.budget * (1 - RESERVE)) {
    const light = lightOf(lim);
    return { ...out, left: r >= light * 4 ? 0 : Math.min(out.left, Math.max(0, light - used)) };
  }
  return out;
}

/* Room in the database. Sync copies and their files, link codes, shared and published decks, voices are stored
   for anyone, without an account, so a script could fill D1 to its size limit in an hour and break the site for
   everybody. Every write that makes the database bigger takes its bytes from a daily allowance per fingerprint
   (enough for one person's whole set of pictures and recordings) and from one for the whole site. */
const MB = 1024 * 1024;
export function takeStore(env, key, bytes) {
  const perDay = (Number(env.STORE_PER_DAY_MB) || 100) * MB, site = (Number(env.STORE_SITE_DAY_MB) || 1000) * MB;
  return takeDaily(env, 'st', key, bytes, perDay, site, 'storage_full');
}

/* The library's check: every piece of a deck is one request to the moderating models, which share Groq's daily
   tokens with everything else. A big deck is up to a hundred of them, so they are counted too — per fingerprint
   and for the whole site, apart from the AI limits people see. */
export function takeGuard(env, key, n) {
  return takeDaily(env, 'gd', key, n, Number(env.GUARD_PER_DAY) || 60, Number(env.GUARD_SITE_DAY) || 400, 'budget');
}

// `amount` from a daily allowance per fingerprint and one for the whole site; nothing is taken when either is spent
async function takeDaily(env, name, key, amount, perDay, site, siteCode) {
  if (amount <= 0) return;
  const db = env.DB, kk = `${name}:${key}:${today()}`, kg = `${name}:g:${today()}`;
  const [k, g] = await Promise.all([bump(db, kk, 26 * HOUR, amount), bump(db, kg, 26 * HOUR, amount)]);
  if (k > perDay || g > site) {
    await Promise.all([bump(db, kk, 26 * HOUR, -amount), bump(db, kg, 26 * HOUR, -amount)]).catch(() => {});
    throw new HttpError(429, g > site ? siteCode : 'slow_down');
  }
}

/* A simple counter for sync and link codes (protection against guessing) */
export async function takeSimple(env, name, key, limit, ttlMs) {
  const n = await bump(env.DB, `${name}:${key}:${Math.floor(Date.now() / ttlMs)}`, ttlMs * 2);
  if (n > limit) throw new HttpError(429, 'slow_down');
}
