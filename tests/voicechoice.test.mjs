// Settings → Voice → which voice says a card (js/voice.js). The lists below are shaped like getVoices().
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';

const { App } = browser(['public/js/voice.js']);
const V = App.voice;

const VOICES = [
  { name: 'Samantha', lang: 'en-US', voiceURI: 'apple.en.samantha' },
  { name: 'Amélie', lang: 'fr-FR', voiceURI: 'apple.fr.amélie' },
  { name: 'Amélie (Enhanced)', lang: 'fr-FR', voiceURI: 'apple.fr.amélie.enhanced' },
  { name: 'Norsk', lang: 'nb-NO', voiceURI: 'apple.nb' },
  { name: 'Nynorsk', lang: 'nn-NO', voiceURI: 'apple.nn' },
  { name: 'עברית', lang: 'he-IL', voiceURI: 'apple.he' },
];

test('the first choice: the site’s recordings, or the device', () => {
  assert.equal(V.usesSite(undefined), true, 'a deck saved before the setting existed');
  assert.equal(V.usesSite('site'), true);
  assert.equal(V.usesSite('system'), false);
});

test('the device’s voice with nothing picked is the platform default, not the best listed voice', () => {
  assert.equal(V.resolve(VOICES, { voice: 'system' }, 'fr'), null, 'u.voice must stay unset');
  assert.equal(V.resolve(VOICES, { voice: 'system', voiceURI: '' }, 'fr'), null);
});

test('a voice picked on this device is the voice used, whatever the language', () => {
  const s = { voice: 'system', voiceURI: 'apple.fr.amélie.enhanced' };
  assert.equal(V.resolve(VOICES, s, 'fr').voiceURI, 'apple.fr.amélie.enhanced');
  assert.equal(V.resolve(VOICES, { voice: 'system', voiceURI: 'apple.en.samantha' }, 'fr').voiceURI, 'apple.en.samantha',
    'the pick wins over the language');
});

test('a voice picked on another device falls back to the platform default', () => {
  assert.equal(V.resolve(VOICES, { voice: 'system', voiceURI: 'mac.only.voice' }, 'fr'), null,
    'not silently some other French voice');
});

test('with the site’s voice chosen, the device’s best voice for the language is the fallback', () => {
  assert.equal(V.resolve(VOICES, { voice: 'site' }, 'fr').voiceURI, 'apple.fr.amélie.enhanced');
  assert.equal(V.resolve(VOICES, {}, 'fr').voiceURI, 'apple.fr.amélie.enhanced');
  assert.equal(V.resolve(VOICES, { voice: 'site' }, 'de'), null, 'no German voice: nothing to fall back to');
  assert.equal(V.resolve(VOICES, { voice: 'site', voiceURI: 'apple.fr.amélie' }, 'fr').voiceURI, 'apple.fr.amélie.enhanced',
    'a pick left over from the device’s voice does not apply to the site’s');
});

test('a language finds the voices the platforms label with another code', () => {
  assert.equal(V.forLang([{ name: 'x', lang: 'no-NO', voiceURI: 'x' }], 'nb').voiceURI, 'x');
  assert.equal(V.forLang([{ name: 'y', lang: 'fa-AF', voiceURI: 'y' }], 'prs').voiceURI, 'y');
  assert.equal(V.forLang([{ name: 'z', lang: 'iw-IL', voiceURI: 'z' }], 'he').voiceURI, 'z');
  assert.equal(V.forLang(VOICES, 'nn').voiceURI, 'apple.nn', 'Nynorsk is not Bokmål');
  assert.equal(V.forLang(VOICES, 'fr').voiceURI, 'apple.fr.amélie.enhanced');
  assert.equal(V.forLang([], 'fr'), null);
});

test('the language tag comes from the list when the list has the language', () => {
  assert.equal(V.langTag(VOICES, 'fr'), 'fr-FR');
  assert.equal(V.langTag(VOICES, 'de'), 'de', 'nothing listed: the bare code is a valid tag');
});
