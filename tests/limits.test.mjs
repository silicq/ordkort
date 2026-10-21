// Who is one person for the limits (src/core/limits.js): an IPv4 address, or an IPv6 /64 network however it is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { network, clientKey, takeAI, aiLeft } from '../src/core/limits.js';
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
