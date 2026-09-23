/* Small interface building blocks: DOM, icons, modals, speech. */
(() => {
  const A = window.App;

  function add(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false || k === '') continue;
      el.append(k instanceof Node ? k : String(k));
    }
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value' && 'value' in el) el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    add(el, kids);
    return el;
  }

  /* Icons: plain strokes on a 24×24 grid */
  const P = {
    cards: '<rect x="3" y="7" width="13" height="14" rx="2.5"/><path d="M8 4h10.5A2.5 2.5 0 0 1 21 6.5V17"/>',
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H20v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H20v-3"/><path d="M9 7.5h7"/>',
    grammar: '<path d="M2.5 5.5c3-1.5 6.3-1.3 9.5 1 3.2-2.3 6.5-2.5 9.5-1v13c-3-1.5-6.3-1.3-9.5 1-3.2-2.3-6.5-2.5-9.5-1z"/><path d="M12 6.5v13"/>',
    translate: '<path d="M3.5 5h9M8 3v2M5.5 5c.9 3.2 3.1 5.7 6.2 7.2M10.5 5c-.9 3.8-3.4 6.8-6.8 8.4"/><path d="m12.5 21 4.2-10 4.3 10M14 17.6h5.5"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    speaker: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    sparkle: '<path d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    check: '<path d="M5 12.5 10 17.5 19 7"/>',
    refresh: '<path d="M20 11.5a8 8 0 1 0-2.4 5.9M20 4.5v7h-7"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    flame: '<path d="M12 21c3.9 0 7-2.6 7-6.4 0-3.9-3-6.2-4.6-9.6-1.4 2.2-2.2 3.5-2.9 5.3-1-1.3-1.5-2.4-1.5-4C7.4 8.2 5 11.2 5 14.6 5 18.4 8.1 21 12 21z"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    flip: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    x: '<path d="M7 7l10 10M17 7 7 17"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    read: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 11h6M9 15h6M9 19h4"/>',
    stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  };
  function icon(name, size = 20) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ico ico-' + name);
    s.innerHTML = P[name] || '';
    return s;
  }

  function logo(size = 30) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 40 40');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'logo');
    s.innerHTML =
      '<rect x="9" y="5" width="24" height="30" rx="5" transform="rotate(12 21 20)" fill="var(--blue)"/>' +
      '<rect x="7" y="6" width="24" height="30" rx="5" transform="rotate(-6 19 21)" fill="var(--card)" stroke="var(--ink)" stroke-width="2.4"/>' +
      '<path d="M11.2 14.2 26.6 12.6" stroke="var(--red)" stroke-width="2.4" stroke-linecap="round" transform="rotate(-0.5 19 13)"/>' +
      '<path d="M12 20.6l12.8-1.35M12.6 26.2l9-.95" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" opacity=".28"/>';
    return s;
  }

  /* AI text with markup: **bold**, *italic*, line breaks — without innerHTML */
  function rich(text, tag = 'span') {
    const root = document.createElement(tag);
    const paras = String(text ?? '').split(/\n{2,}/);
    paras.forEach((para, pi) => {
      if (pi) root.append(document.createElement('br'), document.createElement('br'));
      para.split('\n').forEach((line, li) => {
        if (li) root.append(document.createElement('br'));
        const plain = (s) => s.replace(/\*+/g, '');
        const re = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`/g;
        let last = 0, m;
        while ((m = re.exec(line))) {
          root.append(plain(line.slice(last, m.index)));
          let el;
          if (m[1]) { el = document.createElement('strong'); el.append(Object.assign(document.createElement('em'), { textContent: m[1] })); }
          else { el = document.createElement(m[2] ? 'strong' : m[3] ? 'em' : 'code'); el.textContent = m[2] || m[3] || m[4]; }
          root.append(el);
          last = re.lastIndex;
        }
        root.append(plain(line.slice(last)));
      });
    });
    return root;
  }

  /* Text in a specific language: the right font and direction */
  const lt = (text, lang, cls = '', tag = 'span') => h(tag, { lang, dir: 'auto', class: cls || null }, text);

  /* ---------- toasts ---------- */
  let toastBox;
  function toast(msg, kind = '') {
    if (!msg) return;
    if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastBox); }
    const el = h('div', { class: 'toast ' + kind }, msg);
    toastBox.append(el);
    setTimeout(() => el.classList.add('out'), kind === 'error' ? 5200 : 2800);
    setTimeout(() => el.remove(), kind === 'error' ? 5600 : 3200);
  }

  /* ---------- modal windows ---------- */
  function modal({ title, body, actions = [], wide = false, onClose }) {
    const dlg = h('dialog', { class: 'modal' + (wide ? ' wide' : '') });
    const close = () => { dlg.close(); };
    dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    add(dlg, [
      h('div', { class: 'modal-head' },
        h('h3', null, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': A.t('common.close'), onclick: close }, icon('close'))),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-foot' }, actions) : null,
    ]);
    document.body.append(dlg);
    dlg.showModal();
    return { el: dlg, close };
  }
  function confirmBox(text, { ok, danger } = {}) {
    return new Promise((resolve) => {
      let result = false;
      const m = modal({
        title: A.t('common.confirm'),
        body: h('p', { class: 'muted' }, text),
        actions: [
          h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, A.t('common.cancel')),
          h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => { result = true; m.close(); } }, ok || A.t('common.ok')),
        ],
        onClose: () => resolve(result),
      });
    });
  }
  function promptBox(title, { placeholder = '', value = '', ok } = {}) {
    return new Promise((resolve) => {
      let result = null;
      const input = h('input', { class: 'input', placeholder, value });
      const done = () => { result = input.value.trim() || null; m.close(); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
      const m = modal({
        title,
        body: input,
        actions: [
          h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, A.t('common.cancel')),
          h('button', { class: 'btn btn-primary', onclick: done }, ok || A.t('common.ok')),
        ],
        onClose: () => resolve(result),
      });
      setTimeout(() => input.focus(), 30);
    });
  }

  /* ---------- speech (Web Speech API) ---------- */
  let voices = [];
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  if (synth) {
    const load = () => { voices = synth.getVoices(); };
    load();
    synth.addEventListener?.('voiceschanged', load);
  }
  const ALIAS = { nb: ['nb', 'no', 'nn'], nn: ['nn', 'nb', 'no'], zh: ['zh-cn', 'cmn', 'zh'], prs: ['fa-af', 'prs', 'fa'], kmr: ['ku', 'kmr'], tl: ['fil', 'tl'], he: ['he', 'iw'] };
  function voiceFor(lang) {
    const codes = ALIAS[lang] || [lang];
    for (const c of codes) {
      const v = voices.filter((x) => x.lang.toLowerCase().replace('_', '-').startsWith(c));
      if (v.length) return v.find((x) => /natural|online|google/i.test(x.name)) || v[0];
    }
    return null;
  }
  function speak(text, lang) {
    if (!synth || !text) return false;
    const v = voiceFor(lang);
    if (!v) { toast(A.t('tts.none', { lang: A.langs.name(lang) })); return false; }
    const u = new SpeechSynthesisUtterance(String(text).replace(/[*_]/g, ''));
    u.voice = v;
    u.lang = v.lang;
    u.rate = 0.9;
    synth.cancel();
    synth.speak(u);
    return true;
  }
  function speakBtn(text, lang, cls = '') {
    return h('button', {
      class: 'speak ' + cls, type: 'button', title: A.t('common.listen'), 'aria-label': A.t('common.listen'),
      onclick: (e) => { e.stopPropagation(); speak(text, lang); },
      onpointerdown: (e) => e.stopPropagation(),
    }, icon('speaker', cls.includes('lg') ? 22 : 18));
  }

  /* ---------- misc ---------- */
  function segmented(options, value, onChange, cls = '') {
    const wrap = h('div', { class: 'seg ' + cls, role: 'radiogroup' });
    for (const o of options) {
      const v = typeof o === 'object' ? o.value : o;
      const label = typeof o === 'object' ? o.label : String(o);
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value), class: v === value ? 'on' : '' }, label);
      b.addEventListener('click', () => {
        wrap.querySelectorAll('button').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on');
        b.setAttribute('aria-checked', 'true');
        onChange(v);
      });
      wrap.append(b);
    }
    return wrap;
  }

  function langSelect(value, { withAuto = false, exclude = [], onChange, cls = '' } = {}) {
    const sel = h('select', { class: 'select ' + cls });
    if (withAuto) sel.append(h('option', { value: 'auto' }, A.t('tr.auto')));
    for (const l of A.langs.list) {
      if (exclude.includes(l.code)) continue;
      sel.append(h('option', { value: l.code }, l.name === l.en ? l.name : `${l.name} — ${l.en}`));
    }
    sel.value = value;
    if (onChange) sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  function table(tbl, lang) {
    if (!tbl || !Array.isArray(tbl.rows) || !tbl.rows.length) return null;
    const headers = Array.isArray(tbl.headers) && tbl.headers.some(Boolean) ? tbl.headers : null;
    const vertical = !headers && tbl.rows.every((r) => Array.isArray(r) && r.length === 2);
    return h('div', { class: 'ptable-wrap' },
      tbl.title ? h('div', { class: 'ptable-title' }, tbl.title) : null,
      h('table', { class: 'ptable' + (vertical ? ' vertical' : '') },
        headers ? h('thead', null, h('tr', null, headers.map((c) => h('th', null, String(c ?? ''))))) : null,
        h('tbody', null, tbl.rows.filter(Array.isArray).map((r) =>
          h('tr', null, r.map((c, i) => (i === 0 && (headers ? !headers[0] : vertical)
            ? h('th', { scope: 'row' }, String(c ?? ''))
            : h('td', { lang, dir: 'auto' }, String(c ?? '')))))))));
  }

  function skeleton(lines = 4) {
    return h('div', { class: 'skeleton' }, Array.from({ length: lines }, (_, i) =>
      h('i', { style: `width:${[92, 76, 84, 58, 70, 88][i % 6]}%` })));
  }

  function loading(text) {
    return h('div', { class: 'loading' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i')), h('span', { class: 'loading-text' }, text));
  }

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* "Report a mistake" link: tells the server, forgets the local copy */
  function reportBtn(kind, params, localKey) {
    const b = h('button', { class: 'link-btn small report', type: 'button' }, icon('flag', 14), A.t('report.btn'));
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await A.ai.report(kind, params);
        if (localKey) A.store.cacheDel(localKey);
        b.replaceChildren(icon('check', 14), A.t('report.sent'));
        A.toast(A.t('report.thanks'));
      } catch (e) {
        b.disabled = false;
        A.toast(A.ai.errorText(e), 'error');
      }
    });
    return b;
  }

  function deckTitle(d) {
    if (!d) return '';
    if (d.kind === 'mine') return A.t('deck.mine');
    if (d.topic) return A.t('topic.' + d.topic);
    return d.title || A.t('deck.untitled');
  }

  function download(name, text, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* append/replaceChildren that skip null/false (otherwise the text "null" ends up in the DOM) */
  const addTo = (el, ...kids) => { add(el, kids); return el; };
  const putTo = (el, ...kids) => { el.replaceChildren(); add(el, kids); return el; };

  Object.assign(A, {
    h, icon, logo, add: addTo, put: putTo, rich, lt, toast, modal, confirm: confirmBox, prompt: promptBox,
    speak, speakBtn, canSpeak: (l) => !!voiceFor(l),
    segmented, langSelect, table, skeleton, loading, debounce, deckTitle, download, reportBtn,
  });
})();
