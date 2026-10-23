/* Client for the site's API. Prompts and the AI key live on the server (src/); ready-made data comes here.
   We look in the browser's local cache first, then ask the server (it has a shared cache for everyone). */
(() => {
  const A = window.App;

  class AIError extends Error {
    constructor(kind, message) { super(message || kind); this.kind = kind; }
  }

  /* Our own answers are JSON and come through Cloudflare (CF-Ray). Anything else — an HTML page with neither —
     was put there on the way, by a school's or an office's filter. A 404 without JSON is a copy of the site
     without its server (see 'offline' below). */
  const blocked = (res) => res.status !== 404 && !/json/i.test(res.headers.get('Content-Type') || '') && !res.headers.has('CF-Ray');

  /* Every request to the site's API (the AI, sync, the library, pictures, voices) goes through here. A network may
     block ordkort.com on the way (a school's filter answers DNS for it with its own address) while the same Worker
     still answers at its workers.dev address (config spareApi, src/worker.js). On the site's own page, a request
     that does not get through is asked there again, and the address that answered is kept for the rest of the visit.
     → the Response, or AIError 'offline' / 'network' */
  let base = '';
  const spare = () => (A.config && location.origin === A.config.site && A.config.spareApi) || '';
  async function call(path, opts = {}) {
    if (location.protocol === 'file:') throw new AIError('offline');
    const other = base ? '' : spare();
    // the picture proxy answers only a script, never an <img> or url() that names it (src/sources/images.js): at the
    // site's own address it is told by a header; at the spare one the request's Origin says it, and a header would
    // cost every picture a preflight
    const at = (where) => (where || !path.startsWith('img?') ? opts : { ...opts, headers: { ...opts.headers, 'X-Requested-With': 'ordkort' } });
    let res = null;
    try {
      res = await fetch(base + '/api/' + path, at(base));
      if (!other || !blocked(res)) return res;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      if (!other) throw new AIError('network');
    }
    try {
      const again = await fetch(other + '/api/' + path, at(other));
      if (blocked(again)) return res || again;
      base = other;
      return again;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      if (res) return res;
      throw new AIError('network');
    }
  }

  // a picture from the site's proxy as an <img>, always as a blob: URL: the proxy answers only a script, and the
  // page may only show pictures of its own address (CSP img-src). loading: 'lazy' still waits until it is in sight,
  // so a list of pictures takes no more of the hourly limit than the browser's own lazy loading did
  function img(path, attrs) {
    const el = A.h('img', attrs);
    const load = () => call(path).then((r) => (r.ok ? r.blob() : null)).then((b) => {
      if (!b) return;
      const u = URL.createObjectURL(b);
      el.addEventListener('load', () => URL.revokeObjectURL(u), { once: true });
      el.src = u;
    }).catch(() => {});
    if (attrs?.loading !== 'lazy' || typeof IntersectionObserver !== 'function') load();
    else {
      const seen = new IntersectionObserver((all) => { if (all.some((e) => e.isIntersecting)) { seen.disconnect(); load(); } }, { rootMargin: '200px' });
      seen.observe(el);
    }
    return el;
  }

  async function api(path, body, { signal } = {}) {
    const res = await call(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    if (blocked(res)) throw new AIError('blocked');
    const left = res.headers.get('X-AI-Left');
    if (left !== null) A.ai.quota = { left: +left, limit: +res.headers.get('X-AI-Limit') };
    let data = null;
    try { data = await res.json(); } catch { /* empty response */ }
    if (res.ok) return { data, res };
    const code = data?.error || '';
    if (res.status === 429) {
      if (code === 'quota') A.ai.quota = { left: 0, limit: data.limit || A.ai.quota?.limit || 0 };
      throw new AIError(code === 'budget' ? 'budget' : code === 'quota' ? 'quota' : 'rate');
    }
    if (res.status === 503) throw new AIError(code === 'not_configured' ? 'config' : 'busy');
    if (res.status === 413) throw new AIError('too_long');
    if (res.status === 404 && data?.error === 'gone') throw new AIError('gone');
    if (res.status === 404 && !data) throw new AIError('offline');
    throw new AIError('server');
  }

  const S = () => A.store.settings;
  const pair = () => ({ target: S().target, native: S().native });

  /* the browser's local cache — so that entries and chapters opened before work without a connection */
  async function cached(key, force, fetcher) {
    if (!force) { const c = A.store.cacheGet(key); if (c) return c; }
    const data = await fetcher();
    if (data) A.store.cacheSet(key, data);
    return data;
  }

  async function words({ topic, custom, phrases, level, n, signal }) {
    const have = A.store.cards().map((c) => c.term);
    const { data } = await api('words', { ...pair(), topic, custom, phrases, level, n, have }, { signal });
    return Array.isArray(data?.words) ? data.words : [];
  }

  /* the hand-made Norwegian words of a topic (scripts/anki-decks.mjs), for when the AI is down or busy:
     [] for any other language, a native language without them, or no connection */
  async function ready(topic) {
    const { target, native } = pair();
    if (target !== 'nb' || !topic || !/^[a-z]+$/.test(topic) || location.protocol === 'file:') return [];
    try {
      const res = await fetch(`/ready/nb/${native}/${topic}.json`);
      const data = res.ok ? await res.json() : null;
      return Array.isArray(data?.words) ? data.words : [];
    } catch { return []; }
  }

  async function fill({ term = '', tr = '' }) {
    const { data } = await api('fill', { ...pair(), level: S().level, term, tr });
    return data;
  }

  // up to 20 cards at once: [{ term, tr, ex }] → the same number of filled-in words (null where none came back)
  async function fillMany(words) {
    const { data } = await api('fillmany', { ...pair(), level: S().level, words });
    return Array.isArray(data?.words) ? data.words : [];
  }

  async function lookup(q, { force, signal } = {}) {
    const s = S();
    const key = `dict:${s.target}:${s.native}:${q.toLowerCase()}`;
    if (!force) { const c = A.store.cacheGet(key); if (c) return c; }
    const { data } = await api('lookup', { ...pair(), q, fresh: !!force }, { signal });
    if (data && data.found !== false) A.store.cacheSet(key, data);
    return data;
  }

  /* what Wiktionary says about a word, for languages without an official dictionary here → { found, page, section, articles } */
  function wikt(q, { signal } = {}) {
    const s = S();
    return cached(`wikt:${s.target}:${q.toLowerCase()}`, false, async () => (await api('wikt', { ...pair(), q }, { signal })).data);
  }

  function chapter(id, { force, signal } = {}) {
    const s = S();
    return cached(`gram:${s.target}:${s.native}:${id}`, force, async () => (await api('chapter', { ...pair(), id, fresh: !!force }, { signal })).data);
  }

  function ask(q, { force, signal } = {}) {
    const s = S();
    return cached(`ask:${s.target}:${s.native}:${q.toLowerCase()}`, force, async () => (await api('ask', { ...pair(), q, fresh: !!force }, { signal })).data);
  }

  function translate({ text, from, to, signal }) {
    const s = S();
    return cached(`tr:${s.target}:${s.native}:${from}:${to}:${text}`, false, async () => (await api('translate', { ...pair(), text, from, to }, { signal })).data);
  }

  async function uiPart(lang, part) {
    const { data, res } = await api('ui', { lang, part });
    return { strings: data, parts: +res.headers.get('X-UI-Parts') || 1 };
  }

  /* "Report a mistake": params identify the entry the same way the original request did */
  async function report(kind, params) {
    const { data } = await api('report', { ...pair(), kind, ...params });
    return data;
  }

  /* reading mode: one request per piece of text (≤ 600 chars), cached for everyone */
  function gloss(text, { signal } = {}) {
    const s = S();
    return cached(`gloss:${s.target}:${s.native}:${text}`, false, async () => (await api('gloss', { ...pair(), text }, { signal })).data);
  }

  /* cards saved before the dictionary check existed (not Norwegian: that one the browser does itself),
     up to 10 at a time → [{ term, forms, g } | null (not checked this time)] */
  async function check(words) {
    const { data } = await api('check', { ...pair(), words: words.map((w) => ({ term: w.term, pos: w.pos, forms: w.forms })) });
    return Array.isArray(data?.words) ? data.words : [];
  }

  async function shareDeck(deck) {
    const { data } = await api('share', { deck });
    return data.id;
  }
  async function sharedDeck(id) {
    const { data } = await api('share/' + encodeURIComponent(id));
    return data.deck;
  }

  async function limits() {
    const { data } = await api('limits');
    A.ai.quota = data;
    return data;
  }

  const errorText = (e) => {
    if (e?.name === 'AbortError') return '';
    return A.t('err.' + (e?.kind || 'server'));
  };

  A.ai = { api, words, ready, fill, fillMany, lookup, wikt, chapter, ask, translate, uiPart, limits, report, gloss, check, shareDeck, sharedDeck, errorText, AIError, blocked, call, img, quota: null };
})();
