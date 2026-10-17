/* Opening an Ordkort link inside the app. On an iPhone the app on the home screen keeps its own cards, apart from
   Safari's, and a link always opens in Safari; so a link to a shared deck, a deck in the library, a look or a topic
   can be pasted here instead. Any address of the site works: only its route (#/s/ID, /s/ID, #/lib/ID…) is used. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  const ROUTES = new Set(['', 's', 'lib', 'look', 'library', 'dict', 'grammar', 'read', 'translate', 'link']);

  // an address (or a route) → the app's #/route, or null when it is not one of ours
  function routeOf(text) {
    const s = String(text || '').trim();
    if (!s) return null;
    let u;
    try { u = new URL(s, location.origin); } catch { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    const path = /^\/(s|look|lib)\/([0-9A-Za-z]{8})\/?$/.exec(u.pathname); // a link's own address, as chat apps show it
    if (path) return `#/${path[1]}/${path[2].toUpperCase()}`;
    if (!u.hash.startsWith('#/')) return null;
    const name = u.hash.slice(2).split(/[/?]/)[0];
    return ROUTES.has(name) ? u.hash : null;
  }

  function ask() {
    const input = h('input', { class: 'input', type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: t('open.ph') });
    const go = () => {
      const r = routeOf(input.value);
      if (!r) { A.toast(t('open.bad'), 'error'); input.focus(); return; }
      m.close();
      A.go(r);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    const paste = navigator.clipboard?.readText ? h('button', {
      class: 'btn btn-ghost btn-sm', type: 'button',
      onclick: async () => { try { input.value = (await navigator.clipboard.readText()).trim(); go(); } catch { input.focus(); } },
    }, icon('copy', 16), t('open.paste')) : null;
    const m = A.modal({
      title: t('open.title'),
      body: h('div', { class: 'form-grid' }, h('p', { class: 'muted small' }, t('open.hint')), input, paste),
      actions: [h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: go }, t('open.go'))],
    });
    setTimeout(() => input.focus(), 50);
  }

  // in Safari on an iPhone, on a page that adds something: how to get it into the app on the home screen instead
  function inAppNote() {
    if (!A.install.ios() || A.install.standalone() || A.framed) return null;
    const copy = h('button', { class: 'link-btn small', type: 'button', onclick: () => navigator.clipboard?.writeText(location.href).then(() => A.toast(t('sync.copied'))) }, icon('copy', 14), t('sync.copy'));
    return h('p', { class: 'callout plain small in-app-note' }, icon('info', 16), h('span', { class: 'grow' }, t('open.in_app')), copy);
  }

  A.openLink = { routeOf, ask, inAppNote };
})();
