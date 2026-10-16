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

test('four answers: again < hard < good < easy, and the preview does not touch the card', () => {
  const S = device();
  const c = { ...fresh(), box: 4, s: 10, d: 5, last: T0 - 10 * DAY, due: T0 };
  const before = JSON.stringify(c);
  const p = S.preview(c, T0);
  assert.equal(JSON.stringify(c), before);
  assert.equal(p[1], 10 * MIN, 'again: back in ten minutes');
  assert.ok(p[1] < p[2] && p[2] < p[3] && p[3] < p[4], JSON.stringify(Object.values(p).map(days)));
  const g = { ...c };
  assert.equal(S.schedule(g, true, T0, false, 2), 2);
  assert.equal(g.due - T0, p[2]);
  assert.equal(g.lapses, 0, 'hard is remembered, not a lapse');
});

test('a higher target retention brings words back sooner', () => {
  const S = device();
  const at = (r) => { S.set({ retention: r }); const c = { ...fresh(), box: 4, s: 20, d: 5, last: T0 - 20 * DAY }; S.schedule(c, true, T0); return days(c.due - T0); };
  const low = at(0.8), mid = at(0.9), high = at(0.95);
  assert.ok(low > mid && mid > high, `${low} > ${mid} > ${high}`);
});

test('a word forgotten six times is a leech, and a word set aside stays out of sessions', () => {
  const S = device();
  const deck = S.addDeck({ title: 'T', emoji: '🗂️', group: 'custom' });
  S.addCards(deck.id, [{ term: 'en gaffel', tr: 'fork' }, { term: 'en kniv', tr: 'knife' }]);
  const [a, b] = S.cards(deck.id);
  const c = S.card(a.id);
  let now = T0;
  S.schedule(c, true, now);
  for (let i = 0; i < 6; i++) { now += 30 * DAY; c.last = now - DAY; S.schedule(c, false, now); }
  assert.equal(c.lapses, 6);
  assert.equal(c.leech, 1);
  S.suspend(b.id);
  assert.ok(!S.buildSession(deck.id).includes(b.id));
  assert.ok(!S.cramQueue(deck.id).includes(b.id));
  S.suspend(b.id, false);
  assert.ok(S.buildSession(deck.id).includes(b.id));
  assert.deepEqual(S.cramQueue(deck.id, [a.id, 'gone']), [a.id], 'a chosen list keeps only existing cards');
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

test('each language has its own limit of new words a day', () => {
  const S = device();
  S.set({ newPerDay: 2 });
  const nb = S.addDeck({ title: 'N', emoji: '🗂️', group: 'custom' });
  S.addCards(nb.id, [{ term: 'et hus', tr: 'house' }, { term: 'en bil', tr: 'car' }, { term: 'ei jente', tr: 'girl' }]);
  for (const id of S.buildSession()) S.answer(id, true);
  assert.equal(S.newToday(), 2);
  assert.equal(S.overview().newLeft, 0);
  assert.equal(S.buildSession().length, 0, 'Norwegian is done for today');

  S.set({ target: 'es' });
  const es = S.addDeck({ title: 'E', emoji: '🗂️', group: 'custom' });
  S.addCards(es.id, [{ term: 'la casa', tr: 'house' }, { term: 'el perro', tr: 'dog' }]);
  assert.equal(S.overview().newLeft, 2, 'Spanish still has its own new words');
  assert.equal(S.buildSession().length, 2);
  S.answer(S.buildSession()[0], true);
  assert.equal(S.newToday(), 1);
  assert.equal(S.today().new, 3, 'the day still counts all new words together');

  S.set({ target: 'nb' });
  assert.equal(S.newToday(), 2);
});

test('a day counted before the limit was per language keeps its total for the language in use', () => {
  const S = device();
  const day = S.dayKey();
  S.merge({ pairs: {}, days: { [day]: { rev: 5, ok: 5, new: 5 } } });
  assert.equal(S.newToday(), 5);
  const d = S.addDeck({ title: 'N', emoji: '🗂️', group: 'custom' });
  S.addCards(d.id, [{ term: 'et hus', tr: 'house' }]);
  S.answer(S.cards()[0].id, true);
  assert.equal(S.newToday(), 6);
  assert.equal(S.today().new, 6);
});

test('the list of languages shows what is due in each', () => {
  const S = device();
  const d = S.addDeck({ title: 'N', emoji: '🗂️', group: 'custom' });
  S.addCards(d.id, [{ term: 'et hus', tr: 'house' }, { term: 'en bil', tr: 'car' }]);
  const [a] = S.cards();
  S.updateCard(a.id, { box: 2, s: 1, d: 5, due: Date.now() - 1000 });
  S.set({ target: 'es' });
  const e = S.addDeck({ title: 'E', emoji: '🗂️', group: 'custom' });
  S.addCards(e.id, [{ term: 'la casa', tr: 'house' }]);
  const by = Object.fromEntries(S.pairs().map((p) => [p.target, p]));
  assert.equal(by.nb.count, 2);
  assert.equal(by.nb.due, 1);
  assert.equal(by.es.due, 0, 'a new word is not due for review');
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

test('merge: new words per language take the maximum too, and survive a device without them', () => {
  const A = device(), B = device();
  const day = A.dayKey();
  const snapA = clone(A.snapshot());
  snapA.days = { [day]: { rev: 4, ok: 4, new: 4, nl: { 'nb:en': 3, 'es:en': 1 } } };
  const snapB = clone(B.snapshot());
  snapB.days = { [day]: { rev: 2, ok: 2, new: 2, nl: { 'es:en': 2 } } };
  B.merge(snapB);
  B.merge(snapA);
  assert.deepEqual(clone(B.days[day].nl), { 'nb:en': 3, 'es:en': 2 });

  const old = clone(A.snapshot());
  old.days = { [day]: { rev: 9, ok: 9, new: 4 } }; // an older version of the site did not count per language
  const r = B.merge(old);
  assert.deepEqual(clone(B.days[day].nl), { 'nb:en': 3, 'es:en': 2 });
  assert.ok(r.ahead, 'the other device still has to get them');
});

test('merge rejects garbage', () => {
  const A = device();
  assert.throws(() => A.merge(null));
  assert.throws(() => A.merge({ v: 1 }));
});

/* ---------- empty fields filled in by the AI (js/app.js, 20 cards at a time) ---------- */

test('a card needs filling when it has no word class, no example or no real translation', () => {
  const S = device();
  assert.ok(S.junkTr({ term: 'Hun er ikke så ung', tr: 'y' }), 'a single letter is not a translation');
  assert.ok(S.junkTr({ term: 'hus', tr: '' }));
  assert.ok(S.junkTr({ term: 'hus', tr: '123' }));
  assert.ok(S.junkTr({ term: 'hus', tr: 'hus' }), 'the term itself is not a translation');
  assert.ok(!S.junkTr({ term: 'hus', tr: 'house' }));
  assert.ok(S.needsFill({ term: 'hus', tr: 'house', pos: 'noun', ex: '' }));
  assert.ok(S.needsFill({ term: 'hus', tr: 'house', pos: '', ex: 'Vi bor i et hus.' }));
  assert.ok(!S.needsFill({ term: 'hus', tr: 'house', pos: 'noun', ex: 'Vi bor i et hus.' }));
  assert.ok(!S.needsFill({ term: 'hus', tr: 'y', pos: '', ex: '', af: 1 }), 'tried once: not again');
});

test('filling in changes only what is empty, and a translation that is not one', () => {
  const S = device();
  const card = { term: 'Hun er ikke så ung som hun ser ut.', tr: 'y', pos: '', gram: '', forms: '', pron: '', ex: '', exTr: '' };
  const w = { term: 'hun er ikke så ung som hun ser ut', tr: 'she is not as young as she looks', pos: 'phrase', gram: '', forms: '', pron: '/hʉn ær/', ex: 'Hun er ikke så ung som hun ser ut, faktisk.', ex_tr: 'She is not as young as she looks, actually.' };
  assert.deepEqual({ ...S.fillPatch(card, w) }, { af: 1, tr: w.tr, pos: 'phrase', pron: '/hʉn ær/', ex: w.ex, exTr: w.ex_tr });

  const own = { term: 'et hus', tr: 'дом, здание', pos: '', gram: 'my note', forms: '', pron: '', ex: 'Vi bor i et hus.', exTr: '' };
  const p = S.fillPatch(own, { term: 'et hus', tr: 'дом', pos: 'noun', gram: 'средний род', forms: 'huset, hus, husa', ex: 'Vi bor i et hus.', ex_tr: 'Мы живём в доме.', chk: 1, g: 'n' });
  assert.equal(p.tr, undefined, 'a real translation stays');
  assert.equal(p.gram, undefined, 'the person’s own text stays');
  assert.equal(p.ex, undefined);
  assert.equal(p.exTr, 'Мы живём в доме.', 'the given example gets its translation');
  assert.equal(p.forms, 'huset, hus, husa');
  assert.equal(p.chk, 1);
  assert.equal(p.g, 'n');

  const other = S.fillPatch({ ...own, exTr: '' }, { term: 'et hus', tr: 'дом', ex: 'Huset er stort.', ex_tr: 'Дом большой.' });
  assert.equal(other.exTr, undefined, 'a translation of another example is not put under the card’s own');
  assert.deepEqual({ ...S.fillPatch(card, null) }, { af: 1 }, 'nothing came back: tried all the same');
});
