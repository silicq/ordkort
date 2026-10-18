// Static pages about Ordkort for search engines and for people who have not opened it yet:
// public/<lang>/index.html in the six interface languages. The app itself lives at "/" and needs JavaScript;
// these pages are plain HTML that anyone — and any crawler — can read. scripts/seo-pages.mjs writes them
// together with the Norwegian word pages and the sitemap: run `npm run seo` after changing the texts below
// and commit the result (a test checks that the files are up to date).
import '../public/js/langs.js';
import { UI as SEO, LEARN } from './seo-text.mjs';
import { TEACH } from './teachers-text.mjs';

const SITE = 'https://ordkort.com';
const REPO = 'https://github.com/silicq/ordkort';
export const MAIL = 'hei@ordkort.com'; // questions and help (src/mail.js)
const LANGS = globalThis.App.langs.list;

/* ---------- texts ---------- */

export const PAGES = {
  en: {
    hreflang: 'en', htmlLang: 'en', locale: 'en_US', name: 'English',
    title: 'Ordkort — learn any language with flashcards, free and without ads',
    desc: 'Free flashcards with spaced repetition for 60 languages: ready word lists by topic, a dictionary, grammar and a translator that explains every word. No ads, no sign-up.',
    h1: 'Learn any language with flashcards',
    lede: 'Ordkort gives you ready word lists for your topic and level, reminds you of each word just before you would forget it, and explains the grammar behind it. Free, without ads and without an account.',
    cta: 'Start learning',
    note: 'Free · No sign-up · No ads · Works offline',
    sample: [['German', 'der Hund', 'dog'], ['Spanish', 'la casa', 'house'], ['Norwegian', 'et eple', 'apple']],
    featuresH: 'Everything for learning words in one place',
    features: [
      ['Spaced repetition', 'Cards come back exactly when you are about to forget them (FSRS, the algorithm Anki uses). Six ways to practise: flip cards, multiple choice, typing, listening, filling the gap in an example, or a mix.'],
      ['Ready word lists', '29 topics from greetings to documents and public services, for levels A1–C1. The AI picks frequent, useful words; one tap adds twenty more. Or add your own words, or import them from Anki or CSV.'],
      ['Words checked against dictionaries', 'Nouns and verbs are checked against real dictionaries: the official Norwegian dictionaries (ordbokene.no), and Wiktionary for other languages — the article, the gender and the forms.'],
      ['A learner’s dictionary', 'Translation, inflection tables, meanings with examples, fixed expressions and compounds. For Norwegian, the official Bokmål and Nynorsk entries are shown alongside.'],
      ['Grammar book', '15 chapters — nouns, adjectives, verbs, word order and more — with tables, examples, typical mistakes and exercises. Ask any grammar question in your own words.'],
      ['A translator that explains', 'Every word of the translation is coloured by part of speech, with its form and the rule that explains why it is used exactly there.'],
      ['Reading', 'Paste an article, a message or song lyrics and tap any word to see what it means in this sentence — and add it to your cards.'],
      ['Progress on every device', 'Statistics, a daily goal and a streak. Sync your devices without an account, end-to-end encrypted. Works offline and installs like an app.'],
      ['Anki both ways', 'Import an .apkg from any Anki with its pictures and, if you want, its progress. Export your decks as an .apkg Anki opens, with progress and pictures. CSV in and out, and decks shared by link or QR code.'],
      ['Pictures and your own look', 'A free, openly licensed picture for each word, found by the word in its own language, or a photo of your own. Change how cards and the whole site look with a template in HTML and CSS; scripts never run.'],
      ['Remembering better', 'Two answers or four (Again, Hard, Good, Easy), your own target retention, and words you keep forgetting set aside. “What goes wrong” reads your answers and shows what to change.'],
      ['Your own AI, through MCP', 'Connect Claude, ChatGPT or another assistant to ordkort.com/mcp and ask it for a deck with pictures or a new look. It answers with a link that adds it only when you agree, and never sees your cards.'],
    ],
    honestH: 'Honest by design',
    honest: [
      'No ads, no tracking and no account. Your cards and progress are stored in your browser; syncing between devices is encrypted on the device, so the server never sees them.',
      'Ordkort is open source (AGPL-3.0). The AI answers are shared: whatever someone has already asked opens instantly for the next person, which keeps the site free.',
    ],
    how: 'How it works', source: 'Source code on GitHub',
    languagesH: '60 languages',
    languagesP: 'Learn any of them from any other:',
    faqH: 'Questions',
    faq: [
      ['Is Ordkort really free?', 'Yes. There are no ads, no subscriptions and no paid version. The AI features have a daily limit per person that is plenty for everyday learning.'],
      ['Do I need an account?', 'No. Open the site and start. Your cards stay in your browser; to use them on several devices, link the devices with a one-time code or a QR code — no e-mail, no password.'],
      ['Which languages can I learn?', 'Sixty, from any of them to any other: Norwegian, English, German, Spanish, French, Chinese, Arabic, Ukrainian, Russian and many more. The interface is in English, Russian, Ukrainian, Norwegian, Arabic and Chinese; other interface languages are translated automatically.'],
      ['How is it different from Anki or Quizlet?', 'Ordkort comes with ready word lists for each topic and level, and with a dictionary, a grammar book, a translator and a reading mode built in. It uses the same FSRS scheduler as Anki, and decks move both ways: import an .apkg with its pictures and progress, export your decks as an .apkg Anki opens.'],
      ['Does it work offline?', 'Yes. Once opened, the site keeps a copy, so your cards open without internet. The dictionary, grammar, translator and reading need a connection, except for entries you have already opened.'],
      ['Where do the words and explanations come from?', 'They are written by AI and checked: Norwegian against the official dictionaries of the Language Council of Norway and the University of Bergen, other languages against Wiktionary. Any entry can be reported as a mistake right on the site.'],
      ['Can my own AI make decks for me?', 'Yes. Ordkort is an MCP server: connect Claude, ChatGPT or another assistant to ordkort.com/mcp (Settings in the app shows how). Ask it for a deck about any topic, with pictures, or for a new look for the site; it answers with a link that adds it when you agree. It never sees your cards.'],
    ],
    endH: 'Start with your first words',
    endP: 'Choose the language you know and the one you want to learn — the first cards are ready in a minute.',
    langNav: 'Language of this page',
  },

  ru: {
    hreflang: 'ru', htmlLang: 'ru', locale: 'ru_RU', name: 'Русский',
    title: 'Ordkort — изучение языков по карточкам, бесплатно и без рекламы',
    desc: 'Бесплатные карточки с интервальным повторением для 60 языков: готовые слова по темам, словарь, грамматика и переводчик, который объясняет каждое слово. Без рекламы и регистрации.',
    h1: 'Учите любой язык по карточкам',
    lede: 'Ordkort подбирает слова по теме и уровню, напоминает каждое слово как раз перед тем, как вы его забудете, и объясняет грамматику. Бесплатно, без рекламы и без аккаунта.',
    cta: 'Начать учить',
    note: 'Бесплатно · Без регистрации · Без рекламы · Работает офлайн',
    sample: [['немецкий', 'der Hund', 'собака'], ['испанский', 'la casa', 'дом'], ['норвежский', 'et eple', 'яблоко']],
    featuresH: 'Всё для изучения слов в одном месте',
    features: [
      ['Интервальные повторения', 'Карточки возвращаются ровно тогда, когда слово начинает забываться (алгоритм FSRS, как в Anki). Шесть режимов: карточки, выбор ответа, ввод слова, на слух, пропуск в примере или всё вперемешку.'],
      ['Готовые наборы слов', '29 тем — от приветствий до документов и госуслуг, уровни A1–C1. ИИ подбирает частые и полезные слова, одно нажатие добавляет ещё двадцать. Или добавляйте свои слова и импортируйте их из Anki и CSV.'],
      ['Слова сверяются со словарями', 'Существительные и глаголы проверяются по настоящим словарям: официальным норвежским (ordbokene.no), а для других языков — по Викисловарю. Проверяются артикль, род и формы.'],
      ['Словарь для изучающих', 'Перевод, таблицы словоизменения, значения с примерами, устойчивые выражения и сложные слова. Для норвежского рядом показываются официальные статьи букмола и нюношка.'],
      ['Грамматика', '15 глав — существительные, прилагательные, глаголы, порядок слов и другое — с таблицами, примерами, типичными ошибками и упражнениями. Можно задать любой вопрос своими словами.'],
      ['Переводчик с объяснениями', 'Каждое слово перевода подсвечено по части речи, с его формой и правилом, по которому оно стоит именно здесь.'],
      ['Чтение', 'Вставьте статью, сообщение или текст песни и нажмите на любое слово — увидите его значение в этом предложении и сможете добавить в карточки.'],
      ['Прогресс на всех устройствах', 'Статистика, цель на день и серия дней. Синхронизация устройств без аккаунта, со сквозным шифрованием. Работает без интернета и устанавливается как приложение.'],
      ['Anki в обе стороны', 'Импорт .apkg из любой версии Anki с картинками и, если хотите, с прогрессом. Экспорт колод в .apkg, который открывает Anki, с прогрессом и картинками. CSV туда и обратно, колоды по ссылке и QR-коду.'],
      ['Картинки и своё оформление', 'Бесплатная картинка со свободной лицензией для каждого слова — её находят по слову на его родном языке — или ваше собственное фото. Вид карточек и всего сайта меняется шаблоном на HTML и CSS; скрипты никогда не выполняются.'],
      ['Запоминать лучше', 'Два ответа или четыре («Снова», «Трудно», «Хорошо», «Легко»), своя целевая доля запоминания, а слова, которые постоянно забываются, откладываются. «Что идёт не так» читает ваши ответы и подсказывает, что изменить.'],
      ['Свой ИИ через MCP', 'Подключите Claude, ChatGPT или другого ассистента к ordkort.com/mcp и попросите колоду с картинками или новое оформление. Он ответит ссылкой, которая добавит это только с вашего согласия, а ваших карточек не видит.'],
    ],
    honestH: 'Честно по устройству',
    honest: [
      'Без рекламы, слежки и аккаунта. Карточки и прогресс хранятся в вашем браузере, а синхронизация шифруется на устройстве — сервер их не видит.',
      'Ordkort — открытый проект (AGPL-3.0). Ответы ИИ общие: то, что кто-то уже спрашивал, следующий человек получает мгновенно, поэтому сайт остаётся бесплатным.',
    ],
    how: 'Как это устроено', source: 'Исходный код на GitHub',
    languagesH: '60 языков',
    languagesP: 'Учите любой из них с любого другого:',
    faqH: 'Вопросы',
    faq: [
      ['Ordkort правда бесплатный?', 'Да. Нет рекламы, подписок и платной версии. У функций ИИ есть дневной лимит на человека, которого с запасом хватает для ежедневных занятий.'],
      ['Нужна ли регистрация?', 'Нет. Откройте сайт и начинайте. Карточки хранятся в вашем браузере; чтобы пользоваться ими на нескольких устройствах, свяжите их одноразовым кодом или QR-кодом — без почты и пароля.'],
      ['Какие языки можно учить?', 'Шестьдесят, с любого на любой: норвежский, английский, немецкий, испанский, французский, китайский, арабский, украинский, русский и многие другие. Интерфейс — на русском, украинском, английском, норвежском, арабском и китайском; на другие языки он переводится автоматически.'],
      ['Чем это отличается от Anki или Quizlet?', 'В Ordkort уже есть готовые слова для каждой темы и уровня, а ещё встроены словарь, грамматика, переводчик и режим чтения. Расписание повторений то же, что в Anki (FSRS), и колоды переходят в обе стороны: импорт .apkg с картинками и прогрессом, экспорт колод в .apkg, который открывает Anki.'],
      ['Работает ли без интернета?', 'Да. Открытый однажды сайт сохраняет копию, и карточки открываются без сети. Словарю, грамматике, переводчику и чтению нужен интернет — кроме статей, которые вы уже открывали.'],
      ['Откуда берутся слова и объяснения?', 'Их пишет ИИ, а затем они проверяются: норвежский — по официальным словарям Норвежского языкового совета и Бергенского университета, другие языки — по Викисловарю. О любой ошибке можно сообщить прямо на сайте.'],
      ['Может ли мой ИИ делать для меня колоды?', 'Да. Ordkort — это MCP-сервер: подключите Claude, ChatGPT или другого ассистента к ordkort.com/mcp (как это сделать, написано в настройках приложения). Попросите колоду на любую тему с картинками или новое оформление сайта — он ответит ссылкой, которая добавит это с вашего согласия. Ваших карточек он не видит.'],
    ],
    endH: 'Начните с первых слов',
    endP: 'Выберите язык, который знаете, и тот, который хотите выучить, — первые карточки будут готовы через минуту.',
    langNav: 'Язык этой страницы',
  },

  uk: {
    hreflang: 'uk', htmlLang: 'uk', locale: 'uk_UA', name: 'Українська',
    title: 'Ordkort — вивчення мов за картками, безкоштовно й без реклами',
    desc: 'Безкоштовні картки з інтервальним повторенням для 60 мов: готові слова за темами, словник, граматика й перекладач, що пояснює кожне слово. Без реклами й реєстрації.',
    h1: 'Вивчайте будь-яку мову за картками',
    lede: 'Ordkort добирає слова за темою й рівнем, нагадує кожне слово саме тоді, коли ви от-от його забудете, і пояснює граматику. Безкоштовно, без реклами й без акаунта.',
    cta: 'Почати вчити',
    note: 'Безкоштовно · Без реєстрації · Без реклами · Працює офлайн',
    sample: [['німецька', 'der Hund', 'собака'], ['іспанська', 'la casa', 'будинок'], ['норвезька', 'et eple', 'яблуко']],
    featuresH: 'Усе для вивчення слів в одному місці',
    features: [
      ['Інтервальні повторення', 'Картки повертаються саме тоді, коли слово починає забуватися (алгоритм FSRS, як в Anki). Шість режимів: картки, вибір відповіді, введення слова, на слух, пропуск у прикладі або все впереміш.'],
      ['Готові набори слів', '29 тем — від привітань до документів і державних послуг, рівні A1–C1. ШІ добирає часті й корисні слова, одне натискання додає ще двадцять. Або додавайте свої слова та імпортуйте з Anki й CSV.'],
      ['Слова звіряються зі словниками', 'Іменники й дієслова перевіряються за справжніми словниками: офіційними норвезькими (ordbokene.no), а для інших мов — за Вікісловником. Перевіряються артикль, рід і форми.'],
      ['Словник для тих, хто вчить мову', 'Переклад, таблиці словозміни, значення з прикладами, сталі вирази й складні слова. Для норвезької поруч показуються офіційні статті букмола й нюношка.'],
      ['Граматика', '15 розділів — іменники, прикметники, дієслова, порядок слів тощо — з таблицями, прикладами, типовими помилками й вправами. Можна поставити будь-яке запитання своїми словами.'],
      ['Перекладач із поясненнями', 'Кожне слово перекладу підсвічене за частиною мови, з його формою та правилом, за яким воно стоїть саме тут.'],
      ['Читання', 'Вставте статтю, повідомлення чи текст пісні й натисніть на будь-яке слово — побачите його значення в цьому реченні й зможете додати в картки.'],
      ['Прогрес на всіх пристроях', 'Статистика, мета на день і серія днів. Синхронізація пристроїв без акаунта, з наскрізним шифруванням. Працює без інтернету й установлюється як застосунок.'],
      ['Anki в обидва боки', 'Імпорт .apkg із будь-якої версії Anki з картинками й, якщо хочете, з прогресом. Експорт колод у .apkg, який відкриває Anki, з прогресом і картинками. CSV туди й назад, колоди за посиланням і QR-кодом.'],
      ['Картинки й власне оформлення', 'Безкоштовна картинка з вільною ліцензією для кожного слова — її знаходять за словом його рідною мовою — або ваше власне фото. Вигляд карток і всього сайту змінюється шаблоном на HTML і CSS; скрипти ніколи не виконуються.'],
      ['Запам’ятовувати краще', 'Дві відповіді або чотири («Знову», «Важко», «Добре», «Легко»), власна цільова частка запам’ятовування, а слова, які постійно забуваються, відкладаються. «Що йде не так» читає ваші відповіді й підказує, що змінити.'],
      ['Власний ШІ через MCP', 'Під’єднайте Claude, ChatGPT чи іншого асистента до ordkort.com/mcp і попросіть колоду з картинками або нове оформлення. Він відповість посиланням, яке додасть це лише з вашої згоди, а ваших карток не бачить.'],
    ],
    honestH: 'Чесно за будовою',
    honest: [
      'Без реклами, стеження й акаунта. Картки та прогрес зберігаються у вашому браузері, а синхронізація шифрується на пристрої — сервер їх не бачить.',
      'Ordkort — відкритий проєкт (AGPL-3.0). Відповіді ШІ спільні: те, про що хтось уже питав, наступна людина отримує миттєво, тож сайт лишається безкоштовним.',
    ],
    how: 'Як це влаштовано', source: 'Вихідний код на GitHub',
    languagesH: '60 мов',
    languagesP: 'Вивчайте будь-яку з них з будь-якої іншої:',
    faqH: 'Запитання',
    faq: [
      ['Ordkort справді безкоштовний?', 'Так. Немає реклами, підписок і платної версії. Функції ШІ мають денний ліміт на людину, якого з запасом вистачає для щоденних занять.'],
      ['Чи потрібна реєстрація?', 'Ні. Відкрийте сайт і починайте. Картки зберігаються у вашому браузері; щоб користуватися ними на кількох пристроях, зв’яжіть їх одноразовим кодом або QR-кодом — без пошти й пароля.'],
      ['Які мови можна вчити?', 'Шістдесят, з будь-якої на будь-яку: норвезьку, англійську, німецьку, іспанську, французьку, китайську, арабську, українську й багато інших. Інтерфейс — українською, англійською, російською, норвезькою, арабською й китайською; іншими мовами він перекладається автоматично.'],
      ['Чим це відрізняється від Anki чи Quizlet?', 'В Ordkort уже є готові слова для кожної теми й рівня, а ще вбудовані словник, граматика, перекладач і режим читання. Розклад повторень той самий, що в Anki (FSRS), і колоди переходять в обидва боки: імпорт .apkg з картинками й прогресом, експорт колод у .apkg, який відкриває Anki.'],
      ['Чи працює без інтернету?', 'Так. Відкритий одного разу сайт зберігає копію, і картки відкриваються без мережі. Словнику, граматиці, перекладачу й читанню потрібен інтернет — крім статей, які ви вже відкривали.'],
      ['Звідки беруться слова й пояснення?', 'Їх пише ШІ, а потім вони перевіряються: норвезька — за офіційними словниками Норвезької мовної ради та Бергенського університету, інші мови — за Вікісловником. Про будь-яку помилку можна повідомити просто на сайті.'],
      ['Чи може мій ШІ робити для мене колоди?', 'Так. Ordkort — це MCP-сервер: під’єднайте Claude, ChatGPT чи іншого асистента до ordkort.com/mcp (як це зробити, написано в налаштуваннях застосунку). Попросіть колоду на будь-яку тему з картинками або нове оформлення сайту — він відповість посиланням, яке додасть це з вашої згоди. Ваших карток він не бачить.'],
    ],
    endH: 'Почніть із перших слів',
    endP: 'Оберіть мову, яку знаєте, і ту, яку хочете вивчити, — перші картки будуть готові за хвилину.',
    langNav: 'Мова цієї сторінки',
  },

  nb: {
    hreflang: 'nb', htmlLang: 'nb', locale: 'nb_NO', name: 'Norsk',
    title: 'Ordkort — lær språk med ordkort: gratis, uten reklame og innlogging',
    desc: 'Gratis ordkort med repetisjon til rett tid for 60 språk: ferdige gloser etter tema, ordbok, grammatikk og en oversetter som forklarer hvert ord. Uten reklame og innlogging.',
    h1: 'Lær hvilket som helst språk med ordkort',
    lede: 'Ordkort gir deg ferdige gloser for tema og nivå, minner deg på hvert ord akkurat før du ville glemt det, og forklarer grammatikken bak. Gratis, uten reklame og uten konto.',
    cta: 'Begynn å lære',
    note: 'Gratis · Ingen innlogging · Ingen reklame · Virker uten nett',
    sample: [['tysk', 'der Hund', 'hund'], ['spansk', 'la casa', 'hus'], ['engelsk', 'an apple', 'eple']],
    featuresH: 'Alt for å lære ord, samlet på ett sted',
    features: [
      ['Repetisjon til rett tid', 'Kortene kommer tilbake akkurat når du er i ferd med å glemme dem (FSRS, algoritmen som Anki bruker). Seks måter å øve på: vendekort, flervalg, skriving, lytting, fyll inn ordet i et eksempel, eller en blanding.'],
      ['Ferdige gloselister', '29 temaer fra hilsener til dokumenter og offentlige tjenester, for nivå A1–C1. KI-en velger vanlige og nyttige ord; ett trykk gir tjue til. Eller legg inn dine egne ord og importer fra Anki eller CSV.'],
      ['Ordene kontrolleres mot ordbøker', 'Substantiver og verb kontrolleres mot ekte ordbøker: de offisielle norske ordbøkene (ordbokene.no), og Wiktionary for andre språk – artikkel, kjønn og bøyningsformer.'],
      ['Ordbok for språkinnlærere', 'Oversettelse, bøyningstabeller, betydninger med eksempler, faste uttrykk og sammensatte ord. For norsk vises de offisielle artiklene fra Bokmålsordboka og Nynorskordboka ved siden av.'],
      ['Grammatikkbok', '15 kapitler – substantiver, adjektiver, verb, ordstilling og mer – med tabeller, eksempler, typiske feil og oppgaver. Still et hvilket som helst grammatikkspørsmål med egne ord.'],
      ['En oversetter som forklarer', 'Hvert ord i oversettelsen er farget etter ordklasse, med bøyningsformen og regelen som forklarer hvorfor det står akkurat der.'],
      ['Lesing', 'Lim inn en artikkel, en melding eller en sangtekst og trykk på et ord for å se hva det betyr i akkurat denne setningen – og legg det til i kortene dine.'],
      ['Framgang på alle enheter', 'Statistikk, dagsmål og en rekke av dager. Synkroniser enhetene dine uten konto, ende-til-ende-kryptert. Virker uten nett og kan installeres som en app.'],
      ['Anki begge veier', 'Importer en .apkg fra hvilken som helst Anki med bilder og, om du vil, fremgang. Eksporter kortstokkene dine som en .apkg Anki åpner, med fremgang og bilder. CSV inn og ut, og kortstokker delt med lenke eller QR-kode.'],
      ['Bilder og ditt eget utseende', 'Et gratis bilde med åpen lisens til hvert ord, funnet etter ordet på dets eget språk, eller et eget bilde. Endre hvordan kortene og hele nettstedet ser ut med en mal i HTML og CSS; skript kjøres aldri.'],
      ['Husk bedre', 'To svar eller fire (Igjen, Vanskelig, Bra, Lett), din egen målsatte husketeprosent, og ord du stadig glemmer, legges til side. «Hva går galt» leser svarene dine og viser hva du kan endre.'],
      ['Din egen KI, gjennom MCP', 'Koble Claude, ChatGPT eller en annen assistent til ordkort.com/mcp og be om en kortstokk med bilder eller et nytt utseende. Den svarer med en lenke som legger det til bare når du sier ja, og ser aldri kortene dine.'],
    ],
    honestH: 'Ærlig fra grunnen av',
    honest: [
      'Ingen reklame, ingen sporing og ingen konto. Kortene og framgangen din lagres i nettleseren, og synkroniseringen krypteres på enheten, så serveren ser dem aldri.',
      'Ordkort har åpen kildekode (AGPL-3.0). KI-svarene deles: det noen allerede har spurt om, åpnes med en gang for nestemann – derfor kan siden være gratis.',
    ],
    how: 'Slik fungerer det', source: 'Kildekode på GitHub',
    languagesH: '60 språk',
    languagesP: 'Lær hvilket som helst av dem fra hvilket som helst annet:',
    faqH: 'Spørsmål',
    faq: [
      ['Er Ordkort virkelig gratis?', 'Ja. Det er ingen reklame, ingen abonnement og ingen betalt versjon. KI-funksjonene har en daglig grense per person som er mer enn nok til daglig læring.'],
      ['Må jeg lage en konto?', 'Nei. Åpne siden og sett i gang. Kortene ligger i nettleseren din; vil du bruke dem på flere enheter, kobler du enhetene med en engangskode eller en QR-kode – uten e-post og passord.'],
      ['Hvilke språk kan jeg lære?', 'Seksti, fra hvilket som helst til hvilket som helst: norsk, engelsk, tysk, spansk, fransk, kinesisk, arabisk, ukrainsk, russisk og mange flere. Grensesnittet finnes på norsk, engelsk, russisk, ukrainsk, arabisk og kinesisk; andre språk oversettes automatisk.'],
      ['Hva er forskjellen fra Anki eller Quizlet?', 'Ordkort har ferdige gloser for hvert tema og nivå, og ordbok, grammatikkbok, oversetter og lesemodus er innebygd. Repetisjonen bruker samme FSRS som Anki, og kortstokker går begge veier: importer en .apkg med bilder og fremgang, eksporter kortstokkene som en .apkg Anki åpner.'],
      ['Virker det uten internett?', 'Ja. Når siden først er åpnet, har nettleseren en kopi, så kortene åpnes uten nett. Ordboka, grammatikken, oversetteren og lesingen trenger nett – unntatt oppslag du allerede har åpnet.'],
      ['Hvor kommer ordene og forklaringene fra?', 'De skrives av KI og kontrolleres: norsk mot de offisielle ordbøkene fra Språkrådet og Universitetet i Bergen, andre språk mot Wiktionary. Alle oppslag kan meldes som feil rett på siden.'],
      ['Kan min egen KI lage kortstokker for meg?', 'Ja. Ordkort er en MCP-server: koble Claude, ChatGPT eller en annen assistent til ordkort.com/mcp (innstillingene i appen viser hvordan). Be om en kortstokk om hvilket som helst tema, med bilder, eller et nytt utseende for nettstedet; den svarer med en lenke som legger det til når du sier ja. Den ser aldri kortene dine.'],
    ],
    endH: 'Begynn med de første ordene',
    endP: 'Velg språket du kan og språket du vil lære – de første kortene er klare på et minutt.',
    langNav: 'Språket på denne siden',
  },

  ar: {
    hreflang: 'ar', htmlLang: 'ar', locale: 'ar_AR', name: 'العربية', rtl: true,
    title: 'Ordkort — تعلّم أي لغة بالبطاقات التعليمية مجانًا وبلا إعلانات',
    desc: 'بطاقات تعليمية مجانية بالتكرار المتباعد لستين لغة: كلمات جاهزة حسب الموضوع، وقاموس، وقواعد، ومترجم يشرح كل كلمة. بلا إعلانات وبلا تسجيل.',
    h1: 'تعلّم أي لغة بالبطاقات التعليمية',
    lede: 'يقدّم لك Ordkort كلمات جاهزة حسب الموضوع والمستوى، ويذكّرك بكل كلمة قبيل أن تنساها، ويشرح القواعد وراءها. مجانًا، بلا إعلانات وبلا حساب.',
    cta: 'ابدأ التعلّم',
    note: 'مجاني · بلا تسجيل · بلا إعلانات · يعمل دون اتصال',
    sample: [['الألمانية', 'der Hund', 'كلب'], ['الإسبانية', 'la casa', 'بيت'], ['النرويجية', 'et eple', 'تفاحة']],
    featuresH: 'كل ما تحتاجه لتعلّم الكلمات في مكان واحد',
    features: [
      ['التكرار المتباعد', 'تعود البطاقات تمامًا حين توشك على نسيان الكلمة (خوارزمية FSRS التي يستخدمها Anki). ست طرق للتدريب: قلب البطاقات، والاختيار من متعدد، والكتابة، والاستماع، وملء الفراغ في مثال، أو مزيج منها.'],
      ['قوائم كلمات جاهزة', '29 موضوعًا من التحيات إلى الوثائق والخدمات العامة، للمستويات A1–C1. يختار الذكاء الاصطناعي كلمات شائعة ومفيدة، ونقرة واحدة تضيف عشرين كلمة أخرى. أو أضف كلماتك واستوردها من Anki أو CSV.'],
      ['كلمات تُراجَع مع القواميس', 'تُراجَع الأسماء والأفعال مع قواميس حقيقية: القواميس النرويجية الرسمية (ordbokene.no)، وويكاموس للغات الأخرى — أداة التعريف والجنس والصيغ.'],
      ['قاموس للمتعلّمين', 'الترجمة وجداول التصريف والمعاني مع الأمثلة والتعابير الثابتة والكلمات المركّبة. وللنرويجية تُعرض المداخل الرسمية لبوكمول ونينوشك إلى جانبها.'],
      ['كتاب القواعد', '15 فصلًا — الأسماء والصفات والأفعال وترتيب الكلمات وغيرها — مع جداول وأمثلة وأخطاء شائعة وتمارين. اسأل أي سؤال في القواعد بكلماتك.'],
      ['مترجم يشرح', 'كل كلمة في الترجمة ملوّنة حسب نوعها، مع صيغتها والقاعدة التي تفسّر سبب استخدامها في هذا الموضع بالذات.'],
      ['القراءة', 'الصق مقالًا أو رسالة أو كلمات أغنية، وانقر أي كلمة لترى معناها في هذه الجملة — وأضفها إلى بطاقاتك.'],
      ['تقدّمك على كل أجهزتك', 'إحصاءات وهدف يومي وسلسلة أيام. زامن أجهزتك بلا حساب وبتشفير تام بين الطرفين. يعمل دون اتصال ويُثبَّت كتطبيق.'],
      ['Anki في الاتجاهين', 'استورد ملف .apkg من أي إصدار من Anki مع صوره، ومع تقدّمك إن أردت. وصدّر رزمك بصيغة .apkg يفتحها Anki، مع التقدّم والصور. وCSV استيرادًا وتصديرًا، ومشاركة الرزم برابط أو رمز QR.'],
      ['الصور ومظهرك الخاص', 'صورة مجانية بترخيص مفتوح لكل كلمة، يُعثر عليها بالكلمة بلغتها، أو صورة من عندك. غيّر شكل البطاقات والموقع كله بقالب HTML وCSS؛ ولا تعمل السكربتات أبدًا.'],
      ['تذكّر أفضل', 'إجابتان أو أربع (مجددًا، صعب، جيد، سهل)، ونسبة التذكّر التي تريدها، والكلمات التي تنساها مرارًا تُنحّى جانبًا. وصفحة «ما الذي لا يسير جيدًا» تقرأ إجاباتك وتبيّن ما يجب تغييره.'],
      ['ذكاؤك الاصطناعي عبر MCP', 'اربط Claude أو ChatGPT أو مساعدًا آخر بالعنوان ordkort.com/mcp واطلب رزمة بالصور أو مظهرًا جديدًا. سيجيب برابط لا يضيف شيئًا إلا بموافقتك، ولا يرى بطاقاتك أبدًا.'],
    ],
    honestH: 'صادق في تصميمه',
    honest: [
      'بلا إعلانات ولا تتبّع ولا حساب. تُحفَظ بطاقاتك وتقدّمك في متصفحك، وتُشفَّر المزامنة على جهازك فلا يراها الخادم أبدًا.',
      'Ordkort مفتوح المصدر (AGPL-3.0). إجابات الذكاء الاصطناعي مشتركة: ما سأل عنه أحدهم يُفتح فورًا لمن يأتي بعده، ولهذا يبقى الموقع مجانيًا.',
    ],
    how: 'كيف يعمل', source: 'الشيفرة المصدرية على GitHub',
    languagesH: '60 لغة',
    languagesP: 'تعلّم أيًّا منها انطلاقًا من أي لغة أخرى:',
    faqH: 'أسئلة',
    faq: [
      ['هل Ordkort مجاني فعلًا؟', 'نعم. لا إعلانات ولا اشتراكات ولا نسخة مدفوعة. لميزات الذكاء الاصطناعي حدّ يومي لكل شخص يكفي بسخاء للتعلّم اليومي.'],
      ['هل أحتاج إلى حساب؟', 'لا. افتح الموقع وابدأ. تبقى بطاقاتك في متصفحك، ولاستخدامها على عدة أجهزة اربط الأجهزة برمز لمرة واحدة أو رمز QR — بلا بريد إلكتروني ولا كلمة مرور.'],
      ['ما اللغات التي يمكنني تعلّمها؟', 'ستون لغة، من أي لغة إلى أي لغة: العربية والإنجليزية والنرويجية والألمانية والإسبانية والفرنسية والصينية والأوكرانية والروسية وغيرها كثير. الواجهة متاحة بالعربية والإنجليزية والروسية والأوكرانية والنرويجية والصينية، وتُترجم إلى اللغات الأخرى تلقائيًا.'],
      ['ما الفرق بينه وبين Anki أو Quizlet؟', 'يأتي Ordkort بكلمات جاهزة لكل موضوع ومستوى، وفيه قاموس وكتاب قواعد ومترجم ووضع للقراءة. ويستخدم جدولة FSRS نفسها التي يستخدمها Anki، وتنتقل الرزم في الاتجاهين: استيراد .apkg مع الصور والتقدّم، وتصدير رزمك بصيغة .apkg يفتحها Anki.'],
      ['هل يعمل دون إنترنت؟', 'نعم. بعد أول فتح يحتفظ المتصفح بنسخة من الموقع، فتُفتح بطاقاتك دون اتصال. أما القاموس والقواعد والمترجم والقراءة فتحتاج إلى اتصال، باستثناء المداخل التي فتحتها من قبل.'],
      ['من أين تأتي الكلمات والشروح؟', 'يكتبها الذكاء الاصطناعي ثم تُراجَع: النرويجية مع القواميس الرسمية لمجلس اللغة النرويجية وجامعة بيرغن، واللغات الأخرى مع ويكاموس. ويمكن الإبلاغ عن أي خطأ مباشرة في الموقع.'],
      ['هل يستطيع ذكائي الاصطناعي أن يصنع لي رزمًا؟', 'نعم. Ordkort خادم MCP: اربط Claude أو ChatGPT أو مساعدًا آخر بالعنوان ordkort.com/mcp (تشرح إعدادات التطبيق الطريقة). اطلب رزمة عن أي موضوع مع صور، أو مظهرًا جديدًا للموقع؛ وسيجيب برابط يضيفها حين توافق. ولا يرى بطاقاتك أبدًا.'],
    ],
    endH: 'ابدأ بكلماتك الأولى',
    endP: 'اختر اللغة التي تعرفها واللغة التي تريد تعلّمها — ستكون البطاقات الأولى جاهزة خلال دقيقة.',
    langNav: 'لغة هذه الصفحة',
  },

  zh: {
    hreflang: 'zh-Hans', htmlLang: 'zh-Hans', locale: 'zh_CN', name: '中文',
    title: 'Ordkort — 用单词卡学任何语言：免费、无广告、无需注册',
    desc: '免费的间隔重复单词卡，支持 60 种语言：按主题准备好的词汇、词典、语法书，以及逐词讲解的翻译。无广告，无需注册，可离线使用，卡片只保存在你的浏览器里。',
    h1: '用单词卡学任何语言',
    lede: 'Ordkort 按主题和水平为你准备好词汇，在你快要忘记一个词时及时提醒你，并讲清背后的语法。免费、无广告、无需账号。',
    cta: '开始学习',
    note: '免费 · 无需注册 · 无广告 · 可离线使用',
    sample: [['德语', 'der Hund', '狗'], ['西班牙语', 'la casa', '房子'], ['挪威语', 'et eple', '苹果']],
    featuresH: '学单词所需的一切，都在一个地方',
    features: [
      ['间隔重复', '卡片会在你快要忘记时回来（采用 Anki 同款的 FSRS 算法）。六种练习方式：翻卡、选择题、拼写、听力、例句填空或混合练习。'],
      ['现成的词汇表', '29 个主题，从问候语到证件和公共服务，覆盖 A1–C1 水平。AI 挑选常用、实用的词，点一下就再加二十个。也可以添加自己的单词，或从 Anki、CSV 导入。'],
      ['单词经过词典核对', '名词和动词会与真正的词典核对：挪威语用官方词典（ordbokene.no），其他语言用维基词典——核对冠词、性和词形。'],
      ['学习者词典', '翻译、词形变化表、释义和例句、固定搭配和复合词。挪威语还会同时显示书面挪威语和新挪威语的官方词条。'],
      ['语法书', '15 章——名词、形容词、动词、语序等——配有表格、例句、常见错误和练习。也可以用自己的话提任何语法问题。'],
      ['会讲解的翻译', '译文中的每个词都按词性着色，并标出它的形式，以及它为什么恰好用在这里的规则。'],
      ['阅读', '粘贴一篇文章、一条消息或一段歌词，点任意一个词，就能看到它在这句话里的意思——并加入你的卡片。'],
      ['所有设备同步进度', '统计、每日目标和连续天数。无需账号即可在设备间同步，端到端加密。可离线使用，也能像应用一样安装。'],
      ['与 Anki 双向互通', '从任何版本的 Anki 导入 .apkg，带图片，也可以带学习进度。把牌组导出为 Anki 能打开的 .apkg，包含进度和图片。CSV 可导入导出，牌组还能通过链接或二维码分享。'],
      ['图片与自定义外观', '每个单词都能配一张免费的开放授权图片——按单词在它自己的语言里查找——也可以用你自己的照片。用 HTML 和 CSS 模板改变卡片和整个网站的样子；脚本永远不会运行。'],
      ['记得更牢', '两个按钮或四个（重来、困难、良好、简单），自定目标记忆率，总是忘的单词会被暂时搁置。“问题在哪里”会分析你的作答，告诉你该改什么。'],
      ['通过 MCP 使用你自己的 AI', '把 Claude、ChatGPT 或其他助手连接到 ordkort.com/mcp，让它做带图片的牌组或新外观。它会回复一个链接，只有你同意才会添加，而且它看不到你的卡片。'],
    ],
    honestH: '从设计上就坦诚',
    honest: [
      '没有广告，没有追踪，也不需要账号。你的卡片和进度保存在浏览器里，同步在设备上加密，服务器永远看不到。',
      'Ordkort 是开源项目（AGPL-3.0）。AI 的回答是共享的：别人问过的内容，下一个人可以立即打开——所以网站能保持免费。',
    ],
    how: '工作原理', source: 'GitHub 上的源代码',
    languagesH: '60 种语言',
    languagesP: '可以从任何一种语言学习其他任何一种：',
    faqH: '常见问题',
    faq: [
      ['Ordkort 真的免费吗？', '是的。没有广告、没有订阅，也没有付费版。AI 功能每人每天有使用上限，日常学习绰绰有余。'],
      ['需要注册吗？', '不需要。打开网站就能开始。卡片保存在你的浏览器里；想在多台设备上使用，用一次性代码或二维码把设备关联起来即可——无需邮箱和密码。'],
      ['可以学哪些语言？', '六十种，任意两种之间都可以：挪威语、英语、德语、西班牙语、法语、中文、阿拉伯语、乌克兰语、俄语等等。界面有中文、英语、俄语、乌克兰语、挪威语和阿拉伯语版本，其他语言会自动翻译。'],
      ['和 Anki 或 Quizlet 有什么不同？', 'Ordkort 为每个主题和水平准备了现成的词汇，还内置了词典、语法书、翻译和阅读模式。复习排程使用与 Anki 相同的 FSRS，牌组可以双向流通：导入带图片和进度的 .apkg，或把牌组导出为 Anki 能打开的 .apkg。'],
      ['可以离线使用吗？', '可以。打开过一次后，浏览器会保存网站副本，没有网络也能打开卡片。词典、语法、翻译和阅读需要联网——已经打开过的词条除外。'],
      ['单词和讲解从哪里来？', '由 AI 编写，再经过核对：挪威语对照挪威语言委员会和卑尔根大学的官方词典，其他语言对照维基词典。任何条目都可以直接在网站上报告错误。'],
      ['我自己的 AI 能帮我做牌组吗？', '可以。Ordkort 是一个 MCP 服务器：把 Claude、ChatGPT 或其他助手连接到 ordkort.com/mcp（应用的设置里有说明）。让它做任何主题的带图片牌组，或给网站换新外观；它会回复一个链接，你同意后才会添加。它看不到你的卡片。'],
    ],
    endH: '从第一批单词开始',
    endP: '选择你会的语言和想学的语言——一分钟内第一批卡片就准备好。',
    langNav: '本页语言',
  },
  pl: {
    hreflang: 'pl', htmlLang: 'pl', locale: 'pl_PL', name: 'Polski',
    title: 'Ordkort — ucz się języków z fiszkami, za darmo i bez reklam',
    desc: 'Darmowe fiszki z powtórkami w odstępach dla 60 języków: gotowe listy słówek według tematów, słownik, gramatyka i tłumacz, który wyjaśnia każde słowo. Bez reklam i bez rejestracji.',
    h1: 'Ucz się dowolnego języka z fiszkami',
    lede: 'Ordkort daje gotowe listy słówek do twojego tematu i poziomu, przypomina każde słowo tuż przed tym, zanim je zapomnisz, i wyjaśnia gramatykę, która za nim stoi. Za darmo, bez reklam i bez konta.',
    cta: 'Zacznij naukę',
    note: 'Za darmo · Bez rejestracji · Bez reklam · Działa offline',
    sample: [['niemiecki', 'der Hund', 'pies'], ['hiszpański', 'la casa', 'dom'], ['norweski', 'et eple', 'jabłko']],
    featuresH: 'Wszystko do nauki słówek w jednym miejscu',
    features: [
      ['Powtórki w odstępach', 'Fiszki wracają dokładnie wtedy, gdy masz je zapomnieć (FSRS, ten sam algorytm co w Anki). Sześć sposobów ćwiczenia: odwracanie fiszek, wybór odpowiedzi, wpisywanie, słuchanie, uzupełnianie luki w przykładzie albo wszystko naraz.'],
      ['Gotowe listy słówek', '29 tematów od powitań po dokumenty i urzędy, na poziomach A1–C1. AI wybiera częste, przydatne słowa; jedno dotknięcie dodaje dwadzieścia kolejnych. Możesz też dodać własne słowa albo zaimportować je z Anki lub CSV.'],
      ['Słowa sprawdzone w słownikach', 'Rzeczowniki i czasowniki są sprawdzane w prawdziwych słownikach: w oficjalnych słownikach norweskich (ordbokene.no), a dla innych języków w Wiktionary — rodzajnik, rodzaj i formy.'],
      ['Słownik dla uczących się', 'Tłumaczenie, tabele odmiany, znaczenia z przykładami, stałe wyrażenia i wyrazy złożone. Dla norweskiego obok widać oficjalne hasła bokmål i nynorsk.'],
      ['Podręcznik gramatyki', '15 rozdziałów — rzeczowniki, przymiotniki, czasowniki, szyk zdania i więcej — z tabelami, przykładami, typowymi błędami i ćwiczeniami. Zadaj dowolne pytanie o gramatykę własnymi słowami.'],
      ['Tłumacz, który wyjaśnia', 'Każde słowo tłumaczenia jest oznaczone kolorem części mowy, z formą i regułą, która wyjaśnia, dlaczego stoi właśnie tam.'],
      ['Czytanie', 'Wklej artykuł, wiadomość albo tekst piosenki i dotknij dowolnego słowa, żeby zobaczyć, co znaczy w tym zdaniu — i dodaj je do swoich fiszek.'],
      ['Postępy na każdym urządzeniu', 'Statystyki, cel dzienny i seria dni. Synchronizuj urządzenia bez konta, z szyfrowaniem end-to-end. Działa offline i instaluje się jak aplikacja.'],
      ['Anki w obie strony', 'Zaimportuj plik .apkg z dowolnego Anki razem z obrazkami i, jeśli chcesz, postępami. Wyeksportuj talie jako .apkg, który otworzy Anki, z postępami i obrazkami. CSV w obie strony i talie udostępniane przez link albo kod QR.'],
      ['Obrazki i własny wygląd', 'Darmowy obrazek na wolnej licencji do każdego słowa, znaleziony po słowie w jego własnym języku, albo twoje zdjęcie. Zmień wygląd fiszek i całej strony szablonem w HTML i CSS; skrypty nigdy się nie uruchamiają.'],
      ['Lepsze zapamiętywanie', 'Dwie odpowiedzi albo cztery (Znowu, Trudne, Dobrze, Łatwe), własny docelowy poziom zapamiętania i odkładanie słów, które ciągle umykają. „Co idzie nie tak” czyta twoje odpowiedzi i pokazuje, co zmienić.'],
      ['Twoja własna AI przez MCP', 'Podłącz Claude, ChatGPT albo innego asystenta do ordkort.com/mcp i poproś o talię z obrazkami albo nowy wygląd. Odpowie linkiem, który doda ją tylko wtedy, gdy się zgodzisz, i nigdy nie widzi twoich fiszek.'],
    ],
    honestH: 'Uczciwie z założenia',
    honest: [
      'Bez reklam, bez śledzenia i bez konta. Twoje fiszki i postępy są zapisane w przeglądarce; synchronizacja między urządzeniami jest szyfrowana na urządzeniu, więc serwer nigdy ich nie widzi.',
      'Ordkort ma otwarty kod źródłowy (AGPL-3.0). Odpowiedzi AI są wspólne: to, o co ktoś już zapytał, otwiera się od razu dla następnej osoby — dzięki temu strona pozostaje darmowa.',
    ],
    how: 'Jak to działa', source: 'Kod źródłowy na GitHubie',
    languagesH: '60 języków',
    languagesP: 'Ucz się dowolnego z nich z dowolnego innego:',
    faqH: 'Pytania',
    faq: [
      ['Czy Ordkort jest naprawdę darmowy?', 'Tak. Nie ma reklam, subskrypcji ani płatnej wersji. Funkcje AI mają dzienny limit na osobę, który w zupełności wystarcza do codziennej nauki.'],
      ['Czy potrzebuję konta?', 'Nie. Otwórz stronę i zacznij. Fiszki zostają w przeglądarce; żeby używać ich na kilku urządzeniach, połącz je jednorazowym kodem albo kodem QR — bez e-maila i bez hasła.'],
      ['Jakich języków mogę się uczyć?', 'Sześćdziesięciu, z każdego na każdy: norweskiego, angielskiego, niemieckiego, hiszpańskiego, francuskiego, chińskiego, arabskiego, ukraińskiego i wielu innych. Interfejs jest po angielsku, rosyjsku, ukraińsku, norwesku, arabsku i chińsku; pozostałe języki interfejsu są tłumaczone automatycznie.'],
      ['Czym różni się od Anki albo Quizleta?', 'Ordkort ma gotowe listy słówek do każdego tematu i poziomu, a do tego wbudowany słownik, podręcznik gramatyki, tłumacza i tryb czytania. Używa tego samego algorytmu FSRS co Anki, a talie przechodzą w obie strony: zaimportuj .apkg z obrazkami i postępami, wyeksportuj talie jako .apkg, który otworzy Anki.'],
      ['Czy działa offline?', 'Tak. Po pierwszym otwarciu strona zachowuje kopię, więc fiszki otwierają się bez internetu. Słownik, gramatyka, tłumacz i czytanie potrzebują połączenia, poza hasłami, które już otwierałeś.'],
      ['Skąd pochodzą słowa i wyjaśnienia?', 'Pisze je AI, a potem są sprawdzane: norweskie w oficjalnych słownikach Rady Języka Norweskiego i Uniwersytetu w Bergen, pozostałe języki w Wiktionary. Każde hasło można zgłosić jako błąd bezpośrednio na stronie.'],
      ['Czy moja własna AI może robić dla mnie talie?', 'Tak. Ordkort jest serwerem MCP: podłącz Claude, ChatGPT albo innego asystenta do ordkort.com/mcp (w ustawieniach aplikacji jest opis). Poproś o talię na dowolny temat, z obrazkami, albo o nowy wygląd strony; odpowie linkiem, który doda ją, gdy się zgodzisz. Nigdy nie widzi twoich fiszek.'],
    ],
    endH: 'Zacznij od pierwszych słów',
    endP: 'Wybierz język, który znasz, i ten, którego chcesz się uczyć — pierwsze fiszki są gotowe w minutę.',
    langNav: 'Język tej strony',
  },
};
export const CODES = Object.keys(PAGES);
export const url = (code) => `${SITE}/${code}/`;

/* ---------- page ---------- */

const SAMPLE_LANG = { 'der Hund': 'de', 'la casa': 'es', 'et eple': 'nb', 'an apple': 'en' }; // the sample cards
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOGO = '<svg class="logo" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">'
  + '<rect x="9" y="5" width="24" height="30" rx="5" transform="rotate(12 21 20)" fill="var(--blue)"/>'
  + '<rect x="7" y="6" width="24" height="30" rx="5" transform="rotate(-6 19 21)" fill="var(--card)" stroke="var(--ink)" stroke-width="2.4"/>'
  + '<path d="M11.2 14.2 26.6 12.6" stroke="var(--red)" stroke-width="2.4" stroke-linecap="round"/>'
  + '<path d="M12 20.6l12.8-1.35M12.6 26.2l9-.95" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" opacity=".28"/></svg>';

/* The same card index as the app (css/style.css): warm paper, cards with a red rule and blue lines,
   buttons with an edge, Geologica for the interface, Literata for headings and the words being learnt. No scripts. */
const STYLE = `
:root{--paper:#f4efe6;--paper-2:#ebe4d6;--card:#fffdf8;--ink:#1d1a16;--ink-2:#5a5347;--ink-3:#6b6357;--line:#e4dccc;--line-2:#d2c7b2;
--blue:#2f4bd9;--blue-ink:#2139b0;--blue-edge:#1d2f96;--red:#d9481f;--yellow-soft:#fbf0ce;--rule:rgba(47,75,217,.1);--red-line:rgba(217,72,31,.5);--noise:.05;
--shadow:0 1px 0 rgba(29,26,22,.04),0 14px 30px -20px rgba(60,40,10,.4);--lift:0 1px 0 var(--line-2),0 28px 50px -30px rgba(40,30,10,.55);
--ui:'Geologica','Readex Pro',system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;--serif:'Literata','Noto Naskh Arabic',Georgia,'Songti SC','SimSun',serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#15130f;--paper-2:#26221b;--card:#1e1b16;--ink:#f2ece1;--ink-2:#bdb4a4;--ink-3:#8a8272;--line:#322d24;--line-2:#463f33;
--blue:#4c63ee;--blue-ink:#a9b6ff;--blue-edge:#2e40b8;--red:#e0592f;--yellow-soft:#3a3120;--rule:rgba(140,160,255,.07);--red-line:rgba(255,122,80,.42);--noise:.035;
--shadow:0 1px 0 rgba(0,0,0,.3),0 14px 30px -18px rgba(0,0,0,.7);--lift:0 1px 0 var(--line-2),0 28px 50px -24px rgba(0,0,0,.8);color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 var(--ui);-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:var(--noise);background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5 0 0 0 0 .4 0 0 0 0 .25 0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
a{color:var(--blue-ink)}
:focus-visible{outline:2.5px solid var(--blue);outline-offset:2px;border-radius:8px}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:20px 0}
.brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font:700 23px var(--serif);margin-inline-end:auto}
.langs{display:flex;flex-wrap:wrap;gap:2px;margin:0;padding:4px;list-style:none;border-radius:999px;background:var(--paper-2);border:1px solid var(--line)}
.langs a{display:block;padding:6px 13px;border-radius:999px;color:var(--ink-2);font:550 14px/1.2 var(--ui);text-decoration:none;transition:color .15s,background .15s}
.langs a:hover{color:var(--ink)}
.langs a[aria-current]{background:var(--card);color:var(--ink);box-shadow:0 1px 0 var(--line-2),0 3px 10px -5px rgba(0,0,0,.18)}
h1{font:700 clamp(34px,5.2vw,56px)/1.08 var(--serif);margin:0 0 18px;letter-spacing:-.01em}
h2{font:700 clamp(26px,3.4vw,34px)/1.2 var(--serif);margin:0 0 20px}
h3{font-size:18px;margin:0}
.hero{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:center;padding:48px 0 80px}
.lede{font-size:clamp(17px,1.8vw,19px);color:var(--ink-2);margin:0 0 30px;max-width:34em}
.ctas{display:flex;flex-wrap:wrap;gap:12px}
.btn{--bg:var(--card);--fg:var(--ink);--edge:var(--line-2);display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:14px;border:0;background:var(--bg);color:var(--fg);
font:700 18px/1.2 var(--ui);text-decoration:none;white-space:nowrap;box-shadow:0 4px 0 var(--edge);transition:transform .08s ease,box-shadow .08s ease,filter .15s,background .15s}
.btn:hover{filter:brightness(1.04)}
.btn:active{transform:translateY(2px);box-shadow:0 2px 0 var(--edge)}
.btn-primary{--bg:var(--blue);--fg:#fff;--edge:var(--blue-edge)}
.btn-ghost{--bg:transparent;box-shadow:inset 0 0 0 1.5px var(--edge),0 4px 0 var(--edge)}
.btn-ghost:active{box-shadow:inset 0 0 0 1.5px var(--edge),0 2px 0 var(--edge)}
.btn-ghost:hover{--bg:var(--card)}
.note{margin:18px 0 0;color:var(--ink-3);font-size:14.5px}
/* a study session in miniature: the top card turns over, goes away, the next one comes up (paused under the pointer) */
.demo{position:relative;height:280px;max-width:420px;width:100%;justify-self:center;perspective:1600px;--out:115%}
[dir=rtl] .demo{--out:-115%}
.fc{position:absolute;inset:0;animation:fc 15s infinite;animation-delay:var(--d)}
.fc-in{position:relative;height:100%;transform-style:preserve-3d;animation:flip 15s infinite;animation-delay:var(--d)}
.demo:hover .fc,.demo:hover .fc-in{animation-play-state:paused}
.face{position:absolute;inset:0;display:flex;flex-direction:column;padding:16px 22px 14px;border-radius:22px;border:1.5px solid var(--line-2);
backface-visibility:hidden;-webkit-backface-visibility:hidden;background-color:var(--card);
background-image:linear-gradient(var(--red-line),var(--red-line)),repeating-linear-gradient(to bottom,transparent 0,transparent 33px,var(--rule) 33px,var(--rule) 34px);
background-size:100% 2px,100% calc(100% - 62px);background-position:0 56px,0 60px;background-repeat:no-repeat;box-shadow:var(--lift)}
.face.back{transform:rotateY(180deg)}
.tag{height:34px;display:flex;align-items:center;font-size:12.5px;color:var(--ink-2)}
.face-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center}
.face b{font:620 clamp(34px,4.4vw,46px)/1.1 var(--serif);letter-spacing:-.02em}
.face small{font:italic 400 16px/1.3 var(--serif);color:var(--ink-3)}
@keyframes fc{
0%,28%{transform:none;opacity:1;z-index:4}
33%{transform:translateX(var(--out)) rotate(14deg);opacity:0;z-index:4}
33.4%{transform:translate(-8px,14px) rotate(-2.8deg);opacity:0;z-index:1}
38%,64%{transform:translate(-8px,14px) rotate(-2.8deg);opacity:.7;z-index:1}
67%,97%{transform:translate(8px,10px) rotate(2.4deg);opacity:.92;z-index:2}
100%{transform:none;opacity:1;z-index:3}}
@keyframes flip{0%,10%{transform:none}14%,33.3%{transform:rotateY(180deg)}33.4%,100%{transform:none}}
.fc:first-child{z-index:3}
.fc:nth-child(2){transform:translate(8px,10px) rotate(2.4deg);opacity:.92;z-index:2}
.fc:nth-child(3){transform:translate(-8px,14px) rotate(-2.8deg);opacity:.7;z-index:1}
section{padding:60px 0;border-top:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
@media (max-width:980px){.grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.grid{grid-template-columns:1fr}}
.feat{background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:16px 20px 20px;box-shadow:var(--shadow)}
.feat h3{padding-bottom:10px;margin-bottom:12px;background:linear-gradient(var(--red-line),var(--red-line)) 0 100%/100% 2px no-repeat}
.feat p{margin:0;color:var(--ink-2);font-size:15.5px;line-height:1.55}
.honest{background:var(--yellow-soft);border-radius:22px;padding:30px;border:0}
.honest p{max-width:48em}
.links{display:flex;gap:18px;flex-wrap:wrap;font-weight:600}
.lang-list{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.lang-list li{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:15px}
details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:10px}
summary{cursor:pointer;font-weight:600}
details p{margin:10px 0 2px;color:var(--ink-2)}
.end{text-align:center}
.end p{color:var(--ink-2);margin:0 auto 24px;max-width:34em}
footer{border-top:1px solid var(--line);padding:26px 0 40px;color:var(--ink-3);font-size:14px;display:flex;gap:18px;flex-wrap:wrap}
footer a{color:var(--ink-2)}
@media (max-width:820px){.hero{grid-template-columns:1fr;gap:44px;padding:24px 0 64px}.demo{height:240px}}
@media (prefers-reduced-motion:reduce){.fc,.fc-in{animation:none}}
:lang(ar){line-height:1.8}:lang(ar) h1,:lang(ar) h2{font-family:'Noto Naskh Arabic',var(--serif)}
`;

function jsonLd(code, p) {
  const graph = [
    {
      '@type': 'WebApplication', '@id': `${SITE}/#app`, name: 'Ordkort', url: `${SITE}/`,
      description: p.desc, applicationCategory: 'EducationalApplication', operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript', isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      inLanguage: CODES.map((c) => PAGES[c].hreflang), license: 'https://www.gnu.org/licenses/agpl-3.0.html',
      sameAs: [REPO], featureList: p.features.map(([h]) => h),
      provider: { '@type': 'Organization', name: 'Ordkort', url: `${SITE}/`, email: MAIL },
    },
    { '@type': 'WebPage', '@id': url(code), url: url(code), name: p.title, description: p.desc, inLanguage: p.hreflang, about: { '@id': `${SITE}/#app` } },
    {
      '@type': 'FAQPage', '@id': `${url(code)}#faq`, inLanguage: p.hreflang,
      mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 1).replace(/</g, '\\u003c');
}

export function render(code) {
  const p = PAGES[code];
  const alternates = CODES.map((c) => `  <link rel="alternate" hreflang="${PAGES[c].hreflang}" href="${url(c)}">`).join('\n');
  const langNav = CODES.map((c) => `<li><a href="/${c}/" hreflang="${PAGES[c].hreflang}" lang="${PAGES[c].htmlLang}"${c === code ? ' aria-current="page"' : ''}>${esc(PAGES[c].name)}</a></li>`).join('');
  const ogAlt = CODES.filter((c) => c !== code).map((c) => `  <meta property="og:locale:alternate" content="${PAGES[c].locale}">`).join('\n');
  return `<!doctype html>
<html lang="${p.htmlLang}" dir="${p.rtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}">
  <link rel="canonical" href="${url(code)}">
${alternates}
  <link rel="alternate" hreflang="x-default" href="${url('en')}">
  <meta name="theme-color" content="#f4efe6">
  <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Ordkort">
  <meta property="og:url" content="${url(code)}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.desc)}">
  <meta property="og:image" content="${SITE}/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="${p.locale}">
${ogAlt}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/css/fonts.css">
  <style>${STYLE.trim()}</style>
  <script type="application/ld+json">${jsonLd(code, p)}</script>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="/${code}/">${LOGO}<span>ordkort</span></a>
      <nav aria-label="${esc(p.langNav)}"><ul class="langs">${langNav}</ul></nav>
    </header>
    <main>
      <div class="hero">
        <div>
          <h1>${esc(p.h1)}</h1>
          <p class="lede">${esc(p.lede)}</p>
          <div class="ctas">
            <a class="btn btn-primary" href="/#/">${esc(p.cta)}</a>
            <a class="btn btn-ghost" href="/#/about">${esc(p.how)}</a>
          </div>
          <p class="note">${esc(p.note)}</p>
        </div>
        <div class="demo" aria-hidden="true">${p.sample.map(([l, w, tr], i) => `<div class="fc" style="--d:${[0, -10, -5][i]}s"><div class="fc-in">`
          + `<div class="face"><div class="tag">${esc(l)}</div><div class="face-body"><b lang="${SAMPLE_LANG[w]}">${esc(w)}</b></div></div>`
          + `<div class="face back"><div class="tag">${esc(l)}</div><div class="face-body"><b>${esc(tr)}</b><small lang="${SAMPLE_LANG[w]}">${esc(w)}</small></div></div>`
          + '</div></div>').join('')}</div>
      </div>
      <section>
        <h2>${esc(p.featuresH)}</h2>
        <div class="grid">${p.features.map(([h, t]) => `
          <div class="feat"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join('')}
        </div>
      </section>
      <section class="honest">
        <h2>${esc(p.honestH)}</h2>
        ${p.honest.map((t) => `<p>${esc(t)}</p>`).join('\n        ')}
        <p class="links"><a href="/#/about">${esc(p.how)}</a><a href="${REPO}" rel="noopener">${esc(p.source)}</a></p>
      </section>
${SEO[code] ? `      <section>
        <h2>${esc(SEO[code].hubsH)}</h2>
        <p>${esc(SEO[code].hubsP)}</p>
        <p class="links"><a href="/${code}/${SEO[code].learn}/">${esc(SEO[code].alsoTopics)}</a>${SEO[code].noDict ? '' : `<a href="/${code}/ordbok/${LEARN}/">${esc(SEO[code].alsoDict)}</a>`}${TEACH[code] ? `<a href="${TEACH[code].path}">${esc(TEACH[code].nav)}</a>` : ''}</p>
      </section>
` : ''}      <section>
        <h2>${esc(p.languagesH)}</h2>
        <p>${esc(p.languagesP)}</p>
        <ul class="lang-list">${LANGS.map((l) => `<li lang="${l.code}">${esc(l.name)}</li>`).join('')}</ul>
      </section>
      <section id="faq">
        <h2>${esc(p.faqH)}</h2>
        ${p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n        ')}
      </section>
      <section class="end">
        <h2>${esc(p.endH)}</h2>
        <p>${esc(p.endP)}</p>
        <a class="btn btn-primary" href="/#/">${esc(p.cta)}</a>
      </section>
    </main>
    <footer>
      <span>Ordkort</span>
      <a href="/#/about">${esc(p.how)}</a>
      <a href="${REPO}" rel="noopener">GitHub</a>
      <a href="mailto:${MAIL}">${MAIL}</a>
      <a href="https://www.gnu.org/licenses/agpl-3.0.html" rel="noopener">AGPL-3.0</a>
    </footer>
  </div>
</body>
</html>
`;
}
