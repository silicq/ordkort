// FSRS fitted to the person's answers (public/js/fsrs.js): the same model as the scheduler in js/store.js, the
// history read the way FSRS reads it, and a fit that finds a learner whose memory is not the default one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser, read } from './helpers.mjs';

const DAY = 864e5;
const T0 = Date.UTC(2026, 0, 1, 9);
// with the scheduler, in a fresh "tab"; the fit itself runs outside the VM, where it is several times faster
const { App } = browser(['public/js/fsrs.js', 'public/js/store.js']);
const plain = {};
new Function('globalThis', read('public/js/fsrs.js'))({ App: plain });
const F = plain.fsrs;

test('the fitting model is the scheduler’s own: the same stability after the same answers', () => {
  App.store.load();
  App.store.init({ native: 'en', target: 'nb', level: 'A1' });
  const c = { box: 0, s: 0, d: 0, due: 0, reps: 0, lapses: 0, last: 0 };
  const M = App.fsrs.model(App.fsrs.DEFAULT);
  let s, d, last;
  for (const [day, g] of [[0, 3], [3, 3], [10, 1], [11, 3], [30, 4]]) {
    const now = T0 + day * DAY;
    App.store.schedule(c, g > 1, now, false, g);
    if (s === undefined) { s = M.initS(g); d = M.initD(g); } else {
      const r = M.recall((now - last) / DAY, s);
      s = g > 1 ? M.sAfterRecall(d, s, r, g) : Math.min(s, M.sAfterLapse(d, s, r));
      d = M.nextD(d, g);
    }
    c.last = last = now;
    assert.ok(Math.abs(c.s - s) / s < 1e-3, `day ${day}: ${c.s} vs ${s}`); // the scheduler keeps 3 decimals
  }
});

test('the history is read as FSRS reads it', () => {
  const log = [
    { t: T0, p: 'nb:en', c: 'a', g: 3, n: 1 },
    { t: T0 + 600e3, p: 'nb:en', c: 'a', g: 3 }, // the same day: a learning step
    { t: T0 + 2 * DAY, p: 'nb:en', c: 'a', g: 1 },
    { t: T0 + 3 * DAY, p: 'nb:en', c: 'a', g: 3, cram: 1 }, // a quick run-through: not a test of memory
    { t: T0 + 5 * DAY, p: 'nb:en', c: 'a', g: 4 },
    { t: T0, p: 'nb:en', c: 'b', g: 3 }, // its first answer is not in the history
    { t: T0 + 2 * DAY, p: 'nb:en', c: 'b', g: 3 },
    { t: T0, p: 'de:en', c: 'a', g: 2, n: 1 }, // another language, another card
  ];
  const seqs = F.sequences(log);
  assert.equal(seqs.length, 1);
  assert.equal(JSON.stringify(seqs[0].map((x) => [Math.round((x.t - T0) / DAY), x.g])), '[[0,3],[2,1],[5,4]]');
});

// a learner whose memory is weaker than the defaults expect: words learnt fade faster
function learner(w, cards, seed = 7) {
  let x = seed;
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const M = F.model(w);
  const log = [];
  for (let c = 0; c < cards; c++) {
    let t = T0 + c * 3600e3, g = rnd() < 0.7 ? 3 : 1;
    log.push({ t, p: 'nb:en', c: 'c' + c, g, n: 1 });
    let s = M.initS(g), d = M.initD(g);
    for (let i = 0; i < 6; i++) {
      const gap = Math.max(1, Math.round(s * (0.5 + rnd() * 1.5))); // reviews around the time the defaults would pick
      t += gap * DAY;
      const r = M.recall(gap, s);
      g = rnd() < r ? (rnd() < 0.15 ? 4 : 3) : 1;
      log.push({ t, p: 'nb:en', c: 'c' + c, g });
      s = g > 1 ? M.sAfterRecall(d, s, r, g) : Math.min(s, M.sAfterLapse(d, s, r));
      d = M.nextD(d, g);
    }
  }
  return log;
}

test('too short a history: nothing is fitted, and it says how many answers are missing', async () => {
  const r = await F.fit(learner(F.DEFAULT, 20));
  assert.equal(r.ok, false);
  assert.equal(r.reviews, 120);
  assert.equal(r.need, F.MIN_REVIEWS - 120);
});

test('a learner unlike the defaults is predicted better after a fit, and the weights stay in their ranges', async () => {
  const weak = F.DEFAULT.slice();
  weak[0] = 0.2; weak[1] = 0.5; weak[2] = 1.2; weak[3] = 4; // first impressions fade faster
  weak[8] = 1.1; // and memory grows more slowly
  const r = await F.fit(learner(weak, 400));
  assert.ok(r.ok, `fitted ${r.after} vs default ${r.before}`);
  assert.ok(r.after < r.before, 'better on the later answers it did not learn from');
  assert.ok(F.valid(r.w));
  assert.ok(r.w[2] < F.DEFAULT[2], 'it found that "good" on a new word holds less than the defaults say');
});

test('the scheduler uses the person’s own weights once they are set, and the defaults otherwise', () => {
  App.store.load();
  App.store.init({ native: 'en', target: 'nb', level: 'A1' });
  const fresh = () => ({ box: 0, s: 0, d: 0, due: 0, reps: 0, lapses: 0, last: 0 });
  const a = fresh();
  App.store.schedule(a, true, T0, false, 3);
  assert.ok(Math.abs(a.s - F.DEFAULT[2]) < 1e-3); // kept with 3 decimals
  const own = [...F.DEFAULT]; own[2] = 1.5;
  App.store.set({ fsrs: { w: own, n: 500 } });
  const b = fresh();
  App.store.schedule(b, true, T0, false, 3);
  assert.equal(b.s, 1.5);
  App.store.set({ fsrs: null });
  const c = fresh();
  App.store.schedule(c, true, T0, false, 3);
  assert.ok(Math.abs(c.s - F.DEFAULT[2]) < 1e-3, 'back to the defaults');
});
