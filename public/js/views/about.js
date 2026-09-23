/* «Как это работает»: что где хранится, что куда отправляется, почему есть лимиты. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;

  const SECTIONS = [
    ['local', 'cards'],
    ['ai', 'sparkle'],
    ['limits', 'flame'],
    ['ip', 'info'],
    ['sync', 'refresh'],
    ['transfer', 'upload'],
    ['codes', 'check'],
    ['third', 'globe'],
    ['free', 'grammar'],
  ];

  A.views.about = {
    render(root) {
      const limit = A.ai.quota?.limit || 120;
      A.add(root,
        h('section', { class: 'page-head' },
          A.rich(t('about.title'), 'h1'),
          h('p', { class: 'lede' }, t('about.lede'))),
        h('div', { class: 'about' }, SECTIONS.map(([id, ic]) =>
          h('section', { class: 'about-item', id: 'about-' + id },
            h('span', { class: 'about-ico' }, icon(ic, 20)),
            h('div', null,
              h('h2', null, t(`about.${id}_h`)),
              A.rich(t(`about.${id}_p`, { n: limit }), 'p'),
              id === 'free' && A.config.repoUrl
                ? h('a', { class: 'link-btn', href: A.config.repoUrl, target: '_blank', rel: 'noopener' }, t('about.source'), icon('external', 14))
                : null)))),
        h('div', { class: 'row gap wrap about-foot' },
          h('a', { class: 'btn btn-primary', href: A.store.ready ? '#/' : '#/' }, t('sync.open_cards')),
          A.store.ready ? h('a', { class: 'btn btn-ghost', href: '#/settings' }, icon('settings', 18), t('nav.settings')) : null));
      root.querySelector('.page-head h1').className = 'display';
    },
  };

  /* Подключение по ссылке из QR-кода: #/link/КОД. Всегда с подтверждением. */
  A.views.link = {
    render(root, [raw]) {
      const code = A.sync.normCode(raw);
      history.replaceState(null, '', location.pathname + '#/link'); // код не остаётся в истории
      const card = h('div', { class: 'link-card' });
      root.append(h('section', { class: 'link-page' }, card));

      const confirmStep = () => {
        card.replaceChildren(
          h('div', { class: 'link-ico' }, icon('refresh', 30)),
          h('h1', { class: 'display sm' }, t('sync.confirm_title')),
          h('p', { class: 'muted' }, t('sync.confirm_text')),
          h('p', { class: 'code-show' }, code.length === 16 ? A.sync.formatCode(code) : raw),
          h('div', { class: 'row gap center wrap' },
            h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: run }, t('sync.connect')),
            h('a', { class: 'btn btn-ghost btn-lg', href: '#/' }, t('common.cancel'))),
          h('p', { class: 'small muted' }, h('a', { href: '#/about' }, t('sync.how'))));
      };

      async function run() {
        card.replaceChildren(A.loading(t('sync.connecting')));
        try {
          const kind = await A.sync.join(code);
          A.applyTheme();
          A.applyLang();
          card.replaceChildren(
            h('div', { class: 'link-ico ok' }, icon('check', 30)),
            h('h1', { class: 'display sm' }, t(kind === 'link' ? 'sync.joined_link' : 'sync.joined_transfer')),
            h('div', { class: 'row gap center' },
              h('a', { class: 'btn btn-primary btn-lg', href: '#/' }, t('sync.open_cards'))));
        } catch (e) {
          card.replaceChildren(
            h('div', { class: 'link-ico bad' }, icon('x', 30)),
            h('h1', { class: 'display sm' }, A.sync.errorText(e)),
            h('div', { class: 'row gap center' },
              h('a', { class: 'btn btn-ghost btn-lg', href: '#/' }, t('study.back'))));
        }
      }

      if (code.length === 16) confirmStep();
      else {
        card.replaceChildren(
          h('div', { class: 'link-ico bad' }, icon('x', 30)),
          h('h1', { class: 'display sm' }, t('sync.err_code')),
          h('a', { class: 'btn btn-ghost', href: '#/' }, t('study.back')));
      }
    },
  };
})();
