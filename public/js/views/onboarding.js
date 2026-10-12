/* First run: the language I know → the one I learn → level → first topics. */
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

  // a link from the static pages may say what the visitor knows and learns, the topic and where to go after setup:
  // #/dict/hus?from=ru&learn=nb or #/?from=uk&learn=nb&topic=food
  function invited() {
    const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
    const q = new URLSearchParams(qs || '');
    const lang = (k) => (A.langs.has(q.get(k)) ? q.get(k) : null);
    const topic = A.topics.get(q.get('topic') || '') ? q.get('topic') : null;
    return { native: lang('from'), target: lang('learn'), topic, after: /^dict\/[^/]+$/.test(path) ? '#/' + path : null };
  }

  A.views.onboarding = {
    render(root) {
      const inv = invited();
      const st = { step: 0, native: inv.native || guess(), target: null, level: 'A1', topics: new Set(['greetings', 'core', 'numbers']) };
      if (inv.target && inv.target !== st.native) st.target = inv.target;
      if (inv.topic) st.topics = new Set([inv.topic, 'greetings', 'core']);
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

      // three cards to try before choosing anything: a tap turns one over to its translation and an example
      const SAMPLES = [
        ['nb', 'et hus', 'Vi bor i et rødt hus.'],
        ['es', 'la mariposa', 'La mariposa vuela.'],
        ['zh', '朋友', '他是我的好朋友。'],
      ];
      const miniCard = ([lang, word, example], i) => {
        const card = h('button', {
          class: `mini-card c${i + 1}`, type: 'button', 'aria-pressed': 'false',
          onclick: () => card.setAttribute('aria-pressed', String(card.classList.toggle('flipped'))),
        },
          h('span', { class: 'mini-in' },
            h('span', { class: 'mini-face' },
              h('span', { class: 'serif', lang }, word),
              h('small', { lang }, A.langs.name(lang))),
            h('span', { class: 'mini-face mini-back' },
              h('span', { class: 'serif' }, t(`onb.c${i + 1}`)),
              h('small', { class: 'mini-ex', lang }, example))));
        return card;
      };

      const steps = [
        () => h('section', { class: 'onb-hero' },
          h('div', { class: 'onb-cards' }, SAMPLES.map(miniCard), h('p', { class: 'onb-tap' }, t('onb.tap'))),
          A.rich(t('onb.title'), 'h1'),
          h('p', { class: 'lede' }, t('onb.lede')),
          h('ul', { class: 'onb-feats' },
            h('li', null, icon('cards'), h('span', null, t('onb.f1'))),
            h('li', null, icon('book'), h('span', null, t('onb.f2'))),
            h('li', null, icon('grammar'), h('span', null, t('onb.f3'))),
            h('li', null, icon('translate'), h('span', null, t('onb.f4')))),
          h('div', { class: 'row gap wrap' },
            h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => { st.step = st.target ? 3 : 1; draw(); } }, t('onb.start'), icon('arrow', 18)),
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
        location.hash = inv.after || '#/';
        A.route();
        A.i18n.ensure();
        ids.forEach((id) => A.jobs.generate(id));
      }

      draw();
    },
  };
})();
