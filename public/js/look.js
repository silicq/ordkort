/* Your own look: CSS for the whole site, and a card template in HTML and CSS.
   A template is HTML with fields in double braces: {{term}}, {{translation}}, {{pronunciation}}, {{grammar}},
   {{forms}}, {{example}}, {{example_translation}}, {{image}}, {{audio}}, {{deck}}; {{#example}}…{{/example}}
   shows its inside only when the card has an example (any field works). Field values are always escaped.
   The template is cleaned before it is used: no scripts, frames, objects, forms, event handlers or javascript:
   addresses. The page's CSP would stop a script anyway; cleaning keeps a shared design from even trying. */
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
  const DROP = 'script, iframe, frame, frameset, object, embed, applet, link, meta, base, form, input, button, textarea, select, style, noscript, template';
  function clean(html) {
    const t = document.createElement('template');
    t.innerHTML = String(html || '').slice(0, MAX);
    t.content.querySelectorAll(DROP).forEach((n) => n.remove());
    for (const el of t.content.querySelectorAll('*')) {
      for (const a of [...el.attributes]) {
        const v = a.value.trim().toLowerCase().replace(/\s+/g, '');
        if (/^on/i.test(a.name) || /^(javascript|vbscript|data):/.test(v) && a.name !== 'class' || a.name === 'srcdoc' || a.name === 'formaction') el.removeAttribute(a.name);
      }
    }
    return t.innerHTML;
  }
  // CSS for the page: whatever ends a <style> or reaches outside is cut
  const cleanCss = (css) => String(css || '').slice(0, MAX).replace(/<\/?style/gi, '').replace(/@import[^;]*;?/gi, '').replace(/url\(\s*['"]?\s*(javascript|https?):[^)]*\)/gi, 'none');

  /* ---------- filling a template ---------- */
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function values(c) {
    const ex = A.store.example(c);
    const { gram, pron, forms } = A.store.shown(c);
    const deck = A.store.deck(c.deck);
    return {
      term: c.term, translation: c.tr, pronunciation: pron, grammar: gram, forms, example: ex.text, example_translation: ex.tr,
      deck: deck ? A.deckTitle(deck) : '', image: c.img ? '1' : '', audio: '1',
    };
  }
  // the template → HTML: sections, then fields; {{image}} and {{audio}} become placeholders filled after
  function fill(tpl, v) {
    let out = String(tpl || '');
    out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, k, inner) => (v[k] ? inner : ''));
    out = out.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, k, inner) => (v[k] ? '' : inner));
    return out.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => {
      if (k === 'image') return v.image ? '<span data-slot="image"></span>' : '';
      if (k === 'audio') return '<span data-slot="audio"></span>';
      return FIELDS.includes(k) ? esc(v[k]) : '';
    });
  }
  // a side of a card from the template, as nodes for .face-body; null when the side has no template
  function render(side, c, look = A.store.settings.look) {
    const tpl = look?.[side];
    if (!tpl || !tpl.trim()) return null;
    const box = document.createElement('div');
    box.className = 'tpl tpl-' + side;
    box.innerHTML = clean(fill(tpl, values(c)));
    box.querySelectorAll('[data-slot="image"]').forEach((s) => s.replaceWith(A.media.el(c, 'flash-img') || ''));
    box.querySelectorAll('[data-slot="audio"]').forEach((s) => s.replaceWith(A.speakBtn(c.term, A.store.settings.target)));
    return box;
  }

  /* ---------- the styles in the page ---------- */
  function apply() {
    const look = A.store.settings?.look || {};
    const css = [look.site || '', look.css ? `.flash .face-body .tpl { display: contents; }\n${look.css}` : ''].map(cleanCss).join('\n').trim();
    let el = document.getElementById('user-look');
    if (!css) { el?.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'user-look'; document.head.append(el); }
    el.textContent = css;
  }

  /* ---------- Settings → Your own look ---------- */
  function card() {
    const { h, icon, t } = A;
    const s = A.store.settings;
    const look = { front: '', back: '', css: '', site: '', ...(s.look || {}) };
    const sample = A.store.cards().find((c) => c.ex && c.img) || A.store.cards().find((c) => c.ex) || A.store.cards()[0]
      || { id: 'sample', term: 'et hus', tr: 'house', pos: 'noun', forms: 'huset, hus, husa', pron: '/hʉːs/', ex: 'Vi bor i et rødt hus.', exTr: '' };

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
    const preview = h('div', { class: 'look-preview' });
    function paint() {
      const side = (name) => {
        const own = render(name, sample, look);
        const body = own || (name === 'front'
          ? [A.lt(sample.term, s.target, 'flash-word serif', 'div'), A.speakBtn(sample.term, s.target, 'lg')]
          : [A.lt(sample.term, s.target, 'flash-small', 'div'), A.lt(sample.tr, s.native, 'flash-word serif', 'div'), A.store.example(sample).text ? A.lt(A.store.example(sample).text, s.target, 'flash-ex serif', 'p') : null]);
        return h('div', { class: 'flash look-flash in' }, h('div', { class: 'face' + (name === 'back' ? ' look-back' : '') },
          h('div', { class: 'flash-tag' }, h('span', { class: 'badge new' }, t('study.new'))),
          h('div', { class: 'face-body' }, body)));
      };
      // the template's CSS applies to the preview at once, before it is saved
      let st = document.getElementById('user-look-preview');
      if (!st) { st = document.createElement('style'); st.id = 'user-look-preview'; document.head.append(st); }
      st.textContent = look.css ? `.look-preview .face-body .tpl { display: contents; }\n${cleanCss(look.css)}` : '';
      preview.replaceChildren(side('front'), side('back'));
    }
    paint();

    return h('section', { class: 'set-card look-card' },
      h('h2', null, t('look.title')),
      h('p', { class: 'muted small' }, t('look.lede')),
      h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, h('b', null, t('look.template')), h('small', null, t('look.template_hint'))), h('div', { class: 'set-ctl' }, tplSel)),
      preview,
      h('details', { class: 'look-edit' },
        h('summary', null, icon('edit', 16), t('look.edit')),
        h('p', { class: 'muted small' }, t('look.fields'), ' ', h('code', null, FIELDS.map((f) => `{{${f}}}`).join(' ')), ' · ', h('code', null, '{{#example}}…{{/example}}')),
        frontF, backF, cssF,
        h('p', { class: 'muted small' }, icon('info', 14), ' ', t('look.safe'))),
      h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, h('b', null, t('look.site')), h('small', null, t('look.site_hint'))), h('div', { class: 'set-ctl' }, siteSel)),
      h('details', { class: 'look-edit' }, h('summary', null, icon('palette', 16), t('look.site_edit')), siteF),
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

  A.look = { PRESETS, SITE, FIELDS, render, apply, clean, cleanCss, fill, card, MAX };
})();
