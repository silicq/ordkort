/* Главная: сводка на сегодня, мои колоды и каталог тем. */
(() => {
  const A = window.App;
  const { h, icon, t, tn } = A;

  A.views.home = {
    live: true,
    render(root) {
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
            todo ? h('a', { class: 'btn btn-ghost btn-lg', href: '#catalog', onclick: scrollToCatalog }, t('home.add_topic')) : null)),
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
        h('div', null, h('b', { class: 'streak-n' }, streak), h('span', { class: 'streak-l' }, tn('n_days_streak', streak)))),
      h('div', { class: 'week' }, A.store.week().map((d) =>
        h('div', { class: 'wd' + (d.rev ? ' done' : '') + (d.today ? ' today' : ''), title: d.date.toLocaleDateString(ui) + ' · ' + d.rev },
          h('i'), h('small', null, fmt.format(d.date))))),
      h('div', { class: 'mini-stats' },
        stat(o.due, t('stats.due'), 'due'),
        stat(o.known, t('stats.known')),
        stat(o.total, t('stats.total'))));
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
        h('span', { class: 'deck-emoji' }, d.emoji || '🗂️'),
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

    const custom = h('input', { class: 'input', placeholder: t('cat.custom_ph'), maxlength: 80 });
    const customForm = h('form', {
      class: 'custom-topic',
      onsubmit: (e) => {
        e.preventDefault();
        const v = custom.value.trim();
        if (!v) { custom.focus(); return; }
        const d = A.store.addDeck({ title: v, emoji: '✨', group: 'custom', level: s.level });
        A.go('#/deck/' + d.id);
        A.jobs.generate(d.id);
      },
    }, h('span', { class: 'custom-ico' }, icon('sparkle')), custom, h('button', { class: 'btn btn-primary', type: 'submit' }, t('cat.create')));

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
      customForm,
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
            const name = await A.prompt(t('cat.empty_title'), { placeholder: t('cat.empty_ph'), ok: t('cat.create') });
            if (!name) return;
            const d = A.store.addDeck({ title: name, emoji: '📝', group: 'custom', manual: true });
            A.go('#/deck/' + d.id);
          },
        }, icon('plus', 16), t('cat.empty'))));
  }

  function openTopic(tp) {
    const s = A.store.settings;
    const existing = A.store.decks().find((d) => d.topic === tp.id && d.level === s.level);
    if (existing) { A.go('#/deck/' + existing.id); return; }
    const d = A.store.addDeck({ topic: tp.id, emoji: tp.emoji, group: tp.group, level: s.level });
    A.go('#/deck/' + d.id);
    A.jobs.generate(d.id);
  }
})();
