// Cards checked against Wiktionary (src/wiktionary.js): reading a page's shared headword and table markup,
// and fixing a card from it. The pages are small copies of real en.wiktionary.org markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, check, plain, article, lookup, summary, hasEntries } from '../src/wiktionary.js';

const h2 = (id) => `<div class="mw-heading mw-heading2"><h2 id="${id}">${id}</h2></div>`;
const h3 = (id) => `<div class="mw-heading mw-heading3"><h3 id="${id}">${id}</h3></div>`;
const g = (...t) => `<span class="gender">${t.map((x) => `<abbr title="${x}">${x[0]}</abbr>`).join(' <i>or</i> ')}</span>`;
const line = (lang, word, after) => `<p><span class="headword-line"><strong class="Latn headword" lang="${lang}">${word}</strong>${after}</span>\n</p>`;
const b = (lang, w) => `<b class="Latn" lang="${lang}"><a href="/wiki/${w}">${w}</a></b>`;
const cell = (lang, w, origin) => `<td><span class="Latn form-of lang-${lang} x&#124;p-form-of origin-${origin}" lang="${lang}"><a>${w}</a></span></td>`;

const PAGES = {
  Hund: h2('German') + h3('Noun') + line('de', 'Hund', `&#160;${g('masculine gender')} (<i>genitive</i> ${b('de', 'Hundes')}, <i>plural</i> ${b('de', 'Hunde')}, <i>diminutive</i> <b class="Latn form-of lang-de diminutive-form-of" lang="de">Hündchen</b>&#160;${g('neuter gender')})`)
    + `<table class="inflection-table">${cell('de', 'Hunden', 'Hund')}${cell('de', 'Hundes', 'Hund')}</table>`,
  дом: h2('Russian') + h3('Noun') + `<p><span class="headword-line"><strong class="Cyrl headword" lang="ru">дом</strong> <a>•</a> (<span lang="ru-Latn" class="headword-tr tr Latn">dom</span>)&#160;<span class="gender"><abbr title="masculine gender">m</abbr>&#160;<abbr title="inanimate">inan</abbr></span> (<i>genitive</i> <b class="Cyrl" lang="ru"><a>до́ма</a></b>, <i>nominative plural</i> <b class="Cyrl" lang="ru"><a>дома́</a></b>)</span>\n</p>`,
  laufen: h2('German') + h3('Verb') + line('de', 'laufen', ` (<i>third-person singular present</i> ${b('de', 'läuft')}, <i>past tense</i> ${b('de', 'lief')}, <i>past participle</i> ${b('de', 'gelaufen')})`)
    + `<table>${['laufe', 'läufst', 'lauft', 'liefen'].map((w) => cell('de', w, 'laufen')).join('')}</table>`,
  maison: h2('French') + h3('Noun') + line('fr', 'maison', `&#160;${g('feminine gender')} (<i>plural</i> ${b('fr', 'maisons')})`),
  école: h2('French') + h3('Noun') + line('fr', 'école', `&#160;${g('feminine gender')} (<i>plural</i> ${b('fr', 'écoles')})`),
  zio: h2('Italian') + h3('Noun') + line('it', 'zio', `&#160;${g('masculine gender')} (<i>plural</i> ${b('it', 'zii')})`),
  agua: h2('Spanish') + h3('Noun') + line('es', 'agua', `&#160;${g('feminine gender')} (<i>plural</i> ${b('es', 'aguas')})`),
  See: h2('German') + h3('Noun') + line('de', 'See', `&#160;${g('masculine gender')}`) + h3('Noun_2') + line('de', 'See', `&#160;${g('feminine gender')}`),
  книга: h2('Russian') + h3('Noun') + `<p><span class="headword-line"><strong class="Cyrl headword" lang="ru">кни́га</strong>&#160;${g('feminine gender')}</span>\n</p>`,
  Laufen: h2('German') + h3('Verb') + line('de', 'Laufen', ''), // a verb only: nothing about a noun
};

test('a page is read for one language and part of speech; genders are the word’s own', () => {
  const hund = parsePage(PAGES.Hund, 'de', 'Hund', 'noun');
  assert.deepEqual([...hund.genders], ['m'], 'not the diminutive’s neuter');
  for (const f of ['hund', 'hundes', 'hunde', 'hunden']) assert.ok(hund.forms.has(f), f);
  const dom = parsePage(PAGES.дом, 'ru', 'дом', 'noun');
  assert.deepEqual([...dom.genders], ['m'], 'the transliteration before the gender does not hide it');
  assert.ok(dom.forms.has('дома'), 'stress marks are not part of the spelling');
  assert.equal(parsePage(PAGES.Hund, 'nl', 'Hund', 'noun'), null, 'another language');
  assert.equal(parsePage(PAGES.Laufen, 'de', 'Laufen', 'noun'), null, 'another part of speech');
  assert.deepEqual([...parsePage(PAGES.See, 'de', 'See', 'noun').genders].sort(), ['f', 'm'], 'homonyms');
  assert.equal(plain('kȕća', 'hr'), 'kuća', 'the tone goes, the letter ć stays');
  assert.equal(plain('Hünde', 'de'), 'hünde', 'an umlaut is spelling');
  assert.equal(plain('ещё', 'ru'), 'еще');
  assert.equal(plain('بَيْت', 'ar'), 'بيت');
});

function wiki() {
  const calls = [];
  const mem = new Map();
  const cache = { get: async (k) => mem.get(k) ?? null, set: async (k, v) => { mem.set(k, v); } };
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const page = decodeURIComponent(new URL(url).searchParams.get('page'));
    calls.push(page);
    return { ok: true, json: async () => (PAGES[page] ? { parse: { text: PAGES[page] } } : { error: { code: 'missingtitle' } }) };
  };
  const card = async (lang, term, pos = 'noun', forms = '') => ({ ...(await check(cache, lang, { term, pos, forms })) });
  return { card, calls, restore: () => { globalThis.fetch = real; } };
}

test('a wrong article is replaced by the one the noun’s gender takes', async () => {
  const w = wiki();
  try {
    assert.equal((await w.card('de', 'die Hund')).term, 'der Hund');
    assert.equal((await w.card('de', 'der Hund')).term, 'der Hund');
    assert.equal((await w.card('fr', 'le maison')).term, 'la maison');
    assert.deepEqual(await w.card('fr', 'la école'), { term: 'l’école', forms: '', g: 'f' }, 'elided, and the gender kept apart');
    assert.equal((await w.card('it', 'il zio')).term, 'lo zio');
    assert.equal((await w.card('es', 'el agua')).term, 'el agua', 'a feminine noun with a stressed a takes "el"');
    assert.equal((await w.card('de', 'die See')).term, 'die See', 'either homonym');
    assert.equal(w.calls.filter((p) => p === 'Hund').length, 1, 'a word is fetched once, then it comes from the cache');
  } finally { w.restore(); }
});

test('a language without articles gets the noun’s gender; forms Wiktionary never heard of are dropped', async () => {
  const w = wiki();
  try {
    assert.equal((await w.card('ru', 'книга')).g, 'f');
    assert.equal((await w.card('de', 'laufen', 'verb', 'läuft, lief, ist gelaufen, ist geloffen')).forms, 'läuft, lief, ist gelaufen');
    assert.equal((await w.card('de', 'der Hund', 'noun', 'des Hundes, die Hünde')).forms, 'des Hundes',
      'a form that is not in the tables goes');
    assert.equal((await w.card('fr', 'la maison', 'noun', 'maisonz')).forms, 'maisonz', 'too little known about the forms: nothing is dropped');
    assert.equal((await w.card('de', 'der Hund', 'noun', 'Hünde')).forms, 'Hünde', 'none of the card’s forms known: nothing is dropped');
    assert.equal(await check({ get: async () => null, set: async () => {} }, 'de', { term: 'das Quatschwort', pos: 'noun' }), null);
    assert.equal(await check({ get: async () => null, set: async () => {} }, 'zh', { term: '书', pos: 'noun' }), null, 'no inflection to check');
  } finally { w.restore(); }
});

/* ---------- the entry shown in the dictionary ---------- */

const ol = (...li) => `<ol>${li.map((x) => `<li>${x}</li>`).join('\n')}</ol>`;
const usex = (lang, text, tr) => `<dl><dd><span class="h-usage-example"><i class="Latn mention e-example" lang="${lang}">${text}</i> ― <span class="e-translation">${tr}</span></span></dd></dl>`;
const ruby = (kanji, kana) => `<ruby>${kanji}<rp>(</rp><rt>${kana}</rt><rp>)</rp></ruby>`;
const ENTRY = {
  Hund: h2('German') + h3('Etymology') + '<p>From Middle High German <i class="Latn mention" lang="gmh">hunt</i>.</p>'
    + h3('Pronunciation') + '<ul><li>IPA<sup>(key)</sup>: <span class="IPA">/hʊnt/</span></li></ul>' + h3('Noun')
    + line('de', 'Hund', `&#160;${g('masculine gender')} (<i>strong</i>, <i>genitive</i> ${b('de', 'Hundes')} <i>or</i> ${b('de', 'Hunds')}, <i>plural</i> ${b('de', 'Hunde')})`)
    + ol('dog, hound\n<ul><li><div class="citation-whole">1929, Tucholsky:<dl><dd><div class="h-quotation"><span class="e-quotation" lang="de">Ein <b>Hund</b> bellt …</span></div></dd></dl></div></li></ul>',
      `<span class="usage-label-sense">(<span>derogatory</span>)</span> scoundrel\n${usex('de', 'ein gemeiner <b>Hund</b>', 'a mean <b>dog</b>')}`),
  hund: h2('Danish') + h3('Noun') + line('da', 'hund', `&#160;${g('common gender')}`) + ol('dog'),
  书: h2('Chinese') + h3('Definitions') + '<table class="wikitable zh-see"><tbody><tr><td><b>For pronunciation and definitions of </b><span class="Hans" lang="zh"><strong class="selflink">书</strong></span><b> – see <span class="Hant" lang="zh"><a href="/wiki/書">書</a></span> (“book”).</b></td></tr></tbody></table>',
  書: h2('Chinese') + h3('Pronunciation') + '<dl><dd>(Pinyin): <span class="zhpron-monospace form-of pinyin-t-form-of transliteration-书" lang="cmn"><span class="Latn" lang="cmn"><a>shū</a></span> (<span class="Latn" lang="cmn"><a>shu<sup>1</sup></a></span>)</span></dd></dl>'
    + h3('Definitions') + '<p><span class="headword-line"><strong class="Hant headword" lang="zh">書</strong></span>\n</p>'
    + ol('book <span style="padding-left:15px"><span>(<i>Classifier</i>: <span class="Hani" lang="zh">本</span> <span style="border-bottom: 1px dotted; cursor:help" title="Mandarin"><i>m</i></span>)</span></span>',
      '<span class="usage-label-sense">(Cantonese)</span> something else'),
  食べる: h2('Japanese') + h3('Verb') + `<p><span class="headword-line"><strong class="Jpan headword" lang="ja">${ruby('食', 'た')}べる</strong> • (<span class="headword-tr tr" dir="ltr"><span class="Latn" lang="ja">taberu</span></span>)&#160;<i>transitive&#160;<abbr title="ichidan">ichidan</abbr></i> (<i>past</i> <b class="Jpan" lang="ja">${ruby('食', 'た')}べた</b>)</span>\n</p>`
    + ol('to eat'),
};

test('a dictionary entry: gender, key forms, pronunciation, senses with short examples, origin', () => {
  const r = article(ENTRY.Hund, 'de');
  assert.equal(r.section, 'German');
  const [a] = r.articles;
  assert.equal(a.lemma, 'Hund');
  assert.equal(a.cls, 'noun, masculine, strong');
  assert.equal(a.pron, '/hʊnt/');
  assert.deepEqual(a.table.rows, [['genitive', 'Hundes / Hunds'], ['plural', 'Hunde']]);
  assert.deepEqual(a.senses[0], { expl: ['dog, hound'], ex: [], sub: [] }, 'long quotations are not examples');
  assert.deepEqual(a.senses[1], { expl: ['(derogatory) scoundrel'], ex: [{ text: 'ein gemeiner Hund', tr: 'a mean dog' }], sub: [] });
  assert.equal(a.etym, 'From Middle High German hunt.');
  assert.deepEqual(article(ENTRY.Hund, 'nl').articles, [], 'another language');
  assert.ok(hasEntries('es') && hasEntries('zh') && !hasEntries('nb') && !hasEntries('nn'), 'Norwegian has the official dictionary');
});

test('Chinese: pinyin, a measure word without dialect marks, Mandarin senses only; Japanese: the kana reading', () => {
  const [shu] = article(ENTRY.書, 'zh').articles;
  assert.equal(shu.pron, 'shū');
  assert.equal(shu.cls, '');
  assert.deepEqual(shu.senses.map((s) => s.expl[0]), ['book (Classifier: 本)']);
  assert.equal(article(ENTRY.书, 'zh').see, '書', 'a simplified character sends to its traditional page');
  const [taberu] = article(ENTRY.食べる, 'ja').articles;
  assert.equal(taberu.lemma, '食べる');
  assert.equal(taberu.pron, 'たべる · taberu');
  assert.equal(taberu.cls, 'verb, transitive ichidan');
  assert.deepEqual(taberu.table.rows, [['past', '食べた']]);
});

test('lookup: the other case of the first letter, the traditional page of a simplified character, then the cache', async () => {
  const calls = [];
  const mem = new Map();
  const cache = { get: async (k) => mem.get(k) ?? null, set: async (k, v) => { mem.set(k, v); } };
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const p = decodeURIComponent(new URL(url).searchParams.get('page'));
    calls.push(p);
    return { ok: true, json: async () => (ENTRY[p] ? { parse: { text: ENTRY[p] } } : { error: { code: 'missingtitle' } }) };
  };
  try {
    const de = await lookup(cache, 'de', 'hund');
    assert.equal(de.page, 'Hund', '"hund" is Danish, the German noun is "Hund"');
    assert.equal(de.articles[0].lemma, 'Hund');
    assert.equal((await lookup(cache, 'da', 'hund')).page, 'hund');
    assert.equal((await lookup(cache, 'zh', '书')).page, '書');
    assert.equal(await lookup(cache, 'de', 'Quatschwort'), null);
    const n = calls.length;
    await lookup(cache, 'de', 'hund');
    await lookup(cache, 'de', 'Quatschwort');
    assert.equal(calls.length, n, 'answers, "nothing" too, come from the cache');
    const s = summary(de);
    assert.match(s, /• Hund \(noun, masculine, strong\) \/hʊnt\//);
    assert.match(s, /Forms: genitive: Hundes \/ Hunds; plural: Hunde/);
    assert.match(s, /"ein gemeiner Hund" \(a mean dog\)/);
  } finally { globalThis.fetch = real; }
});
