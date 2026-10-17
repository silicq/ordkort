// A voice for cards without a recording (src/sources/voice.js): a native speaker's recording from the word's Wiktionary page
// (its own language's section only), else Google's synthetic voice within a daily budget, kept for everybody.
// Wiktionary, Commons and Google are small fakes here: no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { audioOf } from '../src/sources/wiktionary.js';
import { tts, singleWord } from '../src/sources/voice.js';

const PAGE = `<div class="mw-parser-output">
<h2 id="Danish">Danish</h2>
<h3 id="Pronunciation">Pronunciation</h3>
<ul><li><span><audio id="mwe_player_0" controls="" data-mwtitle="Da-hus.ogg"><source src="//upload.wikimedia.org/wikipedia/commons/a/aa/Da-hus.ogg" type="audio/ogg; codecs=&quot;vorbis&quot;" /><source src="//upload.wikimedia.org/wikipedia/commons/transcoded/a/aa/Da-hus.ogg/Da-hus.ogg.mp3" type="audio/mpeg" /></audio></span></li></ul>
<p><span class="headword-line"><strong class="Latn headword" lang="da">hus</strong> n</span></p>
<h2 id="Norwegian_Bokmål">Norwegian Bokmål</h2>
<h3 id="Pronunciation_2">Pronunciation</h3>
<ul><li><span><audio id="mwe_player_1" controls="" data-mwtitle="LL-Q25167 (nob)-Telaneo-hus.wav"><source src="//upload.wikimedia.org/wikipedia/commons/8/8a/LL-Q25167_%28nob%29-Telaneo-hus.wav" type="audio/wav; codecs=&quot;1&quot;" /><source src="//upload.wikimedia.org/wikipedia/commons/transcoded/8/8a/LL-Q25167_%28nob%29-Telaneo-hus.wav/LL-Q25167_%28nob%29-Telaneo-hus.wav.mp3" type="audio/mpeg" /></audio></span></li></ul>
<p><span class="headword-line"><strong class="Latn headword" lang="nb">hus</strong> n</span></p>
<h2 id="Swedish">Swedish</h2>
<p><span class="headword-line"><strong class="Latn headword" lang="sv">hus</strong> n</span></p>
</div>`;

test('a recording is taken from the word’s own language, as the MP3 Commons makes', () => {
  assert.deepEqual(audioOf(PAGE, 'nb'), {
    url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8a/LL-Q25167_%28nob%29-Telaneo-hus.wav/LL-Q25167_%28nob%29-Telaneo-hus.wav.mp3',
    file: 'LL-Q25167 (nob)-Telaneo-hus.wav',
  });
  assert.match(audioOf(PAGE, 'da').url, /Da-hus\.ogg\.mp3$/);
  assert.equal(audioOf(PAGE, 'sv'), null, 'Swedish has no recording here: not the Norwegian one');
  assert.equal(audioOf(PAGE, 'de'), null, 'no German section at all');
});

test('a recording is looked up for one word, with its article or "to" at most', () => {
  assert.equal(singleWord('et hus'), 'hus');
  assert.equal(singleWord('å spise'), 'spise');
  assert.equal(singleWord('der Hund'), 'Hund');
  assert.equal(singleWord('hus'), 'hus');
  assert.equal(singleWord('Hun er ikke så ung'), '', 'a sentence: no word recording fits it');
});

// a D1 with just what the cache and the counters use
function db() {
  const cache = new Map(), hits = new Map();
  return {
    cache, hits,
    prepare: (sql) => ({
      bind: (...a) => ({
        first: async () => {
          if (/FROM cache/.test(sql)) return cache.get(a[0]) || null;
          if (/INSERT INTO hits/.test(sql)) { const n = (hits.get(a[0]) || 0) + a[1]; hits.set(a[0], n); return { n }; }
          return null;
        },
        run: async () => { if (/INSERT INTO cache/.test(sql)) cache.set(a[0], { v: a[1], t: a[2] }); return {}; },
      }),
    }),
  };
}
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 1, 2, 3]);
function fake() {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    calls.push(u.host + (opts.method === 'POST' ? ' POST' : ''));
    if (u.host === 'en.wiktionary.org') return new Response(JSON.stringify({ parse: { text: u.searchParams.get('page') === 'hus' ? PAGE : '<p>nothing</p>' } }));
    if (u.host === 'upload.wikimedia.org') return new Response(MP3, { headers: { 'Content-Type': 'audio/mpeg' } });
    if (u.host === 'texttospeech.googleapis.com') {
      const body = JSON.parse(opts.body);
      if (body.voice.languageCode === 'xx-XX') return new Response('{}', { status: 400 });
      return new Response(JSON.stringify({ audioContent: Buffer.from('fake mp3 of ' + body.input.text).toString('base64') }));
    }
    return new Response('', { status: 404 });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const ask = (env, l, q) => tts(new Request(`https://ordkort.test/api/tts?l=${l}&q=${encodeURIComponent(q)}`), env, 'k');

test('a word with a speaker on Wiktionary: that recording, kept for everybody', async () => {
  const f = fake();
  try {
    const env = { DB: db() };
    let r = await ask(env, 'nb', 'et hus');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
    assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [...MP3]);
    assert.match(decodeURIComponent(r.headers.get('X-Voice-By')), /Telaneo-hus\.wav \(Wikimedia Commons\)/, 'whom to credit');
    const n = f.calls.length;
    r = await ask(env, 'nb', 'ET HUS');
    assert.equal(r.status, 200);
    assert.equal(f.calls.length, n, 'the second time, nothing is fetched');
  } finally { f.restore(); }
});

test('without a speaker: the synthetic voice when there is a key, within the day’s characters; else nothing', async () => {
  const f = fake();
  try {
    const before = { DB: db() };
    let r = await ask(before, 'nb', 'Hun er ikke så ung som hun ser ut.');
    assert.equal(r.status, 404, 'no key: the device’s voice speaks');
    assert.equal(before.DB.cache.size, 0, 'and that is not kept for a year: a key may come');

    const env = { DB: db(), GOOGLE_TTS_KEY: 'g', TTS_DAILY_CHARS: '50' };
    r = await ask(env, 'nb', 'Hun er ikke så ung som hun ser ut.');
    assert.equal(r.status, 200, 'once the key is there, it speaks');
    assert.equal(Buffer.from(await r.arrayBuffer()).toString(), 'fake mp3 of Hun er ikke så ung som hun ser ut.');
    assert.ok(f.calls.includes('texttospeech.googleapis.com POST'));

    r = await ask(env, 'nb', 'Vi bor i et rødt hus ved sjøen.');
    assert.equal(r.status, 404, 'over the day’s 50 characters');
    assert.equal([...env.DB.cache.keys()].length, 1, 'and that is not kept: tomorrow it can speak');
  } finally { f.restore(); }
});

test('nonsense is refused', async () => {
  assert.equal((await ask({ DB: db() }, 'xx', 'hus').catch((e) => e)).status, 400);
  assert.equal((await ask({ DB: db() }, 'nb', '   ').catch((e) => e)).status, 400);
});
