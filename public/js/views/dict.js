/* Словарь: статья в духе ordbokene.no и Lexin + официальные данные ordbokene для норвежского. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  let seq = 0;
  let ctrl = null;
  let forceNext = null;

  A.views.dict = {
    render(root, [q]) {
      const s = A.store.settings;
      const T = s.target, N = s.native;
      const query = (q || '').trim();

      const input = h('input', {
        class: 'search-input', type: 'search', name: 'q', value: query, autocomplete: 'off', spellcheck: 'false',
        placeholder: t('dict.placeholder', { a: A.langs.name(T), b: A.langs.name(N) }), 'aria-label': t('dict.search'),
      });
      const sugg = h('div', { class: 'suggest', hidden: true });
      const form = h('form', { class: 'search', role: 'search', onsubmit: (e) => { e.preventDefault(); go(input.value); } },
        h('span', { class: 'search-ico' }, icon('search', 22)), input,
        h('button', { class: 'btn btn-primary', type: 'submit' }, t('dict.search')), sugg);

      if (A.ordbok.supports(T)) {
        let sc = null;
        const load = A.debounce(async () => {
          const v = input.value.trim();
          sc?.abort();
          if (v.length < 2) { sugg.hidden = true; return; }
          sc = new AbortController();
          try {
            const list = await A.ordbok.suggest(v, T, sc.signal);
            sugg.replaceChildren(...list.map((w) => h('button', { type: 'button', lang: T, onmousedown: (e) => { e.preventDefault(); go(w); } }, w)));
            sugg.hidden = !list.length || document.activeElement !== input;
          } catch { sugg.hidden = true; }
        }, 180);
        input.addEventListener('input', load);
        input.addEventListener('blur', () => setTimeout(() => { sugg.hidden = true; }, 120));
      }

      const recent = A.store.recent().filter((r) => r.toLowerCase() !== query.toLowerCase());
      A.add(root,
        h('section', { class: 'page-head' },
          A.rich(t('dict.title'), 'h1'),
          h('p', { class: 'lede' }, t('dict.lede', { lang: A.langs.name(T) }))),
        form,
        recent.length ? h('div', { class: 'recent' }, h('span', { class: 'muted small' }, t('dict.recent')),
          recent.map((r) => h('a', { class: 'chip', href: '#/dict/' + encodeURIComponent(r), lang: T }, r))) : null);
      root.querySelector('.page-head h1').className = 'display';

      const out = h('div', { class: 'dict-out' });
      root.append(out);
      if (query) lookup(query, out);
      else intro(out, T);
      if (!query) setTimeout(() => input.focus(), 50);
    },
    leave() { ctrl?.abort(); },
  };

  function go(q) {
    q = (q || '').trim();
    if (!q) return;
    A.go('#/dict/' + encodeURIComponent(q));
  }

  function intro(out, T) {
    const samples = { nb: ['hus', 'lese', 'glad', 'på', 'å gå'], nn: ['hus', 'lese', 'glad', 'eg', 'kvifor'], en: ['run', 'though', 'bright'], de: ['Haus', 'gehen', 'schön'], es: ['casa', 'ser', 'estar'], fr: ['maison', 'aller', 'beau'] };
    const list = samples[T] || [];
    out.append(h('div', { class: 'dict-intro' },
      h('div', { class: 'intro-card' },
        h('h3', null, t('dict.how_title')),
        h('ul', { class: 'ticks' },
          h('li', null, t('dict.how_1')), h('li', null, t('dict.how_2')), h('li', null, t('dict.how_3')),
          A.ordbok.supports(T) ? h('li', null, t('dict.how_nb')) : null),
        list.length ? h('div', { class: 'row gap wrap' }, h('span', { class: 'muted small' }, t('dict.try')),
          list.map((w) => h('a', { class: 'chip', href: '#/dict/' + encodeURIComponent(w), lang: T }, w))) : null)));
  }

  async function lookup(q, out) {
    const my = ++seq;
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const s = A.store.settings;
    const T = s.target;
    A.store.addRecent(q);

    const aiSlot = h('div', { class: 'slot-ai' }, A.loading(t('dict.loading')), A.skeleton(6));
    const obSlot = A.ordbok.supports(T) ? h('div', { class: 'slot-ob' }, A.skeleton(5)) : null;
    out.replaceChildren(h('div', { class: 'dict-grid' + (obSlot ? ' two' : '') }, aiSlot, obSlot));

    // Официальные данные (норвежский) показываем сразу; сервер сам передаёт их ИИ как опору
    const obPromise = obSlot ? A.ordbok.lookup(q, T, signal).catch(() => null) : Promise.resolve(null);
    if (obSlot) {
      obPromise.then((r) => {
        if (my !== seq) return;
        if (r === null && signal.aborted) return;
        obSlot.replaceChildren(r && r.articles.length ? official(r, q) : h('div', { class: 'official empty-ob' },
          h('div', { class: 'official-head' }, h('span', { class: 'official-badge' }, 'ordbokene.no')),
          h('p', { class: 'muted small' }, t('dict.ob_none'))));
      });
    }

    try {
      const force = forceNext === q;
      forceNext = null;
      const e = await A.ai.lookup(q, { force, signal });
      if (my !== seq) return;
      aiSlot.replaceChildren(e.found === false ? notFound(e, q) : entry(e, q));
      // запрос был на родном языке — показываем официальную статью для найденного перевода
      const ob2 = await obPromise;
      if (obSlot && e.found !== false && e.lemma && !ob2?.articles?.length && e.lemma.toLowerCase() !== q.toLowerCase()) {
        const r = await A.ordbok.lookup(e.lemma, T, signal).catch(() => null);
        if (my === seq && r?.articles?.length) obSlot.replaceChildren(official(r, e.lemma));
      }
    } catch (err) {
      if (my !== seq || err.name === 'AbortError') return;
      aiSlot.replaceChildren(h('div', { class: 'error-box' }, h('p', null, A.ai.errorText(err)),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => lookup(q, out) }, icon('refresh', 16), t('common.retry'))));
    }
  }

  function notFound(e, q) {
    const T = A.store.settings.target;
    return h('div', { class: 'entry' },
      h('h2', { class: 'display sm' }, t('dict.not_found', { q })),
      e.did_you_mean?.length ? h('div', { class: 'row gap wrap' }, h('span', { class: 'muted' }, t('dict.did_you_mean')),
        e.did_you_mean.map((w) => h('a', { class: 'chip', href: '#/dict/' + encodeURIComponent(w), lang: T }, w))) : null);
  }

  const section = (title, ...body) => h('section', { class: 'esec' }, h('h3', { class: 'esec-title' }, title), body);
  const wordChips = (list, T) => h('div', { class: 'chips' }, list.filter(Boolean).map((w) => h('a', { class: 'chip', href: '#/dict/' + encodeURIComponent(w), lang: T }, w)));

  function entry(e, q) {
    const s = A.store.settings;
    const T = s.target, N = s.native;
    const head = [e.article, e.lemma].filter(Boolean).join(' ');

    const addBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, icon('plus', 16), t('dict.add'));
    if (A.store.hasTerm(head)) { addBtn.disabled = true; addBtn.replaceChildren(icon('check', 16), t('dict.in_cards')); }
    addBtn.addEventListener('click', async () => {
      const deckId = await pickDeck();
      if (!deckId) return;
      const ex = e.senses?.[0]?.examples?.[0];
      const forms = [];
      for (const tb of e.inflection || []) for (const r of tb.rows || []) for (const c of r.slice(1)) if (c && !forms.includes(c) && c !== e.lemma && forms.length < 4) forms.push(c);
      const n = A.store.addCards(deckId, [{
        term: head, tr: e.tr || e.senses?.[0]?.tr || '', pos: e.pos, gram: e.pos_label, pron: e.pron,
        forms: forms.join(', '), ex: ex?.text, ex_tr: ex?.tr,
      }]);
      A.toast(n ? t('card.added') : t('card.duplicate'), n ? 'ok' : 'error');
      addBtn.disabled = true;
      addBtn.replaceChildren(icon('check', 16), t('dict.in_cards'));
    });

    return h('article', { class: 'entry' },
      h('div', { class: 'entry-head' },
        h('div', { class: 'entry-hw' },
          h('h2', { class: 'headword serif', lang: T, dir: 'auto' }, e.article ? h('span', { class: 'art' }, e.article + ' ') : null, e.lemma || q),
          h('div', { class: 'entry-sub' },
            e.pron ? h('span', { class: 'pron' }, e.pron) : null,
            e.pos_label ? h('span', { class: 'pill' }, e.pos_label) : null)),
        h('div', { class: 'entry-tools' }, A.speakBtn(e.lemma || q, T, 'lg'), addBtn)),
      e.tr ? h('p', { class: 'entry-tr', lang: N, dir: 'auto' }, e.tr) : null,
      e.alternatives?.length ? h('div', { class: 'alts' }, h('span', { class: 'muted small' }, t('dict.also')),
        e.alternatives.map((a) => h('a', { class: 'chip', href: '#/dict/' + encodeURIComponent(a.lemma) }, A.lt(a.lemma, T, 'serif'), a.tr ? h('small', null, ' — ' + a.tr) : null))) : null,
      e.inflection?.length ? section(t('dict.inflection'), h('div', { class: 'ptables' }, e.inflection.map((tb) => A.table(tb, T)))) : null,
      e.senses?.length ? section(t('dict.senses'), h('ol', { class: 'senses' }, e.senses.map((sn) =>
        h('li', null,
          sn.def ? A.lt(sn.def, T, 'sense-def serif', 'p') : null,
          sn.tr ? A.lt(sn.tr, N, 'sense-tr', 'p') : null,
          sn.examples?.length ? h('ul', { class: 'ex-list' }, sn.examples.map((x) =>
            h('li', null, h('span', { class: 'ex-line' }, A.lt(x.text, T, 'serif ex-t'), A.speakBtn(x.text, T, 'sm')), x.tr ? A.lt(x.tr, N, 'ex-tr', 'span') : null))) : null)))) : null,
      e.expressions?.length ? section(t('dict.expressions'), h('ul', { class: 'expr' }, e.expressions.map((x) =>
        h('li', null, A.lt(x.text, T, 'serif expr-t'), h('span', { class: 'expr-m', lang: N, dir: 'auto' }, x.tr))))) : null,
      e.compounds?.length ? section(t('dict.compounds'), wordChips(e.compounds, T)) : null,
      e.synonyms?.length || e.antonyms?.length ? section(t('dict.related'),
        e.synonyms?.length ? h('div', { class: 'rel' }, h('span', { class: 'k' }, t('dict.synonyms')), wordChips(e.synonyms, T)) : null,
        e.antonyms?.length ? h('div', { class: 'rel' }, h('span', { class: 'k' }, t('dict.antonyms')), wordChips(e.antonyms, T)) : null) : null,
      e.note ? h('div', { class: 'callout' }, icon('bulb', 20), A.rich(e.note, 'div')) : null,
      e.etymology ? h('p', { class: 'etym' }, h('span', { class: 'k' }, t('dict.etymology')), e.etymology) : null,
      h('div', { class: 'entry-foot' },
        h('span', { class: 'muted small' }, icon('sparkle', 14), t('dict.ai_note')),
        h('button', {
          class: 'link-btn small', type: 'button',
          onclick: () => { forceNext = q; A.route(); },
        }, icon('refresh', 14), t('common.regenerate')),
        A.ordbok.supports(T) ? h('a', { class: 'link-btn small', href: A.ordbok.link(e.lemma || q), target: '_blank', rel: 'noopener' }, 'ordbokene.no', icon('external', 14)) : null,
        A.ordbok.supports(T) ? h('a', { class: 'link-btn small', href: A.ordbok.lexin, target: '_blank', rel: 'noopener' }, 'Lexin', icon('external', 14)) : null));
  }

  function official(r, q) {
    const T = A.store.settings.target;
    const senseList = (senses, depth = 0) => h('ol', { class: 'ob-senses' + (depth ? ' sub' : '') }, senses.map((sn) =>
      h('li', null,
        sn.expl.length ? h('p', { class: 'ob-expl' }, sn.expl.join('; ')) : null,
        sn.ex.length ? h('p', { class: 'ob-ex serif', lang: T }, sn.ex.join(' · ')) : null,
        sn.sub?.length ? senseList(sn.sub, depth + 1) : null)));

    return h('aside', { class: 'official' },
      h('div', { class: 'official-head' },
        h('span', { class: 'official-badge' }, r.name),
        h('small', null, t('dict.ob_source'))),
      r.articles.map((a) => h('div', { class: 'oa' },
        h('div', { class: 'oa-head' },
          h('h3', { class: 'serif', lang: T }, a.lemma, a.hgno ? h('sup', null, a.hgno) : null),
          h('span', { class: 'oa-class' }, a.cls)),
        a.table ? A.table(a.table, T) : null,
        a.senses.length ? senseList(a.senses) : null,
        a.expr.length ? h('div', { class: 'ob-block' }, h('h4', null, r.labels.expr),
          h('ul', { class: 'ob-expr' }, a.expr.slice(0, 8).map((x) => h('li', null, h('b', { lang: T }, x.text), x.meaning ? ' — ' + x.meaning : '')))) : null,
        a.etym ? h('p', { class: 'ob-etym' }, h('span', { class: 'k' }, r.labels.etym), a.etym) : null)),
      h('a', { class: 'link-btn small', href: A.ordbok.link(q), target: '_blank', rel: 'noopener' }, t('dict.ob_open'), icon('external', 14)));
  }

  /* Выбор колоды для новой карточки */
  function pickDeck() {
    return new Promise((resolve) => {
      let result = null;
      const decks = A.store.decks();
      const mine = decks.find((d) => d.kind === 'mine');
      const rows = [
        h('button', { class: 'pick-row', type: 'button', onclick: () => { result = (mine || A.store.mineDeck()).id; m.close(); } },
          h('span', { class: 'deck-emoji' }, '📌'), h('span', null, t('deck.mine')), h('small', { class: 'muted' }, t('dict.pick_default'))),
        ...decks.filter((d) => d.kind !== 'mine').map((d) =>
          h('button', { class: 'pick-row', type: 'button', onclick: () => { result = d.id; m.close(); } },
            h('span', { class: 'deck-emoji' }, d.emoji || '🗂️'), h('span', null, A.deckTitle(d)), h('small', { class: 'muted' }, d.level || ''))),
      ];
      const m = A.modal({ title: t('dict.pick_deck'), body: h('div', { class: 'pick-list' }, rows), onClose: () => resolve(result) });
    });
  }
  A.pickDeck = pickDeck;
})();
