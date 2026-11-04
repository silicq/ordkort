// Reading mode keeps its texts on the device (public/js/readlib.js): the recent ones, the saved ones and the earlier
// wordings of an edited text, each with its analysis, so going back costs no AI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';

// a tab with an IndexedDB of its own, or one shared with another tab
function tab(kv = new Map()) {
  const { App, localStorage } = browser(['public/js/readlib.js']);
  App.idb = {
    kvGet: async (k) => (kv.has(k) ? structuredClone(kv.get(k)) : undefined),
    kvPut: async (k, v) => { kv.set(k, structuredClone(v)); },
  };
  return { L: App.readlib, localStorage, kv };
}
const glossed = (text) => [{ text, gloss: { translation: 'x', words: text.split(' ').map((w) => ({ w: w.toLowerCase(), tr: '?' })) } }];
const settle = () => new Promise((r) => setTimeout(r, 0));

test('a text read before opens again with its analysis, and stays after the tab is closed', async () => {
  const { L, kv } = tab();
  await L.ready();
  const a = L.start('nb:en', 'Det var en kald morgen.', glossed('Det var en kald morgen.'));
  assert.equal(L.current('nb:en'), a);
  assert.equal(L.current('de:en'), null, 'another language pair reads its own texts');
  L.close();
  assert.equal(L.current('nb:en'), null);
  const again = L.start('nb:en', 'Det var en kald morgen.', [{ text: 'Det var en kald morgen.' }]);
  assert.equal(again.id, a.id, 'the same wording is the same text');
  assert.ok(again.parts[0].gloss, 'its analysis is kept: no AI again');
  await settle();
  const other = tab(kv);
  await other.L.ready();
  assert.equal(other.L.current('nb:en').text, 'Det var en kald morgen.');
  assert.equal(other.L.list('nb:en').recent.length, 1);
});

test('editing a text keeps the earlier wording as a version, with its analysis, and any version comes back', async () => {
  const { L } = tab();
  await L.ready();
  const x = L.start('nb:en', 'Kari tok bussen.', glossed('Kari tok bussen.'));
  L.edit(x.id, 'Kari tok toget.', [{ text: 'Kari tok toget.' }]);
  assert.equal(x.text, 'Kari tok toget.');
  assert.equal(x.versions.length, 1);
  assert.equal(x.versions[0].text, 'Kari tok bussen.');
  assert.ok(x.versions[0].parts[0].gloss, 'the version keeps its analysis');
  // back to the first wording: the two change places, nothing is lost
  L.restore(x.id, 0);
  assert.equal(x.text, 'Kari tok bussen.');
  assert.ok(x.parts[0].gloss);
  assert.deepEqual([...x.versions.map((v) => v.text)], ['Kari tok toget.']);
  // typing a wording that is already a version takes that version, with its analysis
  x.versions[0].parts[0].gloss = { translation: 'train', words: [] };
  L.edit(x.id, 'Kari tok toget.', [{ text: 'Kari tok toget.' }]);
  assert.equal(x.parts[0].gloss.translation, 'train');
  assert.deepEqual([...x.versions.map((v) => v.text)], ['Kari tok bussen.']);
  // the same wording again changes nothing
  L.edit(x.id, 'Kari tok toget.', [{ text: 'Kari tok toget.' }]);
  assert.equal(x.versions.length, 1);
  for (let i = 0; i < 15; i++) L.edit(x.id, `Kari tok bussen ${i}.`, [{ text: '' }]);
  assert.equal(x.versions.length, L.LIMITS.VERSIONS);
});

test('the recent texts are the last ones opened; saved ones stay, with their names', async () => {
  const { L } = tab();
  await L.ready();
  const keep = L.start('nb:en', 'En tekst å ta vare på.', []);
  L.star(keep.id, true);
  L.rename(keep.id, '  Min tekst  ');
  for (let i = 0; i < 25; i++) L.start('nb:en', `Tekst nummer ${i}.`, []);
  const { saved, recent } = L.list('nb:en');
  assert.deepEqual([...saved.map((x) => x.name)], ['Min tekst']);
  assert.equal(recent.length, L.LIMITS.RECENT);
  assert.equal(recent[0].text, 'Tekst nummer 24.', 'the last opened first');
  assert.ok(!recent.some((x) => x.text === 'Tekst nummer 0.'), 'the oldest went');
  L.remove(keep.id);
  assert.equal(L.list('nb:en').saved.length, 0);
});

test('the one text reading mode kept before the library comes into it', async () => {
  const { L, localStorage, kv } = tab();
  localStorage.setItem('ordkort.read', JSON.stringify({ pair: 'nb:ru', text: 'Hei på deg!', parts: glossed('Hei på deg!'), showTr: true }));
  await L.ready();
  const x = L.current('nb:ru');
  assert.equal(x.text, 'Hei på deg!');
  assert.ok(x.parts[0].gloss && x.showTr);
  assert.equal(localStorage.getItem('ordkort.read'), null);
  await settle();
  assert.equal(kv.get('read').texts.length, 1);
});

test('without IndexedDB the texts stay in localStorage', async () => {
  const { App, localStorage } = browser(['public/js/readlib.js']);
  App.idb = { kvGet: async () => { throw new Error('no IndexedDB'); }, kvPut: async () => { throw new Error('no IndexedDB'); } };
  await App.readlib.ready();
  App.readlib.start('en:ru', 'It was a cold morning.', []);
  await settle(); await settle();
  assert.equal(JSON.parse(localStorage.getItem('ordkort.read.lib')).texts[0].text, 'It was a cold morning.');
});

test('a text without a name is shown by its first line, cut on a word', () => {
  const { L } = tab();
  assert.equal(L.title('Det var en kald morgen i Bergen.\nKari tok bussen.'), 'Det var en kald morgen i Bergen.');
  assert.equal(L.title('Det var en kald morgen i Bergen, og Kari tok bussen til jobben, men den var forsinket.', 40), 'Det var en kald morgen i Bergen, og…');
});
