/* Занятие: карточки «Знаю / Не знаю» (новые) и «Помню / Не помню» (повторение).
   Клавиши: пробел — перевернуть, ← / 1 — не знаю, → / 2 — знаю. Свайп влево/вправо. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  let S = null;
  let onKey = null;

  A.views.study = {
    render(root, [deckId], query) {
      const cram = query.has('cram');
      const extra = parseInt(query.get('extra'), 10) || 0;
      const ids = cram ? A.store.cramQueue(deckId) : A.store.buildSession(deckId, extra);
      S = {
        deckId, cram, queue: ids, i: 0, total: ids.length,
        first: {}, fails: {}, flipped: false, answered: false, dir: 'forward', busy: false,
        root,
      };
      const s = A.store.settings;
      const backHref = deckId ? '#/deck/' + deckId : '#/';
      S.backHref = backHref;

      const wrap = h('div', { class: 'study' });
      root.append(wrap);
      A.persist();
      S.wrap = wrap;

      if (!ids.length) { empty(); return; }

      S.bar = h('i');
      S.count = h('span', { class: 'study-count' });
      A.add(wrap,
        h('div', { class: 'study-top' },
          h('a', { class: 'icon-btn', href: backHref, title: t('study.quit'), 'aria-label': t('study.quit') }, icon('close')),
          h('div', { class: 'progress' }, S.bar),
          S.count),
        cram ? h('p', { class: 'cram-note' }, icon('info', 16), t('study.cram_note')) : null,
        S.stage = h('div', { class: 'stage' }),
        S.actions = h('div', { class: 'answer-row' }),
        h('p', { class: 'keys-hint' }, t('study.keys')));

      onKey = (e) => {
        if (e.target.closest?.('input, textarea, select, dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); S.answered ? next() : flip(); }
        else if (e.key === 'ArrowRight' || e.key === '2') { if (!S.answered) answer(true); }
        else if (e.key === 'ArrowLeft' || e.key === '1') { if (!S.answered) answer(false); }
        else if (e.key.toLowerCase() === 's') { const c = cur(); if (c) A.speak(c.term, s.target); }
      };
      document.addEventListener('keydown', onKey);
      draw();
    },
    leave() {
      if (onKey) document.removeEventListener('keydown', onKey);
      onKey = null;
      window.speechSynthesis?.cancel();
    },
  };

  const cur = () => A.store.card(S.queue[S.i]);

  function empty() {
    const o = A.store.overview(S.deckId);
    S.wrap.append(h('div', { class: 'empty big' },
      h('div', { class: 'empty-emoji' }, '🎉'),
      h('h2', { class: 'display sm' }, o.total ? t('study.nothing') : t('study.no_cards')),
      h('p', { class: 'muted' }, o.total ? t('study.nothing_hint') : t('study.no_cards_hint')),
      h('div', { class: 'row gap center wrap' },
        o.fresh ? h('a', { class: 'btn btn-primary', href: `#/study/${S.deckId || ''}?extra=10`.replace('//?', '/?') }, icon('plus', 18), t('study.more_new')) : null,
        o.total - o.fresh ? h('a', { class: 'btn btn-soft', href: `#/study/${S.deckId || ''}?cram=1`.replace('//?', '/?') }, icon('flip', 18), t('study.cram')) : null,
        h('a', { class: 'btn btn-ghost', href: S.backHref }, t('study.back')))));
  }

  function progress() {
    const pct = Math.round((S.i / S.queue.length) * 100);
    S.bar.style.width = pct + '%';
    S.count.textContent = `${Math.min(S.i + 1, S.queue.length)} / ${S.queue.length}`;
  }

  function pickDir() {
    const d = A.store.settings.direction;
    return d === 'mixed' ? (Math.random() < 0.5 ? 'forward' : 'reverse') : d;
  }

  function draw() {
    const c = cur();
    if (!c) { finish(); return; }
    const s = A.store.settings;
    S.flipped = false;
    S.answered = false;
    S.dir = pickDir();
    progress();

    const isNew = c.box === 0;
    const deck = A.store.deck(c.deck);
    const T = s.target, N = s.native;
    const fwd = S.dir === 'forward';
    const sizeOf = (s) => (s.length > 30 ? ' xl' : s.length > 14 ? ' l' : '');
    const size = sizeOf(fwd ? c.term : c.tr);

    const tag = h('div', { class: 'flash-tag' },
      h('span', { class: 'badge ' + (isNew ? 'new' : 'rev') }, t(isNew ? 'study.new' : 'study.review')),
      deck ? h('span', { class: 'flash-deck' }, `${deck.emoji || ''} ${A.deckTitle(deck)}`) : null);

    const front = h('div', { class: 'face front' },
      tag.cloneNode(true),
      h('div', { class: 'face-body' },
        fwd
          ? [A.lt(c.term, T, 'flash-word serif' + size, 'div'), c.pron ? h('div', { class: 'flash-pron' }, c.pron) : null, A.speakBtn(c.term, T, 'lg')]
          : [A.lt(c.tr, N, 'flash-word serif' + size, 'div'), c.pos ? h('div', { class: 'flash-pron' }, t('pos.' + c.pos)) : null]),
      h('div', { class: 'face-hint' }, icon('flip', 15), t('study.tap')));

    const back = h('div', { class: 'face back' },
      tag,
      h('div', { class: 'face-body' },
        A.lt(fwd ? c.term : c.tr, fwd ? T : N, 'flash-small', 'div'),
        A.lt(fwd ? c.tr : c.term, fwd ? N : T, 'flash-word serif' + sizeOf(fwd ? c.tr : c.term), 'div'),
        !fwd ? h('div', { class: 'row gap center' }, c.pron ? h('span', { class: 'flash-pron' }, c.pron) : null, A.speakBtn(c.term, T)) : null,
        c.gram || c.forms ? h('div', { class: 'flash-gram' },
          c.gram ? h('span', null, c.gram) : null,
          c.forms ? A.lt(c.forms, T, 'serif') : null) : null,
        c.ex ? h('div', { class: 'flash-ex' },
          h('p', null, A.lt(c.ex, T, 'serif'), A.speakBtn(c.ex, T, 'sm')),
          c.exTr ? A.lt(c.exTr, N, 'muted', 'p') : null) : null));

    const inner = h('div', { class: 'flash-inner' }, front, back);
    const card = h('div', { class: 'flash', tabindex: '0', role: 'button', 'aria-label': t('study.tap') },
      h('span', { class: 'stamp ok' }, t(isNew ? 'study.know' : 'study.remember')),
      h('span', { class: 'stamp no' }, t(isNew ? 'study.dont_know' : 'study.dont_remember')),
      inner);
    S.card = card;
    swipe(card);

    S.stage.replaceChildren(h('div', { class: 'stack' }, h('div', { class: 'stack-bg b2' }), h('div', { class: 'stack-bg b1' }), card));
    requestAnimationFrame(() => card.classList.add('in'));
    buttons(isNew);

    if (s.autoSpeak && fwd) setTimeout(() => A.speak(c.term, T), 250);
  }

  function buttons(isNew) {
    S.actions.replaceChildren(
      h('button', { class: 'btn btn-no', type: 'button', onclick: () => answer(false) }, icon('x', 20), t(isNew ? 'study.dont_know' : 'study.dont_remember')),
      h('button', { class: 'btn btn-flip', type: 'button', title: t('study.flip'), 'aria-label': t('study.flip'), onclick: flip }, icon('flip', 20)),
      h('button', { class: 'btn btn-yes', type: 'button', onclick: () => answer(true) }, icon('check', 20), t(isNew ? 'study.know' : 'study.remember')));
  }

  function flip(force) {
    if (!S.card) return;
    S.flipped = force === true ? true : !S.flipped;
    S.card.classList.toggle('flipped', S.flipped);
  }

  function answer(ok) {
    if (S.answered || S.busy) return;
    const id = S.queue[S.i];
    if (!(id in S.first)) S.first[id] = ok;
    A.store.answer(id, ok, S.cram);
    if (ok) {
      S.busy = true;
      S.card.classList.add('out-right');
      setTimeout(() => { S.busy = false; next(); }, 260);
      return;
    }
    const n = (S.fails[id] = (S.fails[id] || 0) + 1);
    if (n <= 3) S.queue.splice(Math.min(S.i + 4, S.queue.length), 0, id);
    S.answered = true;
    S.card.classList.add('failed');
    flip(true);
    S.actions.replaceChildren(
      h('p', { class: 'again-note' }, icon('refresh', 16), t('study.again_note')),
      h('button', { class: 'btn btn-primary btn-next', type: 'button', onclick: next }, t('study.next'), icon('arrow', 18)));
    progress();
  }

  function next() {
    if (S.busy) return;
    S.i++;
    if (S.i >= S.queue.length) finish(); else draw();
  }

  function swipe(card) {
    let x0 = null, dx = 0, pid = null;
    const rtlSign = 1;
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      x0 = e.clientX; dx = 0; pid = e.pointerId;
      card.setPointerCapture(pid);
      card.classList.add('dragging');
    });
    card.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      if (S.answered) dx = 0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
      card.style.setProperty('--ok', Math.max(0, Math.min(1, (dx * rtlSign) / 110)));
      card.style.setProperty('--no', Math.max(0, Math.min(1, (-dx * rtlSign) / 110)));
    });
    const end = () => {
      if (x0 === null) return;
      card.classList.remove('dragging');
      card.style.transform = '';
      card.style.setProperty('--ok', 0);
      card.style.setProperty('--no', 0);
      const d = dx;
      x0 = null;
      if (Math.abs(d) > 100 && !S.answered) answer(d > 0);
      else if (Math.abs(d) < 6) (S.answered ? null : flip());
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

    S.wrap.replaceChildren(h('div', { class: 'result' },
      h('div', { class: 'result-emoji' }, pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '🌱'),
      h('h1', { class: 'display' }, t(pct >= 80 ? 'res.great' : pct >= 50 ? 'res.good' : 'res.keep')),
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
