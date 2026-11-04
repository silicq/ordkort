// The page for people who search for Norwegian flashcards (scripts/seo-pages.mjs, flashcardsPage): what they want
// is to start practising at once, so the page leads straight into the app with a topic chosen.

export const FLASH = {
  en: {
    slug: 'flashcards', nav: 'Norwegian flashcards',
    title: 'Norwegian flashcards – free, no sign-up, spaced repetition',
    desc: 'Free Norwegian flashcards for 29 topics, from greetings to the tax office: every word with its forms and an example. Spaced repetition, no sign-up, no ads.',
    h1: 'Norwegian flashcards',
    lede: [
      'Pick a topic and start practising right away: Ordkort opens with the Norwegian words for it, each with its English meaning, the forms you need and an example sentence. Nothing to install, no account, no ads.',
      'Cards come back just before you would forget them (FSRS spaced repetition, the scheduler Anki uses), so a few minutes a day are enough. You can flip cards, choose the right answer, type the word, listen or fill a gap in a sentence.',
    ],
    startH: 'Start with a topic', start: 'Practise', list: 'Word list',
    moreH: 'Also free',
    more: ['Every topic as an Anki deck, for Anki, AnkiDroid and AnkiMobile.', 'The most common Norwegian words with their full inflection, from Bokmålsordboka.', 'For teachers: one link gives a whole class a topic, each learner in their own language.'],
  },
  ru: {
    slug: 'kartochki', nav: 'Карточки для норвежского',
    title: 'Норвежские слова на карточках: бесплатно, без регистрации',
    desc: 'Бесплатные карточки для норвежского по 29 темам, от приветствий до налоговой: каждое слово с формами и примером. Интервальное повторение, без регистрации.',
    h1: 'Норвежский по карточкам',
    lede: [
      'Выберите тему и начинайте сразу: Ordkort откроется с норвежскими словами по ней — у каждого перевод на русский, нужные формы и пример. Ничего не нужно устанавливать, нет аккаунта и рекламы.',
      'Карточки возвращаются как раз перед тем, как слово забылось бы (интервальное повторение FSRS, как в Anki), поэтому хватает нескольких минут в день. Можно переворачивать карточки, выбирать ответ, вписывать слово, слушать или заполнять пропуск в предложении.',
    ],
    startH: 'Начните с темы', start: 'Учить', list: 'Список слов',
    moreH: 'Тоже бесплатно',
    more: ['Каждая тема — колодой для Anki, AnkiDroid и AnkiMobile.', 'Самые частые норвежские слова со всеми формами из Bokmålsordboka.', 'Для преподавателей: одна ссылка даёт тему всей группе, каждому на своём языке.'],
  },
  uk: {
    slug: 'kartky', nav: 'Картки для норвезької',
    title: 'Норвезька за картками: безкоштовно, без реєстрації',
    desc: 'Безкоштовні картки для норвезької за 29 темами, від привітань до податкової: кожне слово з формами й прикладом. Інтервальне повторення, без реєстрації.',
    h1: 'Норвезька за картками',
    lede: [
      'Виберіть тему й починайте одразу: Ordkort відкриється з норвезькими словами до неї — кожне з перекладом українською, потрібними формами й прикладом. Нічого не треба встановлювати, немає акаунта й реклами.',
      'Картки повертаються якраз перед тим, як слово забулося б (інтервальне повторення FSRS, як в Anki), тож вистачає кількох хвилин на день. Можна перевертати картки, вибирати відповідь, вписувати слово, слухати чи заповнювати пропуск у реченні.',
    ],
    startH: 'Почніть з теми', start: 'Вчити', list: 'Список слів',
    moreH: 'Також безкоштовно',
    more: ['Кожна тема — колодою для Anki, AnkiDroid і AnkiMobile.', 'Найчастіші норвезькі слова з усіма формами з Bokmålsordboka.', 'Для викладачів: одне посилання дає тему всій групі, кожному його мовою.'],
  },
  nb: {
    slug: 'ordkort', nav: 'Norske ordkort',
    title: 'Norske ordkort og gloser – gratis, uten innlogging',
    desc: 'Gratis ordkort på norsk for 29 temaer, fra hilsener til Skatteetaten: hvert ord med bøyning og en eksempelsetning. Repetisjon til rett tid, uten innlogging.',
    h1: 'Norske ordkort',
    lede: [
      'Velg et tema og begynn med en gang: Ordkort åpner med de norske ordene for det, hvert med bøyningen du trenger og en eksempelsetning – og med oversettelse til språket ditt hvis du vil. Ingenting å installere, ingen konto, ingen reklame.',
      'Kortene kommer tilbake akkurat før du ville ha glemt dem (FSRS, den samme planleggeren som Anki bruker), så noen minutter om dagen er nok. Du kan snu kort, velge riktig svar, skrive ordet, lytte eller fylle inn et ord i en setning.',
    ],
    startH: 'Begynn med et tema', start: 'Øv', list: 'Ordliste',
    moreH: 'Også gratis',
    more: ['De vanligste norske ordene med hele bøyningen fra Bokmålsordboka.', 'For lærere: én lenke gir hele klassen et tema, og hver elev velger sitt eget språk.', 'Kortene kan settes inn på skolens nettside.'],
  },
  pl: {
    slug: 'fiszki', nav: 'Fiszki do norweskiego',
    title: 'Fiszki do norweskiego – za darmo, bez rejestracji',
    desc: 'Darmowe fiszki do norweskiego z 29 tematów, od powitań po urząd skarbowy: każde słowo z formami i przykładem. Powtórki w odstępach, bez rejestracji i reklam.',
    h1: 'Fiszki do norweskiego',
    lede: [
      'Wybierz temat i zacznij od razu: Ordkort otworzy się z norweskimi słowami do niego — każde z tłumaczeniem na polski, potrzebnymi formami i przykładowym zdaniem. Nic nie trzeba instalować, nie ma konta ani reklam.',
      'Fiszki wracają tuż przed tym, zanim słowo by się zapomniało (powtórki w odstępach FSRS, jak w Anki), więc wystarczy kilka minut dziennie. Możesz odwracać fiszki, wybierać odpowiedź, wpisywać słowo, słuchać albo uzupełniać lukę w zdaniu.',
    ],
    startH: 'Zacznij od tematu', start: 'Ucz się', list: 'Lista słów',
    moreH: 'Też za darmo',
    more: ['Każdy temat jako talia dla Anki, AnkiDroid i AnkiMobile.', 'Najczęstsze norweskie słowa ze wszystkimi formami z Bokmålsordboka.', 'Dla nauczycieli: jeden link daje temat całej grupie, każdemu w jego języku.'],
  },
  ar: {
    slug: 'bitaqat', nav: 'بطاقات لتعلّم النرويجية',
    title: 'بطاقات لتعلّم النرويجية: مجانًا وبلا تسجيل',
    desc: 'بطاقات مجانية لتعلّم النرويجية في 29 موضوعًا، من التحيات إلى مصلحة الضرائب: كل كلمة مع صيغها وجملة مثال. تكرار متباعد، بلا تسجيل وبلا إعلانات.',
    h1: 'بطاقات لتعلّم النرويجية',
    lede: [
      'اختر موضوعًا وابدأ فورًا: يفتح Ordkort على الكلمات النرويجية لهذا الموضوع، ولكل كلمة ترجمتها العربية والصيغ التي تحتاجها وجملة مثال. لا شيء تثبّته، ولا حساب، ولا إعلانات.',
      'تعود البطاقات قبيل أن تنسى الكلمة (التكرار المتباعد FSRS، كما في Anki)، فتكفيك دقائق قليلة كل يوم. يمكنك قلب البطاقات، أو اختيار الإجابة، أو كتابة الكلمة، أو الاستماع، أو ملء الفراغ في جملة.',
    ],
    startH: 'ابدأ بموضوع', start: 'تدرّب', list: 'قائمة الكلمات',
    moreH: 'مجانًا أيضًا',
    more: ['كل موضوع رزمةً لـ Anki وAnkiDroid وAnkiMobile.', 'أكثر الكلمات النرويجية شيوعًا مع كل صيغها من Bokmålsordboka.', 'للمعلّمين: رابط واحد يعطي الصف كله موضوعًا، وكل متعلّم بلغته.', 'ويمكن وضع البطاقات في موقع المدرسة أو المدوّنة، فتعمل على الهاتف بلا تسجيل.'],
  },
};
