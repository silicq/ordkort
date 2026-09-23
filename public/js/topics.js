/* Каталог тем для колод и главы учебника грамматики.
   Названия для интерфейса берутся из i18n (topic.<id>, ch.<id>),
   английские описания — подсказки для ИИ. */
(globalThis.App ||= {}).topics = (() => {
  const groups = [
    { id: 'start', items: [
      ['greetings', '👋', 'Greetings, introductions and politeness', 'hello, goodbye, thanks, please, sorry, my name is, how are you'],
      ['core', '⭐', 'The most frequent everyday words', 'the most common verbs, nouns, pronouns and little words every beginner needs'],
      ['numbers', '🔢', 'Numbers, quantities and measures'],
      ['time', '🕰️', 'Time, days, months and seasons'],
      ['colors', '🎨', 'Colors, shapes and sizes'],
      ['questions', '❓', 'Question words and connectors', 'who, what, where, why, because, but, if, then'],
    ] },
    { id: 'people', items: [
      ['family', '👪', 'Family and relationships'],
      ['body', '💪', 'Body and health'],
      ['feelings', '😊', 'Feelings, emotions and personality'],
      ['clothes', '🧥', 'Clothes and appearance'],
    ] },
    { id: 'daily', items: [
      ['home', '🏠', 'Home, rooms and furniture'],
      ['food', '🍎', 'Food and drinks'],
      ['cooking', '🍳', 'Kitchen and cooking'],
      ['shopping', '🛒', 'Shopping and money'],
      ['city', '🚋', 'City, directions and transport'],
    ] },
    { id: 'world', items: [
      ['nature', '🌲', 'Nature, landscape and weather'],
      ['animals', '🦊', 'Animals'],
      ['travel', '🧳', 'Travel, hotel and holidays'],
      ['hobby', '⚽', 'Sports, leisure and hobbies'],
      ['culture', '🎭', 'Culture, music, books and cinema'],
    ] },
    { id: 'society', items: [
      ['work', '💼', 'Work, office and professions'],
      ['study', '🎓', 'School and university'],
      ['tech', '💻', 'Technology, phones and the internet'],
      ['doctor', '🩺', 'At the doctor and pharmacy'],
      ['official', '📄', 'Documents and public services', 'residence permit, tax office, bank account, police, municipality, filling in forms, appointments'],
    ] },
    { id: 'grammar', items: [
      ['verbs', '🏃', 'Essential verbs', 'the most useful verbs, including irregular ones'],
      ['adjectives', '✨', 'Essential adjectives', 'common adjectives and their opposites'],
      ['preps', '🧭', 'Prepositions and adverbs of place and time'],
      ['phrases', '💬', 'Everyday phrases and idioms', 'short set phrases and common idioms used in conversation'],
    ] },
  ];

  const list = [];
  for (const g of groups) {
    g.items = g.items.map(([id, emoji, en, hint]) => {
      const t = { id, emoji, en, hint: hint || '', group: g.id };
      list.push(t);
      return t;
    });
  }
  const byId = Object.fromEntries(list.map((t) => [t.id, t]));

  const chapters = [
    ['sounds', 'Alphabet and pronunciation', 'alphabet/script, letters and sounds, stress, tones or intonation, reading rules'],
    ['nouns', 'Nouns: gender, number and declension', 'grammatical gender (if any), plural formation, cases/declension (if any), definite and indefinite forms, irregular nouns'],
    ['articles', 'Articles and determiners', 'articles, definiteness, demonstratives, quantifiers and when to use which'],
    ['pronouns', 'Pronouns', 'personal pronouns in all forms, possessives, reflexive, demonstrative, interrogative and indefinite pronouns'],
    ['adjectives', 'Adjectives: agreement and comparison', 'agreement in gender/number/definiteness/case, position, comparative and superlative, irregular adjectives'],
    ['verbs-present', 'Verbs: infinitive and present tense', 'infinitive, present tense formation, verb groups, the most common irregular and auxiliary verbs'],
    ['verbs-past', 'Verbs: past and future', 'past tenses (simple past, perfect, pluperfect), future, how to choose between tenses, irregular past forms'],
    ['verbs-more', 'Modal verbs, imperative and passive', 'modal verbs, imperative, passive voice, reflexive verbs, phrasal/particle verbs, conditional'],
    ['adverbs', 'Adverbs', 'formation from adjectives, adverbs of time/place/manner/degree, position in the sentence'],
    ['prepositions', 'Prepositions', 'the most common prepositions, place vs direction, time expressions, prepositions that govern cases (if any)'],
    ['numerals', 'Numbers, dates and time', 'cardinal and ordinal numbers, dates, clock time, prices, counting'],
    ['conjunctions', 'Conjunctions and clauses', 'coordinating and subordinating conjunctions, subordinate and relative clauses, word order inside clauses'],
    ['word-order', 'Word order', 'basic word order, inversion (e.g. the V2 rule), position of negation and adverbs, main vs subordinate clauses'],
    ['questions', 'Questions and negation', 'yes/no questions, question words, negation, short answers and answer particles'],
    ['word-formation', 'Word formation and compounds', 'compound words, prefixes, suffixes, derivation patterns, how to guess the meaning of new words'],
  ].map(([id, en, scope], i) => ({ id, en, scope, n: i + 1 }));

  return {
    groups,
    list,
    get: (id) => byId[id],
    chapters,
    chapter: (id) => chapters.find((c) => c.id === id),
  };
})();
