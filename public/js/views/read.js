/* Reading mode (in the spirit of LingQ): paste a text in the language you learn,
   tap unknown words to see their meaning in context and add them to your cards.
   Words are coloured: new (not in your cards), learning, known. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  const MAX = 3000, PART = 600;
  const NO_SPACES = ['zh', 'ja', 'th'];
  let R = null; // { pair, text, parts: [{ text, gloss, error }], showTr }
  let ctrl = null;

  const SAMPLES = {
    nb: 'Det var en kald morgen i Bergen. Kari tok bussen til jobben, men den var forsinket, så hun kjøpte en kopp kaffe og ventet. Hun tenkte på helgen: kanskje skulle hun gå på tur i fjellet hvis det ikke regnet.',
    en: 'It was a cold morning in the city. Anna took the bus to work, but it was late, so she bought a cup of coffee and waited. She was thinking about the weekend: maybe she would go hiking if it did not rain.',
    de: 'Es war ein kalter Morgen in Berlin. Anna nahm den Bus zur Arbeit, aber er hatte Verspätung, also kaufte sie einen Kaffee und wartete. Sie dachte an das Wochenende: Vielleicht würde sie wandern gehen, wenn es nicht regnete.',
    es: 'Era una mañana fría en Madrid. Ana tomó el autobús al trabajo, pero llegó tarde, así que compró un café y esperó. Pensaba en el fin de semana: quizás iría a la montaña si no llovía.',
    fr: 'C’était un matin froid à Lyon. Anne a pris le bus pour aller au travail, mais il était en retard, alors elle a acheté un café et elle a attendu. Elle pensait au week-end : peut-être irait-elle marcher en montagne s’il ne pleuvait pas.',
  };

  try { R = JSON.parse(localStorage.getItem('ordkort.read') || 'null'); } catch { R = null; }
  const persist = () => { try { localStorage.setItem('ordkort.read', JSON.stringify(R)); } catch { /* ignore */ } };

  A.views.read = {
    live: false,
    render(root) {
      const s = A.store.settings;
      const pairId = s.target + ':' + s.native;
      if (R && R.pair !== pairId) R = null;
      A.add(root,
        h('section', { class: 'page-head' },
          A.rich(t('read.title'), 'h1'),
          h('p', { class: 'lede' }, t('read.lede', { lang: A.langs.name(s.target) }))));
      root.querySelector('.page-head h1').className = 'display';
      const body = h('div', { class: 'read-body' });
      root.append(body);
      if (R?.text) reader(body); else editor(body);
    },
    leave() { ctrl?.abort(); closeSheet(); },
  };

  /* ---------- entering a text ---------- */
  function editor(body) {
    const s = A.store.settings;
    const ta = h('textarea', { class: 'input read-input serif', lang: s.target, dir: 'auto', maxlength: MAX, rows: 9, placeholder: t('read.placeholder', { lang: A.langs.name(s.target) }) });
    const count = h('span', { class: 'muted small' }, `0 / ${MAX}`);
    ta.addEventListener('input', () => { count.textContent = `${ta.value.length} / ${MAX}`; });
    const go = () => {
      const text = ta.value.trim();
      if (text.length < 2) { ta.focus(); return; }
      R = { pair: s.target + ':' + s.native, text, parts: split(text).map((p) => ({ text: p })), showTr: false };
      persist();
      body.replaceChildren();
      reader(body);
    };
    const sample = SAMPLES[s.target];
    A.put(body,
      h('div', { class: 'read-editor' },
        ta,
        h('div', { class: 'row gap wrap read-tools' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: go }, icon('read', 18), t('read.go')),
          sample ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { ta.value = sample; ta.dispatchEvent(new Event('input')); } }, t('read.sample')) : null,
          h('span', { class: 'grow' }),
          count),
        h('p', { class: 'muted small' }, icon('info', 14), ' ', t('read.cost'))));
    setTimeout(() => ta.focus(), 50);
  }

  // split into pieces of ≤ PART characters on sentence boundaries
  function split(text) {
    const sentences = text.replace(/\r/g, '').split(/(?<=[.!?…。！？\n])\s*/u).filter(Boolean);
    const out = [];
    let cur = '';
    for (const snt of sentences) {
      const piece = snt.length > PART ? snt.slice(0, PART) : snt;
      if ((cur + ' ' + piece).trim().length > PART && cur) { out.push(cur.trim()); cur = ''; }
      cur += (cur && !/\n$/.test(cur) ? ' ' : '') + piece;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /* ---------- reading ---------- */
  function reader(body) {
    const s = A.store.settings;
    const T = s.target;
    const textBox = h('div', { class: 'read-text serif', lang: T, dir: 'auto' });
    const trBox = h('div', { class: 'read-tr', lang: s.native, dir: 'auto', hidden: !R.showTr });
    const stats = h('span', { class: 'read-stats muted small' });
    const trBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, icon('translate', 16), t(R.showTr ? 'read.hide_tr' : 'read.show_tr'));
    trBtn.addEventListener('click', () => {
      R.showTr = !R.showTr;
      persist();
      trBox.hidden = !R.showTr;
      trBtn.lastChild.textContent = t(R.showTr ? 'read.hide_tr' : 'read.show_tr');
    });

    A.put(body,
      h('div', { class: 'read-bar' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { R = null; persist(); editor(body); } }, icon('back', 16), t('read.new')),
        trBtn,
        h('span', { class: 'grow' }),
        h('div', { class: 'read-legend' },
          h('span', { class: 'rw st-new' }, t('read.st_new')),
          h('span', { class: 'rw st-learning' }, t('read.st_learning')),
          h('span', { class: 'rw st-known' }, t('read.st_known')))),
      stats,
      h('div', { class: 'read-sheet-wrap' }, textBox, trBox),
      h('p', { class: 'muted small read-note' }, icon('sparkle', 14), t('dict.ai_note')));

    const paint = () => {
      textBox.replaceChildren(...R.parts.map((p, i) => renderPart(p, i)));
      trBox.replaceChildren(...R.parts.map((p) => h('p', null, p.gloss?.translation || '…')));
      const words = new Map();
      R.parts.forEach((p) => p.gloss?.words.forEach((w) => words.set(w.w, w)));
      let fresh = 0, learning = 0;
      for (const w of words.values()) { const st = status(w); if (st === 'new') fresh++; else if (st === 'learning') learning++; }
      const pending = R.parts.filter((p) => !p.gloss && !p.error).length;
      stats.textContent = t('read.stats', { n: words.size, fresh, learning }) + (pending ? ' · ' + t('read.loading') : '');
    };
    paint();
    load(paint);
  }

  async function load(paint) {
    ctrl?.abort();
    ctrl = new AbortController();
    for (const p of R.parts) {
      if (p.gloss) continue;
      try {
        p.gloss = await A.ai.gloss(p.text, { signal: ctrl.signal });
        p.error = null;
      } catch (e) {
        if (e.name === 'AbortError') return;
        p.error = A.ai.errorText(e);
        A.toast(p.error, 'error');
        paint();
        return; // stop on the first error (limits, network)
      }
      persist();
      paint();
    }
  }

  const index = () => {
    const map = new Map();
    for (const c of A.store.cards()) map.set(A.store.norm(c.term), c);
    return map;
  };
  function status(w, cards = index()) {
    const c = cards.get(A.store.norm(w.term || '')) || cards.get(A.store.norm(w.w));
    if (!c) return 'new';
    return c.box >= 4 ? 'known' : 'learning';
  }

  function renderPart(p, i) {
    const para = h('p', { class: 'read-part' + (p.gloss ? '' : ' pending') });
    const glossed = new Map((p.gloss?.words || []).map((w) => [w.w, w]));
    const cards = index();
    const word = (txt) => {
      const g = glossed.get(txt.toLowerCase());
      if (!g) return h('span', { class: 'rw' + (p.gloss ? ' plain' : '') }, txt);
      const st = status(g, cards);
      return h('span', { class: 'rw st-' + st, tabindex: '0', role: 'button', onclick: () => openSheet(g, p.text, txt), onkeydown: (e) => { if (e.key === 'Enter') openSheet(g, p.text, txt); } }, txt);
    };
    const T = A.store.settings.target;
    if (NO_SPACES.includes(T) && p.gloss) {
      // no spaces between words: greedy longest match against the glossed forms
      const forms = [...glossed.keys()].sort((a, b) => b.length - a.length);
      let rest = p.text, plain = '';
      while (rest) {
        const f = forms.find((x) => rest.toLowerCase().startsWith(x));
        if (f) { if (plain) { para.append(plain); plain = ''; } para.append(word(rest.slice(0, f.length))); rest = rest.slice(f.length); }
        else { plain += rest[0]; rest = rest.slice(1); }
      }
      if (plain) para.append(plain);
    } else {
      let last = 0;
      for (const m of p.text.matchAll(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu)) {
        para.append(p.text.slice(last, m.index), word(m[0]));
        last = m.index + m[0].length;
      }
      para.append(p.text.slice(last));
    }
    if (p.error) para.append(h('button', { class: 'link-btn small', type: 'button', onclick: () => { p.error = null; A.route(); } }, icon('refresh', 14), t('common.retry')));
    return para;
  }

  /* ---------- word sheet ---------- */
  let sheet = null;
  function closeSheet() { sheet?.remove(); sheet = null; }
  function openSheet(g, partText, form) {
    closeSheet();
    const s = A.store.settings;
    const T = s.target, N = s.native;
    const term = g.term || g.w;
    const sentence = (partText.split(/(?<=[.!?…。！？])\s+/u).find((x) => x.toLowerCase().includes(form.toLowerCase())) || partText).trim();
    const add = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, icon('plus', 16), t('dict.add'));
    if (A.store.hasTerm(term)) { add.disabled = true; add.replaceChildren(icon('check', 16), t('dict.in_cards')); }
    add.addEventListener('click', async () => {
      const deckId = await A.pickDeck();
      if (!deckId) return;
      const n = A.store.addCards(deckId, [{ term, tr: g.tr, pos: g.pos, gram: g.note, ex: sentence }]);
      A.toast(n ? t('card.added') : t('card.duplicate'), n ? 'ok' : 'error');
      add.disabled = true;
      add.replaceChildren(icon('check', 16), t('dict.in_cards'));
      document.querySelectorAll('.read-text .rw').forEach((el) => {
        if (el.textContent.toLowerCase() === form.toLowerCase()) { el.classList.remove('st-new'); el.classList.add('st-learning'); }
      });
    });
    sheet = h('div', { class: 'word-sheet', role: 'dialog', 'aria-label': term },
      h('div', { class: 'ws-head' },
        h('div', null,
          A.lt(term, T, 'ws-term serif', 'div'),
          term.toLowerCase() !== form.toLowerCase() ? A.lt(form, T, 'ws-form', 'div') : null),
        A.speakBtn(term, T),
        h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': t('common.close'), onclick: closeSheet }, icon('close', 18))),
      A.lt(g.tr, N, 'ws-tr', 'p'),
      g.pos || g.note ? h('p', { class: 'ws-note' }, [g.pos ? t('pos.' + g.pos) : '', g.note].filter(Boolean).join(' · ')) : null,
      h('div', { class: 'row gap wrap' },
        add,
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/dict/' + encodeURIComponent(term.replace(/^(en|ei|et|å|der|die|das|la|le|el|the|to)\s+/i, '')) }, icon('book', 16), t('card.in_dict'))));
    document.body.append(sheet);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  window.addEventListener('hashchange', closeSheet);
})();
