// Where the cards live (public/js/store.js with public/js/idb.js): in IndexedDB when the browser has it, moved there
// once from localStorage without losing anything, and back in localStorage when IndexedDB is missing or fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { browser } from './helpers.mjs';

const KEY = 'ordkort.v1';
// a browser tab; `db` is the browser's IndexedDB (shared by its tabs), `ls` what its localStorage holds
async function tab({ db = null, ls = {} } = {}) {
  const t = browser(['public/js/idb.js', 'public/js/store.js']);
  if (db) Object.assign(t.ctx, { indexedDB: db, IDBKeyRange });
  for (const [k, v] of Object.entries(ls)) t.localStorage.setItem(k, v);
  await t.App.store.open();
  t.App.store.load();
  return t;
}
const words = (n) => Array.from({ length: n }, (_, i) => ({ term: `ord ${i}`, tr: `word ${i}` }));
const cardsOf = (t) => [...t.App.store.cards().map((c) => c.term)].sort(); // an array of this realm, not the tab's

test('without IndexedDB everything stays in localStorage, as before', async () => {
  const t = await tab();
  t.App.store.init({ native: 'en', target: 'nb' });
  t.App.store.addCards(t.App.store.addDeck({ title: 'Hjem', manual: true }).id, words(3));
  assert.equal(t.App.store.where, 'localstorage');
  assert.equal(JSON.parse(t.localStorage.getItem(KEY)).settings.target, 'nb');
});

test('cards kept in localStorage are moved to IndexedDB once, with nothing lost', async () => {
  const old = await tab();
  old.App.store.init({ native: 'ru', target: 'nb' });
  old.App.store.addCards(old.App.store.addDeck({ title: 'Mat', manual: true }).id, words(5));
  const before = old.localStorage.getItem(KEY);

  const db = new IDBFactory();
  const t = await tab({ db, ls: { [KEY]: before } });
  assert.equal(t.App.store.where, 'indexeddb');
  assert.deepEqual(cardsOf(t), cardsOf(old), 'the same cards');
  assert.equal(t.App.store.settings.native, 'ru');
  assert.equal(t.localStorage.getItem(KEY), null, 'and the room in localStorage is free again');

  // a change is written to IndexedDB, and the next visit reads it from there
  t.App.store.addCards(t.App.store.decks()[0].id, [{ term: 'et hus', tr: 'дом' }]);
  await t.App.store.flushed();
  const next = await tab({ db });
  assert.equal(next.App.store.where, 'indexeddb');
  assert.ok(cardsOf(next).includes('et hus'));
  assert.equal(next.localStorage.getItem(KEY), null);
});

test('a state bigger than localStorage could ever hold is kept', async () => {
  const db = new IDBFactory();
  const t = await tab({ db });
  t.App.store.init({ native: 'en', target: 'nb' });
  const id = t.App.store.addDeck({ title: 'Stor', manual: true }).id;
  t.App.store.addCards(id, Array.from({ length: 6000 }, (_, i) => ({ term: `ord ${i}`, tr: `word ${i}`, ex: 'x'.repeat(900) })));
  await t.App.store.flushed();
  const next = await tab({ db });
  assert.equal(next.App.store.cards(id).length, 6000);
  assert.ok(next.App.store.usage() > 5 * 1024, 'more than the ~5 MB localStorage allows');
});

test('a big import made within milliseconds keeps every card: no two get the same id', async () => {
  // with five random characters, two of 6,000 cards shared an id in one import of eight, and one card was lost
  const t = await tab();
  t.App.store.init({ native: 'en', target: 'nb' });
  const id = t.App.store.addDeck({ title: 'Anki', manual: true }).id;
  t.App.store.addCards(id, words(20000));
  const cards = t.App.store.cards(id);
  assert.equal(cards.length, 20000);
  assert.equal(new Set(cards.map((c) => c.id)).size, 20000);
});

test('when IndexedDB refuses a write, the state goes to localStorage and is read from there next time', async () => {
  const db = new IDBFactory();
  const t = await tab({ db });
  t.App.store.init({ native: 'en', target: 'nb' });
  await t.App.store.flushed();
  t.App.idb.kvPut = () => Promise.reject(new Error('QuotaExceededError'));
  t.App.store.addCards(t.App.store.addDeck({ title: 'Full', manual: true }).id, words(2));
  await t.App.store.flushed();
  assert.equal(t.App.store.where, 'localstorage');
  const saved = t.localStorage.getItem(KEY);
  assert.ok(saved && JSON.parse(saved).settings, 'written to localStorage instead');

  const next = await tab({ db, ls: { [KEY]: saved } });
  assert.deepEqual(cardsOf(next), ['ord 0', 'ord 1'], 'the newer state, not an older one left in IndexedDB');
});

test('erasing everything erases it from IndexedDB too', async () => {
  const db = new IDBFactory();
  const t = await tab({ db });
  t.App.store.init({ native: 'en', target: 'nb' });
  await t.App.store.flushed();
  t.App.store.resetAll();
  await t.App.store.flushed();
  const next = await tab({ db });
  assert.equal(next.App.store.ready, false);
});
