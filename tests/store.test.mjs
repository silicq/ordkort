// Spaced repetition (FSRS-4.5) and the device-to-device merge in public/js/store.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';

const MIN = 6e4, DAY = 864e5;
const T0 = Date.UTC(2026, 0, 1, 12);

function device() {
  const { App } = browser(['public/js/store.js']);
  App.store.load();
  App.store.init({ native: 'en', target: 'nb', level: 'A1' });
  return App.store;
}
const fresh = () => ({ box: 0, s: 0, d: 0, due: 0, reps: 0, lapses: 0, last: 0 });
const days = (ms) => Math.round(ms / DAY);

test('a brand-new word marked "I know it" jumps ahead about two weeks', () => {
  const S = device();
  const c = fresh();
  S.schedule(c, true, T0);
  assert.equal(days(c.due - T0), 14);
  assert.ok(c.box >= 4, 'counts as known');
  assert.equal(S.stage(c.box), 'known');
});

test('a forgotten word comes back in 10 minutes and counts a lapse only for reviews', () => {
  const S = device();
  const c = fresh();
  S.schedule(c, false, T0);
  assert.equal(c.due - T0, 10 * MIN);
  assert.equal(c.box, 1);
  assert.equal(c.lapses, 0, 'not knowing a new word is not a lapse');

  c.last = T0;
  S.schedule(c, true, T0 + 10 * MIN);
  const first = c.due - (T0 + 10 * MIN);
  assert.ok(first >= DAY, 'after relearning at least a day');

  c.last = T0 + 10 * MIN;
  const s = c.s;
  S.schedule(c, false, c.due);
  assert.equal(c.lapses, 1);
  assert.ok(c.s <= s, 'stability never grows after a lapse');
});

test('intervals grow with every successful review and stay within a year', () => {
  const S = device();
  const c = fresh();
  let now = T0, prev = 0;
  S.schedule(c, false, now); // learning a new word
  c.last = now;
  for (let i = 0; i < 12; i++) {
    now = Math.max(now + 10 * MIN, c.due);
    S.schedule(c, true, now);
    c.last = now;
    const gap = c.due - now;
    assert.ok(gap >= prev, `review ${i}: ${days(gap)}d should not be shorter than ${days(prev)}d`);
    assert.ok(gap <= 365 * DAY);
    prev = gap;
  }
  assert.equal(S.stage(c.box), 'mastered');
});

test('cards from the old Leitner boxes keep their progress', () => {
  const S = device();
  const c = { ...fresh(), box: 5, last: T0 - 16 * DAY, due: T0 };
  S.schedule(c, true, T0);
  assert.ok(c.s > 16, 'stability starts from the old box interval');
  assert.ok(days(c.due - T0) > 16);
});

test('difficulty stays within 1..10', () => {
  const S = device();
  const c = fresh();
  let now = T0;
  S.schedule(c, false, now);
  for (let i = 0; i < 30; i++) { c.last = now; now += DAY; S.schedule(c, i % 3 === 0, now); }
  assert.ok(c.d >= 1 && c.d <= 10, `d = ${c.d}`);
});

test('a half-right answer (the word in a wrong form) is not a lapse, but comes back sooner than a right one', () => {
  const S = device();
  const good = fresh(), hard = fresh();
  S.schedule(good, true, T0);
  S.schedule(hard, true, T0, true);
  assert.equal(days(hard.due - T0), 1, 'a new word answered in the wrong form is asked again tomorrow');
  assert.ok(hard.box < 4, 'still learning');

  let now = T0 + 30 * DAY;
  const a = { ...good, last: T0 }, b = { ...good, last: T0 };
  S.schedule(a, true, now);
  S.schedule(b, true, now, true);
  assert.equal(b.lapses, 0);
  assert.ok(b.s > good.s, 'remembered: stability still grows');
  assert.ok(b.due < a.due, 'but less than after a right answer');
  assert.ok(b.d > a.d, 'and the word counts as harder');
});

test('answer() updates reps, today stats and the card', () => {
  const S = device();
  const deck = S.addDeck({ title: 'T', emoji: '🗂️', group: 'custom' });
  assert.equal(S.addCards(deck.id, [{ term: 'et hus', tr: 'house' }, { term: 'en bil', tr: 'car' }, { term: 'et hus', tr: 'dup' }]), 2);
  const [a] = S.cards(deck.id);
  S.answer(a.id, true);
  const c = S.card(a.id);
  assert.equal(c.reps, 1);
  assert.ok(c.due > Date.now());
  assert.equal(S.today().rev, 1);
  assert.equal(S.today().ok, 1);
});

/* ---------- merge between devices ---------- */

const clone = (x) => JSON.parse(JSON.stringify(x));

test('merge: two devices end up with the same cards', () => {
  const A = device(), B = device();
  const da = A.addDeck({ title: 'A', emoji: '🅰️', group: 'custom' });
  A.addCards(da.id, [{ term: 'et hus', tr: 'house' }]);
  const db = B.addDeck({ title: 'B', emoji: '🅱️', group: 'custom' });
  B.addCards(db.id, [{ term: 'en bil', tr: 'car' }]);

  const r1 = B.merge(clone(A.snapshot()));
  assert.ok(r1.changed && r1.ahead, 'B got news and has news of its own');
  const r2 = A.merge(clone(B.snapshot()));
  assert.ok(r2.changed && !r2.ahead);
  const terms = (S) => clone(S.cards().map((c) => c.term).sort()); // plain arrays from the VM realm
  assert.deepEqual(terms(A), ['en bil', 'et hus']);
  assert.deepEqual(terms(B), terms(A));

  const again = A.merge(clone(B.snapshot()));
  assert.ok(!again.changed && !again.ahead, 'merging the same data twice changes nothing');
});

test('merge: the later edit wins, per card', async () => {
  const A = device(), B = device();
  const d = A.addDeck({ title: 'D', emoji: '🗂️', group: 'custom' });
  A.addCards(d.id, [{ term: 'et hus', tr: 'house' }]);
  B.merge(clone(A.snapshot()));
  const id = A.cards()[0].id;

  A.updateCard(id, { tr: 'a house' });
  await new Promise((r) => setTimeout(r, 5));
  B.updateCard(id, { tr: 'building' });

  A.merge(clone(B.snapshot()));
  B.merge(clone(A.snapshot()));
  assert.equal(A.card(id).tr, 'building');
  assert.equal(B.card(id).tr, 'building');
});

test('merge: a deletion is not undone by an older copy', async () => {
  const A = device(), B = device();
  const d = A.addDeck({ title: 'D', emoji: '🗂️', group: 'custom' });
  A.addCards(d.id, [{ term: 'et hus', tr: 'house' }, { term: 'en bil', tr: 'car' }]);
  B.merge(clone(A.snapshot()));
  const old = clone(B.snapshot());

  await new Promise((r) => setTimeout(r, 5));
  const gone = A.cards().find((c) => c.term === 'en bil').id;
  A.deleteCard(gone);
  A.merge(old); // an outdated device syncs back
  assert.equal(A.card(gone), null);

  B.merge(clone(A.snapshot()));
  assert.equal(B.card(gone), null);
  assert.equal(B.cards().length, 1);
});

test('merge: daily stats take the maximum, never double', () => {
  const A = device(), B = device();
  const day = A.dayKey();
  const snapA = clone(A.snapshot());
  snapA.days = { [day]: { rev: 5, ok: 4, new: 1 } };
  B.merge(snapA);
  B.merge(snapA);
  assert.deepEqual(clone(B.days[day]), { rev: 5, ok: 4, new: 1 });
});

test('merge rejects garbage', () => {
  const A = device();
  assert.throws(() => A.merge(null));
  assert.throws(() => A.merge({ v: 1 }));
});
