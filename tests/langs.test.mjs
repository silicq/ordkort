// Which language a text is in (public/js/langs.js): for Anki decks that do not say, and for speech that must not
// read a Russian word with a Norwegian voice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';

const { App } = browser(['public/js/langs.js']);
const L = App.langs;

test('the letters tell the language where they can', () => {
  assert.equal(L.guess(['щека', 'бедро', 'объект']), 'ru');
  assert.equal(L.guess(['привіт', 'їжа']), 'uk');
  assert.equal(L.guess(['blåbær', 'smør']), 'nb');
  assert.equal(L.guess(['Straße', 'Hund']), 'de');
  assert.equal(L.guess(['niño']), 'es');
  assert.equal(L.guess(['日本語です']), 'ja');
  assert.equal(L.guess(['中文']), 'zh');
  assert.equal(L.guess(['cheek', 'hip']), 'en', 'plain Latin letters: English, unless something says otherwise');
  assert.equal(L.guess(['123', '']), '', 'no letters, no guess');
});

test('hints settle what letters cannot, but never against the letters', () => {
  assert.equal(L.guess(['et hus', 'en bil'], ['nb', 'ru']), 'nb');
  assert.equal(L.guess(['cheek', 'hip'], ['en', 'ru', 'nb']), 'en');
  assert.equal(L.guess(['щека'], ['nb', 'en']), 'ru', 'a Cyrillic word is not Norwegian whatever the hints');
  assert.equal(L.named('Russian-English_Word_List_Elementary').join(), 'en,ru');
  assert.ok(L.named('Norsk – русский').includes('nb'));
});

test('a text fits a language only in its alphabet', () => {
  assert.equal(L.fits('щека', 'nb'), false);
  assert.equal(L.fits('щека', 'ru'), true);
  assert.equal(L.fits('et hus', 'nb'), true);
  assert.equal(L.fits('漢字', 'ja'), true);
  assert.equal(L.fits('', 'ru'), true);
});
