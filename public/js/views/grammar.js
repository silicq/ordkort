/* Учебник грамматики: главы по частям речи + свободные вопросы. Главы кэшируются. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  let askState = null;
  let ctrl = null;

  A.views.grammar = {
    render(root, [id]) {
      const s = A.store.settings;
      const T = s.target;
      const chapters = A.topics.chapters;
      const active = id === 'ask' ? 'ask' : chapters.find((c) => c.id === id) ? id : null;

      const q = h('input', { class: 'input', placeholder: t('gram.ask_ph', { lang: A.langs.name(T) }), value: active === 'ask' ? askState?.q || '' : '' });
      const askForm = h('form', {
        class: 'ask', onsubmit: (e) => {
          e.preventDefault();
          const v = q.value.trim();
          if (!v) { q.focus(); return; }
          askState = { q: v };
          A.go('#/grammar/ask');
        },
      }, h('span', { class: 'ask-ico' }, icon('sparkle')), q, h('button', { class: 'btn btn-primary', type: 'submit' }, t('gram.ask')));

      const toc = h('nav', { class: 'toc' + (active ? ' has-active' : '') },
        h('div', { class: 'toc-title' }, t('gram.contents')),
        chapters.map((c) => {
          const done = A.store.cacheHas(`gram:${T}:${s.native}:${c.id}`);
          return h('a', { class: 'toc-item' + (c.id === active ? ' active' : ''), href: '#/grammar/' + c.id },
            h('span', { class: 'toc-n serif' }, String(c.n).padStart(2, '0')),
            h('span', { class: 'toc-t' }, t('ch.' + c.id)),
            done ? h('span', { class: 'toc-done', title: t('gram.saved') }, icon('check', 15)) : null);
        }));

      const article = h('div', { class: 'gram-article' });
      root.append(
        h('section', { class: 'page-head' },
          A.rich(t('gram.title', { lang: A.langs.name(T) }), 'h1'),
          h('p', { class: 'lede' }, t('gram.lede'))),
        askForm,
        h('div', { class: 'gram-layout' + (active ? ' reading' : '') }, toc, article));
      root.querySelector('.page-head h1').className = 'display';

      if (active === 'ask') {
        if (!askState?.q) { location.replace('#/grammar'); return; }
        load(article, { ask: askState.q });
      } else if (active) load(article, { id: active });
      else article.append(welcome(T));
    },
    leave() { ctrl?.abort(); },
  };

  function welcome(T) {
    const ex = {
      nb: ['Når bruker man preteritum og når perfektum?', 'Hvorfor står «ikke» etter verbet?', 'en, ei eller et?'],
    }[T];
    const samples = ex || [t('gram.q1'), t('gram.q2'), t('gram.q3')];
    return h('div', { class: 'gram-welcome' },
      h('div', { class: 'big-num serif' }, '§'),
      h('h2', { class: 'display sm' }, t('gram.pick')),
      h('p', { class: 'muted' }, t('gram.pick_hint')),
      h('div', { class: 'chips' }, samples.map((s) => h('button', {
        class: 'chip', type: 'button',
        onclick: () => { askState = { q: s }; A.go('#/grammar/ask'); },
      }, s))));
  }

  async function load(article, { id, ask }, force = false) {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    article.replaceChildren(
      h('a', { class: 'back only-mobile', href: '#/grammar' }, icon('back', 18), t('gram.all')),
      A.loading(ask ? t('gram.thinking') : t('gram.writing')), A.skeleton(8));
    const status = (m) => { const el = article.querySelector('.loading-text'); if (el) el.textContent = m; };
    try {
      const data = ask
        ? await A.ai.ask(ask, { force, onStatus: status, signal })
        : await A.ai.chapter(id, { force, onStatus: status, signal });
      if (signal.aborted) return;
      article.replaceChildren(chapter(data, { id, ask, reload: () => load(article, { id, ask }, true) }));
      if (!ask) article.parentElement?.querySelector(`.toc-item[href="#/grammar/${id}"]`)?.classList.add('saved');
    } catch (e) {
      if (e.name === 'AbortError') return;
      article.replaceChildren(h('div', { class: 'error-box' }, h('p', null, A.ai.errorText(e)),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => load(article, { id, ask }, force) }, icon('refresh', 16), t('common.retry'))));
    }
  }

  function chapter(d, { id, ask, reload }) {
    const s = A.store.settings;
    const T = s.target, N = s.native;
    const ch = id ? A.topics.chapter(id) : null;
    const idx = ch ? A.topics.chapters.indexOf(ch) : -1;
    const prev = idx > 0 ? A.topics.chapters[idx - 1] : null;
    const nextCh = idx >= 0 && idx < A.topics.chapters.length - 1 ? A.topics.chapters[idx + 1] : null;

    const example = (x) => h('li', null,
      h('div', { class: 'ex-line' }, h('span', { class: 'serif ex-t', lang: T, dir: 'auto' }, A.rich(x.text)), A.speakBtn(String(x.text || '').replace(/\*/g, ''), T, 'sm')),
      x.tr ? A.lt(x.tr, N, 'ex-tr', 'span') : null,
      x.note ? h('span', { class: 'ex-note' }, A.rich(x.note)) : null);

    return h('article', { class: 'chapter' },
      h('a', { class: 'back only-mobile', href: '#/grammar' }, icon('back', 18), t('gram.all')),
      h('div', { class: 'chapter-kicker' }, ask ? t('gram.answer') : t('gram.chapter_n', { n: String(ch.n).padStart(2, '0') })),
      h('h2', { class: 'chapter-title serif' }, d.title || (ch ? t('ch.' + ch.id) : ask)),
      ask ? h('p', { class: 'asked' }, '«', ask, '»') : null,
      d.intro ? h('p', { class: 'lede' }, A.rich(d.intro)) : null,
      (d.sections || []).map((sec) => h('section', { class: 'gsec' },
        sec.heading ? h('h3', null, sec.heading) : null,
        sec.text ? A.rich(sec.text, 'div') : null,
        sec.table ? A.table(sec.table, T) : null,
        sec.examples?.length ? h('ul', { class: 'ex-list' }, sec.examples.map(example)) : null,
        sec.tip ? h('div', { class: 'callout' }, icon('bulb', 20), A.rich(sec.tip, 'div')) : null)),
      d.mistakes?.length ? h('section', { class: 'gsec' },
        h('h3', null, t('gram.mistakes')),
        h('div', { class: 'mistakes' }, d.mistakes.map((m) => h('div', { class: 'mistake' },
          h('div', { class: 'mk-wrong', lang: T }, icon('x', 16), h('s', null, m.wrong)),
          h('div', { class: 'mk-right', lang: T }, icon('check', 16), m.right),
          m.why ? h('p', { class: 'mk-why' }, A.rich(m.why)) : null)))) : null,
      d.practice?.length ? h('section', { class: 'gsec' },
        h('h3', null, t('gram.practice')),
        h('ol', { class: 'practice' }, d.practice.map((p) => h('li', null,
          h('p', null, A.rich(p.q)),
          h('details', null, h('summary', null, t('gram.show_answer')), h('p', { class: 'serif', lang: T }, A.rich(p.a))))))) : null,
      h('div', { class: 'chapter-foot' },
        h('span', { class: 'muted small' }, icon('sparkle', 14), t('gram.ai_note')),
        h('button', { class: 'link-btn small', type: 'button', onclick: reload }, icon('refresh', 14), t('common.regenerate'))),
      ch ? h('div', { class: 'pager' },
        prev ? h('a', { class: 'pager-link', href: '#/grammar/' + prev.id }, h('small', null, '←'), t('ch.' + prev.id)) : h('span'),
        nextCh ? h('a', { class: 'pager-link next', href: '#/grammar/' + nextCh.id }, t('ch.' + nextCh.id), h('small', null, '→')) : h('span')) : null);
  }
})();
