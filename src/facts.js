/* Проверенные факты грамматики букмола — «опора» для ИИ, чтобы главы учебника
   и разборы перевода не содержали выдуманных форм. Для других языков ИИ опирается
   на собственные знания. */
export const FACTS = {
  nb: {
    sounds: `Alphabet: 29 letters, a–z plus æ, ø, å. Long vowel before a single consonant (tak), short before a double consonant (takk). Retroflexes in most dialects: rs, rt, rd, rn, rl (norsk, kort). "kj" /ç/ (kjøre), "skj"/"sj"/"sk"+i,y,ei,øy /ʃ/ (skje, sjø, ski). "hv", "hj" — h is silent (hva, hjem). "g" before i/y/ei is /j/ (gi, gyse). Two tonal accents (tonem 1 and 2) distinguish e.g. bønder/bønner.`,
    nouns: `Three genders: masculine (en gutt), feminine (ei jente; in Bokmål feminines may also use masculine forms: en jente – jenten), neuter (et hus).
Definite singular = suffix: gutten, jenta/jenten, huset. No cases except genitive -s (guttens bil) and the possessive construction "gutten sin bil".
Indefinite plural: -er (gutter, jenter, epler); monosyllabic neuters usually no ending (hus, barn, år, dyr); nouns in -er add -e (lærer → lærere); -el drops e (onkel → onkler, sykkel → sykler).
Definite plural: -ene (guttene, jentene, husene); many neuters also -a (husa); barn → barna.
Irregular: mann – mannen – menn – mennene; bok – boka/boken – bøker – bøkene; hånd – hånda/hånden – hender – hendene; fot – foten – føtter – føttene; tann – tanna/tannen – tenner – tennene; far – faren – fedre – fedrene; mor – mora/moren – mødre – mødrene; bror – broren – brødre – brødrene; datter – dattera/datteren – døtre – døtrene; øye – øyet – øyne – øynene; sko – skoen – sko – skoene.`,
    articles: `Indefinite articles: en (m), ei (f, or en), et (n); no article in plural. Definiteness is a suffix (bilen, huset).
Double definiteness with an adjective: den store bilen, den store jenta, det store huset, de store bilene.
Demonstratives: denne/dette/disse (this/these) + definite noun: denne bilen, dette huset, disse bilene; den/det/de (that/those): den bilen der.
No article with professions/nationality after "være/bli": Hun er lege. Han er nordmann.
Possessive usually AFTER the definite noun: bilen min, boka mi, huset mitt, bilene mine (also: min bil — no definite suffix then).
Quantifiers: mange (countable), mye (uncountable), noen, ingen, all/alt/alle, hver/hvert.`,
    pronouns: `Personal (subject/object): jeg/meg, du/deg, han/ham (or han), hun/henne, den/den, det/det, vi/oss, dere/dere, de/dem. Formal "De/Dem" is rare today.
Reflexive: seg for 3rd person (Han vasker seg; Hun gleder seg), otherwise meg/deg/oss/dere (Jeg vasker meg).
Possessives agree with the noun: min/mi/mitt/mine, din/di/ditt/dine, sin/si/sitt/sine, vår/vår/vårt/våre; invariable: hans, hennes, deres.
sin vs hans: "Per maler huset sitt" (his own) vs "Per maler huset hans" (someone else's). "sin" never in the subject.
Interrogative: hvem, hva, hvilken/hvilket/hvilke. Relative: som (subject or object), der/hvor (place).`,
    adjectives: `Agreement (indefinite): masculine/feminine = base (en stor bil, ei stor jente), neuter +t (et stort hus), plural +e (store biler).
Definite and after possessives/genitive: +e (den store bilen, det store huset, de store bilene, min nye bil).
No -t in neuter: adjectives in -ig (et viktig møte), most in -sk (et norsk flagg), and -ende. Stressed vowel end: +tt (ny → nytt, blå → blått, fri → fritt).
Predicative agreement: Bilen er stor. Huset er stort. Bilene er store.
liten: liten (m), lita (f), lite (n), små (pl), den lille, de små. annen/annet/andre. egen/eget/egne.
Comparison: -ere, -est (fin – finere – finest; pen – penere – penest). Long/participial: mer/mest (mer interessant). Irregular: god – bedre – best; stor – større – størst; liten – mindre – minst; gammel – eldre – eldst; ung – yngre – yngst; lang – lengre – lengst; mange – flere – flest; mye – mer – mest; dårlig – verre – verst.`,
    'verbs-present': `Infinitive: å + verb (å lese, å bo). Present = infinitive + r for ALL persons: jeg/du/han/vi leser, bor, snakker. No personal endings.
Irregular present: være – er; ha – har; gjøre – gjør; si – sier; spørre – spør; vite – vet; modal verbs: kan, skal, vil, må, bør (no -r).
Present is also used for planned future: Jeg reiser i morgen.
Continuous meaning: "holde på å" (Jeg holder på å lese) or "sitte/stå/ligge og + verb" (Han sitter og leser).`,
    'verbs-past': `Weak verbs, four classes (infinitive – preteritum – perfektum):
1) kaste – kastet (kasta) – har kastet;  2) spise – spiste – har spist;  3) leve – levde – har levd;  4) bo – bodde – har bodd.
Strong/irregular: være – var – har vært; ha – hadde – har hatt; gjøre – gjorde – har gjort; si – sa – har sagt; gå – gikk – har gått; komme – kom – har kommet; se – så – har sett; få – fikk – har fått; ta – tok – har tatt; gi – ga/gav – har gitt; skrive – skrev – har skrevet; drikke – drakk – har drukket; finne – fant – har funnet; sitte – satt – har sittet; ligge – lå – har ligget; stå – sto/stod – har stått; vite – visste – har visst; spørre – spurte – har spurt; selge – solgte – har solgt; velge – valgte – har valgt.
Preteritum: finished action at a stated/known past time (Jeg kom til Norge i 2020. I går spiste jeg fisk).
Presens perfektum: experience or result relevant now, or state lasting until now (Jeg har vært i Bergen. Jeg har bodd her i tre år.).
Pluskvamperfektum: hadde + participle (Da jeg kom, hadde de spist).
Future: skal (plan/intention), kommer til å (prediction), vil (will/want); also present + time word.`,
    'verbs-more': `Modal verbs + bare infinitive (no å): Jeg kan snakke norsk. Forms: kunne – kan – kunne – har kunnet; skulle – skal – skulle – har skullet; ville – vil – ville – har villet; måtte – må – måtte – har måttet; burde – bør – burde – har burdet.
Imperative = infinitive without the final unstressed -e: les! snakk! kom! skriv! (bo! gå! se! keep their form). Negative: Ikke gå!
Passive: s-passive (Huset selges. Det må gjøres.) mostly in present/infinitive; bli-passive for events (Huset ble solgt i fjor. Han har blitt skadet).
Reflexive verbs: å glede seg, å sette seg, å skynde seg, å føle seg. Particle verbs: stå opp, slå av, finne ut (stress on the particle).
Conditional: ville + infinitive / hadde + participle (Jeg ville kjøpt det hvis jeg hadde hatt penger).`,
    adverbs: `Adverbs from adjectives = neuter form: fort (fast), pent (nicely), godt (well), dårlig (badly): Hun synger pent.
Sentence adverbs (ikke, aldri, alltid, ofte, også, bare, kanskje, gjerne, nok, jo, vel): in a main clause they come after the finite verb; in a subordinate clause before it.
Place: her/der (location) vs hit/dit (direction): Jeg bor her. Kom hit! Similarly hjemme/hjem, inne/inn, ute/ut, oppe/opp, nede/ned.`,
    prepositions: `i: in (i Oslo, i Norge, i huset, i fem år = for five years, i dag, i går, i morgen, i fjor).
på: on/at (på bordet, på jobb, på skolen, på kontoret, på kino, på mandag = this/last Monday, på norsk = in Norwegian).
til: to (til Bergen, til legen); fra: from; hos: at someone's (hos legen, hos meg); med: with; uten: without; om: about / habitual time (om morgenen, om mandagen); for … siden: ago (for to år siden); etter, før, under, over, mellom, ved, mot, gjennom, rundt.
Direction vs place: Jeg går til butikken / Jeg er i butikken. Jeg reiser til Norge / Jeg bor i Norge.`,
    numerals: `0–20: null, en/ett, to, tre, fire, fem, seks, sju (syv), åtte, ni, ti, elleve, tolv, tretten, fjorten, femten, seksten, sytten, atten, nitten, tjue. Tens: tretti, førti, femti, seksti, sytti, åtti, nitti; hundre, tusen, en million. Compounds: tjueen, førtifem, (ett) hundre og tjue.
Ordinals: første, andre, tredje, fjerde, femte, sjette, sjuende (syvende), åttende, niende, tiende, ellevte, tolvte, trettende … tjuende, tjueførste. Dates: den 17. mai (syttende mai).
Clock: Klokka er tre. kvart over tre (3:15), halv fire (3:30 — "half to four"), kvart på fire (3:45), fem på halv fire (3:25), fem over halv fire (3:35).`,
    conjunctions: `Coordinating (no change of word order): og, men, eller, for, så.
Subordinating (start a subordinate clause): at, som, fordi, når, da (past, one time), hvis/om (if), selv om, mens, før, etter at, til, slik at, om (whether).
In a subordinate clause: subject before the verb, no inversion, and sentence adverbs (ikke, aldri, alltid) BEFORE the finite verb: … fordi jeg ikke har tid. … at han alltid kommer for sent.
If the subordinate clause comes first, the main clause gets inversion: Når jeg kommer hjem, lager jeg middag.`,
    'word-order': `V2 rule: in a main clause the finite verb is ALWAYS the second element. If something other than the subject comes first (time, place, object, subordinate clause), subject and verb swap: I dag spiser jeg fisk. Hjemme snakker vi russisk.
Sentence adverbs (ikke, aldri, alltid, ofte, også) follow the finite verb in main clauses: Jeg snakker ikke norsk. With auxiliary/modal: Jeg har ikke sett filmen. Jeg kan ikke komme. After inversion: I dag kommer han ikke.
Unstressed object pronouns move before ikke: Jeg ser ham ikke (but: Jeg ser ikke filmen).
Subordinate clauses: subject – adverb – verb: … fordi hun ikke kom.
Order of adverbials: manner – place – time: Hun jobbet hardt på kontoret i går.`,
    questions: `Yes/no questions: finite verb first: Snakker du norsk? Har du sett filmen?
Question word + verb + subject: Hvor bor du? Hva heter du? Når kommer toget? Hvorfor gråter hun? Hvordan har du det? Hvilken bok leser du? Hvor mange / hvor mye …?
When the question word is the subject, no inversion: Hvem kommer? Hva skjedde?
Answers: ja / nei; "jo" = yes to a negative question (Kommer du ikke? – Jo, jeg kommer.).
Negation: ikke (position by the V2 rule); ingen / ikke noe(n): Jeg har ingen bil = Jeg har ikke noen bil. Double negation is not used.`,
    'word-formation': `Compounds are written as one word; the LAST part decides gender and meaning: et hus + en dør → en husdør; ei bok + en hylle → en bokhylle. Linking -s- or -e- is common: arbeidsdag, barnehage, gutteskole.
Suffixes: -het/-else (nouns: frihet, forståelse), -ing/-ning (handling: lesing), -er/-ere (person: lærer, baker), -inne (female: venninne), -lig/-ig/-som (adjectives: vennlig, viktig, morsom), -isk (typisk).
Prefixes: u- (not: ulykkelig, umulig), mis- (misforstå), for- (forklare), be- (betale).`,
  },
};

/* Короткая выжимка для переводчика и свободных вопросов */
export function coreFacts(lang) {
  const f = FACTS[lang];
  if (!f) return '';
  return [f['word-order'], f.adjectives.split('\n').slice(0, 3).join('\n'), f.articles.split('\n').slice(1, 2).join('\n'), f['verbs-past'].split('\n').slice(3, 5).join('\n'), f.pronouns.split('\n').slice(3, 4).join('\n')].join('\n');
}
