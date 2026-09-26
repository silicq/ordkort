// Static pages about Ordkort for search engines and for people who have not opened it yet:
// public/<lang>/index.html in the six interface languages, plus public/sitemap.xml.
// The app itself lives at "/" and needs JavaScript; these pages are plain HTML that anyone — and any
// crawler — can read. Run `npm run landing` after changing the texts below and commit the result
// (a test checks that the files are up to date).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../public/js/langs.js';

const SITE = 'https://ordkort.com';
const REPO = 'https://github.com/silicq/ordkort';
const LANGS = globalThis.App.langs.list;

/* ---------- texts ---------- */

const PAGES = {
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
      ['Ready word lists', '29 topics from greetings to documents and public services, for levels A1–C1. The AI picks frequent, useful words; one tap adds twenty more. Or add your own words and import from Anki or CSV.'],
      ['Words checked against dictionaries', 'Nouns and verbs are checked against real dictionaries: the official Norwegian dictionaries (ordbokene.no), and Wiktionary for other languages — the article, the gender and the forms.'],
      ['A learner’s dictionary', 'Translation, inflection tables, meanings with examples, fixed expressions and compounds. For Norwegian, the official Bokmål and Nynorsk entries are shown alongside.'],
      ['Grammar book', '15 chapters — nouns, adjectives, verbs, word order and more — with tables, examples, typical mistakes and exercises. Ask any grammar question in your own words.'],
      ['A translator that explains', 'Every word of the translation is coloured by part of speech, with its form and the rule that explains why it is used exactly there.'],
      ['Reading', 'Paste an article, a message or song lyrics and tap any word to see what it means in this sentence — and add it to your cards.'],
      ['Progress on every device', 'Statistics, a daily goal and a streak. Sync your devices without an account, end-to-end encrypted. Works offline and installs like an app.'],
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
      ['How is it different from Anki or Quizlet?', 'Ordkort comes with ready word lists for each topic and level, and with a dictionary, a grammar book, a translator and a reading mode built in. You can still add your own words and import an Anki export (plain text) or a CSV file.'],
      ['Does it work offline?', 'Yes. Once opened, the site keeps a copy, so your cards open without internet. The dictionary, grammar, translator and reading need a connection, except for entries you have already opened.'],
      ['Where do the words and explanations come from?', 'They are written by AI and checked: Norwegian against the official dictionaries of the Language Council of Norway and the University of Bergen, other languages against Wiktionary. Any entry can be reported as a mistake right on the site.'],
    ],
    endH: 'Start with your first words',
    endP: 'Choose the language you know and the one you want to learn — the first cards are ready in a minute.',
    langNav: 'Language of this page',
  },

  ru: {
    hreflang: 'ru', htmlLang: 'ru', locale: 'ru_RU', name: 'Русский',
    title: 'Ordkort — изучение языков по карточкам: бесплатно, без рекламы и регистрации',
    desc: 'Бесплатные карточки с интервальным повторением для 60 языков: готовые слова по темам, словарь, грамматика и переводчик, который объясняет каждое слово. Без рекламы и регистрации.',
    h1: 'Учите любой язык по карточкам',
    lede: 'Ordkort подбирает слова по теме и уровню, напоминает каждое слово как раз перед тем, как вы его забудете, и объясняет грамматику. Бесплатно, без рекламы и без аккаунта.',
    cta: 'Начать учить',
    note: 'Бесплатно · Без регистрации · Без рекламы · Работает офлайн',
    sample: [['немецкий', 'der Hund', 'собака'], ['испанский', 'la casa', 'дом'], ['норвежский', 'et eple', 'яблоко']],
    featuresH: 'Всё для изучения слов в одном месте',
    features: [
      ['Интервальные повторения', 'Карточки возвращаются ровно тогда, когда слово начинает забываться (алгоритм FSRS, как в Anki). Шесть режимов: карточки, выбор ответа, ввод слова, на слух, пропуск в примере или всё вперемешку.'],
      ['Готовые наборы слов', '29 тем — от приветствий до документов и госуслуг, уровни A1–C1. ИИ подбирает частые и полезные слова, одно нажатие добавляет ещё двадцать. Или добавляйте свои слова и импортируйте из Anki и CSV.'],
      ['Слова сверяются со словарями', 'Существительные и глаголы проверяются по настоящим словарям: официальным норвежским (ordbokene.no), а для других языков — по Викисловарю. Проверяются артикль, род и формы.'],
      ['Словарь для изучающих', 'Перевод, таблицы словоизменения, значения с примерами, устойчивые выражения и сложные слова. Для норвежского рядом показываются официальные статьи букмола и нюношка.'],
      ['Грамматика', '15 глав — существительные, прилагательные, глаголы, порядок слов и другое — с таблицами, примерами, типичными ошибками и упражнениями. Можно задать любой вопрос своими словами.'],
      ['Переводчик с объяснениями', 'Каждое слово перевода подсвечено по части речи, с его формой и правилом, по которому оно стоит именно здесь.'],
      ['Чтение', 'Вставьте статью, сообщение или текст песни и нажмите на любое слово — увидите его значение в этом предложении и сможете добавить в карточки.'],
      ['Прогресс на всех устройствах', 'Статистика, цель на день и серия дней. Синхронизация устройств без аккаунта, со сквозным шифрованием. Работает без интернета и устанавливается как приложение.'],
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
      ['Чем это отличается от Anki или Quizlet?', 'В Ordkort уже есть готовые слова для каждой темы и уровня, а ещё встроены словарь, грамматика, переводчик и режим чтения. Свои слова тоже можно добавлять, а из Anki — импортировать экспорт в виде текста или CSV-файл.'],
      ['Работает ли без интернета?', 'Да. Открытый однажды сайт сохраняет копию, и карточки открываются без сети. Словарю, грамматике, переводчику и чтению нужен интернет — кроме статей, которые вы уже открывали.'],
      ['Откуда берутся слова и объяснения?', 'Их пишет ИИ, а затем они проверяются: норвежский — по официальным словарям Норвежского языкового совета и Бергенского университета, другие языки — по Викисловарю. О любой ошибке можно сообщить прямо на сайте.'],
    ],
    endH: 'Начните с первых слов',
    endP: 'Выберите язык, который знаете, и тот, который хотите выучить, — первые карточки будут готовы через минуту.',
    langNav: 'Язык этой страницы',
  },

  uk: {
    hreflang: 'uk', htmlLang: 'uk', locale: 'uk_UA', name: 'Українська',
    title: 'Ordkort — вивчення мов за картками: безкоштовно, без реклами й реєстрації',
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
      ['Чим це відрізняється від Anki чи Quizlet?', 'В Ordkort уже є готові слова для кожної теми й рівня, а ще вбудовані словник, граматика, перекладач і режим читання. Свої слова теж можна додавати, а з Anki — імпортувати експорт у вигляді тексту або CSV-файл.'],
      ['Чи працює без інтернету?', 'Так. Відкритий одного разу сайт зберігає копію, і картки відкриваються без мережі. Словнику, граматиці, перекладачу й читанню потрібен інтернет — крім статей, які ви вже відкривали.'],
      ['Звідки беруться слова й пояснення?', 'Їх пише ШІ, а потім вони перевіряються: норвезька — за офіційними словниками Норвезької мовної ради та Бергенського університету, інші мови — за Вікісловником. Про будь-яку помилку можна повідомити просто на сайті.'],
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
      ['Hva er forskjellen fra Anki eller Quizlet?', 'Ordkort har ferdige gloser for hvert tema og nivå, og ordbok, grammatikkbok, oversetter og lesemodus er innebygd. Du kan fortsatt legge inn egne ord og importere en Anki-eksport (ren tekst) eller en CSV-fil.'],
      ['Virker det uten internett?', 'Ja. Når siden først er åpnet, har nettleseren en kopi, så kortene åpnes uten nett. Ordboka, grammatikken, oversetteren og lesingen trenger nett – unntatt oppslag du allerede har åpnet.'],
      ['Hvor kommer ordene og forklaringene fra?', 'De skrives av KI og kontrolleres: norsk mot de offisielle ordbøkene fra Språkrådet og Universitetet i Bergen, andre språk mot Wiktionary. Alle oppslag kan meldes som feil rett på siden.'],
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
      ['ما الفرق بينه وبين Anki أو Quizlet؟', 'يأتي Ordkort بكلمات جاهزة لكل موضوع ومستوى، وفيه قاموس وكتاب قواعد ومترجم ووضع للقراءة. ويمكنك مع ذلك إضافة كلماتك واستيراد ملف تصدير من Anki (نص عادي) أو ملف CSV.'],
      ['هل يعمل دون إنترنت؟', 'نعم. بعد أول فتح يحتفظ المتصفح بنسخة من الموقع، فتُفتح بطاقاتك دون اتصال. أما القاموس والقواعد والمترجم والقراءة فتحتاج إلى اتصال، باستثناء المداخل التي فتحتها من قبل.'],
      ['من أين تأتي الكلمات والشروح؟', 'يكتبها الذكاء الاصطناعي ثم تُراجَع: النرويجية مع القواميس الرسمية لمجلس اللغة النرويجية وجامعة بيرغن، واللغات الأخرى مع ويكاموس. ويمكن الإبلاغ عن أي خطأ مباشرة في الموقع.'],
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
      ['和 Anki 或 Quizlet 有什么不同？', 'Ordkort 为每个主题和水平准备了现成的词汇，还内置了词典、语法书、翻译和阅读模式。你仍然可以添加自己的单词，并导入 Anki 导出的纯文本文件或 CSV 文件。'],
      ['可以离线使用吗？', '可以。打开过一次后，浏览器会保存网站副本，没有网络也能打开卡片。词典、语法、翻译和阅读需要联网——已经打开过的词条除外。'],
      ['单词和讲解从哪里来？', '由 AI 编写，再经过核对：挪威语对照挪威语言委员会和卑尔根大学的官方词典，其他语言对照维基词典。任何条目都可以直接在网站上报告错误。'],
    ],
    endH: '从第一批单词开始',
    endP: '选择你会的语言和想学的语言——一分钟内第一批卡片就准备好。',
    langNav: '本页语言',
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

const STYLE = `
:root{--paper:#f4efe6;--paper-2:#ebe4d6;--card:#fffdf8;--ink:#1d1a16;--ink-2:#5a5347;--ink-3:#8f877a;--line:#e4dccc;--blue:#2f4bd9;--blue-edge:#1d2f96;--red:#d9481f;--rule:rgba(47,75,217,.1);--yellow-soft:#fbf0ce;
--ui:'Geologica','Readex Pro',system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;--serif:'Literata','Noto Naskh Arabic',Georgia,'Songti SC','SimSun',serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#15130f;--paper-2:#26221b;--card:#1e1b16;--ink:#f2ece1;--ink-2:#bdb4a4;--ink-3:#8a8272;--line:#322d24;--blue:#4c63ee;--blue-edge:#2e40b8;--red:#e0592f;--rule:rgba(140,160,255,.07);--yellow-soft:#3a3120;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 var(--ui)}
a{color:var(--blue)}
.wrap{max-width:1060px;margin:0 auto;padding:0 20px}
.top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:18px 0}
.brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font:700 23px var(--serif);margin-inline-end:auto}
.langs{display:flex;flex-wrap:wrap;gap:2px;font-size:14px;margin:0;padding:0;list-style:none}
.langs a{display:block;padding:4px 10px;border-radius:999px;color:var(--ink-2);text-decoration:none}
.langs a[aria-current]{background:var(--card);color:var(--ink);box-shadow:0 0 0 1px var(--line)}
.hero{display:grid;grid-template-columns:1.15fr 1fr;gap:48px;align-items:center;padding:36px 0 64px}
h1{font:700 clamp(34px,5.2vw,56px)/1.08 var(--serif);margin:0 0 18px;letter-spacing:-.01em}
h2{font:700 clamp(26px,3.4vw,34px)/1.2 var(--serif);margin:0 0 20px}
h3{font-size:18px;margin:0 0 6px}
.lede{font-size:clamp(17px,2vw,19px);color:var(--ink-2);margin:0 0 28px;max-width:36em}
.btn{display:inline-block;background:var(--blue);color:#fff;font-weight:700;font-size:18px;padding:14px 28px;border-radius:14px;text-decoration:none;box-shadow:0 4px 0 var(--blue-edge)}
.btn:hover{filter:brightness(1.06)}
.btn:active{transform:translateY(2px);box-shadow:0 2px 0 var(--blue-edge)}
.note{margin:18px 0 0;color:var(--ink-3);font-size:14.5px}
.deck{position:relative;height:320px}
.card{position:absolute;width:250px;padding:16px 20px 20px;border-radius:16px;background:var(--card);border:1px solid var(--line);
box-shadow:0 1px 0 rgba(0,0,0,.04),0 22px 44px -24px rgba(40,30,10,.5);background-image:linear-gradient(var(--red),var(--red));background-size:100% 2px;background-position:0 46px;background-repeat:no-repeat}
.card small{display:block;color:var(--ink-3);font-size:13px;height:32px}
.card b{display:block;font:600 30px/1.2 var(--serif);margin-top:14px}
.card span{color:var(--ink-2)}
.card:nth-child(1){inset-inline-start:0;top:10px;transform:rotate(-5deg)}
.card:nth-child(2){inset-inline-start:22%;top:70px;transform:rotate(3deg)}
.card:nth-child(3){inset-inline-start:40%;top:150px;transform:rotate(-2deg)}
section{padding:56px 0;border-top:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:18px}
.feat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px}
.feat p{margin:0;color:var(--ink-2);font-size:15.5px}
.honest{background:var(--yellow-soft);border-radius:20px;padding:28px;border:0}
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
@media (max-width:760px){.hero{grid-template-columns:1fr;gap:28px;padding-top:16px}.deck{height:270px}.card{width:220px}.card:nth-child(2){inset-inline-start:18%}.card:nth-child(3){inset-inline-start:34%;top:130px}}
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
          <a class="btn" href="/#/">${esc(p.cta)}</a>
          <p class="note">${esc(p.note)}</p>
        </div>
        <div class="deck" aria-hidden="true">${p.sample.map(([l, w, tr]) => `<div class="card"><small>${esc(l)}</small><b lang="${SAMPLE_LANG[w]}">${esc(w)}</b><span>${esc(tr)}</span></div>`).join('')}</div>
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
      <section>
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
        <a class="btn" href="/#/">${esc(p.cta)}</a>
      </section>
    </main>
    <footer>
      <span>Ordkort</span>
      <a href="/#/about">${esc(p.how)}</a>
      <a href="${REPO}" rel="noopener">GitHub</a>
      <a href="https://www.gnu.org/licenses/agpl-3.0.html" rel="noopener">AGPL-3.0</a>
    </footer>
  </div>
</body>
</html>
`;
}

export function sitemap() {
  const links = CODES.map((c) => `    <xhtml:link rel="alternate" hreflang="${PAGES[c].hreflang}" href="${url(c)}"/>`).join('\n');
  const pages = CODES.map((c) => `  <url>\n    <loc>${url(c)}</loc>\n${links}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${url('en')}"/>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${SITE}/</loc></url>
${pages}
</urlset>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pub = fileURLToPath(new URL('../public/', import.meta.url));
  for (const code of CODES) {
    mkdirSync(`${pub}${code}`, { recursive: true });
    writeFileSync(`${pub}${code}/index.html`, render(code));
  }
  writeFileSync(`${pub}sitemap.xml`, sitemap());
  console.log(`landing pages: ${CODES.map((c) => `/${c}/`).join(' ')} + sitemap.xml`);
}
