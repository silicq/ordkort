// The page for teachers of Norwegian (courses for adults, introduction programmes, volunteer groups):
// how to give a class a topic with one link, how to share an own word list, what Ordkort keeps private
// and what it does not do. scripts/seo-pages.mjs builds it with the Norwegian word pages; the button labels
// quoted here are the app's own (public/js/i18n/*.js), so the steps match what a teacher sees.
// `from`: whether the topic links also choose the learners' language (a page for teachers whose learners
// share one), or leave it to each learner (a class with many languages).

export const TEACH = {
  nb: {
    path: '/nb/laerer/', nav: 'For lærere', from: false,
    title: 'Ordkort for lærere: gratis gloser til norskopplæringen',
    desc: 'Gratis ordkort med repetisjon for deltakere i norskopplæringen: 29 temaer på nivå A1–C1, forklaringer på deres eget språk, ingen konto og ingen sporing.',
    h1: 'Ordkort i norskopplæringen',
    lede: [
      'Ordkort er et gratis nettsted der deltakerne lærer norske ord med kort og repetisjon med mellomrom. Ordene kommer i ferdige lister etter tema og nivå, og oversettelser og forklaringer står på deltakerens eget språk.',
      'Her ser du hvordan du kan bruke det i en klasse der deltakerne snakker mange forskjellige språk.',
    ],
    cta: 'Åpne Ordkort',
    getH: 'Hva deltakerne får',
    get: [
      '29 temaer, fra hilsener og tall til helse, arbeid, bolig og offentlige tjenester, på nivå A1–C1.',
      'Oversettelser og forklaringer på 60 språk, blant annet ukrainsk, arabisk, tigrinja, somali, dari, polsk og engelsk.',
      'Substantiv og verb kontrollert mot Bokmålsordboka, så kjønn og bøyning stemmer.',
      'Repetisjon med mellomrom (FSRS): hvert ord kommer tilbake rett før det ville blitt glemt. Ordene kan også øves med flervalg, skriving, lytting og utfylling av eksempler.',
      'Det virker på mobilen, også uten nett, og kan legges på hjemskjermen som en app.',
    ],
    topicH: 'Ett tema til hele klassen',
    topicP: 'Lenkene under åpner Ordkort med norsk og temaet allerede valgt. Hver deltaker velger selv hvilket språk oversettelsene skal stå på, så samme lenke passer for hele klassen. Del den i læringsplattformen eller i gruppechatten.',
    topicNote: 'Lenken velger temaet for den som åpner Ordkort for første gang. Den som allerede bruker Ordkort, finner temaet under «Nytt tema» på forsiden.',
    ownH: 'En egen ordliste for uka',
    own: [
      'Velg «Tom kortstokk for egne ord» og gi den et navn, for eksempel «Uke 12».',
      'Trykk «Legg til ord». Skriv det norske ordet og velg «Fyll ut med KI», eller skriv oversettelse og eksempel selv.',
      'Velg «Del med lenke». Du får en lenke og en QR-kode, og den som åpner dem, kan legge en kopi av ordlisten til sine egne kort.',
    ],
    ownNote: 'Oversettelsene i en delt ordliste står på språket du skrev dem på, for eksempel engelsk. I en klasse med mange språk passer derfor de ferdige temaene best, mens en egen liste passer når deltakerne har et felles språk.',
    printH: 'Plakat og lapper til klasserommet',
    printP: 'En plakat i A4 og to lapper i A5 med en QR-kode som åpner Ordkort med norsk allerede valgt. Skriv ut og heng opp plakaten, eller del ut lappene.',
    printLink: 'Last ned PDF (A4, 2 sider)',
    privacyH: 'Personvern',
    privacy: [
      'Deltakerne trenger ingen konto, e-postadresse eller passord. Kortene og fremgangen lagres i nettleseren på deres egen enhet, og det er verken reklame eller sporing.',
      'Serveren får bare det som skal slås opp eller lages – et ord, et tema eller en tekst – sammen med språkparet. For å begrense bruken teller den forespørsler under en hash av IP-adressen som skiftes hver dag; selve adressen lagres ikke. Ordkort har åpen kildekode, så alt dette kan etterprøves.',
    ],
    mailP: 'Spørsmål, ønsker til klassen eller noe som ikke fungerer? Skriv til hei@ordkort.com – det er en person som svarer.',
    limitsH: 'Det Ordkort ikke gjør',
    limits: [
      'Det finnes ingen lærerkonto og ingen oversikt over deltakernes fremgang, for Ordkort vet ikke hvem som bruker det. Hver deltaker ser sin egen statistikk, sitt dagsmål og hvor mange dager på rad de har øvd.',
      'Ordlistene skrives av kunstig intelligens. Norske substantiv og verb kontrolleres mot ordbøkene, men en oversettelse eller et eksempel kan likevel bli feil. Alle oppføringer har knappen «Meld fra om feil», og etter uavhengige meldinger lages oppføringen på nytt for alle.',
    ],
  },

  en: {
    path: '/en/teachers/', nav: 'For teachers', from: false,
    title: 'Ordkort for teachers: free Norwegian vocabulary for class',
    desc: 'Free flashcards with spaced repetition for learners of Norwegian: 29 topics at A1–C1, translations in each learner’s own language, no accounts and no tracking.',
    h1: 'Ordkort in a Norwegian class',
    lede: [
      'Ordkort is a free website where learners study Norwegian words with flashcards and spaced repetition. The words come in ready lists by topic and level, with translations and explanations in each learner’s own language.',
      'This page shows how to use it with a class whose learners speak many different languages, as in most courses for adults in Norway.',
    ],
    cta: 'Open Ordkort',
    getH: 'What learners get',
    get: [
      '29 topics, from greetings and numbers to health, work, housing and public services, at levels A1–C1.',
      'Translations and explanations in 60 languages, among them Ukrainian, Arabic, Tigrinya, Somali, Dari, Polish and English.',
      'Nouns and verbs checked against Bokmålsordboka, the official dictionary, so genders and inflections are right.',
      'Spaced repetition (FSRS): each word comes back just before it would be forgotten. Words can also be practised by multiple choice, typing, listening and filling the gap in an example.',
      'It works on phones, offline too, and installs on the home screen like an app.',
    ],
    topicH: 'One topic for the whole class',
    topicP: 'The links below open Ordkort with Norwegian and the topic already chosen. Each learner picks the language of the translations, so the same link fits the whole class. Share it in your learning platform or the group chat.',
    topicNote: 'A link chooses the topic for someone who opens Ordkort for the first time. Someone who already uses Ordkort finds the topic under “New topic” on the first screen.',
    ownH: 'Your own word list for the week',
    own: [
      'Choose “Empty deck for my own words” and give it a name, for example “Week 12”.',
      'Tap “Add word”. Type the Norwegian word and choose “Fill in with AI”, or write the translation and an example yourself.',
      'Choose “Share by link”. You get a link and a QR code, and whoever opens them can add a copy of the list to their own cards.',
    ],
    ownNote: 'The translations in a shared list are in the language you wrote them in. In a class with many languages the ready topics work best; an own list fits a class that shares a language.',
    printH: 'A poster and handouts for the classroom',
    printP: 'An A4 poster and two A5 handouts in Norwegian, with a QR code that opens Ordkort with Norwegian already chosen. Print the poster and put it up, or hand out the slips.',
    printLink: 'Download the PDF (A4, 2 pages)',
    privacyH: 'Privacy',
    privacy: [
      'Learners need no account, e-mail address or password. Their cards and progress are stored in the browser on their own device, with no ads and no tracking.',
      'The server receives only what is looked up or made – a word, a topic or a text – with the language pair. To keep usage within limits it counts requests under a hash of the IP address whose salt changes every day; the address itself is not stored. Ordkort is open source, so all of this can be checked.',
    ],
    mailP: 'Questions, a wish for your class, or something that does not work? Write to hei@ordkort.com – a person answers.',
    limitsH: 'What Ordkort does not do',
    limits: [
      'There is no teacher account and no overview of learners’ progress, because Ordkort does not know who uses it. Each learner sees their own statistics, daily goal and streak.',
      'The word lists are written by AI. Norwegian nouns and verbs are checked against the dictionaries, but a translation or an example can still be wrong. Every entry has a “Report a mistake” button, and after independent reports the entry is written again for everyone.',
    ],
  },

  uk: {
    path: '/uk/vykladacham/', nav: 'Для викладачів', from: true,
    title: 'Ordkort для викладачів норвезької: безкоштовні картки',
    desc: 'Безкоштовні картки з інтервальним повторенням для тих, хто вчить норвезьку: 29 тем рівнів A1–C1, переклади українською, без реєстрації та без стеження.',
    h1: 'Ordkort на заняттях норвезької',
    lede: [
      'Ordkort — безкоштовний сайт, де норвезькі слова вчать за картками з інтервальним повторенням. Слова зібрані в готові списки за темами й рівнями, а переклади та пояснення — українською.',
      'Ця сторінка для тих, хто викладає норвезьку українцям: на курсах, у волонтерських групах чи на розмовних клубах.',
    ],
    cta: 'Відкрити Ordkort',
    getH: 'Що отримують учні',
    get: [
      '29 тем: від привітань і чисел до здоров’я, роботи, житла та державних послуг, рівні A1–C1.',
      'Іменники й дієслова звірені з Bokmålsordboka, офіційним словником, тож рід і форми слів правильні.',
      'Інтервальне повторення (FSRS): кожне слово повертається саме тоді, коли його от-от забули б. Слова можна тренувати також вибором відповіді, письмом, на слух і заповненням пропуску в прикладі.',
      'Працює на телефоні, зокрема без інтернету, і встановлюється на головний екран як застосунок.',
      'Інтерфейс перекладено вручну українською.',
    ],
    topicH: 'Одна тема для всієї групи',
    topicP: 'Посилання нижче відкривають Ordkort з уже вибраними мовами (норвезька з перекладом українською) і темою. Поділіться посиланням у чаті групи.',
    topicNote: 'Посилання вибирає тему для того, хто відкриває Ordkort уперше. Хто вже користується Ordkort, знайде тему в розділі «Нова тема» на головному екрані.',
    ownH: 'Власний список слів на тиждень',
    own: [
      'Виберіть «Порожня колода для власних слів» і дайте їй назву, наприклад «Тиждень 12».',
      'Натисніть «Додати слово». Введіть норвезьке слово й виберіть «Заповнити з ШІ» або напишіть переклад і приклад самі.',
      'Виберіть «Поділитися посиланням». Ви отримаєте посилання й QR-код, і кожен, хто їх відкриє, зможе додати копію списку до своїх карток.',
    ],
    ownNote: 'Переклади в спільному списку будуть тією мовою, якою ви їх написали, тож для україномовної групи пишіть українською.',
    printH: 'Плакат і листівки для класу',
    printP: 'Плакат A4 і дві листівки A5 норвезькою з QR-кодом, який відкриває Ordkort із уже вибраною норвезькою. Роздрукуйте й повісьте плакат або роздайте листівки.',
    printLink: 'Завантажити PDF (A4, 2 сторінки)',
    privacyH: 'Приватність',
    privacy: [
      'Учням не потрібні акаунт, електронна пошта чи пароль. Картки й прогрес зберігаються в браузері на їхньому пристрої, без реклами й без стеження.',
      'Сервер отримує тільки те, що треба знайти чи створити — слово, тему або текст — разом із парою мов. Щоб обмежувати навантаження, він рахує запити під хешем IP-адреси, сіль якого щодня змінюється; саму адресу не зберігає. Код Ordkort відкритий, тож усе це можна перевірити.',
    ],
    mailP: 'Питання, побажання для вашої групи або щось не працює? Напишіть на hei@ordkort.com — відповідає людина.',
    limitsH: 'Чого Ordkort не робить',
    limits: [
      'Немає акаунта викладача й немає огляду прогресу учнів, бо Ordkort не знає, хто ним користується. Кожен бачить свою статистику, денну мету й кількість днів поспіль.',
      'Списки слів пише штучний інтелект. Норвезькі іменники й дієслова звіряються зі словниками, але переклад чи приклад усе одно може бути хибним. У кожного запису є кнопка «Повідомити про помилку», а після незалежних повідомлень запис створюється заново для всіх.',
    ],
  },

  ru: {
    path: '/ru/prepodavatelyam/', nav: 'Преподавателям', from: true,
    title: 'Ordkort для преподавателей норвежского: карточки',
    desc: 'Бесплатные карточки с интервальным повторением для изучающих норвежский: 29 тем уровней A1–C1, переводы на русский, без регистрации и без слежки.',
    h1: 'Ordkort на уроках норвежского',
    lede: [
      'Ordkort — бесплатный сайт, где норвежские слова учат по карточкам с интервальным повторением. Слова собраны в готовые списки по темам и уровням, а переводы и объяснения — на русском.',
      'Эта страница для тех, кто преподаёт норвежский русскоязычным ученикам: на курсах, в группах при общинах или в разговорных клубах.',
    ],
    cta: 'Открыть Ordkort',
    getH: 'Что получают ученики',
    get: [
      '29 тем: от приветствий и чисел до здоровья, работы, жилья и госуслуг, уровни A1–C1.',
      'Существительные и глаголы сверены с Bokmålsordboka, официальным словарём, так что род и формы слов правильные.',
      'Интервальное повторение (FSRS): каждое слово возвращается как раз тогда, когда его вот-вот забыли бы. Слова можно тренировать ещё выбором ответа, вводом, на слух и заполнением пропуска в примере.',
      'Работает на телефоне, в том числе без интернета, и ставится на главный экран как приложение.',
      'Интерфейс переведён на русский вручную.',
    ],
    topicH: 'Одна тема для всей группы',
    topicP: 'Ссылки ниже открывают Ordkort с уже выбранными языками (норвежский с переводом на русский) и темой. Отправьте ссылку в чат группы.',
    topicNote: 'Ссылка выбирает тему для того, кто открывает Ordkort впервые. Кто уже пользуется Ordkort, найдёт тему в разделе «Новая тема» на главном экране.',
    ownH: 'Свой список слов на неделю',
    own: [
      'Выберите «Пустая колода для своих слов» и назовите её, например «Неделя 12».',
      'Нажмите «Добавить слово». Введите норвежское слово и выберите «Заполнить с ИИ» или напишите перевод и пример сами.',
      'Выберите «Поделиться ссылкой». Вы получите ссылку и QR-код, и любой, кто их откроет, сможет добавить копию списка к своим карточкам.',
    ],
    ownNote: 'Переводы в общем списке будут на том языке, на котором вы их написали, поэтому для русскоязычной группы пишите по-русски.',
    printH: 'Плакат и листовки для класса',
    printP: 'Плакат A4 и две листовки A5 на норвежском с QR-кодом, который открывает Ordkort с уже выбранным норвежским. Распечатайте и повесьте плакат или раздайте листовки.',
    printLink: 'Скачать PDF (A4, 2 страницы)',
    privacyH: 'Приватность',
    privacy: [
      'Ученикам не нужны аккаунт, почта или пароль. Карточки и прогресс хранятся в браузере на их устройстве, без рекламы и без слежки.',
      'Сервер получает только то, что нужно найти или создать — слово, тему или текст — вместе с парой языков. Чтобы ограничивать нагрузку, он считает запросы под хешем IP-адреса, соль которого меняется каждый день; сам адрес не хранится. Код Ordkort открыт, так что всё это можно проверить.',
    ],
    mailP: 'Вопросы, пожелания для вашей группы или что-то не работает? Напишите на hei@ordkort.com — отвечает человек.',
    limitsH: 'Чего Ordkort не делает',
    limits: [
      'Нет аккаунта преподавателя и нет обзора прогресса учеников, потому что Ordkort не знает, кто им пользуется. Каждый видит свою статистику, дневную цель и сколько дней подряд занимается.',
      'Списки слов пишет искусственный интеллект. Норвежские существительные и глаголы сверяются со словарями, но перевод или пример всё равно может оказаться неверным. У каждой записи есть кнопка «Сообщить об ошибке», и после независимых сообщений запись создаётся заново для всех.',
    ],
  },
};
