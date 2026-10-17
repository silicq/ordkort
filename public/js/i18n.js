/* Interface localisation. Translated by hand: en, ru, uk, nb, ar, zh (files in js/i18n/).
   For other languages the interface is translated once by the AI and kept in the browser. */
(() => {
  const A = window.App;
  const D = (A.i18nData ||= {});
  const extra = {};
  const rules = {};
  let runtime = null;
  let pending = null;

  function lang() {
    const s = A.store?.settings;
    return runtime || (s && (s.ui || s.native)) || 'en';
  }
  const table = (l) => D[l] || (l === 'nn' ? D.nb : null) || extra[l] || null;
  const fmt = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : String(s));

  function t(key, vars) {
    const tb = table(lang());
    return fmt(tb?.[key] ?? D.en?.[key] ?? key, vars);
  }

  function rule(l, n) {
    try { return (rules[l] ||= new Intl.PluralRules(l)).select(n); } catch { return n === 1 ? 'one' : 'other'; }
  }
  function tn(key, n, vars) {
    const l = lang();
    const tb = table(l);
    let s = tb && (tb[`${key}_${rule(l, n)}`] ?? tb[`${key}_other`]);
    if (s == null) s = D.en[`${key}_${rule('en', n)}`] ?? D.en[`${key}_other`] ?? key;
    return fmt(s, { ...vars, n });
  }

  /* AI translation of the interface for languages without a hand-made one */
  /* While the AI translates, a strip shows how far it is: a greeting in the new language, a bar of the parts,
     the line just translated; and the page itself changes as each part arrives (not while someone types, so a
     field being filled in is never redrawn under the cursor). A busy AI is asked again; a used-up day stops it. */
  function strip(l) {
    const { h } = A;
    const L = A.langs.get(l);
    const bar = h('i');
    const track = h('div', { class: 'xl8-bar wait' }, bar);
    const note = h('small', { class: 'xl8-note' }, D.en['ui.translating_start']);
    const sample = h('span', { class: 'xl8-sample', lang: l, dir: 'auto' });
    const close = h('button', { class: 'xl8-x', type: 'button', 'aria-label': D.en['common.close'] || 'Close', onclick: () => el.remove() }, '×');
    const el = h('div', { class: 'xl8', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'xl8-head' },
        L.hello ? h('b', { class: 'xl8-hello', lang: l, dir: 'auto' }, L.hello) : null,
        h('span', null, fmt(D.en['ui.translating_to'], { lang: L.name })), close),
      track, h('div', { class: 'xl8-foot' }, note, sample));
    document.querySelector('.xl8')?.remove();
    document.body.append(el);
    return {
      step(done, parts, en, mine) {
        track.classList.remove('wait');
        bar.style.width = `${Math.max(4, Math.round((done / parts) * 100))}%`;
        note.textContent = fmt(D.en['ui.translating_parts'], { done, parts });
        if (en && mine) { sample.textContent = `«${en}» → «${mine}»`; sample.classList.remove('in'); void sample.offsetWidth; sample.classList.add('in'); }
      },
      waiting() { track.classList.add('wait'); note.textContent = D.en['ui.translating_wait']; },
      done() { bar.style.width = '100%'; setTimeout(() => el.remove(), 900); },
      failed(retry) {
        track.classList.remove('wait');
        el.classList.add('failed');
        note.textContent = D.en['ui.translating_failed'];
        sample.replaceChildren(h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => { el.remove(); retry(); } }, D.en['ui.translating_retry']));
      },
    };
  }

  const TRANSIENT = ['rate', 'busy', 'network', 'server'];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ensure(again = false) {
    const l = lang();
    if ((table(l) && !again) || !A.store?.ready || A.framed) return;
    if (pending === l) return;
    const key = `ordkort.ui.${l}.v${A.config.uiVersion}`;
    try {
      const saved = JSON.parse(A.store.kvGet(key) || 'null');
      if (saved) { extra[l] = saved; A.route(); return; }
    } catch { /* no saved translation */ }

    pending = l;
    const ui = strip(l);
    const total = Object.keys(D.en).length;
    const out = {};
    let held = false;
    // the parts that came in so far, on the page at once; held back while a field has the focus
    const show = () => {
      if (lang() !== l) return;
      extra[l] = { ...out };
      if (document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) { held = true; return; }
      held = false;
      const y = scrollY;
      A.route();
      scrollTo(0, y);
    };
    const onBlur = () => { if (held) setTimeout(show, 0); };
    document.addEventListener('focusout', onBlur);
    let failed = false;
    // the server knows the English strings and translates them in parts; translations are shared by everyone
    for (let part = 0, parts = 1; part < parts; part++) {
      let r = null;
      for (let tries = 0; !r; tries++) {
        try { r = await A.ai.uiPart(l, part); } catch (e) {
          if (!TRANSIENT.includes(e?.kind) || tries >= 3) break;
          ui.waiting();
          await sleep(2500 * 2 ** tries);
        }
      }
      if (!r) { failed = true; break; }
      parts = r.parts;
      let en = '', mine = '';
      for (const [k, v] of Object.entries(r.strings || {})) {
        if (typeof v !== 'string' || !(k in D.en)) continue;
        out[k] = v;
        // a short, plain line to show as it changes
        if (!en && v.length <= 28 && !/[{<]/.test(v) && v !== D.en[k]) { en = D.en[k]; mine = v; }
      }
      ui.step(part + 1, parts, en, mine);
      show();
    }
    document.removeEventListener('focusout', onBlur);
    pending = null;
    if (Object.keys(out).length > total * 0.6) {
      extra[l] = out;
      A.store.kvSet(key, JSON.stringify(out));
      ui.done();
      if (lang() === l) { show(); A.toast(fmt(t('ui.translated'), { lang: A.langs.name(l) }), 'ok'); }
    } else if (failed) {
      // what came stays for this visit; the rest is in English until it is tried again
      if (!Object.keys(out).length) delete extra[l];
      ui.failed(() => ensure(true));
    } else ui.done();
  }

  // a string in a given language if there is a table for it, else in the interface language
  const tIn = (l, key) => fmt(table(l)?.[key] ?? t(key));

  A.t = t;
  A.tn = tn;
  A.i18n = { lang, ensure, tIn, setRuntime: (l) => { runtime = l; }, has: (l) => !!table(l) };
})();
