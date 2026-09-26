// What ends up on a card and how typed answers are judged: examples cut from long texts,
// the typing and gap-fill checks in public/js/views/study.js, which words can be reported,
// and the server-side checks of AI-written cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';
import { aiWord, wordsPrompt } from '../src/prompts.js';
import { App as Shared } from '../src/shared.js';

function tab() {
  const { App } = browser(['public/js/store.js', 'public/js/views/study.js']);
  App.store.load();
  App.store.init({ native: 'ru', target: 'nb', level: 'A1' });
  return App;
}
const A = tab();
const S = A.store;
const { compare, clozeOf } = A.views.study._test;

/* ---------- examples taken from a longer text ---------- */

const LYRICS = '[Chorus]\nKanskje kommer kongen\nHit til middag nå i dag\nVi har dekket på perrongen\nMed god mat av alle slag\n[Vers 1]\nMajones og gåselever\nMed rødbeter og løk';

test('an example from song lyrics is the line with the word, not the whole song', () => {
  assert.equal(S.sentenceWith(LYRICS, 'Kanskje'), 'Kanskje kommer kongen');
  assert.equal(S.sentenceWith(LYRICS, 'perrongen'), 'Vi har dekket på perrongen');
  assert.equal(S.sentenceWith(LYRICS.replace(/\n/g, ' '), 'løk').length <= 124, true, 'lyrics pasted as one line are cut around the word');
  assert.match(S.sentenceWith(LYRICS.replace(/\n/g, ' '), 'løk'), /løk$/);
  assert.doesNotMatch(S.sentenceWith(LYRICS.replace(/\n/g, ' '), 'kongen'), /\[/, 'no [Chorus] markers');
  assert.equal(S.sentenceWith('Jeg vil høre. Øret mitt gjør vondt.', 'øre'), 'Øret mitt gjør vondt.', 'the word itself, not "øre" inside "høre"');
  assert.equal(S.sentenceWith('Hun kjøpte en kopp kaffe og ventet. Så gikk hun.', 'ventet'), 'Hun kjøpte en kopp kaffe og ventet.');
});

test('a card saved with a whole text as its example shows only the sentence with the word', () => {
  const long = { term: 'kanskje', ex: LYRICS.replace(/\n/g, ' ').repeat(3), exTr: 'перевод всей песни' };
  const ex = S.example(long);
  assert.ok(ex.text.length <= 124);
  assert.match(ex.text, /Kanskje/);
  assert.equal(ex.tr, '', 'the translation of the whole text does not belong to one sentence');
  assert.deepEqual({ ...S.example({ term: 'et øre', ex: 'Hun har vondt i øret.', exTr: 'У неё болит ухо.' }) }, { text: 'Hun har vondt i øret.', tr: 'У неё болит ухо.' });
});

/* ---------- typed answers ---------- */

const card = (x) => ({ pos: 'noun', gram: '', forms: '', pron: '', ex: '', exTr: '', ...x });
const tallerken = card({ term: 'en tallerken', tr: 'тарелка', forms: 'tallerkenen, tallerkener, tallerkenene', ex: 'Sett maten på tallerkenen.' });

test('gap fill: the dictionary form of the right word is not a wrong answer', () => {
  const cz = clozeOf(tallerken);
  assert.equal(cz.answer, 'tallerkenen');
  assert.equal(compare('tallerkenen', cz.answer, tallerken), 'right');
  assert.equal(compare('tallerken', cz.answer, tallerken), 'form');
  assert.equal(compare('en tallerken', cz.answer, tallerken), 'form');
  assert.equal(compare('tallerkenene', cz.answer, tallerken), 'form');
  assert.equal(compare('en kopp', cz.answer, tallerken), 'wrong');

  const ore = card({ term: 'et øre', forms: 'øret, ører, ørene', ex: 'Jeg kan ikke høre med øret.' });
  assert.equal(clozeOf(ore).answer, 'øret', 'not the "øre" inside "høre"');
  assert.equal(compare('øre', 'øret', ore), 'form');
  const rundkjoring = card({ term: 'en rundkjøring', forms: 'rundkjøringen, rundkjøringer, rundkjøringene' });
  assert.equal(compare('rundkjøring', 'rundkjøringen', rundkjoring), 'form');
});

test('typing: one typo, including two swapped letters, is "almost"', () => {
  const kanskje = card({ term: 'kanskje', pos: 'adverb' });
  assert.equal(compare('kansjke', 'Kanskje', kanskje), 'almost');
  assert.equal(compare('kanskje', 'Kanskje', kanskje), 'right');
  assert.equal(compare('kansje', 'Kanskje', kanskje), 'almost');
  assert.equal(compare('kaskje', 'kanskje', kanskje), 'almost');
  assert.equal(compare('kasnkej', 'kanskje', kanskje), 'wrong');
  assert.equal(compare('hus', 'hun', card({ term: 'hun' })), 'wrong', 'short words must be exact');
});

test('typing: notes in brackets are optional', () => {
  const privet = card({ term: 'привет (м.)', tr: 'привіт' });
  assert.equal(compare('привет', 'привет (м.)', privet), 'right');
  assert.equal(compare('привет (м.)', 'привет (м.)', privet), 'right');
  assert.equal(compare('пока', 'привет (м.)', privet), 'wrong');
});

test('typing: pinyin without tone marks counts for a Chinese word', () => {
  const qing = card({ term: '请', pos: 'verb', pron: 'qǐng' });
  assert.equal(compare('qing', '请', qing), 'roman');
  assert.equal(compare('qǐng', '请', qing), 'roman');
  assert.equal(compare('请', '请', qing), 'right');
  const ninhao = card({ term: '您好', pos: 'interjection', pron: 'nín hǎo' });
  assert.equal(compare('nin hao', '您好', ninhao), 'roman');
  assert.equal(compare('ninhao', '您好', ninhao), 'roman');
  assert.equal(compare('ni hao', '您好', ninhao), 'almost');
  assert.equal(compare('xie xie', '您好', ninhao), 'wrong');
  // IPA is not a spelling: a Russian word still has to be typed in Cyrillic
  assert.equal(compare('privet', 'привет', card({ term: 'привет', pron: '/prʲɪˈvʲet/' })), 'wrong');
});

/* ---------- "report a mistake" only for words from the shared bank ---------- */

test('only AI words from the bank can be reported, not words the person typed in', () => {
  const T = tab().store;
  const deck = T.addDeck({ topic: 'animals', level: 'A1' });
  T.addCards(deck.id, [{ term: 'en hund', tr: 'собака', src: 'bank' }, { term: 'en katt', tr: 'кошка', src: 'bank' }]);
  T.addCards(deck.id, [{ term: 'huiaka', tr: 'маленький щенок', src: 'user' }]);
  const by = (term) => T.cards(deck.id).find((c) => c.term === term);
  assert.equal(T.fromBank(by('en hund')), true);
  assert.equal(T.fromBank(by('huiaka')), false);

  // cards saved before the origin was recorded: a generated batch is created 1 ms apart, a typed word alone
  const old = T.addDeck({ topic: 'food', level: 'A1' });
  T.addCards(old.id, [{ term: 'et eple', tr: 'яблоко' }, { term: 'en pære', tr: 'груша' }, { term: 'et brød', tr: 'хлеб' }]);
  T.addCards(old.id, [{ term: 'bamsemums', tr: 'конфета' }]);
  const byOld = (term) => T.cards(old.id).find((c) => c.term === term);
  T.updateCard(byOld('bamsemums').id, { created: byOld('et eple').created + 60000 }); // typed in a minute later
  assert.equal(T.fromBank(byOld('en pære')), true);
  assert.equal(T.fromBank(byOld('bamsemums')), false);
});

/* ---------- checks of AI-written cards on the server ---------- */

test('a gender label that contradicts the article is dropped', () => {
  const w = aiWord({ term: 'en tallerken', tr: 'тарелка', pos: 'noun', gender: 'f', gram: 'женский род' }, 'nb');
  assert.equal(w.gram, '');
  assert.equal(w.gender, undefined, 'the check field is not stored');
  assert.equal(aiWord({ term: 'en tallerken', tr: 'тарелка', pos: 'noun', gender: 'm', gram: 'мужской род' }, 'nb').gram, 'мужской род');
  assert.equal(aiWord({ term: 'ei jente', tr: 'девочка', pos: 'noun', gender: 'feminine', gram: 'женский род' }, 'nb').gram, 'женский род');
  assert.equal(aiWord({ term: 'de fiets', tr: 'bike', pos: 'noun', gender: 'f', gram: 'common' }, 'nl').gram, 'common', 'de-words are masculine or feminine');
  assert.equal(aiWord({ term: 'het huis', tr: 'house', pos: 'noun', gender: 'c', gram: 'common' }, 'nl').gram, '');
  assert.equal(aiWord({ term: 'дом', tr: 'house', pos: 'noun', gender: 'm', gram: 'masculine' }, 'ru').gram, 'masculine', 'no articles, nothing to check');
});

test('a note in brackets after the word is not part of the word', () => {
  assert.equal(aiWord({ term: 'привет (м.)', tr: 'привіт', pos: 'noun' }, 'ru').term, 'привет');
  assert.equal(aiWord({ term: 'мыть(ся)', tr: 'to wash', pos: 'verb' }, 'ru').term, 'мыть(ся)');
  assert.equal(aiWord({ term: 'sich (etwas) merken', tr: 'to remember', pos: 'verb' }, 'de').term, 'sich (etwas) merken');
});

test('word-class topics ask for, and keep, only that word class', () => {
  const preps = Shared.topics.get('preps');
  assert.deepEqual([...preps.pos], ['preposition', 'adverb']);
  assert.equal(Shared.topics.get('food').pos, null);
  const p = wordsPrompt({ target: 'nb', native: 'ru', topic: preps.en, hint: preps.hint, only: preps.pos, level: 'B1', n: 20, avoid: [] });
  assert.match(p.user, /ONLY these word classes: preposition, adverb/);
  assert.doesNotMatch(p.user, /mostly nouns, verbs and adjectives/);
  assert.match(p.user, /"en" = masculine, "ei" = feminine, "et" = neuter/);
  assert.match(p.user, /"gender":""/);
  assert.doesNotMatch(wordsPrompt({ target: 'ru', native: 'uk', topic: 'Greetings', level: 'A1', n: 20, avoid: [] }).user, /"gender"/);
});
