// Anki packages both ways (public/js/apkg.js), against real packages made by the Anki engine
// (tests/fixtures/make-anki.py): the current format (zstd, schema 18) and the older one (schema 11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { decompress } from 'fzstd';
import { browser, ROOT } from './helpers.mjs';

const { App } = browser(['public/js/apkg.js']);
const K = App.apkg;
const SQL = await initSqlJs();
const deps = { SQL, zstd: (b) => decompress(b) };
const fixture = (name) => new Uint8Array(readFileSync(new URL('tests/fixtures/' + name, ROOT)));
const DAY = 864e5;

for (const name of ['anki-modern.apkg', 'anki-legacy.apkg']) {
  test(`reads ${name}: note types, decks, notes, cards and the picture`, async () => {
    const pkg = await K.read(fixture(name), deps);
    const basic = Object.values(pkg.types).find((t) => t.name === 'Basic');
    assert.deepEqual([...basic.fields], ['Front', 'Back']);
    assert.match(basic.qfmt, /\{\{Front\}\}/);
    assert.ok(Object.values(pkg.decks).some((p) => p.join('/') === 'Norsk/Mat'));
    assert.equal(pkg.notes.length, 4);
    assert.equal(pkg.cards.length, 4);
    assert.equal(pkg.media.size, 1);
    const png = pkg.media.get('apple.png');
    assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47], 'the picture is the PNG Anki was given');

    const groups = K.words(pkg, {}, { now: Date.UTC(2026, 9, 16) });
    const mat = groups.find((g) => g.path.join('/') === 'Norsk/Mat');
    const eple = mat.words.find((w) => w.term === 'et eple');
    assert.equal(eple.tr, 'apple', 'the <img> and <br> are not part of the translation');
    assert.equal(eple.imgName, 'apple.png');
    assert.equal(eple.sched.s, 12, 'an interval of 12 days becomes a stability of 12');
    assert.equal(Math.round(eple.sched.d * 10) / 10, 5.8, 'ease 230% → a little harder than average');
    assert.equal(eple.sched.reps, 6);
    assert.equal(eple.sched.lapses, 1);
    assert.equal(Math.round((eple.sched.due - eple.sched.last) / DAY), 12);
    const banan = mat.words.find((w) => w.term === 'en banan');
    assert.equal(banan.sus, true, 'a suspended card stays set aside');
    assert.equal(banan.sched, null, 'a card never studied is new');
    assert.ok(mat.words.some((w) => w.term === 'å spise' && w.tr === 'to eat & dine'), 'HTML and entities are read as text');
    assert.ok(groups.some((g) => g.path.join('/') === 'Norsk' && g.words[0].term === 'et hus'));
  });
}

test('field names are guessed in several languages, the rest left to the person', () => {
  const g = K.guess(['Word', 'Meaning', 'Reading', 'Example sentence', 'Example translation', 'Notes']);
  assert.deepEqual({ ...g }, { term: 0, tr: 1, ex: 3, exTr: 4, pron: 2 });
  assert.deepEqual({ ...K.guess(['Слово', 'Перевод']) }, { term: 0, tr: 1, ex: -1, exTr: -1, pron: -1 });
  assert.deepEqual({ ...K.guess(['A', 'B', 'C']) }, { term: 0, tr: 1, ex: -1, exTr: -1, pron: -1 }, 'unknown names: the first two');
});

test('text and pictures inside fields', () => {
  assert.equal(K.text('<div>et&nbsp;<b>hus</b></div><div>[sound:hus.mp3]</div>'), 'et hus');
  assert.equal(K.text('a &lt;b&gt; &#x263A; &#9731;'), 'a <b> ☺ ☃');
  assert.equal(K.imgOf('x <img class=pic src="my%20cat.jpg"> y'), 'my cat.jpg');
  assert.equal(K.imgOf("<img src='a.png'>"), 'a.png');
  assert.equal(K.imgOf('<img src="https://example.org/a.png">'), '', 'only pictures inside the package');
});

test('zip: what is packed comes back, compressed or not', async () => {
  const big = new TextEncoder().encode('hus '.repeat(5000));
  const z = await K.zip([['a.txt', big, true], ['b.bin', new Uint8Array([1, 2, 3]), false]]);
  assert.ok(z.length < big.length / 10, 'deflated');
  const files = await K.unzip(z);
  assert.deepEqual([...files.keys()], ['a.txt', 'b.bin']);
  assert.equal(new TextDecoder().decode(files.get('a.txt')), 'hus '.repeat(5000));
  assert.deepEqual([...files.get('b.bin')], [1, 2, 3]);
  assert.equal(K.crc32(new TextEncoder().encode('The quick brown fox jumps over the lazy dog')), 0x414fa339);
});

test('writing: Ordkort cards become a package Anki can read, with progress and pictures', async () => {
  const now = Date.UTC(2026, 9, 16, 12);
  const pic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const cards = [
    { term: 'et hus', tr: 'house', pron: '/hʉːs/', gram: 'neuter', forms: 'huset, hus, husa', ex: 'Vi bor i et <rødt> hus.', exTr: 'We live in a red house.', img: 'p00aa', box: 4, s: 20, d: 4, due: now + 6 * DAY, last: now - 14 * DAY, reps: 5, lapses: 1 },
    { term: 'en bil', tr: 'car', box: 0, s: 0 },
    { term: 'ei hytte', tr: 'cabin', box: 2, s: 2, d: 6, due: now + DAY, last: now - DAY, reps: 2, lapses: 0, sus: 1 },
  ];
  const bytes = await K.write([{ name: 'Ordkort::Norsk::Hjem', cards }], new Map([['p00aa', pic]]), { SQL, now });
  const pkg = await K.read(bytes, deps);
  assert.deepEqual(Object.values(pkg.types).map((t) => t.name), ['Ordkort']);
  assert.ok(Object.values(pkg.decks).some((p) => p.join('::') === 'Ordkort::Norsk::Hjem'));
  assert.equal(pkg.notes.length, 3);
  const hus = pkg.notes.find((n) => n.fields[0] === 'et hus');
  assert.equal(hus.fields[5], 'Vi bor i et &lt;rødt&gt; hus.', 'text is escaped for Anki, which reads fields as HTML');
  assert.equal(hus.fields[7], '<img src="p00aa.jpg">');
  assert.deepEqual([...pkg.media.get('p00aa.jpg')], [...pic]);
  const back = K.words(pkg, {}, { now });
  const w = back[0].words;
  const h = w.find((x) => x.term === 'et hus');
  assert.equal(h.sched.s, 20, 'the FSRS memory state goes with the card');
  assert.equal(h.sched.d, 4);
  assert.equal(Math.round((h.sched.due - now) / DAY), 6);
  assert.equal(h.ex, 'Vi bor i et <rødt> hus.');
  assert.equal(w.find((x) => x.term === 'en bil').sched, null, 'new stays new');
  assert.equal(w.find((x) => x.term === 'ei hytte').sus, true);
});

test('recordings: the word’s own one is read from a note and goes back out with the card', async () => {
  assert.equal(K.soundOf('<div>[sound:hun er ikke.mp3]</div>'), 'hun er ikke.mp3');
  assert.equal(K.soundOf('no sound here'), '');

  const now = Date.UTC(2026, 9, 16, 12);
  const mp3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0]);
  const cards = [{ term: 'Hun er ikke så ung som hun ser ut.', tr: 'She is not as young as she looks.', audio: 'a00bb', box: 0 }];
  const bytes = await K.write([{ name: 'Ordkort::Norsk::Fraser', cards }], new Map([['a00bb', { bytes: mp3, type: 'audio/mpeg' }]]), { SQL, now });
  const pkg = await K.read(bytes, deps);
  const n = pkg.notes[0];
  assert.equal(n.fields[8], '[sound:a00bb.mp3]', 'in its own field, as Anki writes a recording');
  assert.deepEqual([...pkg.media.get('a00bb.mp3')], [...mp3]);
  assert.equal(K.words(pkg, {}, { now })[0].words[0].audioName, 'a00bb.mp3');

  // a note whose example field reads the sentence: that recording is not the word's
  const type = Object.keys(pkg.types)[0];
  const maps = { [type]: { ...K.guess([...pkg.types[type].fields]), ex: 8 } };
  assert.equal(K.words(pkg, maps, { now })[0].words[0].audioName, '', 'the example’s recording is not the word’s');
});

test('cards with gaps go out as Anki cloze notes and come back; own fields travel too', async () => {
  const now = Date.UTC(2026, 9, 16, 12);
  const cards = [
    { term: 'Jeg {{bor}} i {{c2::Oslo::by}}.', tr: 'I live in Oslo.', box: 0, extra: [{ k: 'Kilde', v: 'Lærebok' }] },
    { term: 'et hus', tr: 'house', box: 0, extra: [{ k: 'Husk', v: 'hus — house' }] },
  ];
  const pkg = await K.read(await K.write([{ name: 'Ordkort::Norsk', cards }], new Map(), { SQL, now }), deps);
  assert.deepEqual(Object.values(pkg.types).map((t) => t.name).sort(), ['Ordkort', 'Ordkort Cloze']);
  const cz = pkg.notes.find((n) => n.fields[0].includes('{{c'));
  assert.equal(cz.fields[0], 'Jeg {{c1::bor}} i {{c2::Oslo::by}}.', 'in Anki’s own form');
  assert.equal(pkg.cards.filter((c) => c.nid === cz.id).length, 2, 'one Anki card for each gap');
  const back = K.words(pkg, {}, { now })[0].words;
  const g = back.find((w) => w.term.startsWith('Jeg'));
  assert.equal(g.tr, 'I live in Oslo.');
  assert.deepEqual(JSON.parse(JSON.stringify(g.extra)), [{ k: 'Notes', v: 'Kilde: Lærebok' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(back.find((w) => w.term === 'et hus').extra)), [{ k: 'Notes', v: 'Husk: hus — house' }]);
});
