// Browser-side pieces that must never silently break: sync encryption, recovery keys,
// QR codes (decoded with an independent reader), CSV import/export.
import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { browser } from './helpers.mjs';

/* ---------- sync crypto ---------- */

const { App: S } = browser(['public/js/sync.js']);
const X = S.sync._test;
const secret = () => X.toB64(crypto.getRandomValues(new Uint8Array(32)));

test('the same secret gives the same id, token and key on every device', async () => {
  const s = secret();
  const a = await X.derive(s), b = await X.derive(s);
  assert.equal(a.id, b.id);
  assert.equal(a.token, b.token);
  assert.match(a.id, /^[a-f0-9]{32}$/, 'the server only accepts 32 hex chars');
  assert.notEqual(a.id, (await X.derive(secret())).id);

  const box = await X.seal(a.key, { hello: 'verden', n: [1, 2, 3] });
  assert.deepEqual(JSON.parse(JSON.stringify(await X.unseal(b.key, box))), { hello: 'verden', n: [1, 2, 3] });
});

test('a copy sealed with one secret cannot be opened with another', async () => {
  const a = await X.derive(secret()), b = await X.derive(secret());
  const box = await X.seal(a.key, { cards: 42 });
  await assert.rejects(X.unseal(b.key, box));
});

test('sealing is randomised and compresses big snapshots', async () => {
  const { key } = await X.derive(secret());
  const data = { cards: Array.from({ length: 500 }, (_, i) => ({ term: 'ord ' + i, tr: 'word ' + i })) };
  const one = await X.seal(key, data), two = await X.seal(key, data);
  assert.notEqual(one, two, 'fresh IV every time');
  assert.ok(one.length < JSON.stringify(data).length / 3);
});

test('pairing codes derive a working key', async () => {
  const k = await X.pairKey('ABCDE12345');
  const box = await X.seal(k, { s: 'x' });
  assert.equal((await X.unseal(await X.pairKey('ABCDE12345'), box)).s, 'x');
  await assert.rejects(X.unseal(await X.pairKey('ABCDE12346'), box));
});

test('recovery key: 54 characters that round-trip and catch typos', async () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const body = X.b32encode(bytes);
  assert.equal(body.length, 52);
  const code = body + (await X.checksum(bytes));
  assert.equal(code.length, S.sync.KEY_LEN);
  assert.deepEqual([...X.b32decode(code.slice(0, 52)).subarray(0, 32)], [...bytes]);

  // one wrong character is caught by the checksum in almost every case
  let caught = 0;
  for (let i = 0; i < 52; i++) {
    const typo = code.slice(0, i) + (code[i] === '0' ? '1' : '0') + code.slice(i + 1);
    const back = X.b32decode(typo.slice(0, 52)).subarray(0, 32);
    if ((await X.checksum(back)) !== typo.slice(52)) caught++;
  }
  assert.ok(caught >= 50, `caught ${caught} of 52 typos`);
});

test('codes are normalised the way people type them', () => {
  assert.equal(S.sync.normCode(' abcd-efgh ijkl-mnop '), 'ABCDEFGH1JK1MN0P');
  assert.equal(S.sync.normCode('o0Il1u'), '00111V');
  assert.equal(S.sync.formatCode('ABCDEFGHJKMNPQRS'), 'ABCD-EFGH-JKMN-PQRS');
});

/* ---------- QR ---------- */

const { App: Q } = browser(['public/js/qr.js']);

function decodeQR(text, scale = 4) {
  const m = Q.qr.encode(text);
  const quiet = 4, n = m.length, size = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!m[y][x]) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }
  return jsQR(px, size, size)?.data;
}

test('QR codes decode back to the same text', () => {
  for (const text of [
    'https://ordkort.com/#/link/ABCD12-EFGH34KLMN',
    'https://ordkort.com/#/s/49EH4TFJ',
    'x',
    'Ordkort — карточки, 词典, بطاقات ✓',
    'https://ordkort.com/#/' + 'A'.repeat(300),
  ]) assert.equal(decodeQR(text), text);
});

/* ---------- CSV ---------- */

const { App: C } = browser(['public/js/views/share.js']);
const { toCSV } = C.deckTools;
const parseCSV = (text) => JSON.parse(JSON.stringify(C.deckTools.parseCSV(text))); // plain objects from the VM realm

test('CSV export and import round-trip, including commas, quotes and new lines', () => {
  const cards = [
    { term: 'et hus', tr: 'house, home', pos: 'noun', gram: 'neuter', forms: 'huset, hus, husene', pron: '/hʉːs/', ex: 'Huset er "gammelt".', exTr: 'The house is "old".\nReally.' },
    { term: 'å løpe', tr: 'to run', pos: 'verb', gram: '', forms: '', pron: '', ex: '', exTr: '' },
  ];
  const back = parseCSV(toCSV(cards));
  assert.equal(back.length, 2);
  assert.equal(back[0].tr, 'house, home');
  assert.equal(back[0].ex, 'Huset er "gammelt".');
  assert.equal(back[0].ex_tr, 'The house is "old". Really.');
  assert.equal(back[1].term, 'å løpe');
});

test('CSV import reads Anki plain-text exports and semicolon files', () => {
  const anki = '#separator:tab\n#html:true\nhus\t<b>house</b>&nbsp;\nbil\tcar\n\n';
  assert.deepEqual(parseCSV(anki).map((w) => [w.term, w.tr]), [['hus', 'house'], ['bil', 'car']]);
  const excel = 'word;translation\r\nhund;dog\r\nkatt;cat\r\n';
  assert.deepEqual(parseCSV(excel).map((w) => [w.term, w.tr]), [['hund', 'dog'], ['katt', 'cat']]);
  assert.equal(parseCSV('only one column\nanother').length, 0);
});
