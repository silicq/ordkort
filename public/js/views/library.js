/* The library: decks people published for the same pair of languages (src/decks/library.js).
   #/library — search and browse; #/lib/ID — one deck, to add, vote on or report; and publishing from a deck. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  const REASONS = ['adult', 'drugs', 'violence', 'hate', 'spam', 'wrong', 'other'];

  async function call(path, { method = 'GET', body, headers = {} } = {}) {
    let r;
    try {
      r = await fetch('/api/' + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    } catch { throw new A.ai.AIError('network'); }
    if (A.ai.blocked(r)) throw new A.ai.AIError('blocked');
    const data = await r.json().catch(() => null);
    if (r.ok) return data;
    const e = new A.ai.AIError(r.status === 404 ? 'gone' : r.status === 429 ? 'rate' : r.status === 503 ? 'busy' : 'server');
    e.status = r.status;
    e.data = data;
    throw e;
  }

  /* ---------- #/library ---------- */
  let state = { q: '', sort: 'top' };
  A.views.library = {
    render(root) {
      const s = A.store.settings;
      const list = h('div', { class: 'deck-grid lib-grid' });
      const more = h('button', { class: 'btn btn-ghost', type: 'button', hidden: true }, t('lib.more'));
      const status = h('p', { class: 'muted' });
      const q = h('input', { class: 'input', type: 'search', placeholder: t('lib.search_ph'), value: state.q });
      let page = 0;
      async function load(reset) {
        if (reset) { page = 0; list.replaceChildren(); }
        status.textContent = t('lib.loading');
        more.hidden = true;
        try {
          const qs = new URLSearchParams({ target: s.target, native: s.native, q: state.q, sort: state.sort, page: String(page) });
          const r = await call('library?' + qs);
          list.append(...r.decks.map(tile));
          status.textContent = list.children.length ? '' : t(state.q ? 'lib.none_found' : 'lib.empty');
          more.hidden = !r.more;
          page++;
        } catch (e) { status.textContent = A.ai.errorText(e); }
      }
      let timer = null;
      q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = q.value.trim(); load(true); }, 350); });
      more.addEventListener('click', () => load(false));
      A.add(root,
        h('section', { class: 'page-head' },
          h('a', { class: 'back', href: '#/' }, icon('back', 18), t('deck.back')),
          A.rich(t('lib.title'), 'h1'),
          h('p', { class: 'lede' }, t('lib.lede', { from: A.langs.name(s.target), to: A.langs.name(s.native) }))),
        h('div', { class: 'row gap wrap lib-tools' }, q,
          A.segmented([{ value: 'top', label: t('lib.top') }, { value: 'new', label: t('lib.new') }], state.sort, (v) => { state.sort = v; load(true); })),
        status, list, h('div', { class: 'row center' }, more),
        h('p', { class: 'muted small lib-how' }, icon('info', 14), ' ', t('lib.how')));
      root.querySelector('.page-head h1').className = 'display';
      load(true);
    },
  };

  function tile(d) {
    return h('a', { class: 'deck lib-deck', href: '#/lib/' + d.id, style: '--tab: var(--t-custom)' },
      h('i', { class: 'deck-paper', 'aria-hidden': 'true' }),
      h('div', { class: 'deck-top' },
        h('span', { class: 'deck-emoji' }, A.media.face(d)),
        d.level ? h('span', { class: 'deck-level' }, d.level) : null),
      h('div', { class: 'deck-title' }, d.title),
      h('div', { class: 'deck-meta', lang: A.store.settings.target }, d.sample.join(', ')),
      h('div', { class: 'deck-foot' },
        h('span', null, A.tn('n_words', d.n)),
        h('span', { class: 'lib-score', title: t('lib.votes', { up: d.up, down: d.down, adds: d.adds }) }, '👍 ', String(d.up), ' · ', icon('plus', 12), ' ', String(d.adds))));
  }

  /* ---------- #/lib/ID ---------- */
  A.views.lib = {
    render(root, [id]) {
      const card = h('div', { class: 'link-card share-open' }, A.loading(t('share.loading')));
      root.append(h('section', { class: 'link-page' }, card));
      call('library/' + encodeURIComponent(id)).then((r) => {
        const voted = h('span', { class: 'muted small' });
        const vote = (v) => async (e) => {
          e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          try { await call(`library/${id}/vote`, { method: 'POST', body: { v } }); voted.textContent = t('lib.thanks'); } catch (err) { voted.textContent = A.ai.errorText(err); }
        };
        const extra = h('div', { class: 'lib-act' },
          h('div', { class: 'row gap center wrap' },
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: vote(1), 'aria-label': t('lib.up') }, '👍 ', String(r.up)),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: vote(-1), 'aria-label': t('lib.down') }, '👎 ', String(r.down)),
            h('span', { class: 'muted small' }, t('lib.added', { n: r.adds })),
            voted),
          h('button', { class: 'link-btn small', type: 'button', onclick: () => report(id) }, icon('flag', 14), t('lib.report')));
        A.deckTools.offer(card, r.deck, {
          extra, src: 'lib',
          onAdded: (d) => { A.store.updateDeck(d.id, { lib: id }); call(`library/${id}/add`, { method: 'POST', body: {} }).catch(() => {}); },
        });
      }).catch((e) => {
        card.replaceChildren(
          h('div', { class: 'link-ico bad' }, icon('x', 30)),
          h('h1', { class: 'display sm' }, e.kind === 'gone' ? t('lib.gone') : A.ai.errorText(e)),
          h('a', { class: 'btn btn-ghost', href: '#/library' }, t('lib.title_plain')));
      });
    },
  };

  function report(id) {
    let why = '';
    const opts = h('div', { class: 'mode-list' }, REASONS.map((r) => h('label', { class: 'mode-row' },
      h('input', { type: 'radio', name: 'why', value: r, onchange: () => { why = r; send.disabled = false; } }),
      h('span', null, h('b', null, t('lib.why_' + r))))));
    const send = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, t('lib.report_send'));
    const m = A.modal({
      title: t('lib.report'),
      body: h('div', null, h('p', { class: 'muted small' }, t('lib.report_hint')), opts),
      actions: [h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')), send],
    });
    send.addEventListener('click', async () => {
      send.disabled = true;
      try { await call(`library/${id}/report`, { method: 'POST', body: { why } }); m.close(); A.toast(t('lib.reported'), 'ok'); } catch (e) { A.toast(A.ai.errorText(e), 'error'); send.disabled = false; }
    });
  }

  /* ---------- publishing a deck ---------- */
  function publish(d) {
    const s = A.store.settings;
    const cards = A.store.cards(d.id).sort((a, b) => a.created - b.created);
    if (cards.length < 5) { A.toast(t('lib.too_small'), 'error'); return; }
    const agree = h('input', { type: 'checkbox', class: 'switch', role: 'switch' });
    const go = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, t('lib.publish_go'));
    const box = h('div', null,
      h('p', null, t('lib.publish_text', { n: cards.length, from: A.langs.name(s.target), to: A.langs.name(s.native) })),
      h('ul', { class: 'about-links' }, ['rule_1', 'rule_2', 'rule_3'].map((k) => h('li', null, t('lib.' + k)))),
      h('label', { class: 'set-row' }, h('span', { class: 'set-label' }, h('b', null, t('lib.agree'))), agree));
    agree.addEventListener('change', () => { go.disabled = !agree.checked; });
    const m = A.modal({ title: t('lib.publish'), body: box, actions: [h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')), go] });
    go.addEventListener('click', async () => {
      go.disabled = true;
      box.replaceChildren(A.loading(t('lib.checking')));
      try {
        const r = await call('library', {
          method: 'POST',
          body: { deck: {
            title: A.deckTitle(d), emoji: d.emoji, level: d.level, group: d.group, target: s.target, native: s.native,
            cover: A.media.isCover(d.cover) ? d.cover : undefined, cover_by: A.media.isCover(d.cover) ? d.coverBy : undefined,
            words: cards.map((c) => ({ term: c.term, tr: c.tr, pos: c.pos, gram: c.gram, forms: c.forms, pron: c.pron, ex: c.ex, ex_tr: c.exTr, img_url: c.imgUrl || undefined, img_by: c.imgUrl ? c.imgBy : undefined })),
          } },
        });
        A.store.updateDeck(d.id, { pub: { id: r.id, token: r.token } });
        const url = `${location.origin}/#/lib/${r.id}`;
        const copy = h('button', { class: 'btn btn-soft btn-sm', type: 'button', onclick: () => navigator.clipboard?.writeText(url).then(() => A.toast(t('sync.copied'))) }, icon('copy', 16), t('sync.copy'));
        const native = navigator.share ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => navigator.share({ title: A.deckTitle(d), url }).catch(() => {}) }, icon('share', 16), t('share.send')) : null;
        box.replaceChildren(...[
          h('p', null, icon('check', 18), ' ', t('lib.published')),
          r.cover === false ? h('p', { class: 'muted small' }, t('lib.no_cover')) : null,
          h('input', { class: 'input share-url', readonly: true, value: url, onfocus: (e) => e.target.select() }),
          h('div', { class: 'row gap wrap lib-share' }, copy, native),
        ].filter(Boolean));
        go.replaceWith(h('a', { class: 'btn btn-primary', href: '#/lib/' + r.id, onclick: () => m.close() }, t('lib.open')));
      } catch (e) {
        box.replaceChildren(...[
          h('p', { class: 'error-text' }, e.status === 422 ? t('lib.refused') : e.status === 503 ? t('lib.check_busy') : A.ai.errorText(e)),
          e.status === 503 && e.data?.why ? h('p', { class: 'muted small' }, e.data.why) : null,
        ].filter(Boolean));
        go.disabled = false;
      }
    });
  }

  async function unpublish(d) {
    if (!d.pub || !(await A.confirm(t('lib.unpublish_q'), { ok: t('lib.unpublish') }))) return;
    try {
      await call('library/' + d.pub.id, { method: 'DELETE', headers: { 'X-Lib-Token': d.pub.token } });
    } catch (e) { if (e.status !== 404) { A.toast(A.ai.errorText(e), 'error'); return; } }
    A.store.updateDeck(d.id, { pub: undefined });
    A.toast(t('lib.unpublished'), 'ok');
  }

  A.library = { publish, unpublish };
})();
