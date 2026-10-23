// One loudness for the site's voices (public/js/media.js): a recording from Wiktionary is brought to one level of
// speech on the device before it plays. Decoding needs a browser; measuring, the gain and the WAV are checked here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';

const { App } = browser(['public/js/media.js']);
const { speechLevel, even, wavOf } = App.media._test;
const RATE = 24000;

// a word: `lead` seconds of silence, `tone` seconds of a tone at `amp`, `tail` seconds of silence
function word({ amp, lead = 0.3, tone = 0.4, tail = 0.5 }) {
  const x = new Float32Array(Math.round(RATE * (lead + tone + tail)));
  const from = Math.round(RATE * lead), to = from + Math.round(RATE * tone);
  for (let i = from; i < to; i++) x[i] = amp * Math.sin(i / 6);
  return x;
}
const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const peak = (x) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);

test('the level is the speech, not the silence around it', () => {
  const short = word({ amp: 0.2, lead: 0.1, tail: 0.1 }), long = word({ amp: 0.2, lead: 1, tail: 2 });
  assert.ok(Math.abs(speechLevel(short, RATE) - speechLevel(long, RATE)) < 0.01, 'the same word with more silence is as loud');
  assert.ok(Math.abs(speechLevel(long, RATE) - 0.2 / Math.SQRT2) < 0.01);
  assert.equal(speechLevel(new Float32Array(10), RATE), 0);
});

test('a quiet recording and a loud one come out at one level', () => {
  const quiet = even(word({ amp: 0.03 }), RATE), loud = even(word({ amp: 0.5 }), RATE), right = even(word({ amp: 0.14 }), RATE);
  const lq = speechLevel(quiet, RATE), ll = speechLevel(loud, RATE), lr = speechLevel(right, RATE);
  for (const l of [lq, ll, lr]) assert.ok(Math.abs(l - 0.12) < 0.005, `level ${l}`);
});

test('the gain stays between a fifth and ten times, and nothing is clipped', () => {
  const whisper = word({ amp: 0.002 });
  assert.ok(Math.abs(rms(even(whisper, RATE)) / rms(whisper) - 10) < 1e-3, 'at most ten times: noise is not raised to speech');
  const shout = word({ amp: 0.9 });
  assert.ok(Math.abs(rms(even(shout, RATE)) / rms(shout) - 0.2) < 0.01, 'at least a fifth');
  // a quiet word with one loud click: the click is rounded off below full scale
  const click = word({ amp: 0.03 });
  click[RATE] = 0.6;
  const out = even(click, RATE);
  assert.ok(peak(out) < 1, `peak ${peak(out)}`);
  assert.ok(peak(out) > 0.9, 'and still loud');
  const silence = new Float32Array(RATE);
  assert.equal(even(silence, RATE), silence, 'silence stays as it is');
});

test('the result is a 16-bit mono WAV of the samples', () => {
  const x = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
  const b = Buffer.from(wavOf(x, RATE));
  assert.equal(b.toString('latin1', 0, 4), 'RIFF');
  assert.equal(b.readUInt32LE(4) + 8, b.length);
  assert.equal(b.toString('latin1', 8, 16), 'WAVEfmt ');
  assert.deepEqual([b.readUInt16LE(20), b.readUInt16LE(22), b.readUInt32LE(24), b.readUInt16LE(34)], [1, 1, RATE, 16]);
  assert.equal(b.readUInt32LE(40), x.length * 2);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => b.readInt16LE(44 + 2 * i)), [0, 16384, -16383, 32767, -32767, 32767], 'past full scale is held at it');
});
