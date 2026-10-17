// Opening an Ordkort link inside the app (public/js/openlink.js): any address of the site gives its route; others none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';

const { App, ctx } = browser(['public/js/openlink.js']);
ctx.location = { origin: 'https://ordkort.com' };
const r = App.openLink.routeOf;

test('a shared deck, a library deck, a look or a topic: the route the app opens', () => {
  assert.equal(r('https://ordkort.com/#/s/VB55KS8J'), '#/s/VB55KS8J');
  assert.equal(r('https://ordkort.com/s/vb55ks8j'), '#/s/VB55KS8J', 'the address chat apps show');
  assert.equal(r('  https://ordkort.com/#/lib/PP3618TS  '), '#/lib/PP3618TS');
  assert.equal(r('https://ordkort.com/look/AB12CD34/'), '#/look/AB12CD34');
  assert.equal(r('https://ordkort.com/#/?from=en&learn=nb&topic=work'), '#/?from=en&learn=nb&topic=work');
  assert.equal(r('https://claude-x-ordkort.example.workers.dev/#/s/VB55KS8J'), '#/s/VB55KS8J', 'a preview of the site too');
});

test('anything else is not opened', () => {
  for (const x of ['', 'hello', 'javascript:alert(1)', 'https://ordkort.com/', 'https://ordkort.com/#/settings', 'https://evil.example/#/nonsense', 'ftp://ordkort.com/#/s/VB55KS8J'])
    assert.equal(r(x), null, x);
});
