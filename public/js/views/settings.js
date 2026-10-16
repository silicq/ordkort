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

  /* The backup file: everything in localStorage, plus pictures of your own (those found on the web are fetched
     again from where they came from) and recordings (from Anki decks), as data URLs */
  async function backup() {
    const data = JSON.parse(A.store.exportData());
    const media = {};
    for (const p of Object.values(data.pairs || {})) {
      for (const c of Object.values(p.cards || {})) {
        for (const k of [c.imgUrl ? '' : c.img, c.audio]) {
          if (!k || media[k]) continue;
          const blob = await A.idb.mediaGet(k);
          if (blob) media[k] = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(blob); });
        }
      }
    }
    for (const k of Object.keys(media)) if (!media[k]) delete media[k];
    if (Object.keys(media).length) data.media = media;
    A.download(`ordkort-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
  }

  /* FSRS fitted to your own answers (js/fsrs.js): a button, what it found, and the way back to the defaults */
  function fsrsRow(row) {
    const s = A.store.settings;
    const status = h('small', { class: 'muted d-block' });
    const btn = h('button', { class: 'btn btn-soft btn-sm', type: 'button' }, icon('sparkle', 16), t('fsrs.go'));
    const reset = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', hidden: !s.fsrs },
      t('fsrs.reset'));
    const better = (f) => Math.max(0, Math.round((1 - f.after / f.before) * 100));
    const paint = () => {
      const f = A.store.settings.fsrs;
      status.textContent = f ? t('fsrs.own', { n: f.n, pct: better(f) }) : t('fsrs.default');
      reset.hidden = !f;
    };
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      status.textContent = t('fsrs.reading');
      try {
        const log = await A.idb.logAll(0);
        const r = await A.fsrs.fit(log, { onStep: (i, of) => { status.textContent = t('fsrs.working', { pct: Math.round((i / of) * 100) }); } });
        if (!r.ok && r.need) { status.textContent = t('fsrs.need', { n: r.reviews, need: r.need }); return; }
        if (!r.ok) { status.textContent = t('fsrs.no_better', { n: r.reviews }); return; }
        A.store.set({ fsrs: { w: r.w, n: r.reviews, before: Math.round(r.before * 10000) / 10000, after: Math.round(r.after * 10000) / 10000, at: Date.now() } });
        paint();
        A.toast(t('fsrs.done', { pct: better(r) }), 'ok');
      } catch (e) {
        console.error(e);
        status.textContent = t('fsrs.failed');
      } finally { btn.disabled = false; }
    });
    reset.addEventListener('click', () => { A.store.set({ fsrs: null }); paint(); A.toast(t('fsrs.back')); });
    paint();
    return row(t('fsrs.title'), t('fsrs.hint'), h('div', { class: 'fsrs-ctl' }, h('div', { class: 'row gap wrap' }, btn, reset), status));
  }

  /* Your own AI through MCP: the address to give it, how to connect it, and what to ask */
  function mcpCard() {
    const url = `${location.origin}/mcp`;
    const copy = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, icon('copy', 16), t('sync.copy'));
    copy.addEventListener('click', () => navigator.clipboard?.writeText(url).then(() => A.toast(t('sync.copied'))));
    const step = (who, how) => h('li', null, h('b', null, who), ' — ', how);
    return h('section', { class: 'set-card mcp-card' },
      h('h2', null, t('mcp.title')),
      h('p', { class: 'muted small' }, t('mcp.text')),
      h('div', { class: 'row gap mcp-url' },
        h('input', { class: 'input share-url', readonly: true, value: url, 'aria-label': t('mcp.address'), onfocus: (e) => e.target.select() }),
        copy),
      h('details', { class: 'mcp-how' },
        h('summary', null, t('mcp.how')),
        h('ul', { class: 'about-links' },
          step('Claude', t('mcp.claude')),
          step('ChatGPT', t('mcp.chatgpt')),
          step('Claude Code', h('code', null, `claude mcp add --transport http ordkort ${url}`)),
          step(t('mcp.others'), t('mcp.others_how')))),
      h('p', { class: 'small' }, h('b', null, t('mcp.try'))),
      h('ul', { class: 'about-links' }, ['mcp.ex1', 'mcp.ex2', 'mcp.ex3'].map((k) => h('li', null, t(k)))),
      h('p', { class: 'small muted safe-note' }, icon('info', 14), t('mcp.private')));
  }

  A.views.settings = {
    leave() { A.look.unpreview(); }, // the sample's CSS is only for this page
    render(root) {
      const s = A.store.settings;
      const set = (patch, rerender = false) => { A.store.set(patch); if (rerender) A.route(); else A.toast(t('set.saved')); };

      const row = (label, hint, control) => h('div', { class: 'set-row' },
        h('div', { class: 'set-label' }, h('b', null, label), hint ? h('small', null, hint) : null),
        h('div', { class: 'set-ctl' }, control));
      const card = (title, ...rows) => h('section', { class: 'set-card' }, h('h2', null, title), rows);
      // two columns that fill on their own; in one column (a phone) `--o` puts the cards in the order of use
      const col = (...cards) => h('div', { class: 'set-col' }, cards);
      const at = (n, el) => { el.style.setProperty('--o', n); return el; };

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
          // pictures of your own and recordings that came with the backup (the others are fetched again from where they came from)
          for (const [k, url] of Object.entries(data.media || {})) {
            const m = /^data:((?:image\/(?:jpeg|png|webp))|(?:audio\/[a-z0-9.+-]+));base64,([A-Za-z0-9+/=]+)$/.exec(url);
            if (!/^[pa][0-9a-f]{24}$/.test(k) || !m || (k[0] === 'a') !== m[1].startsWith('audio/')) continue;
            const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            await A.idb.mediaPut(k, new Blob([bytes], { type: m[1] })).catch(() => {});
          }
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
        h('div', { class: 'set-grid' }, col(
          at(1, card(t('set.languages'),
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
            row(t('set.ui'), null, uiSel))),
          at(4, A.devices.card()),
          at(6, card(t('set.ai'),
            h('p', { class: 'muted small' }, t('set.ai_hint')),
            row(t('set.quota'), t('set.quota_hint'), quotaEl),
            h('a', { class: 'link-btn small', href: '#/about' }, icon('info', 14), t('sync.how')))),
          at(8, mcpCard()),
          at(7, card(t('set.about'),
            h('p', { class: 'muted small' }, t('set.about_text')),
            h('ul', { class: 'about-links' },
              h('li', null, h('a', { href: 'https://ordbokene.no', target: '_blank', rel: 'noopener' }, 'ordbokene.no'), ' — ', t('set.src_ob')),
              h('li', null, h('a', { href: 'https://lexin.oslomet.no', target: '_blank', rel: 'noopener' }, 'Lexin'), ' — ', t('set.src_lexin')),
              h('li', null, h('a', { href: 'https://en.wiktionary.org', target: '_blank', rel: 'noopener' }, 'Wiktionary'), ' — ', t('set.src_wikt')),
              h('li', null, h('a', { href: 'https://commons.wikimedia.org', target: '_blank', rel: 'noopener' }, 'Wikimedia Commons'), ', ',
                h('a', { href: 'https://pixabay.com', target: '_blank', rel: 'noopener' }, 'Pixabay'), ', ',
                h('a', { href: 'https://openverse.org', target: '_blank', rel: 'noopener' }, 'Openverse'), ' — ', t('set.src_pics')),
              h('li', null, h('a', { href: 'https://groq.com', target: '_blank', rel: 'noopener' }, 'Groq'), ' — ', t('set.src_groq')))))),
        col(
          at(2, card(t('set.study'),
            row(t('set.direction'), null, A.segmented([
              { value: 'forward', label: `${s.target.toUpperCase()} → ${s.native.toUpperCase()}` },
              { value: 'reverse', label: `${s.native.toUpperCase()} → ${s.target.toUpperCase()}` },
              { value: 'mixed', label: t('set.mixed') },
            ], s.direction, (v) => set({ direction: v }))),
            row(t('set.grading'), t('set.grading_hint'), A.segmented([
              { value: 'two', label: t('set.grading_two') },
              { value: 'four', label: t('set.grading_four') },
            ], s.grading || 'two', (v) => set({ grading: v }))),
            fsrsRow(row),
            row(t('set.retention'), t('set.retention_hint'), (() => {
              const sel = h('select', { class: 'select narrow' }, [0.8, 0.85, 0.9, 0.95].map((v) => h('option', { value: v }, Math.round(v * 100) + '%')));
              sel.value = String(s.retention || 0.9);
              sel.addEventListener('change', () => set({ retention: +sel.value }));
              return sel;
            })()),
            row(t('set.new_per_day'), t('set.new_per_day_hint'), numSel([5, 10, 15, 20, 30, 50], s.newPerDay, (v) => set({ newPerDay: v }))),
            row(t('set.session'), null, numSel([10, 15, 20, 30, 50, 100], s.sessionSize, (v) => set({ sessionSize: v }))),
            row(t('set.goal'), t('set.goal_hint'), numSel([10, 20, 30, 50, 100, 200], s.goal || 20, (v) => set({ goal: v }))),
            row(t('set.batch'), t('set.batch_hint'), numSel([10, 20, 30], s.batch, (v) => set({ batch: v }))),
            row(t('set.autospeak'), t('set.autospeak_hint'), toggle(s.autoSpeak, (v) => set({ autoSpeak: v }))),
            row(t('set.voice'), t('set.voice_hint'), A.segmented([
              { value: 'site', label: t('set.voice_site') },
              { value: 'system', label: t('set.voice_system') },
            ], s.voice === 'system' ? 'system' : 'site', (v) => set({ voice: v }))))),
          at(5, card(t('set.data'),
            h('p', { class: 'muted small' }, t('set.data_hint', { kb: A.store.usage(), n: counts })),
            protection(),
            h('div', { class: 'row gap wrap' },
              h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: backup }, icon('download', 16), t('set.export')),
              h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => file.click() }, icon('upload', 16), t('set.import')),
              h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => A.anki.pick() }, icon('anki', 16), t('anki.import')),
              h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => A.anki.exportAll() }, icon('anki', 16), t('anki.export_all')),
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
              }, icon('trash', 16), t('set.reset')))))),
          // the theme and the card template together, across the whole width
          at(3, A.look.card({
            title: t('set.look'),
            before: row(t('set.theme'), null, A.segmented([
              { value: 'auto', label: t('set.theme_auto') },
              { value: 'light', label: t('set.theme_light') },
              { value: 'dark', label: t('set.theme_dark') },
            ], s.theme, (v) => { A.store.set({ theme: v }); A.applyTheme(); A.route(); })),
          }))));
      root.querySelector('.page-head h1').className = 'display';
    },
  };
})();
