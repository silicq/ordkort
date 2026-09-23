/* The app shell: header, routes, background deck generation. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  A.views = A.views || {};

  const NAV = [
    { id: 'home', href: '#/', icon: 'cards', label: 'nav.cards' },
    { id: 'dict', href: '#/dict', icon: 'book', label: 'nav.dict' },
    { id: 'read', href: '#/read', icon: 'read', label: 'nav.read' },
    { id: 'grammar', href: '#/grammar', icon: 'grammar', label: 'nav.grammar' },
    { id: 'translate', href: '#/translate', icon: 'translate', label: 'nav.translate' },
  ];
  const SECTION = { home: 'home', deck: 'home', study: 'home', dict: 'dict', grammar: 'grammar', translate: 'translate', settings: 'settings', about: 'settings', read: 'read', stats: 'home', s: 'home' };
  const OPEN_BEFORE_SETUP = ['link', 'about', 's']; // available before the first-run setup

  let current = null;
  let pendingRefresh = false;

  /* ---------- theme and interface language ---------- */
  const prefersDark = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => {
    const th = A.store.settings?.theme || 'auto';
    return th === 'dark' || (th === 'auto' && prefersDark.matches);
  };
  function applyTheme() {
    const th = A.store.settings?.theme || 'auto';
    const root = document.documentElement;
    if (th === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = th;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark() ? '#16140f' : '#f4efe6');
  }
  function applyLang() {
    const ui = A.i18n.lang();
    document.documentElement.lang = ui;
    document.documentElement.dir = A.langs.rtl(ui) ? 'rtl' : 'ltr';
    document.title = 'Ordkort — ' + t('meta.tagline');
  }
  A.applyTheme = applyTheme;
  A.applyLang = applyLang;

  /* ---------- header ---------- */
  function header(active) {
    const s = A.store.settings;
    return h('header', { class: 'top' },
      h('div', { class: 'shell top-in' },
        h('a', { class: 'brand', href: '#/', 'aria-label': 'Ordkort' }, A.logo(32), h('span', { class: 'brand-name' }, 'ordkort')),
        h('nav', { class: 'tabs', 'aria-label': t('nav.main') },
          NAV.map((n) => h('a', { href: n.href, class: 'tab' + (n.id === active ? ' active' : ''), 'aria-current': n.id === active ? 'page' : null },
            icon(n.icon), h('span', null, t(n.label))))),
        h('div', { class: 'top-actions' },
          h('button', { class: 'pair', type: 'button', onclick: pairDialog, title: t('pair.title') },
            h('span', { class: 'pair-from' }, s.native.toUpperCase()),
            icon('arrow', 13),
            h('span', { class: 'pair-to' }, A.langs.name(s.target)),
            icon('chevron', 15)),
          h('button', {
            class: 'icon-btn', type: 'button', title: t('theme.toggle'), 'aria-label': t('theme.toggle'),
            onclick: () => { A.store.set({ theme: isDark() ? 'light' : 'dark' }); applyTheme(); route(); },
          }, icon(isDark() ? 'sun' : 'moon')),
          h('a', { class: 'icon-btn' + (active === 'settings' ? ' active' : ''), href: '#/settings', title: t('nav.settings'), 'aria-label': t('nav.settings') }, icon('settings')))));
  }

  function footer() {
    return h('footer', { class: 'foot shell' },
      h('span', null, t('foot.local')),
      h('span', { class: 'foot-links' },
        h('a', { href: '#/about' }, t('foot.about')),
        h('a', { href: 'https://ordbokene.no', target: '_blank', rel: 'noopener' }, 'ordbokene.no'),
        h('a', { href: 'https://lexin.oslomet.no', target: '_blank', rel: 'noopener' }, 'Lexin'),
        h('a', { href: '#/settings' }, t('nav.settings'))));
  }

  /* ---------- choosing the language you learn ---------- */
  function pairDialog() {
    const s = A.store.settings;
    const pairs = A.store.pairs();
    if (!pairs.some((p) => p.target === s.target)) pairs.unshift({ target: s.target, native: s.native, count: 0 });
    const list = h('div', { class: 'pair-list' }, pairs.map((p) =>
      h('button', {
        class: 'pair-row' + (p.target === s.target ? ' on' : ''), type: 'button',
        onclick: () => { m.close(); switchTarget(p.target); },
      },
        h('span', { class: 'pair-hello serif', lang: p.target }, A.langs.get(p.target).hello),
        h('span', { class: 'pair-name' }, A.langs.name(p.target), h('small', null, A.tn('n_words', p.count))),
        p.target === s.target ? icon('check') : null)));

    const grid = h('div', { class: 'lang-grid compact', hidden: true },
      A.langs.list.filter((l) => l.code !== s.native && !pairs.some((p) => p.target === l.code)).map((l) =>
        h('button', { class: 'lang-tile', type: 'button', onclick: () => { m.close(); switchTarget(l.code); } },
          h('b', { lang: l.code }, l.name), h('small', null, l.en))));
    const addBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { grid.hidden = !grid.hidden; addBtn.hidden = true; } }, icon('plus'), t('pair.add'));

    const m = modal();
    function modal() {
      return A.modal({
        title: t('pair.title'),
        body: [h('p', { class: 'muted small' }, t('pair.hint', { lang: A.langs.name(s.native) })), list, addBtn, grid],
      });
    }
  }
  function switchTarget(code) {
    A.store.set({ target: code });
    location.hash = '#/';
    route();
  }

  /* ---------- routing ---------- */
  function parse() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
    return { name: parts[0] || 'home', params: parts.slice(1), query: new URLSearchParams(qs || '') };
  }

  function route() {
    applyLang();
    current?.view?.leave?.();
    const app = document.getElementById('app');
    const { name, params, query } = parse();

    if (!A.store.ready && OPEN_BEFORE_SETUP.includes(name)) {
      document.body.className = 'onboarding-mode view-' + name;
      const main = h('main', { class: 'shell main' });
      app.replaceChildren(h('div', { class: 'shell onb-top' }, h('a', { class: 'brand', href: '#/' }, A.logo(32), h('span', { class: 'brand-name' }, 'ordkort'))), main);
      current = { view: A.views[name], name, params, query, main };
      A.views[name].render(main, params, query);
      window.scrollTo(0, 0);
      return;
    }

    if (!A.store.ready) {
      document.body.className = 'onboarding-mode';
      const main = h('main', { class: 'onb-main' });
      app.replaceChildren(main);
      current = { view: A.views.onboarding };
      A.views.onboarding.render(main);
      return;
    }

    const view = A.views[name] || A.views.home;
    const section = SECTION[name] || 'home';
    document.body.className = 'view-' + name;
    const main = h('main', { class: 'shell main', id: 'main' });
    app.replaceChildren(header(section), main, footer());
    current = { view, name, params, query, main };
    try {
      view.render(main, params, query);
    } catch (e) {
      console.error(e);
      main.append(h('div', { class: 'empty' }, h('h2', null, t('err.view')), h('p', { class: 'muted' }, String(e.message || e))));
    }
    if (!current.keepScroll) window.scrollTo(0, 0);
  }

  /* Redraw the current screen if it is "live" (for example, word generation has finished) */
  function refresh() {
    if (!current?.view?.live) return;
    const ae = document.activeElement;
    if (ae && current.main?.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) {
      if (!pendingRefresh) {
        pendingRefresh = true;
        ae.addEventListener('blur', () => { pendingRefresh = false; setTimeout(refresh, 50); }, { once: true });
      }
      return;
    }
    const y = window.scrollY;
    current.view.leave?.();
    current.main.replaceChildren();
    current.view.render(current.main, current.params, current.query);
    window.scrollTo(0, y);
  }

  /* ---------- background word generation (one job at a time, to stay within the limits) ---------- */
  const jobs = new Map();
  const queue = [];
  let busy = false;

  function generate(deckId, n) {
    if (jobs.has(deckId)) return;
    jobs.set(deckId, { label: t('gen.queued') });
    queue.push({ deckId, n: n || A.store.settings.batch });
    refresh();
    pump();
  }
  async function pump() {
    if (busy || !queue.length) return;
    busy = true;
    const { deckId, n } = queue.shift();
    const d = A.store.deck(deckId);
    try {
      if (!d) return;
      jobs.set(deckId, { label: t('gen.working') });
      refresh();
      const words = await A.ai.words({
        topic: d.topic || undefined,
        custom: d.topic ? undefined : d.title || 'everyday words',
        level: d.level || A.store.settings.level,
        n,
      });
      const added = A.store.addCards(deckId, words);
      A.toast(added ? A.tn('gen.added', added, { deck: A.deckTitle(d) }) : t('gen.none'), added ? 'ok' : '');
    } catch (e) {
      A.toast(A.ai.errorText(e), 'error');
    } finally {
      jobs.delete(deckId);
      busy = false;
      refresh();
      pump();
    }
  }
  A.jobs = { generate, state: (id) => jobs.get(id) || null };

  /* Ask the browser not to evict the site's data when space runs low (called after a user action) */
  A.persist = async () => {
    try {
      if (!navigator.storage?.persist) return false;
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch { return false; }
  };

  /* Installing as an app: Chrome/Edge fire an event; on iPhone it is Share → Add to Home Screen */
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
  A.install = {
    available: () => !!installPrompt,
    run: async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice.catch(() => {}); installPrompt = null; },
    standalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    ios: () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  };

  A.route = route;
  A.refresh = refresh;
  A.isDark = isDark;
  A.go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

  function start() {
    A.store.load();
    applyTheme();
    window.addEventListener('hashchange', route);
    prefersDark.addEventListener?.('change', () => { applyTheme(); if (A.store.settings?.theme === 'auto') route(); });
    A.sync.start();
    route();
    A.i18n.ensure();
    // offline mode: the site itself is cached by a service worker; AI features need the network
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    window.addEventListener('offline', () => A.toast(t('net.offline')));
    window.addEventListener('online', () => A.toast(t('net.online'), 'ok'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
