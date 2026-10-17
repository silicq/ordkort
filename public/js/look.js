/* Your own look: CSS for the whole site, and a card template in HTML and CSS.
   A template is HTML with fields in double braces: {{term}}, {{translation}}, {{pronunciation}}, {{grammar}},
   {{forms}}, {{example}}, {{example_translation}}, {{image}}, {{audio}}, {{deck}}; {{#example}}…{{/example}}
   shows its inside only when the card has an example (any field works). Field values are always escaped.
   The template is cleaned before it is used: no scripts, frames, objects, forms, event handlers or javascript:
   addresses. The page's CSP would stop a script anyway; cleaning keeps a shared design from even trying.
   The card's own picture: {{image}} alone, <img src="{{image}}">, or var(--card-image) in CSS.
   Pictures from the web (https addresses in the CSS or in the template) are fetched once, see `pics` below. */
(() => {
  const A = window.App;
  const FIELDS = ['term', 'translation', 'pronunciation', 'grammar', 'forms', 'example', 'example_translation', 'image', 'audio', 'deck'];
  const MAX = 20000; // characters in each of CSS, front and back

  const PRESETS = {
    classic: { front: '', back: '', css: '' },
    minimal: {
      front: '<div class="t-big">{{term}}</div>',
      back: '<div class="t-small">{{term}}</div>\n<div class="t-big">{{translation}}</div>',
      css: '.t-big { font: 600 44px/1.15 var(--font-serif); } .t-small { color: var(--ink-3); }',
    },
    picture: {
      front: '{{image}}\n<div class="t-word">{{term}}</div>\n{{audio}}',
      back: '{{image}}\n<div class="t-word">{{translation}}</div>\n<div class="t-note">{{term}} · {{grammar}}</div>\n{{#example}}<p class="t-ex">{{example}}</p>{{/example}}',
      css: '.face-body img { max-height: 46%; border-radius: 16px; } .t-word { font: 600 34px/1.2 var(--font-serif); } .t-note { color: var(--ink-2); } .t-ex { font-style: italic; }',
    },
    sentence: {
      front: '<div class="t-word">{{term}}</div>\n{{#example}}<p class="t-ex">{{example}}</p>{{/example}}\n{{audio}}',
      back: '<div class="t-word">{{translation}}</div>\n<div class="t-note">{{pronunciation}} {{grammar}}</div>\n<div class="t-forms">{{forms}}</div>\n{{#example}}<p class="t-ex">{{example}}<br><small>{{example_translation}}</small></p>{{/example}}',
      css: '.t-word { font: 600 36px/1.2 var(--font-serif); } .t-ex { font: italic 20px/1.5 var(--font-serif); max-width: 34ch; } .t-note, .t-forms { color: var(--ink-2); }',
    },
  };
  const SITE = {
    none: '',
    large: ':root { font-size: 112%; } body { font-size: 18px; } .flash-word { font-size: clamp(40px, 9vw, 64px); }',
    contrast: ':root, :root[data-theme] { --ink-2: var(--ink); --ink-3: var(--ink); --line: var(--ink-3); } .btn { outline: 2px solid currentColor; }',
    sepia: ':root:not([data-theme="dark"]) { --paper: #efe3c8; --paper-2: #e6d6b4; --card: #f8eedb; }',
  };

  /* ---------- cleaning ---------- */
  /* ---------- pictures from the web ----------
     The site may only show pictures of its own (CSP img-src 'self' data: blob:), so the pictures a look names by an
     https address are fetched through the site's picture proxy (src/images.js) and used as blob: URLs. All of them
     are fetched at once, whatever the page shows, so CSS cannot tell anyone what is on the page ("load this picture
     if an attribute starts with a"); and a template's addresses are taken before any field is filled in, so a word
     can never become part of an address. */
  const MAX_PICS = 8;
  const pics = new Map(); // https address → blob: URL ('' while it loads or when it could not be had)
  const URL_RE = /url\(\s*(['"]?)\s*(https:\/\/[^'")\s]+)\s*\1\s*\)/gi;
  const SRC_RE = /\ssrc\s*=\s*(['"]?)(https:\/\/[^'"\s>]+)\1/gi;
  function addresses(look) {
    const out = new Set();
    for (const text of [look?.css, look?.site, look?.front, look?.back]) for (const m of String(text || '').matchAll(URL_RE)) out.add(m[2]);
    for (const text of [look?.front, look?.back]) for (const m of String(text || '').matchAll(SRC_RE)) out.add(m[2]);
    return [...out].filter((u) => !u.includes('{{')).slice(0, MAX_PICS);
  }
  const arrived = new Set(); // what to redo when pictures come
  function fetchPics(look) {
    const todo = addresses(look).filter((u) => !pics.has(u));
    if (!todo.length || typeof fetch !== 'function') return;
    todo.forEach((u) => pics.set(u, ''));
    Promise.all(todo.map((u) => fetch('/api/img?u=' + encodeURIComponent(u))
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (b && /^image\//.test(b.type)) pics.set(u, URL.createObjectURL(b)); })
      .catch(() => {})))
      .then(() => {
        arrived.forEach((fn) => fn());
        document.querySelectorAll('img[data-pic]').forEach((img) => { const b = pics.get(img.dataset.pic); if (b) { img.src = b; img.removeAttribute('data-pic'); } });
      });
  }

  // math and the old raw-text elements are where HTML read twice can come out different from what was cleaned
  const DROP = 'script, iframe, frame, frameset, object, embed, applet, link, meta, base, form, input, button, textarea, select, style, noscript, template, math, noembed, noframes, xmp, plaintext, title';
  // `allowed`: the https pictures this look may show (they come from the template itself, see above).
  // The result is read again by innerHTML, so it is cleaned until reading it again changes nothing
  function clean(html, allowed = new Set()) {
    let out = cleanOnce(String(html || '').slice(0, MAX), allowed);
    for (let i = 0; i < 3; i++) {
      const again = cleanOnce(out, allowed);
      if (again === out) return out;
      out = again;
    }
    return '';
  }
  function cleanOnce(html, allowed) {
    const t = document.createElement('template');
    t.innerHTML = html;
    t.content.querySelectorAll(DROP).forEach((n) => n.remove());
    for (const el of t.content.querySelectorAll('*')) {
      for (const a of [...el.attributes]) {
        const v = a.value.trim().toLowerCase().replace(/\s+/g, '');
        if (/^on/i.test(a.name) || /^(javascript|vbscript|data):/.test(v) && a.name !== 'class' || a.name === 'srcdoc' || a.name === 'formaction') el.removeAttribute(a.name);
        else if (a.name === 'style') el.setAttribute('style', cleanCss(a.value));
        else if (a.name === 'srcset') el.removeAttribute(a.name);
      }
      // a picture from the web waits for its blob: URL; one from anywhere else is not shown
      const src = el.getAttribute('src');
      if (src && /^(https?:)?\/\//i.test(src.trim())) {
        el.removeAttribute('src');
        if (el.localName === 'img' && allowed.has(src.trim())) {
          const b = pics.get(src.trim());
          if (b) el.setAttribute('src', b); else el.setAttribute('data-pic', src.trim());
        } else if (el.localName === 'img') el.remove();
      }
    }
    return t.innerHTML;
  }
  // CSS for the page: whatever ends a <style> or reaches outside is cut; a picture from the web becomes its blob: URL
  const cleanCss = (css) => String(css || '').slice(0, MAX).replace(/<\/?style/gi, '').replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)\s*([^'")]*?)\s*\1\s*\)/gi, (m, q, u) => {
      if (/^https:\/\//i.test(u)) { const b = pics.get(u); return b ? `url("${b}")` : 'none'; }
      return /^(javascript|vbscript|https?):|^\/\//i.test(u) ? 'none' : m;
    });

  /* A look someone else made is shown before it is used: its card CSS then must not reach the rest of the page
     (hide the buttons, cover the page, restyle "Cancel"). It is parsed and wrapped in @scope, so it styles only the
     sample cards; .look-preview itself is outside that scope and clips them (contain: paint in style.css).
     @keyframes, @font-face and @property cannot live in @scope and only give names, so they stay outside. */
  /* The CSS is not parsed and written out again (the browser cannot write back a `background` with var() next to
     a background-clip of its own, and the gradient was lost): it is cut into its top-level blocks as written,
     reading strings, escapes and comments, and a brace that closes nothing is dropped, so no block can end the
     @scope around it. */
  function blocks(css) {
    const out = [];
    let start = 0, depth = 0, quote = '', i = 0;
    const s = String(css || '');
    for (; i < s.length; i++) {
      const ch = s[i];
      if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
      if (ch === '/' && s[i + 1] === '*') { const end = s.indexOf('*/', i + 2); i = end < 0 ? s.length : end + 1; continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '\\') i++;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        if (!depth) { out.push(s.slice(start, i)); start = i + 1; continue; } // closes nothing: left out
        if (!--depth) { out.push(s.slice(start, i + 1)); start = i + 1; }
      } else if (ch === ';' && !depth) { out.push(s.slice(start, i + 1)); start = i + 1; }
    }
    return out.map((b) => b.trim()).filter((b) => b && /[{;]/.test(b) && (b.endsWith('}') || b.endsWith(';')));
  }
  function scoped(css, root) {
    if (!css) return '';
    const all = blocks(css);
    const named = (b) => /^@(-webkit-)?(keyframes|font-face|property)\b/i.test(b);
    return all.filter(named).join('\n') + `\n@scope (${root}) {\n${all.filter((b) => !named(b)).join('\n')}\n}`;
  }

  /* A look's card CSS usually takes its colours from variables its site CSS sets on :root (--card, --ink, accents of
     its own). For the preview only those custom properties are lifted onto the sample cards (`root`), from rules on
     :root or html, inside @media and @supports too: the sample shows as it will be, and the page stays as it is. */
  function variables(css, root) {
    if (!css || typeof CSSStyleSheet !== 'function') return '';
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      const walk = (rules) => [...rules].map((r) => {
        if (r.style && typeof r.selectorText === 'string') {
          const decls = [...r.style].filter((p) => p.startsWith('--') || p === 'color-scheme').map((p) => `${p}: ${r.style.getPropertyValue(p)};`).join(' ');
          const sel = r.selectorText.split(',').map((x) => x.trim()).filter((x) => /:root|^html\b/i.test(x)).map((x) => `${x} ${root}`).join(', ');
          return decls && sel ? `${sel} { ${decls} }` : '';
        }
        if (r.cssRules && /^@(media|supports)\b/i.test(r.cssText)) {
          const inner = walk(r.cssRules).join('\n');
          return inner ? `${r.cssText.slice(0, r.cssText.indexOf('{'))}{\n${inner}\n}` : '';
        }
        return '';
      }).filter(Boolean);
      return walk(sheet.cssRules).join('\n');
    } catch { return ''; }
  }

  /* ?nolook in the address turns your own look off for that visit: the way back to Settings → Reset when a look
     has hidden the controls */
  const off = () => typeof location === 'object' && /[?&]nolook\b/.test(String(location.search) + String(location.hash));

  /* ---------- filling a template ---------- */
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  /* `ask`: the side of a card that asks for the word from its translation (reverse flip cards, typing). The template
     then shows the translation where it shows the term: on the front nothing that gives the word away (no
     pronunciation, forms, example or sound), and on the back the word in the template's big place. */
  function values(c, ask = '') {
    const ex = A.store.example(c);
    const { gram, pron, forms } = A.store.shown(c);
    const deck = A.store.ready && A.store.deck(c.deck);
    const v = {
      term: c.term, translation: c.tr, pronunciation: pron, grammar: gram, forms, example: ex.text, example_translation: ex.tr,
      deck: deck ? A.deckTitle(deck) : '', image: c.img ? '1' : '', audio: '1',
    };
    if (ask === 'front') return { ...v, term: c.tr, translation: '', pronunciation: '', grammar: '', forms: '', example: '', example_translation: '', audio: '' };
    if (ask === 'back') return { ...v, term: c.tr, translation: c.term };
    return v;
  }
  // the template → HTML: sections, then fields; {{image}} and {{audio}} become placeholders filled after
  function fill(tpl, v) {
    let out = String(tpl || '')
      // the card's picture where an address goes: <img src="{{image}}">, url({{image}})
      .replace(/\ssrc\s*=\s*(['"]?)\{\{\s*image\s*\}\}\1/g, ' data-card-image')
      .replace(/url\(\s*(['"]?)\{\{\s*image\s*\}\}\1\s*\)/g, 'var(--card-image)');
    // sections, also one inside another ({{#example}}…{{#example_translation}}…{{/example_translation}}{{/example}}):
    // opened again until nothing changes; a section mark left without its pair is dropped, never shown as braces
    for (let i = 0; i < 8; i++) {
      const was = out;
      out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, k, inner) => (v[k] ? inner : ''));
      out = out.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, k, inner) => (v[k] ? '' : inner));
      if (out === was) break;
    }
    out = out.replace(/\{\{\s*[#^/]\s*\w+\s*\}\}/g, '');
    return out.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => {
      if (k === 'image') return v.image ? '<span data-slot="image"></span>' : '';
      if (k === 'audio') return '<span data-slot="audio"></span>';
      return FIELDS.includes(k) ? esc(v[k]) : '';
    });
  }
  // whether your own look has a card template (then study cards wear .face.own in every mode)
  const has = (look = A.store.settings?.look) => !!(look && (String(look.front || '').trim() || String(look.back || '').trim()) && !off());
  // a side of a card from the template, as nodes for .face-body; null when the side has no template
  function render(side, c, look = A.store.settings.look, ask = false) {
    const tpl = look?.[side];
    if (!tpl || !tpl.trim() || (look === A.store.settings?.look && off())) return null;
    const box = document.createElement('div');
    box.className = 'tpl tpl-' + side;
    fetchPics(look);
    box.innerHTML = clean(fill(tpl, values(c, ask ? side : '')), new Set(addresses(look)));
    box.querySelectorAll('[data-slot="image"]').forEach((s) => s.replaceWith(A.media.el(c, 'flash-img') || ''));
    // the card's picture: <img src="{{image}}"> and var(--card-image)
    const imgs = [...box.querySelectorAll('img[data-card-image]')];
    if (!c.img) imgs.forEach((i) => i.remove());
    else A.media.url(c).then((u) => {
      if (!u) return;
      box.style.setProperty('--card-image', `url("${u}")`);
      imgs.forEach((i) => { i.src = u; i.removeAttribute('data-card-image'); });
    });
    box.querySelectorAll('[data-slot="audio"]').forEach((s) => s.replaceWith(ask && side === 'front' ? '' : A.speakBtn(c.term, A.store.settings?.target || 'nb', '', c)));
    return box;
  }

  /* ---------- the styles in the page ---------- */
  // a look chosen before the first-run setup waits here, and moves into the settings once they exist
  const LATER = 'ordkort.look-later';
  const later = () => { try { return JSON.parse(localStorage.getItem(LATER) || 'null'); } catch { return null; } };
  let worn = null; // the look a preview shows instead of the saved one (in the phone preview's frame)
  function apply() {
    const waiting = later();
    if (waiting && A.store.ready && !A.framed) { A.store.set({ look: waiting }); try { localStorage.removeItem(LATER); } catch {} }
    const look = worn || (off() ? {} : A.store.settings?.look || waiting || {});
    fetchPics(look);
    const css = [look.site || '', look.css ? `.flash .face-body .tpl { display: contents; }\n${look.css}` : ''].map(cleanCss).join('\n').trim();
    let el = document.getElementById('user-look');
    if (!css) { el?.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'user-look'; document.head.append(el); }
    el.textContent = css;
  }

  /* ---------- the preview of a look: both sides of a sample card ---------- */
  // before the first-run setup there are no cards (and no settings) yet: a Norwegian sample then
  const sampleCard = () => (A.store.ready && (A.store.cards().find((c) => c.ex && c.img) || A.store.cards().find((c) => c.img) || A.store.cards().find((c) => c.ex) || A.store.cards()[0]))
    || { id: 'sample', term: 'et hus', tr: 'house', pos: 'noun', forms: 'huset, hus, husa', pron: '/hʉːs/', ex: 'Vi bor i et rødt hus.', exTr: '' };
  // fills `box` with the two sides; the look's CSS applies to them at once, before anything is saved
  const size = (x) => (String(x || '').length > 30 ? ' xl' : String(x || '').length > 14 ? ' l' : ''); // as in a session
  // the sample is drawn at a real card's size and scaled down to the space it has, so a design looks as it will
  const W = 480, H = 430;
  let shown = null;
  const previewCss = () => {
    let st = document.getElementById('user-look-preview');
    if (!shown) { st?.remove(); return; }
    if (!st) { st = document.createElement('style'); st.id = 'user-look-preview'; document.head.append(st); }
    st.textContent = variables(cleanCss(shown.site), '.look-side') + '\n'
      + (shown.css ? `.look-preview .face-body .tpl { display: contents; }\n${scoped(cleanCss(shown.css), '.look-side')}` : '');
  };
  arrived.add(() => { apply(); previewCss(); });
  const scaler = typeof ResizeObserver === 'function' ? new ResizeObserver((all) => {
    for (const e of all) e.target.style.setProperty('--z', String(e.contentRect.width / W));
  }) : null;
  function preview(box, look, sample = sampleCard()) {
    const { h, t } = A;
    const s = A.store.settings || { target: 'nb', native: 'en' };
    const side = (name) => {
      const own = render(name, sample, look);
      const ex = A.store.example(sample).text;
      const body = own || (name === 'front'
        ? [A.lt(sample.term, s.target, 'flash-word serif' + size(sample.term), 'div'), A.speakBtn(sample.term, s.target, 'lg')]
        : [sample.img ? A.media.el(sample, 'flash-img') : null, A.lt(sample.term, s.target, 'flash-small', 'div'), A.lt(sample.tr, s.native, 'flash-word serif' + size(sample.tr), 'div'), ex ? A.lt(ex, s.target, 'flash-ex serif', 'p') : null]);
      const el = h('div', { class: 'look-side is-' + name, style: `--w: ${W}px; --h: ${H}px`, onclick: () => flip(name === 'front' ? 'back' : 'front') },
        h('div', { class: 'flash look-flash in' }, h('div', { class: 'face' + (has(look) ? ' own' : '') + (name === 'back' ? ' back look-back' : ' front') },
          h('div', { class: 'flash-tag' }, h('span', { class: 'badge new' }, t('study.new'))),
          h('div', { class: 'face-body' }, body))));
      scaler?.observe(el);
      return el;
    };
    // on a phone one side at a time, turned by the switch or by a tap on the card; side by side on wider screens
    const sides = A.segmented([{ value: 'front', label: t('look.side_front') }, { value: 'back', label: t('look.side_back') }], 'front', (v) => { box.dataset.side = v; }, 'look-sides');
    const flip = (v) => { box.dataset.side = v; sides.querySelectorAll('button').forEach((b, i) => { const on = (i === 0) === (v === 'front'); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); };
    box.dataset.side = 'front';
    shown = look;
    previewCss();
    box.replaceChildren(sides, side('front'), side('back'));
  }
  const unpreview = () => { shown = null; previewCss(); };
  const wear = (look) => { worn = look; apply(); };

  /* The whole site at a phone's width, wearing the look being edited: the site itself in a frame, which keeps and
     sends nothing (A.framed), scaled down to the space it has. Made when it is first opened. */
  const PHONE_W = 360, PHONE_H = 720;
  function phone(getLook) {
    const { h, icon, t } = A;
    const holder = h('div', { class: 'look-phone' });
    let frame = null;
    const dress = () => { try { frame?.contentWindow?.App?.look?.wear({ ...getLook() }); } catch { /* not ready */ } };
    const fit = typeof ResizeObserver === 'function' ? new ResizeObserver(([e]) => holder.style.setProperty('--z', String(Math.min(1, e.contentRect.width / PHONE_W)))) : null;
    const el = h('details', { class: 'look-edit' }, h('summary', null, icon('phone', 16), t('look.phone')));
    el.addEventListener('toggle', () => {
      if (!el.open || frame) return;
      frame = h('iframe', { src: '/#/', title: t('look.phone'), width: PHONE_W, height: PHONE_H, loading: 'lazy', style: `--w: ${PHONE_W}px; --h: ${PHONE_H}px` });
      frame.addEventListener('load', () => { dress(); setTimeout(dress, 600); });
      holder.append(frame);
      el.append(h('p', { class: 'muted small' }, t('look.phone_hint')), holder);
      fit?.observe(holder);
    });
    return { el, dress };
  }

  /* ---------- Settings → Your own look ---------- */
  // `title` and `before` (rows such as the theme) let Settings make this its whole "Appearance" card
  function card({ title, before = null } = {}) {
    const { h, icon, t } = A;
    const s = A.store.settings;
    const look = { front: '', back: '', css: '', site: '', ...(s.look || {}) };

    let timer = null;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { A.store.set({ look: { ...look } }); apply(); }, 300);
      paint();
    };
    const area = (key, label, rows = 4) => {
      const ta = h('textarea', { class: 'input code', rows, spellcheck: 'false', autocapitalize: 'off', maxlength: MAX, dir: 'ltr' });
      ta.value = look[key];
      ta.addEventListener('input', () => { look[key] = ta.value; tplSel.value = 'custom'; save(); });
      return [h('label', { class: 'field' }, h('span', null, label), ta), ta];
    };
    const [frontF, frontTa] = area('front', t('look.front'));
    const [backF, backTa] = area('back', t('look.back'), 5);
    const [cssF, cssTa] = area('css', t('look.css'));
    const [siteF, siteTa] = area('site', t('look.site_css'));

    const which = () => Object.keys(PRESETS).find((k) => ['front', 'back', 'css'].every((f) => (PRESETS[k][f] || '') === (look[f] || ''))) || 'custom';
    const tplSel = h('select', { class: 'select' },
      Object.keys(PRESETS).map((k) => h('option', { value: k }, t('look.p_' + k))), h('option', { value: 'custom' }, t('look.p_custom')));
    tplSel.value = which();
    tplSel.addEventListener('change', () => {
      if (tplSel.value === 'custom') return;
      Object.assign(look, PRESETS[tplSel.value]);
      frontTa.value = look.front; backTa.value = look.back; cssTa.value = look.css;
      save();
    });
    const siteWhich = () => Object.keys(SITE).find((k) => SITE[k] === (look.site || '')) || 'custom';
    const siteSel = h('select', { class: 'select' },
      Object.keys(SITE).map((k) => h('option', { value: k }, t('look.s_' + k))), h('option', { value: 'custom' }, t('look.p_custom')));
    siteSel.value = siteWhich();
    siteSel.addEventListener('change', () => { if (siteSel.value === 'custom') return; look.site = SITE[siteSel.value]; siteTa.value = look.site; save(); });
    siteTa.addEventListener('input', () => { siteSel.value = siteWhich(); });

    // the sample card, both sides, as a session would show them
    const box = h('div', { class: 'look-preview' });
    const sample = sampleCard();
    const tel = phone(() => look);
    const paint = () => { preview(box, look, sample); tel.dress(); };
    paint();

    return h('section', { class: 'set-card look-card' },
      h('h2', null, title || t('look.title')),
      before,
      title ? h('h3', { class: 'look-sub' }, t('look.title')) : null,
      h('p', { class: 'muted small' }, t('look.lede')),
      h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, h('b', null, t('look.template')), h('small', null, t('look.template_hint'))), h('div', { class: 'set-ctl' }, tplSel)),
      box,
      h('details', { class: 'look-edit' },
        h('summary', null, icon('edit', 16), t('look.edit')),
        h('p', { class: 'muted small' }, t('look.fields'), ' ', h('code', null, FIELDS.map((f) => `{{${f}}}`).join(' ')), ' · ', h('code', null, '{{#example}}…{{/example}}')),
        frontF, backF, cssF,
        h('p', { class: 'muted small' }, icon('info', 14), ' ', t('look.safe'))),
      h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, h('b', null, t('look.site')), h('small', null, t('look.site_hint'))), h('div', { class: 'set-ctl' }, siteSel)),
      h('details', { class: 'look-edit' }, h('summary', null, icon('palette', 16), t('look.site_edit')), siteF),
      tel.el,
      h('div', { class: 'row gap' },
        h('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          onclick: () => {
            Object.assign(look, { front: '', back: '', css: '', site: '' });
            frontTa.value = backTa.value = cssTa.value = siteTa.value = '';
            tplSel.value = 'classic'; siteSel.value = 'none';
            save();
          },
        }, icon('refresh', 16), t('look.reset'))));
  }

  /* ---------- #/look/ID: a look someone made (through MCP), shown before it is used ---------- */
  A.views = A.views || {};
  A.views.look = {
    render(root, [id]) {
      const { h, icon, t } = A;
      const page = h('section', { class: 'link-page' }, h('div', { class: 'link-card share-open look-open' }, A.loading(t('share.loading'))));
      root.append(page);
      A.ai.sharedDeck(id).then((d) => {
        if (!d || d.kind !== 'look') { location.replace('#/s/' + id); return; }
        const look = { front: String(d.front || ''), back: String(d.back || ''), css: String(d.css || ''), site: String(d.site || '') };
        const box = h('div', { class: 'look-preview' });
        // the site's CSS, worn for a moment before saying yes
        trying = null;
        const tryBtn = h('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          onclick: () => { trying = trying ? null : look; tryOn(); tryBtn.lastChild.textContent = t(trying ? 'look.try_off' : 'look.try'); },
        }, icon('palette', 16), h('span', null, t('look.try')));
        A.put(page.firstChild,
          h('div', { class: 'link-ico' }, icon('palette', 30)),
          h('h1', { class: 'display sm' }, d.name || t('look.title')),
          h('p', { class: 'muted' }, t('look.shared_d')),
          box,
          look.site ? h('p', { class: 'muted small row gap center wrap look-note' }, h('span', null, icon('info', 14), ' ', t('look.shared_site')), tryBtn) : null,
          h('div', { class: 'row gap center wrap look-go' },
            h('button', {
              class: 'btn btn-primary btn-lg', type: 'button',
              onclick: () => {
                trying = null; tryOn();
                if (A.store.ready) A.store.set({ look });
                else try { localStorage.setItem(LATER, JSON.stringify(look)); } catch {}
                apply(); A.toast(t('look.applied'), 'ok'); A.go(A.store.ready ? '#/settings' : '#/');
              },
            }, icon('check', 18), t('look.use')),
            h('a', { class: 'btn btn-ghost btn-lg', href: '#/' }, t('common.cancel'))));
        preview(box, look);
      }).catch((e) => {
        page.firstChild.replaceChildren(h('h1', { class: 'display sm' }, e.kind === 'gone' ? t('share.gone') : A.ai.errorText(e)), h('a', { class: 'btn btn-ghost', href: '#/' }, t('study.back')));
      });
    },
    leave() { unpreview(); trying = null; tryOn(); },
  };
  let trying = null;
  function tryOn() {
    let st = document.getElementById('user-look-try');
    if (!trying) { st?.remove(); return; }
    fetchPics(trying);
    if (!st) { st = document.createElement('style'); st.id = 'user-look-try'; document.head.append(st); }
    st.textContent = cleanCss(trying.site);
  }
  arrived.add(tryOn);

  A.look = { PRESETS, SITE, FIELDS, has, render, apply, clean, cleanCss, scoped, fill, card, preview, unpreview, wear, addresses, MAX };
})();
