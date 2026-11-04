// The page about who makes Ordkort and where its words come from (scripts/seo-pages.mjs, aboutPage), in each
// language of the static pages: what a reader, a teacher or a search engine checks before trusting a dictionary.
// The app's own "How it works" (/#/about) explains the technical side: storage, sync, limits.

export const ABOUT = {
  en: {
    path: '/en/about/', nav: 'About Ordkort',
    title: 'About Ordkort: who makes it and where the words come from',
    desc: 'Ordkort is a free, open-source site for learning words: who builds it, where its Norwegian words and forms come from, and how mistakes are corrected.',
    h1: 'About Ordkort',
    lede: ['Ordkort is a free, open-source web app for learning vocabulary with flashcards and spaced repetition. It has no ads, no accounts and no tracking: your cards stay in your browser.'],
    sections: [
      ['Who makes it', [
        'Ordkort is built and maintained by an independent developer, with help from the people who report mistakes and translate the interface. The whole code is public on GitHub under the AGPL-3.0 licence, so anyone can see how the site works and what it does with data.',
      ]],
      ['Where the Norwegian words come from', [
        'The list of common words was put together by hand, roughly in the order in which the words occur in everyday Norwegian. The word class, the gender and every inflected form come from Bokmålsordboka, the official Bokmål dictionary of the University of Bergen and the Language Council of Norway (CC BY 4.0); every word page links to its entry there. When Bokmålsordboka has several words spelt alike, the one the page means is chosen by hand.',
        'The translations, example sentences and notes for learners were drafted with the help of AI and then checked. The word lists by topic contain only these checked words.',
      ]],
      ['Decks made in the app', [
        'A deck you ask the app for — any topic, any language — is written by AI on request. Its words are checked against dictionaries where one is available (ordbokene.no for Norwegian; Wiktionary for other languages, and the free dictionaries Wikidata Lexemes, BÍN for Icelandic and SALDO for Swedish where Wiktionary cannot tell), but such a deck can still contain a mistake.',
      ]],
      ['Corrections', [
        'Every word page has a “Report a mistake” link, and every card in the app has a button for it. You can also write to hei@ordkort.com. A correction appears with the next update of the pages; each page shows the date of its last update.',
      ]],
    ],
    contactH: 'Contact', source: 'Source code on GitHub',
  },
  ru: {
    path: '/ru/o-proekte/', nav: 'О проекте',
    title: 'О проекте Ordkort: кто его делает и откуда берутся слова',
    desc: 'Ordkort — бесплатный сайт с открытым кодом для изучения слов. Кто его делает, откуда норвежские слова, формы и переводы и как исправляются ошибки.',
    h1: 'О проекте Ordkort',
    lede: ['Ordkort — бесплатное веб-приложение с открытым кодом для изучения слов по карточкам с интервальным повторением. В нём нет рекламы, аккаунтов и слежки: ваши карточки хранятся в вашем браузере.'],
    sections: [
      ['Кто его делает', [
        'Ordkort создаёт и поддерживает независимый разработчик, а помогают ему люди, которые сообщают об ошибках и переводят интерфейс. Весь код открыт на GitHub под лицензией AGPL-3.0: любой может посмотреть, как устроен сайт и что он делает с данными.',
      ]],
      ['Откуда норвежские слова', [
        'Список частых слов составлен вручную, примерно в том порядке, в каком слова встречаются в повседневном норвежском. Часть речи, род и все формы взяты из Bokmålsordboka — официального словаря букмола Бергенского университета и Совета по норвежскому языку (CC BY 4.0); каждая страница слова ссылается на его статью там. Если в Bokmålsordboka несколько слов пишутся одинаково, нужное выбрано вручную.',
        'Переводы, примеры и пояснения для учащихся подготовлены с помощью ИИ, а затем проверены. В подборки по темам входят только эти проверенные слова.',
      ]],
      ['Колоды, созданные в приложении', [
        'Колоду, которую вы просите у приложения, — на любую тему и на любом языке — пишет ИИ по запросу. Её слова сверяются со словарями, где они есть (ordbokene.no для норвежского; для других языков — Викисловарь, а где его не хватает, свободные словари: лексемы Wikidata, BÍN для исландского, SALDO для шведского), но ошибка в такой колоде всё же возможна.',
      ]],
      ['Исправления', [
        'На каждой странице слова есть ссылка «Сообщить об ошибке», у каждой карточки в приложении — такая же кнопка. Можно также написать на hei@ordkort.com. Исправление появляется со следующим обновлением страниц; на каждой странице указана дата её последнего обновления.',
      ]],
    ],
    contactH: 'Связаться', source: 'Исходный код на GitHub',
  },
  uk: {
    path: '/uk/pro-proekt/', nav: 'Про проєкт',
    title: 'Про проєкт Ordkort: хто його робить і звідки беруться слова',
    desc: 'Ordkort — безкоштовний сайт з відкритим кодом для вивчення слів. Хто його робить, звідки норвезькі слова, форми й переклади та як виправляються помилки.',
    h1: 'Про проєкт Ordkort',
    lede: ['Ordkort — безкоштовний вебзастосунок з відкритим кодом для вивчення слів за картками з інтервальним повторенням. У ньому немає реклами, акаунтів і стеження: ваші картки зберігаються у вашому браузері.'],
    sections: [
      ['Хто його робить', [
        'Ordkort створює й підтримує незалежний розробник, а допомагають йому люди, які повідомляють про помилки й перекладають інтерфейс. Увесь код відкритий на GitHub за ліцензією AGPL-3.0: будь-хто може подивитися, як влаштований сайт і що він робить з даними.',
      ]],
      ['Звідки норвезькі слова', [
        'Список частих слів складено вручну, приблизно в тому порядку, в якому слова трапляються в повсякденній норвезькій. Частину мови, рід і всі форми взято з Bokmålsordboka — офіційного словника букмолу Бергенського університету та Ради з норвезької мови (CC BY 4.0); кожна сторінка слова посилається на його статтю там. Якщо в Bokmålsordboka кілька слів пишуться однаково, потрібне вибрано вручну.',
        'Переклади, приклади й пояснення для учнів підготовлено за допомогою ШІ, а потім перевірено. До добірок за темами входять лише ці перевірені слова.',
      ]],
      ['Колоди, створені в застосунку', [
        'Колоду, яку ви просите в застосунку, — на будь-яку тему й будь-якою мовою — пише ШІ на запит. Її слова звіряються зі словниками, де вони є (ordbokene.no для норвезької; для інших мов — Вікісловник, а де його не вистачає, вільні словники: лексеми Wikidata, BÍN для ісландської, SALDO для шведської), але помилка в такій колоді все ж можлива.',
      ]],
      ['Виправлення', [
        'На кожній сторінці слова є посилання «Повідомити про помилку», у кожної картки в застосунку — така сама кнопка. Можна також написати на hei@ordkort.com. Виправлення з’являється з наступним оновленням сторінок; на кожній сторінці вказано дату її останнього оновлення.',
      ]],
    ],
    contactH: 'Зв’язатися', source: 'Вихідний код на GitHub',
  },
  nb: {
    path: '/nb/om/', nav: 'Om Ordkort',
    title: 'Om Ordkort: hvem som lager det og hvor ordene kommer fra',
    desc: 'Ordkort er et gratis nettsted med åpen kildekode for å lære ord: hvem som lager det, hvor ordene og bøyningen kommer fra, og hvordan feil blir rettet.',
    h1: 'Om Ordkort',
    lede: ['Ordkort er en gratis nettapp med åpen kildekode for å lære ord med ordkort og repetisjon med økende mellomrom. Den har ingen reklame, ingen brukerkontoer og ingen sporing: kortene dine blir i nettleseren din.'],
    sections: [
      ['Hvem lager det', [
        'Ordkort er laget og vedlikeholdes av en uavhengig utvikler, med hjelp fra dem som melder fra om feil og oversetter grensesnittet. All koden er åpen på GitHub med lisensen AGPL-3.0, så hvem som helst kan se hvordan nettstedet virker og hva det gjør med data.',
      ]],
      ['Hvor de norske ordene kommer fra', [
        'Listen over vanlige ord er satt sammen for hånd, omtrent i den rekkefølgen ordene forekommer i vanlig norsk. Ordklasse, kjønn og alle bøyningsformer er hentet fra Bokmålsordboka, den offisielle ordboka til Universitetet i Bergen og Språkrådet (CC BY 4.0), og hver ordside lenker til oppslaget der. Når Bokmålsordboka har flere ord som skrives likt, er det riktige valgt for hånd.',
        'Oversettelsene, eksempelsetningene og rådene til innlærere er skrevet med hjelp av KI og deretter kontrollert. Ordlistene etter tema inneholder bare disse kontrollerte ordene.',
      ]],
      ['Kortstokker laget i appen', [
        'En kortstokk du ber appen om – om hvilket som helst tema og på hvilket som helst språk – skrives av KI på forespørsel. Ordene sjekkes mot ordbøker der det finnes en (ordbokene.no for norsk; Wiktionary for andre språk, og der Wiktionary ikke vet, de frie ordbøkene Wikidata-leksemer, BÍN for islandsk og SALDO for svensk), men en slik kortstokk kan likevel inneholde feil.',
      ]],
      ['Rettelser', [
        'Hver ordside har lenken «Meld fra om feil», og hvert kort i appen har en knapp for det. Du kan også skrive til hei@ordkort.com. En rettelse kommer med neste oppdatering av sidene; hver side viser datoen den sist ble oppdatert.',
      ]],
    ],
    contactH: 'Kontakt', source: 'Kildekoden på GitHub',
  },
  pl: {
    path: '/pl/o-projekcie/', nav: 'O projekcie',
    title: 'O projekcie Ordkort: kto go tworzy i skąd pochodzą słowa',
    desc: 'Ordkort to darmowa strona z otwartym kodem do nauki słówek. Kto ją tworzy, skąd pochodzą norweskie słowa, formy i tłumaczenia oraz jak poprawiamy błędy.',
    h1: 'O projekcie Ordkort',
    lede: ['Ordkort to darmowa aplikacja internetowa z otwartym kodem do nauki słówek z fiszkami i powtórkami w odstępach. Nie ma w niej reklam, kont ani śledzenia: twoje fiszki zostają w twojej przeglądarce.'],
    sections: [
      ['Kto go tworzy', [
        'Ordkort tworzy i utrzymuje niezależny programista, a pomagają mu osoby, które zgłaszają błędy i tłumaczą interfejs. Cały kod jest otwarty na GitHubie na licencji AGPL-3.0, więc każdy może sprawdzić, jak działa strona i co robi z danymi.',
      ]],
      ['Skąd pochodzą norweskie słowa', [
        'Listę częstych słów ułożono ręcznie, mniej więcej w kolejności, w jakiej słowa pojawiają się w codziennym norweskim. Część mowy, rodzaj i wszystkie formy pochodzą z Bokmålsordboka, oficjalnego słownika bokmålu Uniwersytetu w Bergen i Rady Języka Norweskiego (CC BY 4.0); każda strona słowa odsyła do jego hasła. Gdy Bokmålsordboka ma kilka słów pisanych tak samo, właściwe wybrano ręcznie.',
        'Tłumaczenia, przykładowe zdania i wskazówki dla uczących się przygotowano z pomocą AI, a potem sprawdzono. Listy według tematów zawierają tylko te sprawdzone słowa.',
      ]],
      ['Talie tworzone w aplikacji', [
        'Talię, o którą prosisz aplikację — na dowolny temat i w dowolnym języku — pisze AI na żądanie. Jej słowa są sprawdzane w słownikach, jeśli taki istnieje (ordbokene.no dla norweskiego; Wikisłownik dla innych języków, a tam, gdzie mu brakuje, wolne słowniki: leksemy Wikidata, BÍN dla islandzkiego i SALDO dla szwedzkiego), ale błąd w takiej talii wciąż jest możliwy.',
      ]],
      ['Poprawki', [
        'Każda strona słowa ma link „Zgłoś błąd”, a każda fiszka w aplikacji ma taki przycisk. Możesz też napisać na hei@ordkort.com. Poprawka pojawia się z następną aktualizacją stron; każda strona podaje datę swojej ostatniej aktualizacji.',
      ]],
    ],
    contactH: 'Kontakt', source: 'Kod źródłowy na GitHubie',
  },
  ar: {
    path: '/ar/an-ordkort/', nav: 'عن Ordkort',
    title: 'عن Ordkort: من يصنعه ومن أين تأتي الكلمات',
    desc: 'Ordkort موقع مجاني مفتوح المصدر لتعلّم الكلمات. من يصنعه، ومن أين تأتي الكلمات النرويجية وصيغها وترجماتها، وكيف تُصحَّح الأخطاء.',
    h1: 'عن Ordkort',
    lede: ['Ordkort تطبيق ويب مجاني مفتوح المصدر لتعلّم المفردات بالبطاقات والتكرار المتباعد. لا إعلانات فيه ولا حسابات ولا تتبّع: بطاقاتك تبقى في متصفحك.'],
    sections: [
      ['من يصنعه', [
        'يبني Ordkort ويصونه مطوّر مستقل، ويساعده من يبلّغون عن الأخطاء ويترجمون الواجهة. الشيفرة كلها مفتوحة على GitHub برخصة AGPL-3.0، فيستطيع أيّ أحد أن يرى كيف يعمل الموقع وماذا يفعل بالبيانات.',
      ]],
      ['من أين تأتي الكلمات النرويجية', [
        'جُمعت قائمة الكلمات الشائعة يدويًا، بترتيب تقريبي حسب ورودها في النرويجية اليومية. أمّا نوع الكلمة وجنسها وكل صيغها فمأخوذة من Bokmålsordboka، القاموس الرسمي للبوكمول الذي تصدره جامعة بيرغن ومجلس اللغة النرويجية (CC BY 4.0)، وكل صفحة كلمة ترتبط بمدخلها هناك. وحين يضمّ Bokmålsordboka عدة كلمات تُكتب بالطريقة نفسها، تُختار الكلمة المقصودة يدويًا.',
        'أُعدّت الترجمات والجمل المثالية والملاحظات للمتعلّمين بمساعدة الذكاء الاصطناعي ثم رُوجعت. وقوائم المواضيع لا تضمّ إلا هذه الكلمات المراجَعة.',
      ]],
      ['الرزم التي تُصنع في التطبيق', [
        'الرزمة التي تطلبها من التطبيق، في أي موضوع وبأي لغة، يكتبها الذكاء الاصطناعي عند الطلب. وتُطابَق كلماتها مع القواميس حيث يوجد قاموس (ordbokene.no للنرويجية، وويكاموس للغات الأخرى، وحيث لا يكفي فالقواميس الحرة: مفردات Wikidata وBÍN للآيسلندية وSALDO للسويدية)، لكن الخطأ يبقى ممكنًا في مثل هذه الرزمة.',
      ]],
      ['التصحيحات', [
        'في كل صفحة كلمة رابط «أبلغ عن خطأ»، ولكل بطاقة في التطبيق زرّ لذلك. ويمكنك أيضًا الكتابة إلى hei@ordkort.com. يظهر التصحيح مع التحديث التالي للصفحات، وتعرض كل صفحة تاريخ آخر تحديث لها.',
      ]],
    ],
    contactH: 'التواصل', source: 'الشيفرة المصدرية على GitHub',
  },
};
