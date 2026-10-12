// The words around the content of the static Norwegian pages (scripts/seo-pages.mjs), in each interface
// language that has them: titles, labels, table headings, the introductions of the two hub pages.
// The content itself — words, translations, examples, notes — lives in data/seo/.

export const LEARN = 'nb'; // the language these pages teach (more can follow: one folder per language in data/seo)

// grammatical labels: word classes, genders, rows of the inflection tables
const POS = {
  en: { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', preposition: 'preposition', pronoun: 'pronoun', determiner: 'determiner', conjunction: 'conjunction', numeral: 'numeral', interjection: 'interjection', particle: 'infinitive marker', phrase: 'phrase' },
  ru: { noun: 'существительное', verb: 'глагол', adjective: 'прилагательное', adverb: 'наречие', preposition: 'предлог', pronoun: 'местоимение', determiner: 'определитель', conjunction: 'союз', numeral: 'числительное', interjection: 'междометие', particle: 'частица инфинитива', phrase: 'выражение' },
  uk: { noun: 'іменник', verb: 'дієслово', adjective: 'прикметник', adverb: 'прислівник', preposition: 'прийменник', pronoun: 'займенник', determiner: 'означальне слово', conjunction: 'сполучник', numeral: 'числівник', interjection: 'вигук', particle: 'частка інфінітива', phrase: 'вираз' },
  nb: { noun: 'substantiv', verb: 'verb', adjective: 'adjektiv', adverb: 'adverb', preposition: 'preposisjon', pronoun: 'pronomen', determiner: 'determinativ', conjunction: 'konjunksjon', numeral: 'tallord', interjection: 'interjeksjon', particle: 'infinitivsmerke', phrase: 'uttrykk' },
};
const GENDER = {
  en: { Masc: 'masculine', Fem: 'feminine', Neuter: 'neuter' },
  ru: { Masc: 'мужской род', Fem: 'женский род', Neuter: 'средний род' },
  uk: { Masc: 'чоловічий рід', Fem: 'жіночий рід', Neuter: 'середній рід' },
  nb: { Masc: 'hankjønn', Fem: 'hunkjønn', Neuter: 'intetkjønn' },
};
const TABLE = {
  en: {
    sg: 'Singular', pl: 'Plural', ind: 'Indefinite', def: 'Definite',
    inf: 'Infinitive', pres: 'Present', past: 'Past', perf: 'Present perfect', imp: 'Imperative', pass: 'Passive',
    mf: 'Masculine / feminine', n: 'Neuter', defsg: 'Definite', plur: 'Plural', cmp: 'Comparative', sup: 'Superlative', supdef: 'Superlative, definite',
    forms: 'Forms',
  },
  ru: {
    sg: 'Единственное число', pl: 'Множественное число', ind: 'Неопределённая форма', def: 'Определённая форма',
    inf: 'Инфинитив', pres: 'Настоящее время', past: 'Прошедшее время', perf: 'Перфект', imp: 'Повелительное наклонение', pass: 'Пассив',
    mf: 'Мужской / женский род', n: 'Средний род', defsg: 'Определённая форма', plur: 'Множественное число', cmp: 'Сравнительная степень', sup: 'Превосходная степень', supdef: 'Превосходная, определённая',
    forms: 'Формы',
  },
  uk: {
    sg: 'Однина', pl: 'Множина', ind: 'Неозначена форма', def: 'Означена форма',
    inf: 'Інфінітив', pres: 'Теперішній час', past: 'Минулий час', perf: 'Перфект', imp: 'Наказовий спосіб', pass: 'Пасив',
    mf: 'Чоловічий / жіночий рід', n: 'Середній рід', defsg: 'Означена форма', plur: 'Множина', cmp: 'Вищий ступінь', sup: 'Найвищий ступінь', supdef: 'Найвищий, означена',
    forms: 'Форми',
  },
  nb: {
    sg: 'Entall', pl: 'Flertall', ind: 'Ubestemt', def: 'Bestemt',
    inf: 'Infinitiv', pres: 'Presens', past: 'Preteritum', perf: 'Presens perfektum', imp: 'Imperativ', pass: 'Passiv',
    mf: 'Hankjønn / hunkjønn', n: 'Intetkjønn', defsg: 'Bestemt form', plur: 'Flertall', cmp: 'Komparativ', sup: 'Superlativ', supdef: 'Superlativ, bestemt',
    forms: 'Former',
  },
};

const SOURCE = 'Bokmålsordboka, Universitetet i Bergen og Språkrådet, ordbøkene.no, CC-BY 4.0';

export const UI = {
  en: {
    learn: 'norwegian',
    pos: POS.en, gender: GENDER.en, table: TABLE.en, source: SOURCE,
    home: 'Ordkort', topicsHub: 'Norwegian by topic', dictHub: 'Norwegian dictionary',
    topicsTitle: (n) => `Norwegian vocabulary by topic: ${n} word lists | Ordkort`,
    topicsH1: 'Norwegian vocabulary by topic',
    topicsDesc: (n, w) => `${n} lists of Norwegian words by topic — ${w} words with translations, forms and example sentences, from greetings to the tax office. Free, no sign-up.`,
    topicsIntro: [
      'Each list gathers the Norwegian words you meet first in one area of life: at the table, at the doctor, at work, on the bus. Every word comes with its English meaning, the forms that Norwegian textbooks expect you to know and a short sentence that shows it in use.',
      'Nouns are given with their article (en, ei or et), verbs with their past and perfect forms. The forms are checked against Bokmålsordboka, the official Bokmål dictionary.',
    ],
    dictTitle: (n) => `Norwegian–English dictionary: ${n} common words | Ordkort`,
    dictH1: (n) => `Norwegian–English dictionary: the ${n} most common words`,
    dictDesc: (n) => `The ${n} most frequent Norwegian Bokmål words from A to Å: English meanings, full inflection tables, example sentences and notes on typical mistakes.`,
    dictIntro: [
      'These are the words that make up most of any Norwegian text — the little ones like og, på and som as well as everyday verbs, nouns and adjectives. Knowing them well gets you further than knowing thousands of rare ones.',
      'Every entry shows the forms from Bokmålsordboka, example sentences with translations and a short note on what learners tend to get wrong.',
    ],
    groupsH: 'Topics', words: (n) => `${n} words`, wordsH: 'Words', allTopics: 'All topics',
    otherTopics: (g) => `More in “${g}”`, alsoDict: 'The 500 most common Norwegian words', alsoTopics: 'Norwegian words by topic',
    thWord: 'Norwegian', thTr: 'English', thForms: 'Forms', thEx: 'Example',
    topicTitle: (t) => `${t} in Norwegian – vocabulary`,
    topicH1: (t) => `${t} in Norwegian`,
    topicDesc: (t, n, sample) => `${n} Norwegian words for ${t.toLowerCase()} with English translations, forms and examples: ${sample}…`,
    ctaTopic: 'Practise these words with flashcards',
    wordTitle: (w) => `${w} – Norwegian to English: meaning, forms, examples`,
    wordDesc: (w, pos, tr, forms) => `${w} (Norwegian ${pos}): ${tr}.${forms ? ` Forms: ${forms}.` : ''} Example sentences with translations and notes for learners.`,
    ctaWord: (w) => `Learn “${w}” in Ordkort`,
    phH: 'Useful phrases', plain: 'In simple Norwegian', examplesH: 'Examples', noteH: 'Good to know', formsH: 'Forms',
    officialH: 'In Bokmålsordboka', exprH: 'Fixed expressions', compoundsH: 'Compounds', relatedH: 'Related words', inTopicsH: 'In topics',
    prev: 'Previous word', next: 'Next word', letters: 'Words by letter', crumbs: 'Breadcrumbs',
    trLang: 'English',
    hubsH: 'Norwegian, ready to study',
    hubsP: 'Word lists by topic and the 500 most common Norwegian words — readable right here, without installing anything.',
  },
  ru: {
    learn: 'norvezhskij',
    pos: POS.ru, gender: GENDER.ru, table: TABLE.ru, source: SOURCE,
    home: 'Ordkort', topicsHub: 'Норвежский по темам', dictHub: 'Норвежский словарь',
    topicsTitle: (n) => `Норвежский язык: слова по темам — ${n} подборок | Ordkort`,
    topicsH1: 'Норвежские слова по темам',
    topicsDesc: (n, w) => `${n} подборок норвежских слов по темам — ${w} слов с переводом на русский, формами и примерами: от приветствий до налоговой. Бесплатно, без регистрации.`,
    topicsIntro: [
      'В каждой подборке — норвежские слова, которые нужны первыми в одной сфере жизни: за столом, у врача, на работе, в автобусе. У каждого слова есть перевод на русский, формы, которые требуют в любом учебнике, и короткое предложение-пример.',
      'Существительные даны с артиклем (en, ei или et), глаголы — с прошедшим временем и перфектом. Формы сверены с Bokmålsordboka, официальным словарём букмола.',
    ],
    dictTitle: (n) => `Норвежско-русский словарь: ${n} частых слов | Ordkort`,
    dictH1: (n) => `Норвежско-русский словарь: ${n} самых частых слов`,
    dictDesc: (n) => `${n} самых частотных слов норвежского (букмол) от A до Å: перевод на русский, таблицы склонения и спряжения, примеры и типичные ошибки.`,
    dictIntro: [
      'Эти слова составляют большую часть любого норвежского текста: служебные og, på и som, самые нужные глаголы, существительные и прилагательные. Знать их уверенно полезнее, чем помнить тысячи редких.',
      'В каждой статье — формы из Bokmålsordboka, примеры с переводом и короткое пояснение, где русскоязычные учащиеся чаще всего ошибаются.',
    ],
    groupsH: 'Темы', words: (n) => `${n} ${plural(n, 'слово', 'слова', 'слов')}`, wordsH: 'Слова', allTopics: 'Все темы',
    otherTopics: (g) => `Ещё в разделе «${g}»`, alsoDict: '500 самых частых норвежских слов', alsoTopics: 'Норвежские слова по темам',
    thWord: 'Норвежский', thTr: 'Перевод', thForms: 'Формы', thEx: 'Пример',
    topicTitle: (t) => `${t} на норвежском: слова с переводом`,
    topicH1: (t) => `${t}: норвежские слова`,
    topicDesc: (t, n, sample) => `${n} норвежских слов по теме «${t}» с переводом на русский, формами и примерами: ${sample}…`,
    ctaTopic: 'Учить эти слова по карточкам',
    wordTitle: (w) => `${w} — перевод с норвежского, формы и примеры`,
    wordDesc: (w, pos, tr, forms) => `${w} — норвежское слово (${pos}): ${tr}.${forms ? ` Формы: ${forms}.` : ''} Примеры с переводом и советы для изучающих.`,
    ctaWord: (w) => `Учить «${w}» в Ordkort`,
    phH: 'Полезные сочетания', plain: 'Простыми словами по-норвежски', examplesH: 'Примеры', noteH: 'Что важно знать', formsH: 'Формы',
    officialH: 'В словаре Bokmålsordboka', exprH: 'Устойчивые выражения', compoundsH: 'Сложные слова', relatedH: 'Похожие слова', inTopicsH: 'В темах',
    prev: 'Предыдущее слово', next: 'Следующее слово', letters: 'Слова по буквам', crumbs: 'Навигационная цепочка',
    trLang: 'русский',
    hubsH: 'Норвежский: читать прямо здесь',
    hubsP: 'Подборки слов по темам и 500 самых частых норвежских слов — с переводом, формами и примерами, без установки и регистрации.',
  },
  uk: {
    learn: 'norvezka',
    pos: POS.uk, gender: GENDER.uk, table: TABLE.uk, source: SOURCE,
    home: 'Ordkort', topicsHub: 'Норвезька за темами', dictHub: 'Норвезький словник',
    topicsTitle: (n) => `Норвезька мова: слова за темами — ${n} добірок | Ordkort`,
    topicsH1: 'Норвезькі слова за темами',
    topicsDesc: (n, w) => `${n} добірок норвезьких слів за темами — ${w} слів з перекладом українською, формами й прикладами: від привітань до податкової. Безкоштовно.`,
    topicsIntro: [
      'У кожній добірці — норвезькі слова, які потрібні першими в одній сфері життя: за столом, у лікаря, на роботі, в автобусі. Кожне слово має переклад українською, форми, яких вимагає будь-який підручник, і коротке речення-приклад.',
      'Іменники подано з артиклем (en, ei або et), дієслова — з минулим часом і перфектом. Форми звірено з Bokmålsordboka, офіційним словником букмола.',
    ],
    dictTitle: (n) => `Норвезько-український словник: ${n} частих слів | Ordkort`,
    dictH1: (n) => `Норвезько-український словник: ${n} найчастіших слів`,
    dictDesc: (n) => `${n} найчастотніших слів норвезької (букмол) від A до Å: переклад українською, таблиці відмінювання, приклади й типові помилки.`,
    dictIntro: [
      'Ці слова складають більшу частину будь-якого норвезького тексту: службові og, på і som, найпотрібніші дієслова, іменники й прикметники. Знати їх упевнено корисніше, ніж пам’ятати тисячі рідкісних.',
      'У кожній статті — форми з Bokmålsordboka, приклади з перекладом і коротке пояснення, де україномовні учні найчастіше помиляються.',
    ],
    groupsH: 'Теми', words: (n) => `${n} ${plural(n, 'слово', 'слова', 'слів')}`, wordsH: 'Слова', allTopics: 'Усі теми',
    otherTopics: (g) => `Ще в розділі «${g}»`, alsoDict: '500 найчастіших норвезьких слів', alsoTopics: 'Норвезькі слова за темами',
    thWord: 'Норвезькою', thTr: 'Переклад', thForms: 'Форми', thEx: 'Приклад',
    topicTitle: (t) => `${t} норвезькою: слова з перекладом`,
    topicH1: (t) => `${t}: норвезькі слова`,
    topicDesc: (t, n, sample) => `${n} норвезьких слів на тему «${t}» з перекладом українською, формами й прикладами: ${sample}…`,
    ctaTopic: 'Вчити ці слова за картками',
    wordTitle: (w) => `${w} — переклад з норвезької, форми й приклади`,
    wordDesc: (w, pos, tr, forms) => `${w} — норвезьке слово (${pos}): ${tr}.${forms ? ` Форми: ${forms}.` : ''} Приклади з перекладом і поради для тих, хто вчить мову.`,
    ctaWord: (w) => `Вчити «${w}» в Ordkort`,
    phH: 'Корисні сполучення', plain: 'Простими словами норвезькою', examplesH: 'Приклади', noteH: 'Що важливо знати', formsH: 'Форми',
    officialH: 'У словнику Bokmålsordboka', exprH: 'Сталі вирази', compoundsH: 'Складні слова', relatedH: 'Схожі слова', inTopicsH: 'У темах',
    prev: 'Попереднє слово', next: 'Наступне слово', letters: 'Слова за літерами', crumbs: 'Навігаційний ланцюжок',
    trLang: 'українська',
    hubsH: 'Норвезька: читати просто тут',
    hubsP: 'Добірки слів за темами й 500 найчастіших норвезьких слів — з перекладом, формами й прикладами, без встановлення та реєстрації.',
  },
  nb: {
    learn: 'norsk',
    pos: POS.nb, gender: GENDER.nb, table: TABLE.nb, source: SOURCE,
    home: 'Ordkort', topicsHub: 'Gloser etter tema', dictHub: 'Ordbok',
    topicsTitle: (n) => `Norske gloser etter tema: ${n} ordlister | Ordkort`,
    topicsH1: 'Norske gloser etter tema',
    topicsDesc: (n, w) => `${n} ordlister med norske gloser etter tema — ${w} ord med bøyning og eksempelsetninger, fra hilsener til Skatteetaten. Gratis og uten innlogging.`,
    topicsIntro: [
      'Hver liste samler ordene du trenger først på ett område: ved bordet, hos legen, på jobben, på bussen. Alle ordene står med bøyningsformene du må kunne og en kort setning som viser hvordan ordet brukes.',
      'Substantivene står med artikkel (en, ei eller et), verbene med preteritum og perfektum. Bøyningen er kontrollert mot Bokmålsordboka.',
    ],
    dictTitle: (n) => `Norsk ordbok for innlærere: ${n} vanlige ord | Ordkort`,
    dictH1: (n) => `De ${n} vanligste norske ordene`,
    dictDesc: (n) => `De ${n} vanligste ordene i norsk bokmål fra A til Å: enkel forklaring, hele bøyningen, eksempelsetninger og tips om typiske feil for deg som lærer norsk.`,
    dictIntro: [
      'Disse ordene utgjør det meste av enhver norsk tekst – småord som og, på og som, og de vanligste verbene, substantivene og adjektivene. Kan du dem godt, kommer du lenger enn med tusenvis av sjeldne ord.',
      'Hvert oppslag har bøyningen fra Bokmålsordboka, en forklaring med enkle ord, eksempelsetninger og et kort råd om hva innlærere ofte gjør feil.',
    ],
    groupsH: 'Temaer', words: (n) => `${n} ord`, wordsH: 'Ord', allTopics: 'Alle temaer',
    otherTopics: (g) => `Mer i «${g}»`, alsoDict: 'De 500 vanligste norske ordene', alsoTopics: 'Norske gloser etter tema',
    thWord: 'Ord', thTr: 'Forklaring', thForms: 'Bøyning', thEx: 'Eksempel',
    topicTitle: (t) => `${t} – gloser på norsk`,
    topicH1: (t) => `${t}: norske gloser`,
    topicDesc: (t, n, sample) => `${n} norske gloser om ${t.toLowerCase()} med bøyning og eksempelsetninger: ${sample}…`,
    ctaTopic: 'Øv på disse ordene med ordkort',
    wordTitle: (w) => `${w} – hva betyr det? Bøyning og eksempler`,
    wordDesc: (w, pos, tr, forms) => `Hva betyr «${w}» (${pos})? ${tr}.${forms ? ` Bøyning: ${forms}.` : ''} Eksempelsetninger og tips for deg som lærer norsk.`,
    ctaWord: (w) => `Lær «${w}» i Ordkort`,
    phH: 'Nyttige uttrykk', plain: 'Forklaring', examplesH: 'Eksempler', noteH: 'Verdt å vite', formsH: 'Bøyning',
    officialH: 'I Bokmålsordboka', exprH: 'Faste uttrykk', compoundsH: 'Sammensatte ord', relatedH: 'Beslektede ord', inTopicsH: 'I temaene',
    prev: 'Forrige ord', next: 'Neste ord', letters: 'Ord etter forbokstav', crumbs: 'Brødsmulesti',
    trLang: 'Oversettelser',
    hubsH: 'Norsk, klart til å leses',
    hubsP: 'Gloser etter tema og de 500 vanligste ordene – med bøyning og eksempler, rett her på siden.',
  },
};
export const UIS = Object.keys(UI);

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Cyrillic topic names in URLs: Russian and Ukrainian transliteration ("Еда и напитки" → "eda-i-napitki",
// "Їжа й напої" → "yizha-y-napoi"); "&" in English names becomes "and"
const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const UKR = { ...CYR, г: 'h', ґ: 'g', и: 'y', і: 'i', ї: 'yi', є: 'ye', х: 'kh', щ: 'shch', '’': '', "'": '' };
export const translit = (s, lang) => {
  const map = lang === 'uk' ? UKR : CYR;
  return s.toLowerCase().replace(/&/g, ' and ').replace(/./g, (c) => (c in map ? map[c] : c));
};

// "år" → "aar", "e-post" → "e-post": URLs stay plain ASCII
export const slug = (s) => s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
