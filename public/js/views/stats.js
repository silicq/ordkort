/* Statistics: streak, today's goal, reviews over 30 days, 14-day forecast, word stages, hardest words.
   Charts are plain SVG: thin columns with rounded data ends, hover/focus tooltips and a table view. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  const SVG = 'http://www.w3.org/2000/svg';
  const DAY = 864e5;

  const svg = (tag, attrs = {}) => {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const fmtDay = (d, opts = { day: 'numeric', month: 'short' }) => {
    try { return d.toLocaleDateString(A.i18n.lang(), opts); } catch { return d.toLocaleDateString('en', opts); }
  };
  const niceMax = (v) => {
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
  };

  /* shared tooltip: value first, label second */
  let tip = null;
  function showTip(e, value, label) {
    if (!tip) { tip = h('div', { class: 'chart-tip', role: 'status' }); document.body.append(tip); }
    tip.replaceChildren(h('b', null, value), h('span', null, label));
    tip.hidden = false;
    const r = e.target.getBoundingClientRect();
    const x = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2));
    tip.style.left = x + 'px';
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + window.scrollY + 'px';
  }
  const hideTip = () => { if (tip) tip.hidden = true; };

  /* column chart for one series: [{ label, value, tip }] */
  function columns(data, { height = 180, labelEvery = 7 } = {}) {
    // real pixel width, so that text keeps its size on phones
    const W = Math.max(280, Math.min(760, window.innerWidth - 72)), H = height, padL = 34, padB = 26, padT = 10;
    const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
    const band = (W - padL) / data.length;
    const bw = Math.min(24, band * 0.62);
    const y = (v) => padT + (H - padT - padB) * (1 - v / max);
    const every = Math.max(labelEvery, Math.ceil(46 / band));
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
    for (const v of [0, max / 2, max]) {
      root.append(svg('line', { x1: padL, x2: W, y1: y(v), y2: y(v), class: 'grid' }));
      const tx = svg('text', { x: padL - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
      tx.textContent = Math.round(v).toLocaleString();
      root.append(tx);
    }
    data.forEach((d, i) => {
      const x = padL + band * i + (band - bw) / 2;
      const top = y(d.value), base = y(0);
      const hgt = base - top;
      if (d.value > 0) {
        const r = Math.min(4, hgt, bw / 2);
        // rounded data end, square at the baseline
        root.append(svg('path', {
          class: 'col',
          d: `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z`,
        }));
      }
      // hit target: the whole band, taller than the mark
      const hit = svg('rect', { x: padL + band * i, y: padT, width: band, height: H - padT - padB, class: 'hit', tabindex: '0' });
      hit.addEventListener('pointerenter', (e) => showTip(e, d.value.toLocaleString(), d.tip));
      hit.addEventListener('focus', (e) => showTip(e, d.value.toLocaleString(), d.tip));
      hit.addEventListener('pointerleave', hideTip);
      hit.addEventListener('blur', hideTip);
      root.append(hit);
      if (i % every === 0) {
        const tx = svg('text', { x: padL + band * i + band / 2, y: H - 8, class: 'tick', 'text-anchor': 'middle' });
        tx.textContent = d.label;
        root.append(tx);
      }
    });
    return root;
  }

  function tableView(title, head, rows) {
    return h('details', { class: 'chart-table' },
      h('summary', null, t('stats.table')),
      h('table', { class: 'ptable' },
        h('caption', { class: 'sr-only' }, title),
        h('thead', null, h('tr', null, head.map((x) => h('th', null, x)))),
        h('tbody', null, rows.map((r) => h('tr', null, r.map((x) => h('td', null, String(x))))))));
  }

  A.views.stats = {
    render(root) {
      const s = A.store.settings;
      const cards = A.store.cards();
      const days = A.store.days;
      const today = A.store.today();
      const goal = s.goal || 20;
      const streak = A.store.streak();

      // last 30 days
      const hist = [];
      let rev30 = 0, ok30 = 0;
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const v = days[A.store.dayKey(d)] || { rev: 0, ok: 0 };
        rev30 += v.rev; ok30 += v.ok;
        hist.push({ date: d, value: v.rev, ok: v.ok });
      }
      // next 14 days: when cards come due (overdue ones count for today)
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const fc = Array.from({ length: 14 }, (_, i) => ({ date: new Date(start.getTime() + i * DAY), value: 0 }));
      for (const c of cards) {
        if (!c.box) continue;
        const idx = Math.max(0, Math.floor((c.due - start.getTime()) / DAY));
        if (idx < 14) fc[idx].value++;
      }
      // stages
      const st = { new: 0, learning: 0, known: 0, mastered: 0 };
      for (const c of cards) st[A.store.stage(c.box)]++;
      const learned = st.known + st.mastered;
      const acc = rev30 ? Math.round((ok30 / rev30) * 100) : 0;
      const hard = cards.filter((c) => c.lapses > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 8);

      const tile = (label, value, extra) => h('div', { class: 'stat-tile' }, h('span', { class: 'st-label' }, label), h('b', { class: 'st-value' }, value), extra || null);
      const meter = h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': today.rev },
        h('i', { style: `width:${Math.min(100, (today.rev / goal) * 100)}%` }));

      const total = cards.length || 1;
      const stageOrder = ['new', 'learning', 'known', 'mastered'];
      const stack = h('div', { class: 'stage-bar' }, stageOrder.filter((k) => st[k]).map((k) => {
        const pct = (st[k] / total) * 100;
        const seg = h('span', { class: 'seg st-' + k, style: `flex:${st[k]}`, tabindex: '0' }, pct >= 12 ? h('em', null, st[k]) : null);
        seg.addEventListener('pointerenter', (e) => showTip(e, st[k], t('stage.' + k)));
        seg.addEventListener('focus', (e) => showTip(e, st[k], t('stage.' + k)));
        seg.addEventListener('pointerleave', hideTip);
        seg.addEventListener('blur', hideTip);
        return seg;
      }));

      A.add(root,
        h('section', { class: 'page-head' },
          h('a', { class: 'back', href: '#/' }, icon('back', 18), t('deck.back')),
          A.rich(t('stats.title'), 'h1'),
          h('p', { class: 'lede' }, t('stats.lede', { lang: A.langs.name(s.target) }))),
        h('div', { class: 'stat-tiles' },
          tile(t('stats.streak'), streak, h('small', null, A.tn('n_days_streak', streak))),
          tile(t('stats.today'), `${today.rev} / ${goal}`, meter),
          tile(t('stats.learned'), learned, h('small', null, t('stats.of_total', { n: cards.length }))),
          tile(t('stats.accuracy'), rev30 ? acc + '%' : '—', h('small', null, t('stats.days30')))),
        h('section', { class: 'chart-card' },
          h('h2', null, t('stats.reviews')),
          h('p', { class: 'muted small' }, t('stats.reviews_d')),
          columns(hist.map((d) => ({ value: d.value, label: fmtDay(d.date), tip: `${fmtDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.value ? Math.round((d.ok / d.value) * 100) + '% ' + t('stats.correct') : ''}` }))),
          tableView(t('stats.reviews'), [t('stats.date'), t('stats.reviews_n'), t('stats.correct_n')], hist.slice().reverse().map((d) => [fmtDay(d.date), d.value, d.ok]))),
        h('section', { class: 'chart-card' },
          h('h2', null, t('stats.forecast')),
          h('p', { class: 'muted small' }, t('stats.forecast_d')),
          columns(fc.map((d, i) => ({ value: d.value, label: i === 0 ? t('stats.today_short') : fmtDay(d.date, { weekday: 'short' }), tip: fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'short' }) })), { height: 150, labelEvery: 1 }),
          tableView(t('stats.forecast'), [t('stats.date'), t('stats.due_n')], fc.map((d) => [fmtDay(d.date), d.value]))),
        h('section', { class: 'chart-card' },
          h('h2', null, t('stats.stages')),
          stack,
          h('ul', { class: 'stage-legend' }, stageOrder.map((k) => h('li', null, h('i', { class: 'st-' + k }), h('span', null, t('stage.' + k)), h('b', null, st[k]))))),
        hard.length ? h('section', { class: 'chart-card' },
          h('h2', null, t('stats.hard')),
          h('p', { class: 'muted small' }, t('stats.hard_d')),
          h('ul', { class: 'hard-list' }, hard.map((c) => h('li', null,
            A.lt(c.term, s.target, 'serif'), h('span', { class: 'muted' }, c.tr),
            h('span', { class: 'pill' }, t('stats.lapses', { n: c.lapses })))))) : null);
      root.querySelector('.page-head h1').className = 'display';
    },
    leave() { hideTip(); },
  };
})();
