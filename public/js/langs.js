/* Languages: code, own name, English name (for the AI), TTS voice, "hello", RTL */
(globalThis.App ||= {}).langs = (() => {
  const RTL = 1;
  const rows = [
    ['en', 'English', 'English', 'en-US', 'Hello'],
    ['nb', 'Norsk bokmål', 'Norwegian Bokmål', 'nb-NO', 'Hei'],
    ['nn', 'Norsk nynorsk', 'Norwegian Nynorsk', 'nb-NO', 'Hei'],
    ['uk', 'Українська', 'Ukrainian', 'uk-UA', 'Привіт'],
    ['ru', 'Русский', 'Russian', 'ru-RU', 'Привет'],
    ['ar', 'العربية', 'Arabic (Modern Standard)', 'ar-SA', 'مرحبا', RTL],
    ['zh', '中文', 'Chinese (Mandarin, Simplified)', 'zh-CN', '你好'],
    ['es', 'Español', 'Spanish', 'es-ES', 'Hola'],
    ['fr', 'Français', 'French', 'fr-FR', 'Bonjour'],
    ['de', 'Deutsch', 'German', 'de-DE', 'Hallo'],
    ['it', 'Italiano', 'Italian', 'it-IT', 'Ciao'],
    ['pt', 'Português', 'Portuguese', 'pt-PT', 'Olá'],
    ['pl', 'Polski', 'Polish', 'pl-PL', 'Cześć'],
    ['tr', 'Türkçe', 'Turkish', 'tr-TR', 'Merhaba'],
    ['ja', '日本語', 'Japanese', 'ja-JP', 'こんにちは'],
    ['ko', '한국어', 'Korean', 'ko-KR', '안녕하세요'],
    ['hi', 'हिन्दी', 'Hindi', 'hi-IN', 'नमस्ते'],
    ['bn', 'বাংলা', 'Bengali', 'bn-BD', 'নমস্কার'],
    ['id', 'Bahasa Indonesia', 'Indonesian', 'id-ID', 'Halo'],
    ['vi', 'Tiếng Việt', 'Vietnamese', 'vi-VN', 'Xin chào'],
    ['th', 'ไทย', 'Thai', 'th-TH', 'สวัสดี'],
    ['nl', 'Nederlands', 'Dutch', 'nl-NL', 'Hallo'],
    ['sv', 'Svenska', 'Swedish', 'sv-SE', 'Hej'],
    ['da', 'Dansk', 'Danish', 'da-DK', 'Hej'],
    ['fi', 'Suomi', 'Finnish', 'fi-FI', 'Hei'],
    ['is', 'Íslenska', 'Icelandic', 'is-IS', 'Halló'],
    ['cs', 'Čeština', 'Czech', 'cs-CZ', 'Ahoj'],
    ['sk', 'Slovenčina', 'Slovak', 'sk-SK', 'Ahoj'],
    ['ro', 'Română', 'Romanian', 'ro-RO', 'Salut'],
    ['hu', 'Magyar', 'Hungarian', 'hu-HU', 'Szia'],
    ['el', 'Ελληνικά', 'Greek', 'el-GR', 'Γεια σου'],
    ['bg', 'Български', 'Bulgarian', 'bg-BG', 'Здравей'],
    ['sr', 'Српски', 'Serbian', 'sr-RS', 'Здраво'],
    ['hr', 'Hrvatski', 'Croatian', 'hr-HR', 'Bok'],
    ['lt', 'Lietuvių', 'Lithuanian', 'lt-LT', 'Labas'],
    ['lv', 'Latviešu', 'Latvian', 'lv-LV', 'Sveiki'],
    ['et', 'Eesti', 'Estonian', 'et-EE', 'Tere'],
    ['be', 'Беларуская', 'Belarusian', 'be-BY', 'Прывітанне'],
    ['ka', 'ქართული', 'Georgian', 'ka-GE', 'გამარჯობა'],
    ['hy', 'Հայերեն', 'Armenian', 'hy-AM', 'Բարև'],
    ['kk', 'Қазақша', 'Kazakh', 'kk-KZ', 'Сәлем'],
    ['uz', 'Oʻzbekcha', 'Uzbek', 'uz-UZ', 'Salom'],
    ['az', 'Azərbaycanca', 'Azerbaijani', 'az-AZ', 'Salam'],
    ['he', 'עברית', 'Hebrew', 'he-IL', 'שלום', RTL],
    ['fa', 'فارسی', 'Persian (Farsi)', 'fa-IR', 'سلام', RTL],
    ['prs', 'دری', 'Dari', 'fa-AF', 'سلام', RTL],
    ['ur', 'اردو', 'Urdu', 'ur-PK', 'السلام علیکم', RTL],
    ['ps', 'پښتو', 'Pashto', 'ps-AF', 'سلام', RTL],
    ['ckb', 'کوردی', 'Kurdish (Sorani)', 'ckb', 'سڵاو', RTL],
    ['kmr', 'Kurmancî', 'Kurdish (Kurmanji)', 'ku', 'Silav'],
    ['ta', 'தமிழ்', 'Tamil', 'ta-IN', 'வணக்கம்'],
    ['sw', 'Kiswahili', 'Swahili', 'sw-KE', 'Habari'],
    ['am', 'አማርኛ', 'Amharic', 'am-ET', 'ሰላም'],
    ['ti', 'ትግርኛ', 'Tigrinya', 'ti-ER', 'ሰላም'],
    ['so', 'Soomaali', 'Somali', 'so-SO', 'Salaan'],
    ['sq', 'Shqip', 'Albanian', 'sq-AL', 'Përshëndetje'],
    ['tl', 'Filipino', 'Filipino (Tagalog)', 'fil-PH', 'Kumusta'],
    ['ms', 'Bahasa Melayu', 'Malay', 'ms-MY', 'Helo'],
    ['la', 'Latina', 'Latin', 'la', 'Salve'],
    ['eo', 'Esperanto', 'Esperanto', 'eo', 'Saluton'],
  ];

  const list = rows.map(([code, name, en, tts, hello, rtl]) => ({ code, name, en, tts, hello, rtl: !!rtl }));
  const map = Object.fromEntries(list.map((l) => [l.code, l]));
  const get = (c) => map[c] || { code: c, name: c, en: c, tts: c, hello: '', rtl: false };

  /* The gender an article shows (c = common gender). A noun's gender is its article's: "en tallerken" is
     masculine whatever the AI wrote — used in the prompts, to check AI cards and for the label on a card. */
  const ARTICLE_GENDER = {
    nb: { en: 'm', ei: 'f', et: 'n' },
    nn: { ein: 'm', ei: 'f', eit: 'n' },
    de: { der: 'm', die: 'f', das: 'n' },
    sv: { en: 'c', ett: 'n' },
    da: { en: 'c', et: 'n' },
    nl: { de: 'c', het: 'n' },
    fr: { le: 'm', la: 'f' },
    es: { el: 'm', la: 'f' },
    it: { il: 'm', lo: 'm', la: 'f' },
    pt: { o: 'm', a: 'f' },
    el: { ο: 'm', η: 'f', το: 'n' },
  };
  function articleGender(code, term) {
    const [art, ...rest] = String(term || '').trim().toLowerCase().split(/\s+/);
    return (rest.length && ARTICLE_GENDER[code]?.[art]) || '';
  }

  /* Which language a text is in, as far as its letters tell: the script first, then letters only some languages
     have (ø, ñ, ї…), then hints (names in a file name, the languages in use), then the usual one for the script.
     For an Anki deck whose sides are "щека" and "cheek", and for speech that must not read Russian as Norwegian. */
  const SCRIPTS = [
    ['Cyrillic', /\p{Script=Cyrillic}/u, ['ru', 'uk', 'bg', 'sr', 'be', 'kk']],
    ['Arabic', /\p{Script=Arabic}/u, ['ar', 'fa', 'prs', 'ur', 'ps', 'ckb']],
    ['Hebrew', /\p{Script=Hebrew}/u, ['he']],
    ['Kana', /[\p{Script=Hiragana}\p{Script=Katakana}]/u, ['ja']],
    ['Han', /\p{Script=Han}/u, ['zh', 'ja']],
    ['Hangul', /\p{Script=Hangul}/u, ['ko']],
    ['Devanagari', /\p{Script=Devanagari}/u, ['hi']],
    ['Bengali', /\p{Script=Bengali}/u, ['bn']],
    ['Thai', /\p{Script=Thai}/u, ['th']],
    ['Greek', /\p{Script=Greek}/u, ['el']],
    ['Georgian', /\p{Script=Georgian}/u, ['ka']],
    ['Armenian', /\p{Script=Armenian}/u, ['hy']],
    ['Tamil', /\p{Script=Tamil}/u, ['ta']],
    ['Ethiopic', /\p{Script=Ethiopic}/u, ['am', 'ti']],
    ['Latin', /\p{Script=Latin}/u, null],
  ];
  const LETTERS = [ // [language, letters that point to it]
    ['uk', /[іїєґ]/i], ['be', /ў/i], ['sr', /[ђћџјљњ]/i], ['kk', /[әғқңөұүһ]/i],
    ['ur', /[ٹڈڑںے]/], ['ps', /[ځڅښږ]/], ['ckb', /[ڵڕۆێ]/], ['fa', /[پچژگ]/],
    ['ja', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
    ['nb', /[æø]/i], ['sv', /ä.*å|å.*ä|ö.*å|å.*ö/i], ['da', /[æø]/i], ['de', /[ßü]|[äö]/i], ['es', /[ñ¿¡]/i], ['pt', /[ãõ]/i],
    ['pl', /[ąęłśźżń]/i], ['cs', /[řěů]/i], ['sk', /[ľĺŕô]/i], ['tr', /[ğışİ]/], ['ro', /[ășțşţ]/i], ['hu', /[őű]/i],
    ['vi', /[ơưđạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i], ['is', /[þð]/i], ['lt', /[ėįųū]/i], ['lv', /[āēīņķļ]/i],
    ['et', /õ/i], ['fr', /[çœèêëàâîïûù]/i], ['it', /[àèìòù]/i], ['az', /ə/i], ['nb', /å/i],
  ];
  function scriptOf(text) {
    const counts = new Map();
    for (const ch of String(text || '')) {
      if (!/\p{L}/u.test(ch)) continue;
      const sc = SCRIPTS.find(([, re]) => re.test(ch));
      if (sc) counts.set(sc[0], (counts.get(sc[0]) || 0) + 1);
    }
    if (counts.has('Kana')) return 'Kana';
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }
  const scriptLangs = (sc) => SCRIPTS.find(([name]) => name === sc)?.[2] || list.filter((l) => !SCRIPTS.some(([, , codes]) => codes?.includes(l.code))).map((l) => l.code);
  // the script a language is written in
  const scriptOfLang = (code) => SCRIPTS.find(([, , codes]) => codes?.includes(code))?.[0] || 'Latin';
  // codes of languages named in a text such as "Russian-English_Word_List" or "Norsk – русский"
  function named(text) {
    const s = ' ' + String(text || '').toLowerCase().replace(/[^\p{L}]+/gu, ' ') + ' ';
    return list.filter((l) => [l.en.split(' (')[0], l.name, l.name.split(' ')[0]].some((n) => n && s.includes(' ' + n.toLowerCase() + ' '))).map((l) => l.code);
  }
  // whether a text can be in a language at all, by its letters ("щека" cannot be Norwegian)
  function fits(text, code) {
    const sc = scriptOf(text);
    return !sc || code === 'sr' || scriptLangs(sc).includes(code);
  }
  function guess(texts, hints = []) {
    const text = [].concat(texts).join(' / ');
    const sc = scriptOf(text);
    if (!sc) return '';
    const can = scriptLangs(sc);
    if (can.length === 1) return can[0];
    const hinted = hints.find((c) => can.includes(c));
    const marked = LETTERS.filter(([c, re]) => can.includes(c) && re.test(text)).map(([c]) => c);
    if (hinted && (marked.includes(hinted) || !marked.length)) return hinted;
    if (marked.length) return marked[0];
    return { Latin: 'en', Cyrillic: 'ru', Arabic: 'ar', Han: 'zh' }[sc] || can[0];
  }

  return {
    scriptOf,
    scriptOfLang,
    fits,
    named,
    guess,
    list,
    get,
    name: (c) => get(c).name,
    en: (c) => get(c).en,
    rtl: (c) => get(c).rtl,
    has: (c) => !!map[c],
    ARTICLE_GENDER,
    articleGender,
  };
})();
