/* Study session. Modes:
   flip   — classic card: "I know / I don't know" (new) and "I remember / I forgot" (review)
   choice — see the word, pick its translation out of four
   type   — see the translation, type the word
   listen — hear the word, pick its translation
   cloze  — type the missing word into the example sentence
   mix    — a different mode for every card
   Keys: Space — flip / next, ← or 1 — don't know, → or 2 — know, 1–4 — options, S — listen. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  let S = null;
  let onKey = null;
  let autoNext = null;

  const MODES = [
    ['flip', 'cards'], ['choice', 'check'], ['type', 'edit'], ['listen', 'speaker'], ['cloze', 'book'], ['mix', 'sparkle'],
  ];

  // letters that are hard to type on a foreign keyboard
  const LETTERS = {
    nb: 'æøå', nn: 'æøå', da: 'æøå', sv: 'åäö', fi: 'äö', is: 'áðéíóúýþæö', de: 'äöüß', nl: 'éëï',
    fr: 'éèêàçôîûùœ', es: 'áéíóúñü¿¡', it: 'àèéìòù', pt: 'áâãàçéêíóôõú', pl: 'ąćęłńóśźż',
    cs: 'áčďéěíňóřšťúůýž', sk: 'áäčďéíľĺňóôŕšťúýž', tr: 'çğıİöşü', hu: 'áéíóöőúüű', ro: 'ăâîșț',
    lt: 'ąčęėįšųūž', lv: 'āčēģīķļņšūž', et: 'äöõüšž', hr: 'čćđšž', sq: 'çë', vi: 'ăâđêôơư', eo: 'ĉĝĥĵŝŭ',
  };

  A.views.study = {
    render(root, [deckId], query) {
      const cram = query.has('cram');
      const extra = parseInt(query.get('extra'), 10) || 0;
      const ids = cram ? A.store.cramQueue(deckId) : A.store.buildSession(deckId, extra);
      S = {
        deckId, cram, queue: ids, i: 0, total: ids.length,
        first: {}, fails: {}, flipped: false, answered: false, dir: 'forward', busy: false, mode: 'flip',
        root,
      };
      S.backHref = deckId ? '#/deck/' + deckId : '#/';

      const wrap = h('div', { class: 'study' });
      root.append(wrap);
      A.persist();
      S.wrap = wrap;

      if (!ids.length) { empty(); return; }

      S.bar = h('i');
      S.count = h('span', { class: 'study-count' });
      S.modeBtn = h('button', { class: 'mode-chip', type: 'button', onclick: chooseMode });
      A.add(wrap,
        h('div', { class: 'study-top' },
          h('a', { class: 'icon-btn', href: S.backHref, title: t('study.quit'), 'aria-label': t('study.quit') }, icon('close')),
          h('div', { class: 'progress' }, S.bar),
          S.count,
          S.modeBtn),
        cram ? h('p', { class: 'cram-note' }, icon('info', 16), t('study.cram_note')) : null,
        S.stage = h('div', { class: 'stage' }),
        S.actions = h('div', { class: 'answer-row' }),
        h('p', { class: 'keys-hint' }, t('study.keys')));
      paintModeBtn();

      onKey = (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('dialog')) return;
        const typing = e.target.closest?.('input, textarea, select');
        if (typing) return; // the answer field handles Enter itself
        const k = e.key;
        if (k === ' ' || k === 'Enter') {
          e.preventDefault();
          if (S.answered) next(); else if (S.mode === 'flip') flip();
        } else if (S.mode === 'flip' && !S.answered && (k === 'ArrowRight' || k === '2')) record(true);
        else if (S.mode === 'flip' && !S.answered && (k === 'ArrowLeft' || k === '1')) record(false);
        else if ((S.mode === 'choice' || S.mode === 'listen') && !S.answered && /^[1-4]$/.test(k)) S.actions.querySelectorAll('.opt')[+k - 1]?.click();
        else if (k.toLowerCase() === 's') { const c = cur(); if (c) A.speak(c.term, A.store.settings.target); }
      };
      document.addEventListener('keydown', onKey);
      draw();
    },
    leave() {
      if (onKey) document.removeEventListener('keydown', onKey);
      onKey = null;
      clearTimeout(autoNext);
      window.speechSynthesis?.cancel();
    },
    _test: { compare, clozeOf },
  };

  const cur = () => A.store.card(S.queue[S.i]);

  function empty() {
    const o = A.store.overview(S.deckId);
    const base = S.deckId ? `#/study/${S.deckId}` : '#/study';
    S.wrap.append(h('div', { class: 'empty big' },
      h('div', { class: 'empty-emoji' }, '🎉'),
      h('h2', { class: 'display sm' }, o.total ? t('study.nothing') : t('study.no_cards')),
      h('p', { class: 'muted' }, o.total ? t('study.nothing_hint') : t('study.no_cards_hint')),
      h('div', { class: 'row gap center wrap' },
        o.fresh ? h('a', { class: 'btn btn-primary', href: base + '?extra=10' }, icon('plus', 18), t('study.more_new')) : null,
        o.total - o.fresh ? h('a', { class: 'btn btn-soft', href: base + '?cram=1' }, icon('flip', 18), t('study.cram')) : null,
        h('a', { class: 'btn btn-ghost', href: S.backHref }, t('study.back')))));
  }

  function progress() {
    S.bar.style.width = Math.round((S.i / S.queue.length) * 100) + '%';
    S.count.textContent = `${Math.min(S.i + 1, S.queue.length)} / ${S.queue.length}`;
  }

  /* ---------- modes ---------- */
  function paintModeBtn() {
    const m = A.store.settings.studyMode || 'flip';
    const ic = MODES.find(([id]) => id === m)?.[1] || 'cards';
    S.modeBtn.replaceChildren(icon(ic, 16), h('span', null, t('mode.' + m)), icon('chevron', 14));
    S.modeBtn.title = t('mode.choose');
  }

  function chooseMode() {
    const current = A.store.settings.studyMode || 'flip';
    const m = A.modal({
      title: t('mode.choose'),
      body: h('div', { class: 'mode-list' }, MODES.map(([id, ic]) =>
        h('button', {
          class: 'mode-row' + (id === current ? ' on' : ''), type: 'button',
          onclick: () => {
            A.store.set({ studyMode: id });
            m.close();
            paintModeBtn();
            if (!S.answered) draw(); // re-ask the current card in the new mode
          },
        },
          h('span', { class: 'mode-ico' }, icon(ic, 20)),
          h('span', null, h('b', null, t('mode.' + id)), h('small', null, t('mode.' + id + '_d'))),
          id === current ? icon('check', 18) : null))),
    });
  }

  function distractors(c, n = 3) {
    const seen = new Set([A.store.norm(c.tr)]);
    const pool = A.store.cards().filter((x) => x.id !== c.id && x.tr)
      .map((x) => ({ x, k: (x.pos === c.pos ? 0 : 1) + Math.random() }))
      .sort((a, b) => a.k - b.k).map((o) => o.x);
    const out = [];
    for (const x of pool) {
      const k = A.store.norm(x.tr);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
      if (out.length === n) break;
    }
    return out.length === n ? out : null;
  }

  /* Find the word form of the card inside its example sentence → { before, answer, after, tr } */
  function clozeOf(c) {
    const { text: ex, tr } = A.store.example(c);
    if (!ex) return null;
    const base = c.term.replace(/^(en|ei|et|ein|eit|å|der|die|das|eine?|le|la|les|l['’]|une?|el|los|las|il|lo|gli|uno|o|os|as|uma?|het|ett|att|to|the|an?)\s+/i, '').trim();
    if (!base) return null;
    const low = ex.toLowerCase(), b = base.toLowerCase();
    const isWord = (ch) => !!ch && /[\p{L}\p{M}\p{N}]/u.test(ch);
    const spaced = /[\p{L}]/u.test(b[0]) && !/[぀-ヿ㐀-鿿가-힯฀-๿]/.test(b);
    // prefer a match at the start of a word: "øre" → "øret", not the "øre" inside "høre"
    const starts = [];
    for (let i = low.indexOf(b); i >= 0; i = low.indexOf(b, i + 1)) starts.push(i);
    let at = (spaced ? starts.find((i) => !isWord(ex[i - 1])) : undefined) ?? (starts.length ? starts[0] : -1);
    let len = b.length;
    if (at >= 0 && spaced) {
      while (at > 0 && isWord(ex[at - 1])) { at--; len++; } // expand to whole word(s)
      while (isWord(ex[at + len])) len++;
    }
    if (at < 0 && !b.includes(' ')) {
      const stem = b.slice(0, Math.max(3, Math.ceil(b.length * 0.6)));
      for (const m of ex.matchAll(/[\p{L}\p{M}'’-]+/gu)) {
        if (m[0].toLowerCase().startsWith(stem)) { at = m.index; len = m[0].length; break; }
      }
    }
    if (at < 0 || len > 40) return null;
    return { before: ex.slice(0, at), answer: ex.slice(at, at + len), after: ex.slice(at + len), tr };
  }

  function available(mode, c) {
    if (mode === 'choice') return !!distractors(c);
    if (mode === 'listen') return !!distractors(c) && A.canSpeak(A.store.settings.target);
    if (mode === 'cloze') return !!clozeOf(c);
    return true;
  }

  function resolveMode(c) {
    let m = A.store.settings.studyMode || 'flip';
    if (m === 'mix') {
      const opts = ['flip', 'choice', 'type', 'listen', 'cloze'].filter((x) => available(x, c));
      m = opts[Math.floor(Math.random() * opts.length)] || 'flip';
    }
    if (!available(m, c)) m = m === 'cloze' ? 'type' : m === 'listen' && available('choice', c) ? 'choice' : m === 'type' ? 'type' : 'flip';
    return m;
  }

  /* ---------- drawing ---------- */
  function draw() {
    clearTimeout(autoNext);
    const c = cur();
    if (!c) { finish(); return; }
    const s = A.store.settings;
    S.flipped = false;
    S.answered = false;
    S.mode = resolveMode(c);
    const d = s.direction;
    S.dir = S.mode === 'flip' ? (d === 'mixed' ? (Math.random() < 0.5 ? 'forward' : 'reverse') : d) : 'forward';
    progress();

    const isNew = c.box === 0;
    const deck = A.store.deck(c.deck);
    const T = s.target, N = s.native;
    const fwd = S.dir === 'forward';
    const sizeOf = (x) => (x.length > 30 ? ' xl' : x.length > 14 ? ' l' : '');
    const ex = A.store.example(c);
    const { gram, pron, forms } = A.store.shown(c);

    const tag = h('div', { class: 'flash-tag' },
      h('span', { class: 'badge ' + (isNew ? 'new' : 'rev') }, t(isNew ? 'study.new' : 'study.review')),
      deck ? h('span', { class: 'flash-deck' }, `${deck.emoji || ''} ${A.deckTitle(deck)}`) : null);

    let frontBody;
    if (S.mode === 'type') {
      frontBody = [h('div', { class: 'flash-ask' }, t('study.ask_type')), A.lt(c.tr, N, 'flash-word serif' + sizeOf(c.tr), 'div'),
        gram ? h('div', { class: 'flash-pron' }, gram) : c.pos ? h('div', { class: 'flash-pron' }, t('pos.' + c.pos)) : null];
    } else if (S.mode === 'listen') {
      frontBody = [h('div', { class: 'flash-ask' }, t('study.ask_listen')),
        h('button', { class: 'listen-big', type: 'button', 'aria-label': t('common.listen'), onclick: (e) => { e.stopPropagation(); A.speak(c.term, T); } }, icon('speaker', 40))];
    } else if (S.mode === 'cloze') {
      S.cloze = clozeOf(c);
      frontBody = [h('div', { class: 'flash-ask' }, t('study.ask_cloze')),
        h('p', { class: 'cloze serif', lang: T, dir: 'auto' }, S.cloze.before, h('span', { class: 'gap' }, '＿＿＿'), S.cloze.after),
        S.cloze.tr ? A.lt(S.cloze.tr, N, 'flash-small', 'p') : null,
        h('div', { class: 'flash-pron' }, `${c.tr}`)];
    } else if (fwd) {
      frontBody = [A.lt(c.term, T, 'flash-word serif' + sizeOf(c.term), 'div'), pron ? h('div', { class: 'flash-pron' }, pron) : null, A.speakBtn(c.term, T, 'lg')];
    } else {
      frontBody = [A.lt(c.tr, N, 'flash-word serif' + sizeOf(c.tr), 'div'), c.pos ? h('div', { class: 'flash-pron' }, t('pos.' + c.pos)) : null];
    }

    const front = h('div', { class: 'face front' },
      tag.cloneNode(true),
      h('div', { class: 'face-body' }, frontBody),
      S.mode === 'flip' ? h('div', { class: 'face-hint' }, icon('flip', 15), t('study.tap')) : null);

    const back = h('div', { class: 'face back' },
      tag,
      h('div', { class: 'face-body' },
        A.lt(fwd ? c.term : c.tr, fwd ? T : N, 'flash-small', 'div'),
        A.lt(fwd ? c.tr : c.term, fwd ? N : T, 'flash-word serif' + sizeOf(fwd ? c.tr : c.term), 'div'),
        S.mode === 'flip' && !fwd ? h('div', { class: 'row gap center' }, pron ? h('span', { class: 'flash-pron' }, pron) : null, A.speakBtn(c.term, T)) : null,
        S.mode !== 'flip' ? h('div', { class: 'row gap center' }, pron ? h('span', { class: 'flash-pron' }, pron) : null, A.speakBtn(c.term, T)) : null,
        gram || forms ? h('div', { class: 'flash-gram' },
          gram ? h('span', null, gram) : null,
          forms ? A.lt(forms, T, 'serif') : null) : null,
        ex.text ? h('div', { class: 'flash-ex' },
          h('p', null, A.lt(ex.text, T, 'serif'), A.speakBtn(ex.text, T, 'sm')),
          ex.tr ? A.lt(ex.tr, N, 'muted', 'p') : null) : null));

    const inner = h('div', { class: 'flash-inner' }, front, back);
    const card = h('div', { class: 'flash mode-' + S.mode, tabindex: '0', role: 'button', 'aria-label': t('study.tap') },
      h('span', { class: 'stamp ok' }, t(isNew ? 'study.know' : 'study.remember')),
      h('span', { class: 'stamp no' }, t(isNew ? 'study.dont_know' : 'study.dont_remember')),
      inner);
    S.card = card;
    swipe(card);

    S.stage.replaceChildren(h('div', { class: 'stack' }, h('div', { class: 'stack-bg b2' }), h('div', { class: 'stack-bg b1' }), card));
    requestAnimationFrame(() => card.classList.add('in'));

    if (S.mode === 'flip') flipButtons(isNew);
    else if (S.mode === 'choice' || S.mode === 'listen') choiceButtons(c);
    else typeBox(c);

    if (S.mode === 'listen') setTimeout(() => A.speak(c.term, T), 300);
    else if (s.autoSpeak && S.mode !== 'type' && S.mode !== 'cloze' && fwd) setTimeout(() => A.speak(c.term, T), 250);
  }

  function flipButtons(isNew) {
    S.actions.className = 'answer-row';
    S.actions.replaceChildren(
      h('button', { class: 'btn btn-no', type: 'button', onclick: () => record(false) }, icon('x', 20), t(isNew ? 'study.dont_know' : 'study.dont_remember')),
      h('button', { class: 'btn btn-flip', type: 'button', title: t('study.flip'), 'aria-label': t('study.flip'), onclick: flip }, icon('flip', 20)),
      h('button', { class: 'btn btn-yes', type: 'button', onclick: () => record(true) }, icon('check', 20), t(isNew ? 'study.know' : 'study.remember')));
  }

  function choiceButtons(c) {
    const opts = [c, ...distractors(c)].map((x) => ({ x, k: Math.random() })).sort((a, b) => a.k - b.k).map((o) => o.x);
    S.actions.className = 'answer-row options';
    S.actions.replaceChildren(...opts.map((x, i) => h('button', {
      class: 'opt', type: 'button', lang: A.store.settings.native, dir: 'auto',
      onclick: (e) => {
        if (S.answered) return;
        const ok = x.id === c.id;
        S.actions.querySelectorAll('.opt').forEach((b, j) => { if (opts[j].id === c.id) b.classList.add('right'); b.disabled = true; });
        if (!ok) e.currentTarget.classList.add('wrong');
        settle(ok);
      },
    }, h('span', { class: 'opt-n' }, i + 1), h('span', null, x.tr))));
  }

  function typeBox(c) {
    const T = A.store.settings.target;
    const expected = S.mode === 'cloze' ? S.cloze.answer : c.term;
    const input = h('input', { class: 'input type-input', lang: T, dir: 'auto', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: t(S.mode === 'cloze' ? 'study.ph_cloze' : 'study.ph_type') });
    const check = h('button', { class: 'btn btn-primary', type: 'button' }, t('study.check'));
    const giveUp = h('button', { class: 'link-btn small', type: 'button' }, t('study.give_up'));
    const letters = LETTERS[T] ? h('div', { class: 'letters' }, [...LETTERS[T]].map((ch) =>
      h('button', {
        type: 'button', class: 'letter',
        onpointerdown: (e) => e.preventDefault(), // keep focus in the field
        onclick: () => {
          const a = input.selectionStart ?? input.value.length, b = input.selectionEnd ?? a;
          input.value = input.value.slice(0, a) + ch + input.value.slice(b);
          input.setSelectionRange(a + 1, a + 1);
          input.focus();
        },
      }, ch))) : null;
    const feedback = h('p', { class: 'feedback', hidden: true });

    const submit = (gaveUp) => {
      if (S.answered) { next(); return; }
      const v = input.value.trim();
      if (!v && !gaveUp) { input.focus(); return; }
      const res = gaveUp ? 'wrong' : compare(v, expected, c);
      const ok = res !== 'wrong', hard = res === 'form';
      input.disabled = true;
      check.textContent = t('study.next');
      giveUp.hidden = true;
      if (letters) letters.hidden = true;
      feedback.hidden = false;
      feedback.className = 'feedback ' + (hard ? 'partial' : ok ? 'good' : 'bad');
      A.put(feedback,
        icon(hard ? 'refresh' : ok ? 'check' : 'x', 16),
        h('span', null, t(FEEDBACK[res])),
        res !== 'right' ? A.lt(expected, T, 'serif fb-word') : null);
      settle(ok, { auto: res === 'right', hard }); // give time to read the correct spelling or form
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(false); } });
    check.addEventListener('click', () => submit(false));
    giveUp.addEventListener('click', () => submit(true));

    S.actions.className = 'answer-row typing';
    A.put(S.actions, h('div', { class: 'type-line' }, input, check), letters, h('div', { class: 'type-foot' }, feedback, giveUp));
    // on phones focusing opens the keyboard; do it only on devices with a real keyboard
    if (matchMedia('(hover: hover)').matches) setTimeout(() => input.focus(), 60);
  }

  /* The typed answer is judged as:
     right  — the expected word or one of its variants; notes in brackets such as "(м.)" may be left out
     almost — one typo (a wrong, missing, extra or two swapped letters) in a word of 5+ letters
     form   — the same word in another form, e.g. "tallerken" where the gap needs "tallerkenen":
              half-right — not a mistake, but graded "hard" and asked again in this session
     roman  — the romanization of a word in another script, e.g. pinyin "qing" for 请
     wrong  — anything else. Everything but "wrong" counts as remembered. */
  const FEEDBACK = { right: 'study.right', almost: 'study.almost', form: 'study.other_form', roman: 'study.roman', wrong: 'study.correct_is' };
  function compare(value, expected, c) {
    const n = (x) => A.store.norm(x).replace(/\s+/g, ' ');
    const variants = (x) => {
      const out = new Set();
      for (const s of [x, x.replace(/\([^)]*\)/g, ' ')]) {
        out.add(n(s));
        for (const v of s.split(/\s*[/,;]\s*/)) out.add(n(v));
      }
      out.delete('');
      return [...out];
    };
    const a = n(value), exp = variants(expected);
    if (exp.includes(a)) return 'right';
    if (c && variants([c.term, c.forms].filter(Boolean).join(', ')).includes(a)) return 'form';
    if (exp.some((b) => b.length >= 5 && dist(a, b) <= 1)) return 'almost';
    if (!c) return 'wrong';
    const roman = romanOf(c);
    if (roman && n(expected) === n(c.term)) {
      const flat = (x) => x.normalize('NFD').replace(/[^\p{L}]/gu, '').toLowerCase(); // no tone marks, spaces or digits
      const r = flat(roman), v = flat(value);
      if (v === r) return 'roman';
      if (r.length >= 5 && dist(v, r) <= 1) return 'almost';
    }
    return 'wrong';
  }
  // pinyin, romaji and the like — the pronunciation of a word in a non-Latin script, unless it is IPA
  const romanOf = (c) => (c.pron && !/^\s*[/[]/.test(c.pron) && !/\p{Script=Latin}/u.test(c.term) && /\p{Script=Latin}/u.test(c.pron) ? c.pron : '');

  // edit distance where two swapped neighbouring letters are one typo; anything above 1 is just "2"
  function dist(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return Math.min(2, d[a.length][b.length]);
  }

  /* ---------- answering ---------- */
  function flip(force) {
    if (!S.card) return;
    if (S.mode !== 'flip' && !S.answered) return; // the back would reveal the answer
    S.flipped = force === true ? true : !S.flipped;
    S.card.classList.toggle('flipped', S.flipped);
  }

  // hard: half-right (the right word in a wrong form) — not a mistake, but the card comes back like one
  function store(ok, hard = false) {
    const id = S.queue[S.i];
    if (!(id in S.first)) S.first[id] = ok;
    A.store.answer(id, ok, S.cram, hard);
    if (!ok || hard) {
      const n = (S.fails[id] = (S.fails[id] || 0) + 1);
      if (n <= 3) S.queue.splice(Math.min(S.i + 4, S.queue.length), 0, id);
    }
  }

  // flip mode: "know" moves on at once, "don't know" shows the answer first
  function record(ok) {
    if (S.answered || S.busy) return;
    store(ok);
    if (ok) {
      S.busy = true;
      S.card.classList.add('out-right');
      setTimeout(() => { S.busy = false; next(); }, 260);
      return;
    }
    S.answered = true;
    S.card.classList.add('failed');
    flip(true);
    S.actions.className = 'answer-row';
    S.actions.replaceChildren(
      h('p', { class: 'again-note' }, icon('refresh', 16), t('study.again_note')),
      h('button', { class: 'btn btn-primary btn-next', type: 'button', onclick: next }, t('study.next'), icon('arrow', 18)));
    progress();
  }

  // other modes: show the answer on the back, move on by itself after a correct answer
  function settle(ok, { auto = ok, hard = false } = {}) {
    store(ok, hard);
    S.answered = true;
    if (!ok || hard) S.card.classList.add(hard ? 'partial' : 'failed');
    flip(true);
    const nextBtn = S.actions.querySelector('.btn-next');
    if (!nextBtn && S.mode !== 'type' && S.mode !== 'cloze') {
      S.actions.append(h('button', { class: 'btn btn-primary btn-next wide', type: 'button', onclick: next }, t('study.next'), icon('arrow', 18)));
    }
    if (auto) autoNext = setTimeout(next, 1600);
    progress();
  }

  function next() {
    if (S.busy) return;
    clearTimeout(autoNext);
    S.i++;
    if (S.i >= S.queue.length) finish(); else draw();
  }

  function swipe(card) {
    let x0 = null, dx = 0;
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      x0 = e.clientX; dx = 0;
      card.setPointerCapture(e.pointerId);
      card.classList.add('dragging');
    });
    card.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      dx = S.mode === 'flip' && !S.answered ? e.clientX - x0 : 0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
      card.style.setProperty('--ok', Math.max(0, Math.min(1, dx / 110)));
      card.style.setProperty('--no', Math.max(0, Math.min(1, -dx / 110)));
    });
    const end = () => {
      if (x0 === null) return;
      card.classList.remove('dragging');
      card.style.transform = '';
      card.style.setProperty('--ok', 0);
      card.style.setProperty('--no', 0);
      const d = dx;
      x0 = null;
      if (Math.abs(d) > 100 && !S.answered) record(d > 0);
      else if (Math.abs(d) < 6) flip();
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); S.answered ? next() : flip(); } });
  }

  function finish() {
    A.views.study.leave();
    const ids = Object.keys(S.first);
    const firstOk = ids.filter((id) => S.first[id]).length;
    const missed = ids.filter((id) => !S.first[id]).map((id) => A.store.card(id)).filter(Boolean);
    const pct = ids.length ? Math.round((firstOk / ids.length) * 100) : 0;
    const s = A.store.settings;
    const o = A.store.overview(S.deckId);
    const more = Math.min(s.sessionSize, o.due + Math.min(o.fresh, o.newLeft));
    const streak = A.store.streak();
    const goal = s.goal || 20, done = A.store.today().rev;

    S.wrap.replaceChildren(h('div', { class: 'result' },
      h('div', { class: 'result-emoji' }, pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '🌱'),
      h('h1', { class: 'display' }, t(pct >= 80 ? 'res.great' : pct >= 50 ? 'res.good' : 'res.keep')),
      done >= goal ? h('p', { class: 'goal-done' }, icon('check', 18), t('goal.done', { n: goal })) : h('p', { class: 'muted' }, t('goal.left', { n: goal - done })),
      h('div', { class: 'result-stats' },
        h('div', null, h('b', null, ids.length), h('span', null, t('res.cards'))),
        h('div', null, h('b', null, pct + '%'), h('span', null, t('res.first_try'))),
        h('div', null, h('b', null, streak), h('span', null, A.tn('n_days_streak', streak)))),
      missed.length ? h('div', { class: 'missed' },
        h('h3', null, t('res.review_these')),
        h('ul', null, missed.map((c) => h('li', null, A.lt(c.term, s.target, 'serif'), h('span', { class: 'dash' }, '—'), A.lt(c.tr, s.native))))) : null,
      h('div', { class: 'row gap center wrap' },
        more ? h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => A.route() }, t('res.again'), h('span', { class: 'btn-count' }, more)) : null,
        h('a', { class: 'btn btn-ghost btn-lg', href: S.backHref }, t('res.back')))));
  }
})();
