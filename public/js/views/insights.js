/* What goes wrong: the history of answers (js/idb.js) read back as a few findings, each with one thing to do.
   Only this device's history counts (it is not synced), and only the language pair in use. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  const DAY = 864e5;
  const MIN_ANSWERS = 30; // fewer than this and there is nothing to say yet

  const pct = (x) => Math.round(x * 100) + '%';

  /* Every finding: { id, weight, title, text, cards?, action? }; the heaviest first. Pure, for the tests. */
  function analyse(log, cards, settings, now = Date.now()) {
    const out = [];
    const byId = new Map(cards.map((c) => [c.id, c]));
    const real = log.filter((e) => !e.cram && byId.has(e.c));
    if (real.length < MIN_ANSWERS) return { enough: false, answers: real.length, findings: out };

    // 1. retention: how many reviews (not first meetings) of the last 30 days were remembered
    const reviews = real.filter((e) => !e.n && e.t > now - 30 * DAY);
    const target = settings.retention || 0.9;
    if (reviews.length >= 30) {
      const kept = reviews.filter((e) => e.g > 1).length / reviews.length;
      if (kept < target - 0.07) {
        out.push({ id: 'retention_low', weight: 90, vars: { kept: pct(kept), target: pct(target) },
          action: { kind: 'new_per_day', value: Math.max(5, Math.round(settings.newPerDay / 2)) } });
      } else if (kept > target + 0.05 && settings.newPerDay < 30) {
        out.push({ id: 'retention_high', weight: 20, vars: { kept: pct(kept), target: pct(target) },
          action: { kind: 'new_per_day', value: Math.min(50, settings.newPerDay + 5) } });
      }
    }

    // 2. leeches: words forgotten again and again, still in sessions
    const leeches = cards.filter((c) => c.leech && !c.sus).sort((a, b) => b.lapses - a.lapses);
    if (leeches.length) out.push({ id: 'leeches', weight: 70 + leeches.length, vars: { n: leeches.length }, cards: leeches.slice(0, 12), action: { kind: 'leeches' } });

    // 3. confusions: picked the translation of another card, or typed another card's word
    const termOf = new Map(cards.map((c) => [A.store.norm(c.term), c.id]));
    const pairs = new Map();
    for (const e of real) {
      if (e.g > 1) continue;
      const other = e.k || (e.x && termOf.get(A.store.norm(e.x)));
      if (!other || other === e.c || !byId.has(other)) continue;
      const key = [e.c, other].sort().join('|');
      pairs.set(key, (pairs.get(key) || 0) + 1);
    }
    const confused = [...pairs].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, n]) => ({ a: byId.get(k.split('|')[0]), b: byId.get(k.split('|')[1]), n }));
    if (confused.length) out.push({ id: 'confused', weight: 60 + confused[0].n * 3, pairs: confused, cards: confused.flatMap((p) => [p.a, p.b]) });

    // 4. articles and forms in typed answers: the right word with another article, or in another form
    const half = (r) => real.filter((e) => e.r === r && e.x).map((e) => ({ c: byId.get(e.c), x: e.x }));
    const articles = half('article'), forms = half('form');
    if (articles.length >= 3) out.push({ id: 'articles', weight: 50 + articles.length, vars: { n: articles.length }, examples: articles.slice(-5), cards: uniq(articles.map((x) => x.c)) });
    if (forms.length >= 3) out.push({ id: 'forms', weight: 40 + forms.length, vars: { n: forms.length }, examples: forms.slice(-5), cards: uniq(forms.map((x) => x.c)) });

    // 5. the mode or direction that goes worst, against the others
    const rate = (list) => list.filter((e) => e.g > 1).length / list.length;
    const groups = (key) => {
      const m = new Map();
      for (const e of real) { const k = key(e); if (k) m.set(k, [...(m.get(k) || []), e]); }
      return [...m].filter(([, l]) => l.length >= 15).map(([k, l]) => ({ k, r: rate(l), n: l.length }));
    };
    const all = rate(real);
    const modes = groups((e) => e.m).sort((a, b) => a.r - b.r);
    if (modes.length >= 2 && modes[0].r < all - 0.15) {
      out.push({ id: 'mode', weight: 35, vars: { mode: t('mode.' + modes[0].k), r: pct(modes[0].r), all: pct(all) }, action: { kind: 'mode', value: modes[0].k } });
    }
    const dirs = groups((e) => e.m === 'flip' && e.d).sort((a, b) => a.r - b.r);
    if (dirs.length === 2 && dirs[0].r < dirs[1].r - 0.15) {
      out.push({ id: dirs[0].k === 'r' ? 'reverse' : 'forward', weight: 30, vars: { r: pct(dirs[0].r), other: pct(dirs[1].r) } });
    }

    // 6. the part of speech that goes worst
    const kinds = groups((e) => e.pos).sort((a, b) => a.r - b.r);
    if (kinds.length >= 2 && kinds[0].r < all - 0.12) {
      const worst = kinds[0].k;
      const list = cards.filter((c) => c.pos === worst && c.lapses > 0 && !c.sus).sort((a, b) => b.lapses - a.lapses).slice(0, 15);
      out.push({ id: 'pos', weight: 25, vars: { pos: t('pos.' + worst), r: pct(kinds[0].r), all: pct(all) }, cards: list });
    }

    // 7. a backlog of reviews: too much waits today
    const due = cards.filter((c) => c.box > 0 && !c.sus && c.due <= now).length;
    if (due > Math.max(40, settings.sessionSize * 2)) out.push({ id: 'backlog', weight: 80, vars: { n: due }, action: { kind: 'study' } });

    return { enough: true, answers: real.length, findings: out.sort((a, b) => b.weight - a.weight) };
  }
  const uniq = (list) => [...new Map(list.map((c) => [c.id, c])).values()];

  A.views.insights = {
    async render(root) {
      const s = A.store.settings;
      const head = h('section', { class: 'page-head' },
        h('a', { class: 'back', href: '#/stats' }, icon('back', 18), t('stats.open')),
        A.rich(t('ins.title'), 'h1'),
        h('p', { class: 'lede' }, t('ins.lede', { lang: A.langs.name(s.target) })));
      const body = h('div', { class: 'insights' }, A.loading(t('ins.reading')));
      root.append(head, body);
      root.querySelector('.page-head h1').className = 'display';

      const log = await A.idb.logAll(Date.now() - 60 * DAY, A.store.pairKey());
      const res = analyse(log, A.store.cards(), s);
      if (!res.enough) {
        body.replaceChildren(h('div', { class: 'empty' },
          h('div', { class: 'empty-emoji' }, '🔍'),
          h('h3', null, t('ins.not_yet')),
          h('p', { class: 'muted' }, t('ins.not_yet_hint', { n: MIN_ANSWERS - res.answers })),
          h('a', { class: 'btn btn-primary', href: '#/study' }, icon('cards', 18), t('ins.study'))));
        return;
      }
      if (!res.findings.length) {
        body.replaceChildren(h('div', { class: 'empty' },
          h('div', { class: 'empty-emoji' }, '🌿'),
          h('h3', null, t('ins.all_good')),
          h('p', { class: 'muted' }, t('ins.all_good_hint', { n: res.answers }))));
        return;
      }
      body.replaceChildren(...res.findings.map((f) => finding(f, s)));
    },
    _test: { analyse },
  };

  const only = (cards) => '#/study?only=' + cards.map((c) => c.id).join(',');

  function finding(f, s) {
    const T = s.target, N = s.native;
    const word = (c) => h('span', { class: 'ins-word' }, A.lt(c.term, T, 'serif'), h('small', null, c.tr));
    const parts = [h('h2', null, t(`ins.${f.id}_h`, f.vars)), h('p', null, t(`ins.${f.id}_p`, f.vars))];

    if (f.pairs) {
      parts.push(h('ul', { class: 'ins-pairs' }, f.pairs.map((p) => h('li', null, word(p.a), h('span', { class: 'ins-vs' }, '⇄'), word(p.b), h('span', { class: 'pill' }, `${p.n}×`)))));
    }
    if (f.examples?.length) {
      parts.push(h('ul', { class: 'ins-examples' }, f.examples.map((x) => h('li', null,
        h('s', { lang: T }, x.x), h('span', null, '→'), A.lt(x.c.term, T, 'serif'), h('span', { class: 'muted' }, x.c.tr)))));
    }
    if (f.id === 'leeches') {
      parts.push(h('ul', { class: 'ins-leech-list' }, f.cards.map((c) => {
        const li = h('li', null, word(c), h('span', { class: 'pill' }, t('stats.lapses', { n: c.lapses })),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => A.editCard(c, c.deck) }, icon('edit', 16), t('ins.make_easier')),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { A.store.suspend(c.id); li.remove(); A.toast(t('card.suspended')); } }, icon('pause', 16), t('card.suspend')));
        return li;
      })));
    } else if (f.cards?.length && !f.pairs && !f.examples?.length) {
      parts.push(h('p', { class: 'ins-list' }, f.cards.slice(0, 10).map((c) => A.lt(c.term, T, 'serif')).flatMap((x, i) => (i ? [', ', x] : [x]))));
    }

    const acts = h('div', { class: 'row gap wrap' });
    if (f.cards?.length) acts.append(h('a', { class: 'btn btn-soft btn-sm', href: only(f.cards.slice(0, 30)) }, icon('flip', 16), t('ins.practise', { n: Math.min(30, f.cards.length) })));
    const a = f.action;
    if (a?.kind === 'new_per_day') {
      acts.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: (e) => { A.store.set({ newPerDay: a.value }); e.currentTarget.replaceWith(h('span', { class: 'ok-text' }, icon('check', 16), t('ins.done'))); } }, t('ins.set_new', { n: a.value })));
    } else if (a?.kind === 'mode') {
      acts.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => { A.store.set({ studyMode: a.value }); A.go('#/study'); } }, icon('cards', 16), t('ins.train_mode', { mode: t('mode.' + a.value) })));
    } else if (a?.kind === 'study') {
      acts.append(h('a', { class: 'btn btn-primary btn-sm', href: '#/study' }, icon('cards', 16), t('ins.study')));
    }
    if (acts.childElementCount) parts.push(acts);
    return h('section', { class: 'ins-card ins-' + f.id }, parts);
  }
})();
