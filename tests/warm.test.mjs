// The base of ready decks the cron fills (src/ai/warm.js): the plan, which group comes next, and when it waits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';
import '../src/core/shared.js';
import { plan, nextGroup, quiet, CORE, READY } from '../src/ai/warm.js';
import { today } from '../src/core/util.js';

const list = plan(App.topics.list);

test('the plan: real languages and topics, no group twice, the first decks of the main pairs first', () => {
  const codes = new Set(App.langs.list.map((l) => l.code));
  const topics = new Set(App.topics.list.map((t) => t.id));
  assert.ok(list.length > 1500);
  assert.equal(new Set(list.map((g) => g.grp)).size, list.length);
  for (const g of list) {
    assert.ok(codes.has(g.target) && codes.has(g.native) && g.target !== g.native, g.grp);
    assert.ok(topics.has(g.topic), g.grp);
    assert.equal(g.grp, `${g.target}:${g.native}:${g.topic}:${g.level}`);
  }
  // what every newcomer gets, for the pairs the site is built around
  assert.deepEqual(list.slice(0, 3).map((g) => g.grp), ['nb:en:greetings:A1', 'nb:en:core:A1', 'nb:en:numbers:A1']);
  assert.equal(list.slice(0, CORE.length * 3).filter((g) => g.level === 'A1' && ['greetings', 'core', 'numbers'].includes(g.topic)).length, CORE.length * 3);
});

// a stand-in for D1 that knows how many words each group has
const fakeDB = (counts) => ({
  prepare: () => ({
    bind: (...grps) => ({ all: async () => ({ results: grps.filter((g) => counts[g]).map((g) => ({ grp: g, n: counts[g] })) }) }),
  }),
});

test('the next group is the first with fewer words than the app asks for', async () => {
  const full = Object.fromEntries(list.slice(0, 120).map((g) => [g.grp, READY]));
  assert.equal(await nextGroup(fakeDB(full), list), 120);
  assert.equal(await nextGroup(fakeDB({ ...full, [list[5].grp]: READY - 1 }), list), 5);
  assert.equal(await nextGroup(fakeDB({}), list, 7), 7);
  const all = Object.fromEntries(list.map((g) => [g.grp, 30]));
  assert.equal(await nextGroup(fakeDB(all), list), -1);
});

test('it waits while visitors use the AI and once 40% of the daily budget is used', () => {
  const day = today();
  assert.equal(quiet(null, 0, 2500), true);
  assert.equal(quiet({ day, used: 12 }, 12, 2500), true, 'nobody since the last turn');
  assert.equal(quiet({ day, used: 12 }, 13, 2500), false, 'a visitor generated something');
  assert.equal(quiet({ day: '2000-01-01', used: 900 }, 3, 2500), true, 'a new day');
  assert.equal(quiet(null, 1001, 2500), false, 'the budget is for visitors');
});

test('the cron runs it every 15 minutes, apart from the daily cleanup', () => {
  const cfg = read('wrangler.jsonc');
  assert.match(cfg, /"crons": \["17 3 \* \* \*", "\*\/15 \* \* \* \*"\]/);
  assert.match(read('src/worker.js'), /const DAILY = '17 3 \* \* \*'/);
});

test('it takes only a small, fixed share of the AI each day', () => {
  // Groq's free plan: 200,000 tokens a day per model, a list of words takes 5,000–7,000
  assert.match(read('wrangler.jsonc'), /"WARM_PER_DAY": "24"/);
  const src = read('src/ai/warm.js');
  assert.match(src, /env\.WARM_PER_DAY \?\? PER_DAY/);
  assert.ok(src.indexOf('enough for today') < src.indexOf("words(req, env, 'warm')"), 'the cap is checked before the AI is asked');
});
