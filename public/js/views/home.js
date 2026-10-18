/* Home: today's summary, my decks and the topic catalogue. */
(() => {
  const A = window.App;
  const { h, icon, t, tn } = A;

  A.views.home = {
    live: true,
    render(root) {
      // a topic's link from the static pages (#/?from=en&learn=nb&topic=food), opened once set up: that topic's deck
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      const linked = A.topics.get(q.get('topic') || '');
      if (linked) {
        history.replaceState(null, '', location.pathname + '#/');
        const learn = q.get('learn');
        if (A.langs.has(learn) && learn !== A.store.settings.target && learn !== A.store.settings.native) A.store.set({ target: learn });
        openTopic(linked);
        return;
      }
      const s = A.store.settings;
      const decks = A.store.decks();
      const o = A.store.overview();
      const newToday = Math.min(o.fresh, o.newLeft);
      const todo = Math.min(s.sessionSize, o.due + newToday);
      const L = A.langs.get(s.target);

      let title, lede;
      if (!decks.length || !o.total) { title = t('home.title_start'); lede = t('home.lede_start'); }
      else if (todo) {
        title = t('home.title_study');
        lede = o.due && newToday ? t('home.lede_study', { due: o.due, new: newToday })
          : o.due ? t('home.lede_due', { due: o.due }) : t('home.lede_new', { new: newToday });
      }
      else { title = t('home.title_done'); lede = t('home.lede_done'); }

      const hero = h('section', { class: 'hero' },
        h('div', { class: 'hero-main' },
          L.hello ? h('p', { class: 'hello' }, h('span', { class: 'hello-word serif', lang: s.target, dir: 'auto' }, L.hello + '!'), h('span', { class: 'hello-sub' }, t('home.learning', { lang: L.name }))) : null,
          A.rich(title, 'h1'),
          h('p', { class: 'lede' }, lede),
          h('div', { class: 'row gap' },
            todo
              ? h('a', { class: 'btn btn-primary btn-lg', href: '#/study' }, t('home.start'), h('span', { class: 'btn-count' }, todo), icon('arrow', 18))
              : h('a', { class: 'btn btn-primary btn-lg', href: '#catalog', onclick: scrollToCatalog }, icon('plus', 18), t('home.add_topic')),
            // the second way gives way to the session: a quieter button
            todo ? h('a', { class: 'btn btn-ghost hero-more', href: '#catalog', onclick: scrollToCatalog }, icon('plus', 16), t('home.add_topic')) : null)),
        statsCard(o));
      hero.querySelector('h1').className = 'display';

      root.append(hero);
      if (decks.length) root.append(decksSection(decks));
      root.append(catalog(decks));
    },
  };

  function scrollToCatalog(e) {
    e.preventDefault();
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function statsCard(o) {
    const streak = A.store.streak();
    const ui = A.i18n.lang();
    let fmt;
    try { fmt = new Intl.DateTimeFormat(ui, { weekday: 'narrow' }); } catch { fmt = new Intl.DateTimeFormat('en', { weekday: 'narrow' }); }
    return h('aside', { class: 'stats-card' },
      h('div', { class: 'streak' },
        h('span', { class: 'streak-ico' + (streak ? ' lit' : '') }, icon('flame', 26)),
        // no streak yet: an invitation instead of a big 0
        streak ? h('div', null, h('b', { class: 'streak-n' }, streak), h('span', { class: 'streak-l' }, tn('n_days_streak', streak)))
          : h('div', null, h('b', { class: 'streak-start' }, t('streak.start')))),
      h('div', { class: 'week' }, A.store.week().map((d) =>
        h('div', { class: 'wd' + (d.rev ? ' done' : '') + (d.today ? ' today' : ''), title: d.date.toLocaleDateString(ui) + ' · ' + d.rev },
          h('i'), h('small', null, fmt.format(d.date))))),
      h('div', { class: 'mini-stats' },
        stat(o.due, t('stats.due'), o.due ? 'due' : ''), // red only when something is waiting
        stat(o.known, t('stats.known')),
        stat(o.total, t('stats.total'))),
      goalLine(),
      h('a', { class: 'stats-link', href: '#/stats' }, icon('stats', 16), t('stats.open')));
  }
  function goalLine() {
    const goal = A.store.settings.goal || 20, done = A.store.today().rev;
    return h('div', { class: 'goal-line', title: t('goal.title') },
      icon(done >= goal ? 'check' : 'target', 16),
      h('span', null, t('goal.today', { done: Math.min(done, goal), goal })),
      h('div', { class: 'meter' }, h('i', { style: `width:${Math.min(100, (done / goal) * 100)}%` })));
  }
  const stat = (n, label, cls = '') => h('div', { class: 'mini ' + cls }, h('b', null, n), h('span', null, label));

  function decksSection(decks) {
    return h('section', { class: 'block' },
      h('div', { class: 'block-head' },
        h('h2', null, t('home.my_decks')),
        h('span', { class: 'muted' }, tn('n_decks', decks.length))),
      h('div', { class: 'deck-grid' }, decks.map(deckTile)));
  }

  function deckTile(d) {
    const o = A.store.overview(d.id);
    const job = A.jobs.state(d.id);
    const pct = o.total ? Math.round((o.known / o.total) * 100) : 0;
    return h('a', { class: 'deck', href: '#/deck/' + d.id, style: `--tab: var(--t-${d.group || 'custom'})` },
      h('i', { class: 'deck-paper', 'aria-hidden': 'true' }),
      h('div', { class: 'deck-top' },
        h('span', { class: 'deck-emoji' }, A.media.face(d)),
        d.level ? h('span', { class: 'deck-level' }, d.level) : null),
      h('div', { class: 'deck-title' }, A.deckTitle(d)),
      h('div', { class: 'deck-meta' }, job ? h('span', { class: 'gen' }, h('i', { class: 'spin' }), job.label) : tn('n_words', o.total)),
      h('div', { class: 'bar', title: pct + '%' }, h('i', { style: `width:${pct}%` })),
      h('div', { class: 'deck-foot' },
        h('span', null, t('deck.known_n', { n: o.known })),
        o.due ? h('span', { class: 'pill due' }, t('deck.due_n', { n: o.due }))
          : o.fresh ? h('span', { class: 'pill' }, t('deck.new_n', { n: o.fresh })) : null));
  }

  function catalog(decks) {
    const s = A.store.settings;
    const have = new Set(decks.filter((d) => d.topic && d.level === s.level).map((d) => d.topic));

    // your own topic: words for it, or phrases for a situation ("at the pharmacy")
    let kind = 'words';
    const custom = h('input', { class: 'input', placeholder: t('cat.custom_ph'), maxlength: 80 });
    const kindSel = A.segmented([{ value: 'words', label: t('cat.kind_words') }, { value: 'phrases', label: t('cat.kind_phrases') }], kind, (v) => {
      kind = v;
      custom.placeholder = t(v === 'phrases' ? 'cat.phrases_ph' : 'cat.custom_ph');
    });
    const customForm = h('form', {
      class: 'custom-topic',
      onsubmit: (e) => {
        e.preventDefault();
        const v = custom.value.trim();
        if (!v) { custom.focus(); return; }
        const d = A.store.addDeck({ title: v, emoji: kind === 'phrases' ? '💬' : '✨', group: 'custom', level: s.level, ...(kind === 'phrases' ? { phrases: 1 } : {}) });
        A.go('#/deck/' + d.id);
        A.jobs.generate(d.id);
      },
    }, h('span', { class: 'custom-ico' }, icon('sparkle')), custom, h('button', { class: 'btn btn-primary', type: 'submit' }, t('cat.create')));
    // ready situations: phrases asked for by their English name, so everybody shares one bank for each
    const SITUATIONS = [['pharmacy', '💊', 'at the pharmacy'], ['cafe', '☕', 'ordering in a café or restaurant'], ['doctor', '🩺', 'at the doctor'],
      ['shop', '🛒', 'shopping in a store'], ['transport', '🚌', 'taking a bus, train or taxi'], ['hotel', '🏨', 'checking in at a hotel'],
      ['interview', '💼', 'a job interview'], ['meeting', '👋', 'meeting someone new'], ['phone', '📞', 'a phone call'], ['help', '🆘', 'asking for help or directions']];
    const openSituation = ([id, emoji, en]) => {
      const existing = A.store.decks().find((d) => d.phrases === en && d.level === s.level);
      if (existing) { A.go('#/deck/' + existing.id); return; }
      const d = A.store.addDeck({ title: t('sit.' + id), emoji, group: 'custom', level: s.level, phrases: en });
      A.go('#/deck/' + d.id);
      A.jobs.generate(d.id);
    };
    const haveSit = new Set(decks.filter((d) => typeof d.phrases === 'string' && d.level === s.level).map((d) => d.phrases));

    return h('section', { class: 'block catalog', id: 'catalog' },
      h('div', { class: 'block-head wrap' },
        h('div', null,
          h('h2', null, t('cat.title')),
          h('p', { class: 'muted' }, t('cat.lede'))),
        h('div', { class: 'cat-controls' },
          h('label', { class: 'ctl' }, h('span', null, t('cat.level')),
            A.segmented(['A1', 'A2', 'B1', 'B2', 'C1'], s.level, (v) => { A.store.set({ level: v }); A.refresh(); })),
          h('label', { class: 'ctl' }, h('span', null, t('cat.count')),
            A.segmented([10, 20, 30], s.batch, (v) => A.store.set({ batch: v }))))),
      h('div', { class: 'row gap wrap custom-kind' }, kindSel),
      customForm,
      h('div', { class: 'cat-group', style: '--tab: var(--t-custom)' },
        h('h3', { class: 'cat-label' }, t('cat.situations')),
        h('div', { class: 'chips' }, SITUATIONS.map((x) => h('button', { class: 'topic' + (haveSit.has(x[2]) ? ' have' : ''), type: 'button', onclick: () => openSituation(x) },
          h('span', { class: 'topic-emoji' }, x[1]), h('span', null, t('sit.' + x[0])), haveSit.has(x[2]) ? icon('check', 16) : null)))),
      A.topics.groups.map((g) =>
        h('div', { class: 'cat-group', style: `--tab: var(--t-${g.id})` },
          h('h3', { class: 'cat-label' }, t('group.' + g.id)),
          h('div', { class: 'chips' }, g.items.map((tp) =>
            h('button', {
              class: 'topic' + (have.has(tp.id) ? ' have' : ''), type: 'button',
              onclick: () => openTopic(tp),
            },
              h('span', { class: 'topic-emoji' }, tp.emoji),
              h('span', null, t('topic.' + tp.id)),
              have.has(tp.id) ? icon('check', 16) : null))))),
      h('div', { class: 'manual' },
        h('button', {
          class: 'link-btn', type: 'button',
          onclick: async () => {
            // a name already typed into the topic field above is not asked for again
            const name = custom.value.trim() || await A.prompt(t('cat.empty_title'), { placeholder: t('cat.empty_ph'), ok: t('cat.create') });
            if (!name) return;
            const d = A.store.addDeck({ title: name, emoji: '📝', group: 'custom', manual: true });
            A.go('#/deck/' + d.id);
          },
        }, icon('plus', 16), t('cat.empty')),
        h('button', { class: 'link-btn', type: 'button', onclick: () => A.anki.pick() }, icon('anki', 16), t('anki.import')),
        h('a', { class: 'link-btn', href: '#/library' }, icon('globe', 16), t('lib.title_plain')),
        h('button', { class: 'link-btn', type: 'button', onclick: () => A.openLink.ask() }, icon('external', 16), t('open.action'))));
  }

  function openTopic(tp) {
    const s = A.store.settings;
    const existing = A.store.decks().find((d) => d.topic === tp.id && d.level === s.level);
    if (existing) { A.go('#/deck/' + existing.id); return; }
    const d = A.store.addDeck({ topic: tp.id, emoji: tp.emoji, group: tp.group, level: s.level });
    A.go('#/deck/' + d.id);
    A.jobs.generate(d.id);
    A.media.autoCover(d.id);
  }
})();
