/* A deck: the word list, adding words, generating new ones, editing. */
(() => {
  const A = window.App;
  const { h, icon, t, tn } = A;
  let filter = '';

  A.views.deck = {
    live: true,
    render(root, [id]) {
      const d = A.store.deck(id);
      if (!d) { location.replace('#/'); return; }
      const s = A.store.settings;
      const o = A.store.overview(id);
      const job = A.jobs.state(id);
      const cards = A.store.cards(id).sort((a, b) => a.created - b.created);
      const newToday = Math.min(o.fresh, Math.max(o.newLeft, 0));
      const studyN = Math.min(s.sessionSize, o.due + newToday);

      const head = h('section', { class: 'deck-head', style: `--tab: var(--t-${d.group || 'custom'})` },
        h('a', { class: 'back', href: '#/' }, icon('back', 18), t('deck.back')),
        h('div', { class: 'deck-hero' },
          h('span', { class: 'deck-hero-emoji' }, d.emoji || '🗂️'),
          h('div', { class: 'deck-hero-text' },
            h('h1', { class: 'display sm' }, A.deckTitle(d)),
            h('p', { class: 'muted' },
              [d.level, tn('n_words', o.total), t('deck.known_n', { n: o.known }), o.due ? t('deck.due_n', { n: o.due }) : null].filter(Boolean).join(' · ')))),
        h('div', { class: 'row gap wrap' },
          studyN
            ? h('a', { class: 'btn btn-primary', href: '#/study/' + id }, icon('cards', 18), t('deck.study'), h('span', { class: 'btn-count' }, studyN))
            : o.fresh
              ? h('a', { class: 'btn btn-primary', href: `#/study/${id}?extra=10` }, icon('cards', 18), t('deck.study_more'))
              : o.total ? h('a', { class: 'btn btn-primary', href: `#/study/${id}?cram=1` }, icon('flip', 18), t('deck.cram')) : null,
          h('button', { class: 'btn btn-soft', type: 'button', disabled: !!job, onclick: () => A.jobs.generate(id) },
            icon('sparkle', 18), t('deck.more', { n: s.batch })),
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => editCard(null, id) }, icon('plus', 18), t('deck.add_word')),
          h('span', { class: 'grow' }),
          h('button', { class: 'icon-btn', type: 'button', title: t('deck.tools'), 'aria-label': t('deck.tools'), onclick: () => A.deckTools.menu(d) }, icon('more')),
          d.topic ? null : h('button', {
            class: 'icon-btn', type: 'button', title: t('deck.rename'), 'aria-label': t('deck.rename'),
            onclick: async () => {
              const v = await A.prompt(t('deck.rename'), { value: A.deckTitle(d) });
              if (v) { A.store.updateDeck(id, { title: v, kind: undefined }); A.refresh(); }
            },
          }, icon('edit')),
          h('button', {
            class: 'icon-btn danger', type: 'button', title: t('deck.delete'), 'aria-label': t('deck.delete'),
            onclick: async () => {
              if (await A.confirm(t('deck.delete_q', { name: A.deckTitle(d) }), { ok: t('deck.delete'), danger: true })) {
                A.store.deleteDeck(id);
                A.go('#/');
              }
            },
          }, icon('trash'))));

      root.append(head);

      if (job) {
        root.append(h('div', { class: 'gen-banner' }, h('i', { class: 'spin' }), h('span', null, job.label)));
      }

      if (!cards.length) {
        root.append(job
          ? h('div', { class: 'word-list' }, Array.from({ length: 6 }, () => h('div', { class: 'wrow ghost' }, h('i'), h('i'), h('i'))))
          : h('div', { class: 'empty' },
            h('div', { class: 'empty-emoji' }, '🃏'),
            h('h3', null, t('deck.empty')),
            h('p', { class: 'muted' }, t('deck.empty_hint')),
            h('div', { class: 'row gap center' },
              h('button', { class: 'btn btn-primary', type: 'button', onclick: () => A.jobs.generate(id) }, icon('sparkle', 18), t('deck.more', { n: s.batch })),
              h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => editCard(null, id) }, icon('plus', 18), t('deck.add_word')))));
        return;
      }

      const list = h('div', { class: 'word-list' });
      const search = h('input', { class: 'input search-sm', type: 'search', placeholder: t('deck.filter'), value: filter });
      const draw = () => {
        const f = A.store.norm(filter);
        const shown = f ? cards.filter((c) => A.store.norm(c.term).includes(f) || c.tr.toLowerCase().includes(filter.toLowerCase())) : cards;
        list.replaceChildren(...shown.map((c) => row(c, s)));
        if (!shown.length) list.append(h('p', { class: 'muted center pad' }, t('deck.nothing')));
      };
      search.addEventListener('input', () => { filter = search.value; draw(); });
      draw();

      root.append(
        h('div', { class: 'list-head' },
          h('h2', null, t('deck.words')),
          h('div', { class: 'legend' },
            ['new', 'learning', 'known', 'mastered'].map((st) => h('span', { class: 'lg st-' + st }, h('i'), t('stage.' + st)))),
          search),
        list);
    },
  };

  // words that came from the shared bank can be reported, so they get replaced for everyone;
  // a word the person typed in (or took from the dictionary, a text, a file) has nothing to report
  function wordReport(c) {
    const d = A.store.deck(c.deck);
    if (!d || d.manual || d.kind === 'mine' || !(d.topic || d.title) || !A.store.fromBank(c)) return null;
    return A.reportBtn('word', { topic: d.topic || undefined, custom: d.topic ? undefined : d.title, level: d.level || 'A1', term: c.term });
  }

  function pips(box) {
    const max = A.store.MAX_BOX;
    return h('span', { class: 'pips st-' + A.store.stage(box), title: t('stage.' + A.store.stage(box)) },
      Array.from({ length: max }, (_, i) => h('i', { class: i < box ? 'on' : '' })));
  }

  function row(c, s) {
    const ex = A.store.example(c);
    const { gram, pron, forms } = A.store.shown(c);
    const detail = h('div', { class: 'wdetail' },
      c.img ? A.media.el(c, 'wrow-img') : null,
      gram || c.pos ? h('p', null, h('span', { class: 'k' }, t('card.gram')), [c.pos ? t('pos.' + c.pos) : '', gram].filter(Boolean).join(' · ')) : null,
      forms ? h('p', null, h('span', { class: 'k' }, t('card.forms')), A.lt(forms, s.target, 'serif')) : null,
      ex.text ? h('p', null, h('span', { class: 'k' }, t('card.example')), A.lt(ex.text, s.target, 'serif'), A.speakBtn(ex.text, s.target, 'sm'), ex.tr ? h('span', { class: 'muted d-block' }, ex.tr) : null) : null,
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => editCard(c, c.deck) }, icon('edit', 16), t('common.edit')),
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/dict/' + encodeURIComponent(c.term.replace(/^(en|ei|et|å|der|die|das|la|le|el|the|to)\s+/i, '')) }, icon('book', 16), t('card.in_dict')),
        c.box ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { A.store.resetCard(c.id); A.refresh(); } }, icon('refresh', 16), t('card.reset')) : null,
        h('button', {
          class: 'btn btn-ghost btn-sm', type: 'button', title: t(c.sus ? 'card.unsuspend_d' : 'card.suspend_d'),
          onclick: () => { A.store.suspend(c.id, !c.sus); A.toast(t(c.sus ? 'card.suspended' : 'card.unsuspended')); A.refresh(); },
        }, icon(c.sus ? 'play' : 'pause', 16), t(c.sus ? 'card.unsuspend' : 'card.suspend')),
        wordReport(c),
        h('span', { class: 'grow' }),
        h('button', {
          class: 'btn btn-ghost btn-sm danger', type: 'button',
          onclick: () => { A.store.deleteCard(c.id); A.toast(t('card.deleted')); A.refresh(); },
        }, icon('trash', 16), t('common.delete'))));
    const el = h('details', { class: 'wrow' + (c.sus ? ' sus' : '') },
      h('summary', null,
        A.speakBtn(c.term, s.target),
        h('span', { class: 'w-term' }, A.lt(c.term, s.target, 'serif'), pron ? h('small', null, pron) : null),
        A.lt(c.tr, s.native, 'w-tr'),
        c.sus ? h('span', { class: 'pill muted-pill', title: t('card.suspend_d') }, icon('pause', 12), t('card.set_aside'))
          : c.leech ? h('span', { class: 'pill leech-pill', title: t('card.leech_d') }, t('card.leech')) : null,
        pips(c.box),
        h('span', { class: 'w-caret' }, icon('chevron', 18))),
      detail);
    return el;
  }

  /* The add/edit card modal, with AI autofill */
  function editCard(card, deckId) {
    const s = A.store.settings;
    const f = {};
    const field = (key, label, lang, opts = {}) => {
      const input = h(opts.area ? 'textarea' : 'input', { class: 'input', lang, dir: 'auto', value: card?.[key] || '', rows: opts.area ? 2 : null, placeholder: opts.ph || '' });
      if (opts.area) input.value = card?.[key] || '';
      f[key] = input;
      return h('label', { class: 'field' + (opts.half ? ' half' : '') }, h('span', null, label), input);
    };
    const T = A.langs.name(s.target), N = A.langs.name(s.native);
    const fillBtn = h('button', { class: 'btn btn-soft btn-sm', type: 'button' }, icon('sparkle', 16), t('card.autofill'));
    fillBtn.addEventListener('click', async () => {
      const term = f.term.value.trim(), tr = f.tr.value.trim();
      if (!term && !tr) { A.toast(t('card.need_one')); f.term.focus(); return; }
      fillBtn.disabled = true;
      fillBtn.lastChild.textContent = t('card.filling');
      try {
        const w = await A.ai.fill({ term, tr });
        for (const [k, src] of [['term', 'term'], ['tr', 'tr'], ['pron', 'pron'], ['gram', 'gram'], ['forms', 'forms'], ['ex', 'ex'], ['exTr', 'ex_tr']]) {
          if (w[src] && (!f[k].value.trim() || k === 'term')) f[k].value = w[src];
        }
        f.pos = w.pos || '';
      } catch (e) { A.toast(A.ai.errorText(e), 'error'); }
      fillBtn.disabled = false;
      fillBtn.lastChild.textContent = t('card.autofill');
    });

    const pic = { img: card?.img || '', imgUrl: card?.imgUrl || '', imgBy: card?.imgBy || '' };
    const picture = pictureField(pic, () => f.term.value.trim(), () => f.tr.value.trim());

    const body = h('div', { class: 'form-grid' },
      field('term', `${t('card.term')} · ${T}`, s.target, { ph: t('card.term_ph') }),
      field('tr', `${t('card.translation')} · ${N}`, s.native),
      h('div', { class: 'fill-row' }, fillBtn, h('small', { class: 'muted' }, t('card.autofill_hint'))),
      picture.el,
      field('pron', t('card.pron'), s.target, { half: true }),
      field('gram', t('card.gram'), s.native, { half: true }),
      field('forms', t('card.forms'), s.target),
      field('ex', t('card.example'), s.target, { area: true }),
      field('exTr', t('card.example_tr'), s.native, { area: true }));

    const save = () => {
      const data = {};
      for (const k of ['term', 'tr', 'pron', 'gram', 'forms', 'ex', 'exTr']) data[k] = f[k].value.trim();
      if (!data.term || !data.tr) { A.toast(t('card.need_both'), 'error'); return; }
      if (typeof f.pos === 'string') data.pos = f.pos;
      Object.assign(data, { img: pic.img, imgUrl: pic.imgUrl, imgBy: pic.imgBy });
      if (card) A.store.updateCard(card.id, data);
      else {
        const n = A.store.addCards(deckId, [{ ...data, src: 'user' }]);
        if (!n) { A.toast(t('card.duplicate'), 'error'); return; }
      }
      m.close();
      A.toast(card ? t('card.saved') : t('card.added'), 'ok');
      A.refresh();
    };
    const m = A.modal({
      title: card ? t('card.edit_title') : t('card.add_title'),
      body,
      wide: true,
      onClose: picture.stop,
      actions: [
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: save }, t('common.save')),
      ],
    });
    setTimeout(() => f.term.focus(), 30);
  }
  A.editCard = editCard;

  /* The picture of a card: a free one found by the word, one of your own (a file or the camera), or pasted.
     pic is changed in place: { img, imgUrl, imgBy }. */
  function pictureField(pic, term, tr) {
    const s = A.store.settings;
    const preview = h('div', { class: 'pic-preview' });
    const credit = h('small', { class: 'pic-credit muted' });
    const results = h('div', { class: 'pic-results' });
    const status = h('p', { class: 'muted small', hidden: true });
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const bare = (x) => x.replace(/^(en|ei|et|ein|eit|der|die|das|le|la|les|el|los|las|il|lo|gli|the|an?|to|å)\s+/i, '');
    const q = h('input', { class: 'input', type: 'search', placeholder: t('card.pic_search_ph') });
    const panel = h('div', { class: 'pic-search', hidden: true },
      h('form', { class: 'row gap', onsubmit: (e) => { e.preventDefault(); find(); } }, q, h('button', { class: 'btn btn-soft btn-sm', type: 'submit', 'aria-label': t('card.pic_find') }, icon('search', 16))),
      h('small', { class: 'muted' }, t('card.pic_hint')), status, results);

    const remove = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => set('') }, icon('trash', 16), t('card.pic_remove'));
    const paint = () => {
      preview.replaceChildren();
      credit.textContent = pic.imgBy ? t('card.pic_by', { by: pic.imgBy }) : '';
      remove.hidden = !pic.img;
      const im = pic.img ? A.media.el(pic, 'pic-img') : null;
      preview.append(im || h('span', { class: 'pic-empty' }, icon('image', 28)));
    };
    const set = (img, imgUrl = '', imgBy = '') => { Object.assign(pic, { img, imgUrl, imgBy }); paint(); };
    const say = (text) => { status.hidden = !text; status.textContent = text || ''; };

    async function find() {
      const query = q.value.trim();
      if (!query) { q.focus(); return; }
      say(t('card.pic_searching'));
      results.replaceChildren();
      try {
        const list = await A.media.search(query);
        say(list.length ? '' : t('card.pic_none'));
        results.replaceChildren(...list.map((r) => h('button', {
          class: 'pic-thumb', type: 'button', title: `${r.by} · ${r.license}`,
          onclick: async (e) => {
            const b = e.currentTarget;
            b.classList.add('loading');
            try { set(await A.media.addUrl(r.thumb), r.thumb, `${r.by} · ${r.license}`); panel.hidden = true; } catch { A.toast(t('card.pic_failed'), 'error'); }
            b.classList.remove('loading');
          },
        }, h('img', { src: '/api/img?u=' + encodeURIComponent(r.thumb), alt: r.by, loading: 'lazy' }))));
      } catch (e) { say(A.ai.errorText(e)); }
    }
    async function own(blob) {
      try { set(await A.media.add(blob)); panel.hidden = true; } catch { A.toast(t('card.pic_failed'), 'error'); }
    }
    file.addEventListener('change', () => { const b = file.files?.[0]; if (b) own(b); file.value = ''; });
    const onPaste = (e) => {
      const it = [...(e.clipboardData?.items || [])].find((x) => x.type.startsWith('image/'));
      if (it) { e.preventDefault(); own(it.getAsFile()); }
    };
    document.addEventListener('paste', onPaste);

    const el = h('div', { class: 'field pic-field' },
      h('span', null, t('card.picture')),
      h('div', { class: 'pic-row' }, preview,
        h('div', { class: 'pic-actions' },
          h('button', {
            class: 'btn btn-soft btn-sm', type: 'button',
            onclick: () => {
              panel.hidden = !panel.hidden;
              if (!panel.hidden && !q.value) { q.value = s.native === 'en' ? tr() : bare(term()) || tr(); if (q.value) find(); }
            },
          }, icon('search', 16), t('card.pic_find')),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => file.click() }, icon('upload', 16), t('card.pic_upload')),
          remove,
          h('small', { class: 'muted' }, t('card.pic_paste')))),
      credit, panel, file);
    paint();
    return { el, stop: () => document.removeEventListener('paste', onPaste) };
  }
})();
