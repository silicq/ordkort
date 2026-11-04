// The free dictionaries beside Wiktionary (src/sources/dicts.js): Wikidata Lexemes for every language, BÍN for
// Icelandic, SALDO for Swedish. The answers are recorded from the real APIs (tests/fixtures/dicts/), cut to what
// the code reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Lexemes from '../src/sources/lexemes.js';
import * as Bin from '../src/sources/bin.js';
import * as Saldo from '../src/sources/saldo.js';
import * as D from '../src/sources/dicts.js';
import { check } from '../src/sources/wiktionary.js';

const fixture = (f) => JSON.parse(readFileSync(new URL(`./fixtures/dicts/${f}`, import.meta.url), 'utf8'));
const WD = fixture('wikidata.json');

// the three APIs as they answered, and Wiktionary with no page at all; `down` names a host that fails
function apis({ down = '' } = {}) {
  const calls = [];
  const mem = new Map();
  const cache = { get: async (k) => mem.get(k) ?? null, set: async (k, v) => { mem.set(k, v); } };
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    calls.push(u.host);
    if (down && u.host.includes(down)) throw new TypeError('network');
    const ok = (data) => ({ ok: true, status: 200, json: async () => data });
    if (u.host === 'www.wikidata.org') {
      const p = u.searchParams;
      const rec = Object.values(WD).find((r) => Object.keys(r.entities.entities).some((id) => p.get('ids')?.includes(id)))
        || WD[`${p.get('language')}:${p.get('search')}`];
      if (p.get('action') === 'wbsearchentities') return ok(rec ? rec.search : { search: [] });
      if (p.get('props') === 'labels') {
        const all = Object.assign({}, ...Object.values(WD).map((r) => r.labels));
        return ok({ entities: Object.fromEntries(p.get('ids').split('|').map((q) => [q, all[q] ? { labels: { en: { value: all[q] } } } : {}])) });
      }
      return ok(rec ? rec.entities : { entities: {} });
    }
    if (u.host === 'bin.arnastofnun.is') return decodeURIComponent(u.pathname).endsWith('/hús') ? ok(fixture('bin-hus.json')) : { ok: false, status: 404 };
    if (u.host === 'spraakbanken4.it.gu.se') return ok(u.searchParams.get('q').endsWith('|hus') ? fixture('saldo-hus.json') : { total: 0, hits: [] });
    if (u.host === 'en.wiktionary.org') return ok({ error: { code: 'missingtitle' } });
    throw new Error('unexpected ' + url);
  };
  return { cache, calls, restore: () => { globalThis.fetch = real; } };
}

test('Wikidata: a German noun with its gender, IPA, every case and its senses, asked once', async () => {
  const w = apis();
  try {
    const r = await Lexemes.lookup(w.cache, 'de', 'Hund');
    assert.equal(r.url, 'https://www.wikidata.org/wiki/Lexeme:L34727');
    const a = r.articles[0];
    assert.equal(a.lemma, 'Hund');
    assert.equal(a.cls, 'noun, masculine');
    assert.equal(a.pron, '/hʊnt/');
    assert.deepEqual(a.genders, ['m']);
    const rows = Object.fromEntries(a.table.rows);
    assert.equal(rows['singular genitive'], 'Hunds / Hundes', 'two spellings of one form share a row; "case" is left out');
    assert.equal(rows['dative plural'] || rows['plural dative'], 'Hunden');
    assert.ok(a.senses.length >= 2 && a.senses[0].expl[0]);
    assert.ok(a.forms.includes('hundes'), 'the plain forms, for checking cards');
    const asked = w.calls.length;
    assert.equal(asked, 3, 'the search, the lexemes and the names of their features');
    await Lexemes.lookup(w.cache, 'de', 'Hund');
    assert.equal(w.calls.length, asked, 'then from the shared cache');
    assert.equal(await Lexemes.lookup(w.cache, 'de', 'Quatschwort'), null);
  } finally { w.restore(); }
});

test('Wikidata: a Finnish noun gets its cases, which Wiktionary’s headword line does not give', async () => {
  const w = apis();
  try {
    const a = (await Lexemes.lookup(w.cache, 'fi', 'talo')).articles[0];
    assert.ok(a.table.rows.length >= 15, `${a.table.rows.length} rows`);
    assert.ok(a.table.rows.some(([l, f]) => /partitive/.test(l) && f === 'taloa'));
    assert.equal(Lexemes.genderOf('masculine inanimate'), 'm');
    assert.equal(Lexemes.genderOf('common gender'), 'c');
  } finally { w.restore(); }
});

test('BÍN: an Icelandic noun with every case, number and the article, named in English', async () => {
  const w = apis();
  try {
    const r = await Bin.lookup(w.cache, 'is', 'hús');
    const a = r.articles[0];
    assert.equal(a.cls, 'noun, neuter');
    assert.deepEqual(a.genders, ['n']);
    assert.equal(Object.fromEntries(a.table.rows)['dative singular definite'], 'húsinu');
    assert.equal(r.url, 'https://bin.arnastofnun.is/leit/?q=h%C3%BAs');
    assert.equal(Bin.label('GM-FH-NT-3P-ET'), 'active indicative present 3rd person singular');
    assert.equal(await Bin.lookup(w.cache, 'is', 'xyz'), null, 'a word BÍN does not have');
    assert.equal(await Bin.lookup(w.cache, 'de', 'Hund'), null, 'Icelandic only');
  } finally { w.restore(); }
});

test('SALDO: a Swedish noun with its gender from the paradigm, without the parts of compounds', async () => {
  const w = apis();
  try {
    const a = (await Saldo.lookup(w.cache, 'sv', 'hus')).articles[0];
    assert.equal(a.cls, 'noun, neuter');
    const rows = Object.fromEntries(a.table.rows);
    assert.equal(rows['singular definite nominative'], 'huset');
    assert.ok(!a.table.rows.some(([l]) => /^(c|ci|cm|sms)$/.test(l)), 'no compound parts');
    assert.equal(Saldo.label('pret_part indef sg u nom'), 'past participle indefinite singular common nominative');
  } finally { w.restore(); }
});

test('a language gets the dictionaries made for it first, and one that is down leaves the others', async () => {
  assert.deepEqual(D.sourcesOf('is').map((s) => s.name), ['BÍN', 'Wikidata']);
  assert.deepEqual(D.sourcesOf('sv').map((s) => s.name), ['SALDO', 'Wikidata']);
  assert.deepEqual(D.sourcesOf('de').map((s) => s.name), ['Wikidata']);
  const w = apis({ down: 'wikidata' });
  try {
    const got = await D.lookup(w.cache, 'is', 'hús');
    assert.deepEqual(got.map((d) => [d.name, d.license]), [['BÍN', 'CC BY-SA 4.0']]);
    // the page gets what it shows, not the lists the checks use
    const shown = D.shown(got)[0].articles[0];
    assert.deepEqual(Object.keys(shown).sort(), ['cls', 'etym', 'lemma', 'pron', 'senses', 'table']);
    assert.match(D.summary(got), /^BÍN \(CC BY-SA 4\.0\):\n• hús \(noun, neuter\)\n {2}Forms: nominative singular: hús;/);
  } finally { w.restore(); }
});

test('the dictionaries that answered are named, with the word or without it; one that is down is not', async () => {
  let w = apis();
  try {
    const none = await D.search(w.cache, 'is', 'ekkiorð');
    assert.deepEqual(none, { found: [], checked: ['BÍN', 'Wikidata'] }, 'asked, and neither has it');
    const some = await D.search(w.cache, 'sv', 'hus');
    assert.deepEqual(some.found.map((d) => d.name), ['SALDO']);
    assert.deepEqual(some.checked, ['SALDO', 'Wikidata']);
  } finally { w.restore(); }
  w = apis({ down: 'wikidata' });
  try {
    assert.deepEqual(await D.search(w.cache, 'de', 'Hund'), { found: [], checked: [] }, 'Wikidata did not answer: not "not found"');
  } finally { w.restore(); }
});

test('a card Wiktionary cannot check is checked against the free dictionaries: "die Hund" → "der Hund"', async () => {
  const w = apis();
  try {
    const more = (lemma, pos) => D.entry(w.cache, 'de', lemma, pos);
    const r = await check(w.cache, 'de', { term: 'die Hund', pos: 'noun', forms: 'Hundes, Hunde, Hündin' }, { more });
    assert.equal(r.term, 'der Hund');
    assert.equal(r.forms, 'Hundes, Hunde', 'a form neither dictionary knows goes, once they know enough of them');
    assert.equal(await check(w.cache, 'de', { term: 'die Hund', pos: 'noun' }), null, 'without them Wiktionary alone cannot tell');
    assert.equal(await check(w.cache, 'de', { term: 'der Quatsch', pos: 'noun' }, { more }), null, 'nobody knows the word');
  } finally { w.restore(); }
});
