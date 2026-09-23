/* Первый запуск: какой язык знаю → какой учу → уровень → первые темы. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;

  const POPULAR = ['en', 'nb', 'es', 'de', 'fr', 'zh', 'ar', 'ru', 'uk', 'it', 'pt', 'ja', 'ko', 'pl', 'tr', 'sv', 'nl', 'hi'];

  function guess() {
    const nav = (navigator.languages || [navigator.language || 'en']).map((l) => l.toLowerCase());
    for (const l of nav) {
      const c = l.split('-')[0];
      if (c === 'no' || c === 'nb') return 'nb';
      if (A.langs.has(c)) return c;
    }
    return 'en';
  }

  A.views.onboarding = {
    render(root) {
      const st = { step: 0, native: guess(), target: null, level: 'A1', topics: new Set(['greetings', 'core', 'numbers']) };
      A.i18n.setRuntime(st.native);
      A.applyLang();

      const draw = () => {
        A.i18n.setRuntime(st.native);
        A.applyLang();
        root.replaceChildren(h('div', { class: 'onb' },
          h('div', { class: 'onb-top' },
            h('div', { class: 'brand' }, A.logo(34), h('span', { class: 'brand-name' }, 'ordkort')),
            st.step ? h('div', { class: 'dots-steps' }, [1, 2, 3, 4].map((i) => h('i', { class: i <= st.step ? 'on' : '' }))) : null),
          steps[st.step]()));
        window.scrollTo(0, 0);
      };

      const back = () => h('button', { class: 'link-btn', type: 'button', onclick: () => { st.step--; draw(); } }, icon('back', 16), t('onb.back'));

      const langGrid = (exclude, onPick, selected) => {
        const q = h('input', { class: 'input', type: 'search', placeholder: t('onb.search') });
        const pop = POPULAR.filter((c) => c !== exclude).map(A.langs.get);
        const rest = A.langs.list.filter((l) => !POPULAR.includes(l.code) && l.code !== exclude);
        const grid = h('div', { class: 'lang-grid' });
        const fill = () => {
          const f = q.value.trim().toLowerCase();
          const list = [...pop, ...rest].filter((l) => !f || l.name.toLowerCase().includes(f) || l.en.toLowerCase().includes(f) || l.code === f);
          grid.replaceChildren(...list.map((l) => h('button', {
            class: 'lang-tile' + (l.code === selected ? ' on' : ''), type: 'button', onclick: () => onPick(l.code),
          },
            h('span', { class: 'lang-hello serif', lang: l.code, dir: 'auto' }, l.hello),
            h('b', { lang: l.code, dir: 'auto' }, l.name),
            h('small', null, l.en))));
        };
        q.addEventListener('input', fill);
        fill();
        return [q, grid];
      };

      const steps = [
        () => h('section', { class: 'onb-hero' },
          h('div', { class: 'onb-cards', 'aria-hidden': 'true' },
            h('div', { class: 'mini-card c1' }, h('span', { class: 'serif' }, 'et hus'), h('small', null, 'hus · house')),
            h('div', { class: 'mini-card c2' }, h('span', { class: 'serif' }, 'la mariposa'), h('small', null, 'butterfly')),
            h('div', { class: 'mini-card c3' }, h('span', { class: 'serif', lang: 'zh' }, '朋友'), h('small', null, 'péngyou · friend'))),
          A.rich(t('onb.title'), 'h1'),
          h('p', { class: 'lede' }, t('onb.lede')),
          h('ul', { class: 'onb-feats' },
            h('li', null, icon('cards'), h('span', null, t('onb.f1'))),
            h('li', null, icon('book'), h('span', null, t('onb.f2'))),
            h('li', null, icon('grammar'), h('span', null, t('onb.f3'))),
            h('li', null, icon('translate'), h('span', null, t('onb.f4')))),
          h('div', { class: 'row gap wrap' },
            h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => { st.step = 1; draw(); } }, t('onb.start'), icon('arrow', 18)),
            h('button', { class: 'btn btn-ghost btn-lg', type: 'button', onclick: () => A.devices.enterCode() }, icon('refresh', 18), t('onb.have_code'))),
          h('p', { class: 'muted small onb-note' }, t('onb.local'), ' ', h('a', { href: '#/about' }, t('foot.about')))),

        () => h('section', { class: 'onb-step' },
          h('h2', { class: 'display sm' }, t('onb.native')),
          h('p', { class: 'muted' }, t('onb.native_hint')),
          langGrid(null, (c) => { st.native = c; if (st.target === c) st.target = null; st.step = 2; draw(); }, st.native),
          back()),

        () => h('section', { class: 'onb-step' },
          h('h2', { class: 'display sm' }, t('onb.target')),
          h('p', { class: 'muted' }, t('onb.target_hint')),
          langGrid(st.native, (c) => { st.target = c; st.step = 3; draw(); }, st.target),
          back()),

        () => h('section', { class: 'onb-step' },
          h('h2', { class: 'display sm' }, t('onb.level', { lang: A.langs.name(st.target) })),
          h('div', { class: 'level-list' }, ['A1', 'A2', 'B1', 'B2', 'C1'].map((lv) =>
            h('button', { class: 'level' + (st.level === lv ? ' on' : ''), type: 'button', onclick: () => { st.level = lv; st.step = 4; draw(); } },
              h('span', { class: 'level-code' }, lv),
              h('span', null, h('b', null, t('level.' + lv)), h('small', null, t('level.' + lv + '_d')))))),
          back()),

        () => {
          const chips = A.topics.groups.flatMap((g) => g.items).map((tp) => {
            const b = h('button', {
              class: 'topic' + (st.topics.has(tp.id) ? ' on' : ''), type: 'button', style: `--tab: var(--t-${tp.group})`,
              onclick: () => {
                if (st.topics.has(tp.id)) st.topics.delete(tp.id);
                else if (st.topics.size < 5) st.topics.add(tp.id);
                else { A.toast(t('onb.max5')); return; }
                b.classList.toggle('on', st.topics.has(tp.id));
                go.disabled = !st.topics.size;
              },
            }, h('span', { class: 'topic-emoji' }, tp.emoji), h('span', null, t('topic.' + tp.id)));
            return b;
          });
          const go = h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: finish }, t('onb.finish'), icon('arrow', 18));
          return h('section', { class: 'onb-step' },
            h('h2', { class: 'display sm' }, t('onb.topics')),
            h('p', { class: 'muted' }, t('onb.topics_hint')),
            h('div', { class: 'chips' }, chips),
            h('div', { class: 'row gap onb-actions' }, go, back()));
        },
      ];

      function finish() {
        A.i18n.setRuntime(null);
        A.store.init({ native: st.native, target: st.target, level: st.level });
        A.persist();
        const ids = [];
        for (const id of st.topics) {
          const tp = A.topics.get(id);
          ids.push(A.store.addDeck({ topic: id, emoji: tp.emoji, group: tp.group, level: st.level }).id);
        }
        location.hash = '#/';
        A.route();
        A.i18n.ensure();
        ids.forEach((id) => A.jobs.generate(id));
      }

      draw();
    },
  };
})();
