/* Settings: languages, study, appearance, AI, data. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;

  /* Data protection: persistent storage and installing as an app (on iPhone this switches off Safari's 7-day cleanup) */
  function protection() {
    const status = h('b', null, '…');
    const box = h('div', { class: 'protect' },
      h('div', { class: 'set-row' },
        h('div', { class: 'set-label' }, h('b', null, t('set.storage')), h('small', null, t('set.storage_hint'))),
        h('div', { class: 'set-ctl' }, status)));
    const paint = (ok) => {
      status.textContent = t(ok ? 'set.storage_persist' : 'set.storage_best');
      status.className = ok ? 'ok-text' : 'muted';
    };
    (navigator.storage?.persisted?.() || Promise.resolve(false)).then(paint).catch(() => paint(false));
    if (A.install.standalone()) return box;
    if (A.install.available()) {
      box.append(h('button', { class: 'btn btn-soft btn-sm', type: 'button', onclick: async () => { await A.install.run(); A.route(); } }, icon('download', 16), t('set.install')));
    } else if (A.install.ios()) {
      box.append(h('p', { class: 'callout ios-hint' }, icon('info', 18), h('span', null, t('set.install_ios'))));
    }
    return box;
  }

  A.views.settings = {
    render(root) {
      const s = A.store.settings;
      const set = (patch, rerender = false) => { A.store.set(patch); if (rerender) A.route(); else A.toast(t('set.saved')); };

      const row = (label, hint, control) => h('div', { class: 'set-row' },
        h('div', { class: 'set-label' }, h('b', null, label), hint ? h('small', null, hint) : null),
        h('div', { class: 'set-ctl' }, control));
      const card = (title, ...rows) => h('section', { class: 'set-card' }, h('h2', null, title), rows);

      const uiSel = h('select', { class: 'select' },
        h('option', { value: '' }, t('set.ui_same')),
        A.langs.list.map((l) => h('option', { value: l.code }, l.name)));
      uiSel.value = s.ui || '';
      uiSel.addEventListener('change', () => { A.store.set({ ui: uiSel.value }); A.route(); A.i18n.ensure(); });

      const toggle = (value, onChange) => {
        const c = h('input', { type: 'checkbox', class: 'switch', role: 'switch' });
        c.checked = !!value;
        c.addEventListener('change', () => onChange(c.checked));
        return c;
      };
      const numSel = (values, value, onChange) => {
        const sel = h('select', { class: 'select narrow' }, values.map((v) => h('option', { value: v }, v)));
        sel.value = value;
        sel.addEventListener('change', () => onChange(+sel.value));
        return sel;
      };

      // what is left of the daily AI limit (the server counts by an anonymous fingerprint)
      const quotaEl = h('b', { class: 'quota-n' }, A.ai.quota ? `${A.ai.quota.left} / ${A.ai.quota.limit}` : '…');
      A.ai.limits().then((q) => { quotaEl.textContent = `${q.left} / ${q.limit}`; }).catch(() => { quotaEl.textContent = '—'; });

      const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
      file.addEventListener('change', async () => {
        const f = file.files?.[0];
        if (!f) return;
        try {
          const data = JSON.parse(await f.text());
          if (!(await A.confirm(t('set.import_q'), { ok: t('set.import') }))) return;
          A.store.importData(data);
          A.applyTheme();
          A.toast(t('set.imported'), 'ok');
          A.go('#/');
        } catch { A.toast(t('set.import_bad'), 'error'); }
        file.value = '';
      });

      const counts = A.store.pairs().reduce((n, p) => n + p.count, 0);

      root.append(
        h('section', { class: 'page-head' },
          A.rich(t('set.title'), 'h1'),
          h('p', { class: 'lede' }, t('set.lede'))),
        h('div', { class: 'set-grid' },
          card(t('set.languages'),
            row(t('set.native'), t('set.native_hint'), A.langSelect(s.native, {
              onChange: async (v) => {
                if (v === s.target) { A.toast(t('set.same_lang'), 'error'); A.route(); return; }
                A.store.set({ native: v });
                A.route();
                A.i18n.ensure();
              },
            })),
            row(t('set.target'), t('set.target_hint'), A.langSelect(s.target, {
              exclude: [s.native],
              onChange: (v) => { A.store.set({ target: v }); A.route(); },
            })),
            row(t('set.ui'), null, uiSel)),
          card(t('set.study'),
            row(t('set.direction'), null, A.segmented([
              { value: 'forward', label: `${s.target.toUpperCase()} → ${s.native.toUpperCase()}` },
              { value: 'reverse', label: `${s.native.toUpperCase()} → ${s.target.toUpperCase()}` },
              { value: 'mixed', label: t('set.mixed') },
            ], s.direction, (v) => set({ direction: v }))),
            row(t('set.new_per_day'), t('set.new_per_day_hint'), numSel([5, 10, 15, 20, 30, 50], s.newPerDay, (v) => set({ newPerDay: v }))),
            row(t('set.session'), null, numSel([10, 15, 20, 30, 50, 100], s.sessionSize, (v) => set({ sessionSize: v }))),
            row(t('set.goal'), t('set.goal_hint'), numSel([10, 20, 30, 50, 100, 200], s.goal || 20, (v) => set({ goal: v }))),
            row(t('set.batch'), t('set.batch_hint'), numSel([10, 20, 30], s.batch, (v) => set({ batch: v }))),
            row(t('set.autospeak'), t('set.autospeak_hint'), toggle(s.autoSpeak, (v) => set({ autoSpeak: v })))),
          card(t('set.look'),
            row(t('set.theme'), null, A.segmented([
              { value: 'auto', label: t('set.theme_auto') },
              { value: 'light', label: t('set.theme_light') },
              { value: 'dark', label: t('set.theme_dark') },
            ], s.theme, (v) => { A.store.set({ theme: v }); A.applyTheme(); A.route(); }))),
          A.devices.card(),
          card(t('set.ai'),
            h('p', { class: 'muted small' }, t('set.ai_hint')),
            row(t('set.quota'), t('set.quota_hint'), quotaEl),
            h('a', { class: 'link-btn small', href: '#/about' }, icon('info', 14), t('sync.how'))),
          card(t('set.data'),
            h('p', { class: 'muted small' }, t('set.data_hint', { kb: A.store.usage(), n: counts })),
            protection(),
            h('div', { class: 'row gap wrap' },
              h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => A.download(`ordkort-${new Date().toISOString().slice(0, 10)}.json`, A.store.exportData()) }, icon('download', 16), t('set.export')),
              h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => file.click() }, icon('upload', 16), t('set.import')),
              file,
              h('button', {
                class: 'btn btn-ghost btn-sm', type: 'button',
                onclick: async () => { if (await A.confirm(t('set.clear_cache_q'))) { A.store.cacheClear(); A.toast(t('set.cache_cleared')); A.route(); } },
              }, icon('refresh', 16), t('set.clear_cache')),
              h('button', {
                class: 'btn btn-ghost btn-sm danger', type: 'button',
                onclick: async () => {
                  if (await A.confirm(t('set.reset_q'), { ok: t('set.reset'), danger: true })) { await A.sync.disable().catch(() => {}); A.store.resetAll(); A.go('#/'); }
                },
              }, icon('trash', 16), t('set.reset')))),
          card(t('set.about'),
            h('p', { class: 'muted small' }, t('set.about_text')),
            h('ul', { class: 'about-links' },
              h('li', null, h('a', { href: 'https://ordbokene.no', target: '_blank', rel: 'noopener' }, 'ordbokene.no'), ' — ', t('set.src_ob')),
              h('li', null, h('a', { href: 'https://lexin.oslomet.no', target: '_blank', rel: 'noopener' }, 'Lexin'), ' — ', t('set.src_lexin')),
              h('li', null, h('a', { href: 'https://en.wiktionary.org', target: '_blank', rel: 'noopener' }, 'Wiktionary'), ' — ', t('set.src_wikt')),
              h('li', null, h('a', { href: 'https://groq.com', target: '_blank', rel: 'noopener' }, 'Groq'), ' — ', t('set.src_groq'))))));
      root.querySelector('.page-head h1').className = 'display';
    },
  };
})();
