// "What goes wrong" (public/js/views/insights.js): findings read from the history of answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';

const DAY = 864e5, NOW = Date.UTC(2026, 9, 1, 12);

function tab() {
  const { App } = browser(['public/js/langs.js', 'public/js/i18n/en.js', 'public/js/i18n.js', 'public/js/store.js', 'public/js/views/insights.js']);
  App.store.load();
  App.store.init({ native: 'en', target: 'nb', level: 'A1' });
  return App;
}
const A = tab();
const { analyse } = A.views.insights._test;
const settings = { retention: 0.9, newPerDay: 20, sessionSize: 20 };

let n = 0;
const card = (term, tr, extra = {}) => ({ id: 'c' + n++, term, tr, pos: 'noun', box: 3, due: NOW + DAY, lapses: 0, ...extra });
// an answer: g 1–4, mode, result and what was typed or picked
const ans = (c, g, more = {}) => ({ t: NOW - DAY, p: 'nb:en', c: c.id, g, n: 0, m: 'flip', d: 'f', pos: c.pos, ...more });

test('too few answers: nothing to say yet', () => {
  const c = card('et hus', 'house');
  const res = analyse([ans(c, 3)], [c], settings, NOW);
  assert.equal(res.enough, false);
  assert.equal(res.findings.length, 0);
});

test('reviews kept far below the aim: take fewer new words', () => {
  const cs = Array.from({ length: 10 }, (_, i) => card('ord' + i, 'word' + i));
  const log = cs.flatMap((c) => [ans(c, 1), ans(c, 1), ans(c, 3), ans(c, 3)]); // 50% kept
  const f = analyse(log, cs, settings, NOW).findings.find((x) => x.id === 'retention_low');
  assert.ok(f);
  assert.equal(f.vars.kept, '50%');
  assert.equal(f.action.kind, 'new_per_day');
  assert.equal(f.action.value, 10, 'half the new words');
});

test('leeches, confused pairs and wrong articles each become a finding', () => {
  const hus = card('et hus', 'house'), hytte = card('ei hytte', 'cabin'), eple = card('et eple', 'apple', { leech: 1, lapses: 7 });
  const cs = [hus, hytte, eple, ...Array.from({ length: 10 }, (_, i) => card('ord' + i, 'word' + i))];
  const log = [];
  for (const c of cs) for (let i = 0; i < 3; i++) log.push(ans(c, 3));
  log.push(ans(hus, 1, { m: 'choice', k: hytte.id }), ans(hytte, 1, { m: 'type', x: 'et hus' }));
  for (let i = 0; i < 3; i++) log.push(ans(eple, 2, { m: 'type', r: 'article', x: 'en eple' }));
  const f = Object.fromEntries(analyse(log, cs, settings, NOW).findings.map((x) => [x.id, x]));
  assert.deepEqual(f.leeches.cards.map((c) => c.term), ['et eple']);
  assert.equal(f.confused.pairs.length, 1);
  assert.deepEqual([f.confused.pairs[0].a.term, f.confused.pairs[0].b.term].sort(), ['ei hytte', 'et hus']);
  assert.equal(f.confused.pairs[0].n, 2);
  assert.equal(f.articles.vars.n, 3);
  assert.equal(f.articles.examples[0].x, 'en eple');
});

test('a mode far worse than the rest is named, and practising it is offered', () => {
  const cs = Array.from({ length: 20 }, (_, i) => card('ord' + i, 'word' + i));
  const log = [...cs.map((c) => ans(c, 3, { m: 'flip' })), ...cs.map((c) => ans(c, 3, { m: 'flip' })),
    ...cs.map((c, i) => ans(c, i < 12 ? 1 : 3, { m: 'listen' }))];
  const f = analyse(log, cs, settings, NOW).findings.find((x) => x.id === 'mode');
  assert.ok(f);
  assert.equal(f.action.value, 'listen');
  assert.equal(f.vars.r, '40%');
});

test('practice runs and set-aside words stay out of it', () => {
  const a = card('en bil', 'car', { leech: 1, lapses: 9, sus: 1 });
  const cs = [a, ...Array.from({ length: 12 }, (_, i) => card('ord' + i, 'word' + i))];
  const log = [];
  for (const c of cs) for (let i = 0; i < 3; i++) log.push(ans(c, 3), ans(c, 1, { cram: 1 }));
  const res = analyse(log, cs, settings, NOW);
  assert.equal(res.answers, cs.length * 3, 'practice runs are not counted');
  assert.ok(!res.findings.some((x) => x.id === 'leeches'), 'a word set aside is not a finding');
});
