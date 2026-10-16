/* FSRS fitted to the person: the 17 weights of FSRS-4.5 (js/store.js schedules with them) found from the history of
   answers kept on this device (js/idb.js), the way Anki's "Optimize" does, but in the browser.

   Each card's answers become a sequence; only the first answer of a day counts (FSRS-4.5 leaves same-day steps
   out). From the first answer the model starts a stability and a difficulty; before every later answer it predicts
   the chance of remembering after the days that passed, and the answer says whether that came true. Fitting lowers
   the log loss of those predictions, with a pull towards the default weights so that a short history cannot drag
   them far. The answers are split by time: the fit learns on the earlier ones and is judged on the later ones, and
   the new weights are kept only when they predict those better than the defaults. Nothing leaves the device. */
(() => {
  const A = (globalThis.App ||= {});
  const DAY = 864e5;
  const DEFAULT = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  // the ranges FSRS-4.5 allows each weight
  const LO = [0.1, 0.1, 0.1, 0.1, 1, 0.1, 0.1, 0, 0, 0, 0.01, 0.5, 0.01, 0.01, 0.01, 0, 1];
  const HI = [100, 100, 100, 100, 10, 5, 5, 0.75, 4, 0.8, 3, 5, 0.2, 0.9, 2, 1, 6];
  const DECAY = -0.5, FACTOR = 19 / 81;
  const MIN_REVIEWS = 300; // predictions to learn from, before a fit is worth anything

  const valid = (w) => Array.isArray(w) && w.length === 17 && w.every((x, i) => Number.isFinite(x) && x >= LO[i] - 1e-9 && x <= HI[i] + 1e-9);

  // the model with weights w (the same formulas as js/store.js)
  function model(w) {
    const clampD = (d) => Math.min(10, Math.max(1, d));
    const initD = (g) => clampD(w[4] - (g - 3) * w[5]);
    return {
      initD,
      initS: (g) => Math.max(0.1, w[g - 1]),
      recall: (days, s) => Math.pow(1 + (FACTOR * days) / s, DECAY),
      nextD: (d, g) => clampD(w[7] * initD(4) + (1 - w[7]) * (d - w[6] * (g - 3))),
      sAfterRecall: (d, s, r, g) => s * (Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * (g === 2 ? w[15] : 1) * (g === 4 ? w[16] : 1) + 1),
      sAfterLapse: (d, s, r) => w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)),
    };
  }

  /* The history (entries of js/idb.js) as sequences: [[{ t, g }…] per card], studied from its very first answer
     (a card whose first answer is not in the history started somewhere unknown, e.g. imported with progress). */
  function sequences(log) {
    const by = new Map();
    for (const e of log) {
      if (e.cram || !(e.g >= 1 && e.g <= 4) || !e.c) continue;
      const k = (e.p || '') + '\x1f' + e.c;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(e);
    }
    const out = [];
    for (const list of by.values()) {
      list.sort((a, b) => a.t - b.t);
      if (!list[0].n) continue;
      const seq = [];
      let day = -1;
      for (const e of list) {
        const d = Math.floor(e.t / DAY);
        if (d === day) continue; // a second answer the same day: a learning step, not a test of memory
        day = d;
        seq.push({ t: e.t, g: e.g });
      }
      if (seq.length >= 2) out.push(seq);
    }
    return out;
  }
  const predictions = (seqs) => seqs.reduce((n, s) => n + s.length - 1, 0);

  /* The sequences as flat arrays, read many times while fitting: for each card its first grade and how many
     answers follow, then for each answer the days since the one before, its grade and its time. */
  function flatten(seqs) {
    const n = predictions(seqs);
    const f = { cards: seqs.length, first: new Uint8Array(seqs.length), len: new Uint16Array(seqs.length), gap: new Float64Array(n), grade: new Uint8Array(n), t: new Float64Array(n) };
    let k = 0;
    seqs.forEach((seq, i) => {
      f.first[i] = seq[0].g;
      f.len[i] = Math.min(65535, seq.length - 1);
      for (let j = 1; j <= f.len[i]; j++, k++) { f.gap[k] = (seq[j].t - seq[j - 1].t) / DAY; f.grade[k] = seq[j].g; f.t[k] = seq[j].t; }
    });
    return f;
  }

  /* The mean log loss of the predictions of weights w. `from`/`to`: only predictions in that time span count
     (the time split of a fit); the model still runs through every answer. The formulas are js/store.js's, inline. */
  function lossFlat(w, f, from = -Infinity, to = Infinity) {
    const e8 = Math.exp(w[8]), d0 = Math.min(10, Math.max(1, w[4] - w[5])); // initD(4)
    let sum = 0, n = 0, k = 0;
    for (let i = 0; i < f.cards; i++) {
      const g0 = f.first[i];
      let s = Math.max(0.1, w[g0 - 1]), d = Math.min(10, Math.max(1, w[4] - (g0 - 3) * w[5]));
      for (let j = 0; j < f.len[i]; j++, k++) {
        const g = f.grade[k];
        let r = Math.pow(1 + (FACTOR * f.gap[k]) / s, DECAY);
        if (r > 0.9999) r = 0.9999; else if (r < 0.0001) r = 0.0001;
        const t = f.t[k];
        if (t >= from && t < to) { sum -= g > 1 ? Math.log(r) : Math.log(1 - r); n++; }
        if (g > 1) s = s * (e8 * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * (g === 2 ? w[15] : 1) * (g === 4 ? w[16] : 1) + 1);
        else s = Math.min(s, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
        if (!(s > 0.01)) s = 0.01;
        d = w[7] * d0 + (1 - w[7]) * (d - w[6] * (g - 3));
        if (d < 1) d = 1; else if (d > 10) d = 10;
      }
    }
    return n ? sum / n : NaN;
  }
  // the same for sequences as sequences() gives them (tests, and a look at a history)
  const loss = (w, seqs) => lossFlat(w, flatten(seqs));

  /* The first stabilities on their own, as FSRS does before the rest: for each grade of a first answer, the
     stability that best explains how the second answer went after the days that passed (a search over a log grid,
     with the default as a weak prior). Only grades with at least 20 such cards are moved. */
  function pretrain(f, w, to) {
    const out = w.slice();
    const pairs = [[], [], [], []];
    let k = 0;
    for (let i = 0; i < f.cards; i++) {
      if (f.len[i] && f.t[k] < to) pairs[f.first[i] - 1].push([f.gap[k], f.grade[k] > 1 ? 1 : 0]);
      k += f.len[i];
    }
    pairs.forEach((list, g) => {
      if (list.length < 20) return;
      let best = out[g], bestL = Infinity;
      for (let e = -1; e <= 2; e += 0.02) {
        const S = 10 ** e;
        let L = 0;
        for (const [gap, y] of list) {
          const r = Math.min(0.9999, Math.max(0.0001, Math.pow(1 + (FACTOR * gap) / S, DECAY)));
          L -= y ? Math.log(r) : Math.log(1 - r);
        }
        L += 2 * Math.log(S / DEFAULT[g]) ** 2; // a weak pull to the default
        if (L < bestL) { bestL = L; best = S; }
      }
      out[g] = Math.min(HI[g], Math.max(LO[g], best));
    });
    return out;
  }

  /* Adam on the weights scaled to their ranges (0…1), with gradients by finite differences, and a pull towards the
     defaults that weakens as the history grows; only predictions before `to` count. Yields to the page every few
     steps and stops early after `budgetMs`. */
  async function descend(f, start, { steps, to = Infinity, reviews, onStep, budgetMs = 20000 }) {
    const toU = (w) => w.map((x, i) => (x - LO[i]) / (HI[i] - LO[i]));
    const toW = (u) => u.map((x, i) => LO[i] + Math.min(1, Math.max(0, x)) * (HI[i] - LO[i]));
    const u0 = toU(DEFAULT);
    const pull = 30 / reviews; // weight of the defaults: strong for a short history, faint for a long one
    const objective = (u) => lossFlat(toW(u), f, -Infinity, to) + pull * u.reduce((a, x, i) => a + (x - u0[i]) ** 2, 0);
    let u = toU(start);
    const m = new Array(17).fill(0), v = new Array(17).fill(0);
    const lr = 0.02, b1 = 0.9, b2 = 0.999, h = 1e-4, began = Date.now();
    let best = u.slice(), bestF = objective(u);
    for (let step = 1; step <= steps; step++) {
      const fu = objective(u);
      const grad = u.map((_, i) => { const x = u.slice(); x[i] += h; return (objective(x) - fu) / h; });
      for (let i = 0; i < 17; i++) {
        m[i] = b1 * m[i] + (1 - b1) * grad[i];
        v[i] = b2 * v[i] + (1 - b2) * grad[i] ** 2;
        const mh = m[i] / (1 - b1 ** step), vh = v[i] / (1 - b2 ** step);
        u[i] = Math.min(1, Math.max(0, u[i] - (lr * mh) / (Math.sqrt(vh) + 1e-8)));
      }
      const nf = objective(u);
      if (nf < bestF) { bestF = nf; best = u.slice(); }
      if (step % 10 === 0) {
        onStep?.(step);
        await new Promise((r) => setTimeout(r, 0));
        if (Date.now() - began > budgetMs) break;
      }
    }
    return toW(best).map((x) => Math.round(x * 10000) / 10000);
  }

  /* Fit. The answers are split by time: weights learnt on the earlier 80% are judged on the later 20% against the
     defaults; when they predict those better, the final weights are learnt again from all the answers.
     → { ok, w, reviews, before, after }, or { ok: false, reviews, need } for too short a history.
     onStep(done, of) can show progress. */
  async function fit(log, { steps = 200, onStep } = {}) {
    const seqs = sequences(log);
    const reviews = predictions(seqs);
    if (reviews < MIN_REVIEWS) return { ok: false, reviews, need: MIN_REVIEWS - reviews };
    const f = flatten(seqs);
    const cut = Float64Array.from(f.t).sort()[Math.floor(f.t.length * 0.8)];
    const total = steps + Math.round(steps / 2);
    const early = await descend(f, pretrain(f, DEFAULT, cut), { steps, to: cut, reviews, onStep: (i) => onStep?.(i, total) });
    const before = lossFlat(DEFAULT, f, cut), after = lossFlat(early, f, cut);
    if (!(after < before)) return { ok: false, w: early, reviews, before, after };
    const w = await descend(f, pretrain(f, early, Infinity), { steps: Math.round(steps / 2), reviews, onStep: (i) => onStep?.(steps + i, total) });
    return { ok: true, w, reviews, before, after };
  }

  A.fsrs = { DEFAULT, LO, HI, MIN_REVIEWS, valid, model, sequences, loss, fit };
})();
