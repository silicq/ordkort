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
  async function ensure() {
    const l = lang();
    if (table(l) || !A.store?.ready) return;
    if (pending === l) return;
    const key = `ordkort.ui.${l}.v${A.config.uiVersion}`;
    try {
      const saved = JSON.parse(A.store.kvGet(key) || 'null');
      if (saved) { extra[l] = saved; A.route(); return; }
    } catch { /* no saved translation */ }

    pending = l;
    A.toast(D.en['ui.translating']);
    const total = Object.keys(D.en).length;
    const out = {};
    // the server knows the English strings and translates them in parts; translations are shared by everyone
    for (let part = 0, parts = 1; part < parts; part++) {
      try {
        const r = await A.ai.uiPart(l, part);
        parts = r.parts;
        for (const [k, v] of Object.entries(r.strings || {})) if (typeof v === 'string' && k in D.en) out[k] = v;
      } catch {
        break;
      }
    }
    pending = null;
    if (Object.keys(out).length > total * 0.6) {
      extra[l] = out;
      A.store.kvSet(key, JSON.stringify(out));
      if (lang() === l) A.route();
    }
  }

  // a string in a given language if there is a table for it, else in the interface language
  const tIn = (l, key) => fmt(table(l)?.[key] ?? t(key));

  A.t = t;
  A.tn = tn;
  A.i18n = { lang, ensure, tIn, setRuntime: (l) => { runtime = l; }, has: (l) => !!table(l) };
})();
