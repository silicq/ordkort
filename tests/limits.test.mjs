// Who is one person for the limits (src/core/limits.js): an IPv4 address, or an IPv6 /64 network however it is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { network, wideNetwork, networkOf, clientKey, takeAI, aiLeft } from '../src/core/limits.js';
import { today } from '../src/core/util.js';

const key = (ip) => clientKey(new Request('https://ordkort.com/api/x', { headers: { 'CF-Connecting-IP': ip } }), { IP_SALT: 'test' });

// the two statements the counters use (src/core/db.js: bump, peek), over a Map
function counters() {
  const hits = new Map();
  const run = (sql, a) => {
    if (sql.startsWith('INSERT INTO hits')) { const n = (hits.get(a[0]) || 0) + a[1]; hits.set(a[0], n); return { n }; }
    if (sql.startsWith('SELECT n FROM hits')) return hits.has(a[0]) ? { n: hits.get(a[0]) } : null;
    throw new Error('unexpected ' + sql);
  };
  return { hits, prepare: (sql) => ({ bind: (...a) => ({ first: async () => run(sql, a) }) }) };
}
// small numbers, the same shape: 4 an hour, 10 a day, 100 for the site, 5 times past them while it is quiet
const env = (db = counters()) => ({ DB: db, AI_PER_HOUR: '4', AI_PER_DAY: '10', AI_DAILY_BUDGET: '100', AI_SHARED_TIMES: '5' });
const site = (e, n) => e.DB.hits.set(`ai:g:${today()}`, n);
async function take(e, k, n) {
  let ok = 0;
  for (let i = 0; i < n; i++) { try { await takeAI(e, k); ok++; } catch (err) { if (err.code !== 'quota') throw err; } }
  return ok;
}

test('an IPv6 address counts by its /64, whatever the way it is written', () => {
  for (const ip of ['2600:3c00::f03c:91ff:fe12:3456', '2600:3c00::abcd', '2600:3C00:0:0:1:2:3:4', '2600:3c00:0000:0000::1', '2600:3c00::'])
    assert.equal(network(ip), '2600:3c00:0:0', ip);
  assert.equal(network('::1'), '0:0:0:0');
  assert.equal(network('fe80::1%eth0'), 'fe80:0:0:0');
  assert.notEqual(network('2600:3c00:0:1::1'), network('2600:3c00:0:2::1'), 'another /64 is another person');
  // as Cloudflare writes it, with '::' past the fourth group: the same text as the first four groups, as it always was
  assert.equal(network('2001:db8:0:12:1:2:3:4'), '2001:db8:0:12');
  assert.equal(network('2001:db8:ab:12::1'), '2001:db8:ab:12');
});

test('an IPv4 address counts as itself, also when it comes as IPv6', () => {
  assert.equal(network('203.0.113.7'), '203.0.113.7');
  assert.equal(network('::ffff:203.0.113.7'), '203.0.113.7');
});

test('changing the device part of an IPv6 address does not give a new fingerprint', async () => {
  assert.equal(await key('2600:3c00::f03c:91ff:fe12:3456'), await key('2600:3c00::abcd:1:2:3'));
  assert.notEqual(await key('2600:3c00:0:1::1'), await key('2600:3c00:0:2::1'));
});

test('the wider network: the /48 of an IPv6 address; an IPv4 address is its own', async () => {
  assert.equal(wideNetwork('203.0.113.7'), '203.0.113.7', 'the addresses beside it are other homes');
  assert.equal(wideNetwork('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(wideNetwork('2600:3c00:12:34::1'), '2600:3c00:12');
  assert.equal(wideNetwork('2600:3c00:12::1'), '2600:3c00:12');
  assert.equal(wideNetwork('local'), 'local');
  // another /64 of the same /48: another person, the same network
  const [a, b, c] = await Promise.all([key('2600:3c00:12:1::1'), key('2600:3c00:12:2::1'), key('2600:3c00:13:1::1')]);
  assert.notEqual(a, b);
  assert.equal(networkOf(a), networkOf(b));
  assert.notEqual(networkOf(a), networkOf(c));
  assert.equal(networkOf('kari'), 'kari', 'a key without a network is its own');
});

test('thousands of /64s from one server’s /48 take no more than a quarter of the site’s day', async () => {
  const e = env();
  // 5 a day each past the ordinary 10 while the site is quiet, 100 for the site: one network stops at 50 (a class's room)
  let spent = 0;
  for (let i = 0; i < 40; i++) spent += await take(e, `bot${i}.lab`, 4);
  assert.equal(spent, 50, `took ${spent}`);
  assert.equal(await take(e, 'kari.home', 4), 4, 'another network still has its hour');
});

test('the last fifth of the budget is kept for people who have hardly used the AI today', async () => {
  const e = env();
  // one person's day is 10 here, so "hardly" is 1 a day, and 4 from one network
  assert.equal(await take(e, 'heavy.lab', 3), 3);
  site(e, 80);
  let err = await takeAI(e, 'heavy.lab').catch((x) => x);
  assert.equal(err.code, 'budget', 'someone who used the AI today waits for tomorrow');
  assert.equal(e.DB.hits.get(`ai:d:heavy.lab:${today()}`), 3, 'and is not charged for the refusal');
  // a script with many addresses: one each, and four from one network
  let got = 0;
  for (let i = 0; i < 10; i++) got += await takeAI(e, `bot${i}.farm`).then(() => 1, (x) => { if (x.code !== 'budget') throw x; return 0; });
  assert.equal(got, 4);
  const q = await takeAI(e, 'kari.home');
  assert.ok(q.left >= 0, 'someone new still gets an answer');
  err = await takeAI(e, 'kari.home').catch((x) => x);
  assert.equal(err.code, 'budget');
});

test('what the browser is told is left follows the same rules as taking one', async () => {
  const e = env();
  assert.deepEqual(await aiLeft(e, 'kari.home'), { left: 10, limit: 10 });
  // the reserve: someone who used the AI today is told there is none left, someone new one ("hardly" is 1 here)
  site(e, 80);
  assert.equal((await aiLeft(e, 'kari.home')).left, 1);
  await takeAI(e, 'kari.home');
  assert.equal((await aiLeft(e, 'kari.home')).left, 0);
  assert.equal((await takeAI(e, 'kari.home').catch((x) => x)).code, 'budget', 'and taking agrees');
  // a network that took its share of the day: none left for anyone in it
  const f = env();
  f.DB.hits.set(`ai:n:lab:${today()}`, 50);
  assert.equal((await aiLeft(f, 'new.lab')).left, 0);
  assert.equal((await takeAI(f, 'new.lab').catch((x) => x)).code, 'quota');
  site(f, 100);
  assert.equal((await aiLeft(f, 'kari.home')).left, 0, 'the site’s budget spent');
});

test('one person: the ordinary limits, the same answer as always', async () => {
  const e = env();
  const q = await takeAI(e, 'kari');
  assert.deepEqual([q.left, q.limit], [9, 10]);
  assert.deepEqual(await aiLeft(e, 'nobody'), { left: 10, limit: 10 });
});

test('a class behind one address goes on past one person’s limits while the site is quiet', async () => {
  const e = env();
  assert.equal(await take(e, 'school', 30), 20, 'five times the hour');
  // past its own day the address is told about the room it has, not that it has none
  assert.deepEqual(await aiLeft(e, 'school'), { left: 30, limit: 50 });
  const err = await takeAI(e, 'school').catch((x) => x);
  assert.equal(err.code, 'quota');
  assert.equal(err.extra.limit, 50);
  assert.equal(e.DB.hits.get(`ai:d:school:${today()}`), 20, 'a refused generation is given back');
});

test('once half of the site’s budget is spent, nobody goes past the ordinary limits', async () => {
  const e = env();
  site(e, 50);
  assert.equal(await take(e, 'school', 10), 4, 'one person’s hour');
  assert.deepEqual(await aiLeft(e, 'school'), { left: 6, limit: 10 });
  const err = await takeAI(e, 'school').catch((x) => x);
  assert.equal(err.extra.limit, 10);
});

test('however many addresses take the extra room, the second half of the day is shared as before', async () => {
  const e = env();
  // each address takes all it may in its hour: the room closes at half the budget, and not much past it
  let spent = 0;
  for (let i = 0; i < 6; i++) spent += await take(e, 'bot' + i, 30);
  assert.ok(spent <= 50 + 4 * 6, `took ${spent}`);
  assert.equal(await take(e, 'kari', 10), 4, 'someone else still has the ordinary hour');
});

test('the site’s budget is the end for everyone, and is not spent by refusals', async () => {
  const e = env();
  site(e, 100);
  const err = await takeAI(e, 'kari').catch((x) => x);
  assert.equal(err.code, 'budget');
  assert.equal(e.DB.hits.get(`ai:g:${today()}`), 100);
  assert.equal(e.DB.hits.get(`ai:d:kari:${today()}`), 0);
});
