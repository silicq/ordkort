// A voice for cards without a recording (src/sources/voice.js): a native speaker's recording from the word's Wiktionary page
// (its own language's section only), kept for everybody, else Workers AI's synthetic voice (MeloTTS) within a daily
// budget, for the languages it speaks. Wiktionary, Commons and Workers AI are small fakes here: no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { audioOf } from '../src/sources/wiktionary.js';
import { tts, singleWord, smallWav, MELO } from '../src/sources/voice.js';

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

// a WAV as MeloTTS makes it: 44.1 kHz, 16-bit mono, `quiet` seconds of silence, then a tone, then silence again
function wav({ rate = 44100, bits = 16, lead = 0.3, tone = 0.2, tail = 0.4, level = 5000 } = {}) {
  const n = Math.round(rate * (lead + tone + tail)), size = n * (bits / 8);
  const b = Buffer.alloc(44 + size);
  b.write('RIFF', 0); b.writeUInt32LE(36 + size, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * bits / 8, 28); b.writeUInt16LE(bits / 8, 32); b.writeUInt16LE(bits, 34);
  b.write('data', 36); b.writeUInt32LE(size, 40);
  if (bits === 16) {
    const from = Math.round(rate * lead), to = from + Math.round(rate * tone);
    for (let i = from; i < to; i++) b.writeInt16LE(Math.round(level * Math.sin(i / 8)), 44 + 2 * i);
  }
  return new Uint8Array(b);
}
const info = (bytes) => {
  const b = Buffer.from(bytes);
  return { rate: b.readUInt32LE(24), seconds: b.readUInt32LE(40) / 2 / b.readUInt32LE(24), size: b.length, riff: b.readUInt32LE(4) + 8 };
};

test('a synthetic voice loses its silence and half its samples: about a quarter of the size, the word whole', () => {
  const big = wav();
  const small = info(smallWav(big));
  assert.equal(small.rate, 22050);
  assert.ok(Math.abs(small.seconds - (0.2 + 2 * 0.08)) < 0.01, `the tone and a little around it: ${small.seconds}`);
  assert.equal(small.riff, small.size, 'the header says the size it has');
  assert.ok(small.size < big.length / 4, `${small.size} of ${big.length}`);
  assert.equal(smallWav(wav({ level: 0 })), null, 'silence only: no voice');
  assert.equal(smallWav(new TextEncoder().encode('not a wav at all, just some text here and more of it')), null);
  const eight = wav({ bits: 8 });
  assert.equal(smallWav(eight), eight, 'a WAV of another shape is left as it is');
});

// Workers AI as the Worker sees it (env.AI): MeloTTS answers { audio: base64 WAV }
function workersAI() {
  const calls = [];
  return { calls, run: async (model, input) => { calls.push({ model, ...input }); return { audio: Buffer.from(wav()).toString('base64') }; } };
}

test('without a speaker: Workers AI speaks the languages MeloTTS knows, within the day’s characters; else nothing', async () => {
  const f = fake();
  try {
    const before = { DB: db() };
    let r = await ask(before, 'en', 'She is not as young as she looks.');
    assert.equal(r.status, 404, 'no Workers AI here: the device’s voice speaks');

    const AI = workersAI();
    const env = { DB: db(), AI, TTS_DAILY_CHARS: '60' };
    r = await ask(env, 'en', 'She is not as young as she looks.');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Content-Type'), 'audio/wav');
    assert.equal(decodeURIComponent(r.headers.get('X-Voice-By')), 'MeloTTS (Workers AI)');
    assert.equal(info(new Uint8Array(await r.arrayBuffer())).rate, 22050, 'made smaller');
    assert.deepEqual(AI.calls[0], { model: '@cf/myshell-ai/melotts', prompt: 'She is not as young as she looks.', lang: 'en' });
    assert.equal(env.DB.cache.size, 0, 'a synthetic voice is not kept in the database');

    r = await ask(env, 'ja', 'いえ');
    assert.equal(r.status, 200);
    assert.equal(AI.calls.at(-1).lang, 'jp', 'MeloTTS’s own code for Japanese');
    assert.deepEqual(Object.keys(MELO).sort(), ['en', 'es', 'fr', 'ja', 'ko', 'zh']);

    const n = AI.calls.length;
    r = await ask(env, 'nb', 'Hun er ikke så ung som hun ser ut.');
    assert.equal(r.status, 404, 'a language MeloTTS does not speak: the device’s voice');
    assert.equal(AI.calls.length, n, 'and Workers AI is not asked');

    r = await ask(env, 'en', 'We live in a red house by the sea.');
    assert.equal(r.status, 404, 'over the day’s 60 characters');
    assert.equal(AI.calls.length, n, 'refused before Workers AI is asked');
  } finally { f.restore(); }
});

test('a synthetic voice is kept in Cloudflare’s cache of the place, and served from there next time', async () => {
  const f = fake();
  const store = new Map();
  const hadCaches = 'caches' in globalThis, real = globalThis.caches;
  globalThis.caches = { default: { match: async (req) => store.get(req.url)?.clone() || undefined, put: async (req, res) => { store.set(req.url, res); } } };
  try {
    const AI = workersAI();
    const env = { DB: db(), AI };
    assert.equal((await ask(env, 'fr', 'une maison')).status, 200);
    assert.equal(store.size, 1);
    const again = await ask(env, 'fr', 'une maison');
    assert.equal(again.status, 200);
    assert.equal(again.headers.get('Content-Type'), 'audio/wav');
    assert.equal(AI.calls.length, 1, 'made once');
  } finally {
    f.restore();
    if (hadCaches) globalThis.caches = real; else delete globalThis.caches;
  }
});

test('nonsense is refused', async () => {
  assert.equal((await ask({ DB: db() }, 'xx', 'hus').catch((e) => e)).status, 400);
  assert.equal((await ask({ DB: db() }, 'nb', '   ').catch((e) => e)).status, 400);
});
