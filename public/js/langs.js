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
  };
  function articleGender(code, term) {
    const [art, ...rest] = String(term || '').trim().toLowerCase().split(/\s+/);
    return (rest.length && ARTICLE_GENDER[code]?.[art]) || '';
  }

  return {
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
