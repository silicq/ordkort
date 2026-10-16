// Picture search (src/images.js): the word is looked up in Wikidata in its own language, the item's Commons picture
// comes first, and Openverse is asked in English with the pictures about the word sorted before the rest.
// Wikidata, Commons and Openverse are small fakes here: no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { find, bare, relevant, wikidata, OV_PAGE } from '../src/images.js';

const DB = { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) }) };
const env = { DB };

const ENTITIES = {
  Q3947: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q16889133' } } } }], P18: [{ rank: 'normal', mainsnak: { datavalue: { value: 'Old house.jpg' } } }] }, labels: { en: { value: 'house' } } },
  Q42: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }], P18: [{ rank: 'normal', mainsnak: { datavalue: { value: 'Jan Hus.jpg' } } }] }, labels: { en: { value: 'Jan Hus' } } },
};
const OPENVERSE = [
  { title: 'Sunset over the sea', thumbnail: 'https://ov.example/1.jpg', license: 'by', license_version: '2.0', tags: [{ name: 'evening' }] },
  { title: 'A red house', thumbnail: 'https://ov.example/2.jpg', license: 'cc0', tags: [] },
  { title: 'IMG_0042', thumbnail: 'https://ov.example/3.jpg', license: 'by-sa', license_version: '4.0', tags: [{ name: 'houses' }] },
  { title: 'Lighthouse', thumbnail: 'https://ov.example/4.jpg', license: 'by', tags: [] },
];

function fake() {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    const p = Object.fromEntries(u.searchParams);
    calls.push({ host: u.host, ...p });
    let body = {};
    if (u.host === 'www.wikidata.org' && p.action === 'wbsearchentities') {
      body = { search: p.search === 'hus' ? [
        { id: 'Q3947', label: 'hus', match: { type: 'label', text: 'hus' } },
        { id: 'Q42', label: 'Jan Hus', match: { type: 'alias', text: 'Hus' } },
        { id: 'Q99', label: 'Hus (film)', match: { type: 'label', text: 'Hus (film)' } },
      ] : [] };
    } else if (u.host === 'www.wikidata.org') {
      body = { entities: Object.fromEntries(p.ids.split('|').map((id) => [id, ENTITIES[id] || { claims: {} }])) };
    } else if (u.host === 'commons.wikimedia.org') {
      body = { query: { pages: { 1: { title: 'File:Old house.jpg', imageinfo: [{ url: 'https://upload.example/Old_house.jpg', thumburl: 'https://upload.example/640px-Old_house.jpg', descriptionurl: 'https://commons.example/File:Old_house.jpg', extmetadata: { Artist: { value: '<a href="x">Kari Nordmann</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] } } } };
    } else if (u.host === 'api.openverse.org') {
      // as the real API does without a key
      if (+p.page_size > 20) return { ok: false, status: 401, json: async () => ({ detail: 'page_size' }) };
      body = { results: OPENVERSE };
    }
    return { ok: true, json: async () => body };
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

test('articles and "to" are left out of a search', () => {
  assert.equal(bare('et hus'), 'hus');
  assert.equal(bare('der Hund'), 'Hund');
  assert.equal(bare('l’école'), 'école');
  assert.equal(bare('to eat'), 'eat');
  assert.equal(bare('å spise'), 'spise');
  assert.equal(bare('Ann'), 'Ann', 'a word that only starts like an article stays');
});

test('a picture is about the word when its title or a tag holds it as a whole word', () => {
  assert.ok(relevant({ title: 'Old house in Oslo' }, 'house'));
  assert.ok(relevant({ title: 'x', tags: [{ name: 'houses' }] }, 'house'), 'a plural tag counts');
  assert.ok(!relevant({ title: 'Lighthouse' }, 'house'));
  assert.ok(!relevant({ title: 'Sunset', tags: [{ name: 'evening' }] }, 'house'));
});

test('Wikidata: only items named by the word itself, and not a person, a name or a film', async () => {
  const f = fake();
  try {
    const items = await wikidata('hus', 'nb');
    assert.deepEqual(items, [{ id: 'Q3947', file: 'Old house.jpg', en: 'house' }]);
    assert.equal(f.calls[0].language, 'nb', 'searched in the word’s own language');
  } finally { f.restore(); }
});

test('the Wikidata picture comes first; Openverse is asked in English and its pictures about the word lead', async () => {
  const f = fake();
  try {
    const { results, en } = await find(env, 'k', 'et hus', 'nb');
    assert.equal(en, 'house');
    assert.equal(f.calls.find((c) => c.host === 'api.openverse.org').q, 'house', 'not "hus": Openverse is mostly in English');
    assert.deepEqual(results[0], {
      thumb: 'https://upload.example/640px-Old_house.jpg', by: '“Old house”, Kari Nordmann', license: 'CC BY-SA 4.0',
      page: 'https://commons.example/File:Old_house.jpg',
    });
    assert.deepEqual(results.slice(1, 3).map((r) => r.thumb), ['https://ov.example/2.jpg', 'https://ov.example/3.jpg'], 'title or tag holds the word');
    assert.equal(results.length, 1 + 4, 'too few good ones: the rest fill up to six, after them');
  } finally { f.restore(); }
});

test('a word Wikidata does not know is searched as it is', async () => {
  const f = fake();
  try {
    const { results, en } = await find(env, 'k', 'lobster pot', 'en');
    assert.equal(en, undefined);
    assert.equal(f.calls.find((c) => c.host === 'api.openverse.org').q, 'lobster pot');
    assert.ok(results.every((r) => r.thumb.startsWith('https://ov.example/')));
  } finally { f.restore(); }
});

test('Openverse is asked for no more than it gives without a key', () => {
  assert.ok(OV_PAGE <= 20);
});

test('when Openverse does not answer, Wikidata’s picture still comes, and nothing is cached', async () => {
  const f = fake();
  const writes = [];
  const db = { prepare: (sql) => ({ bind: (...a) => ({ first: async () => null, run: async () => { if (/INSERT INTO cache/.test(sql)) writes.push(a); return {}; } }) }) };
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => (new URL(url).host === 'api.openverse.org' ? { ok: false, status: 503, json: async () => ({}) } : real(url));
  try {
    const { results } = await find({ DB: db }, 'k', 'hus', 'nn'); // not 'nb': that one is in the in-memory cache since the test above
    assert.equal(results.length, 1);
    assert.equal(writes.length, 0);
    await assert.rejects(find({ DB: db }, 'k', 'lobster trap', 'en'), (e) => e.status === 503, 'nothing at all: busy');
  } finally { globalThis.fetch = real; f.restore(); }
});
