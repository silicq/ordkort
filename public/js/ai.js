/* Клиент API сайта. Промпты и ключ ИИ живут на сервере (src/), сюда приходят готовые данные.
   Сначала смотрим в локальный кэш браузера, потом спрашиваем сервер (у него общий кэш для всех). */
(() => {
  const A = window.App;

  class AIError extends Error {
    constructor(kind, message) { super(message || kind); this.kind = kind; }
  }

  async function api(path, body, { signal } = {}) {
    if (location.protocol === 'file:') throw new AIError('offline');
    let res;
    try {
      res = await fetch('/api/' + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new AIError('network');
    }
    const left = res.headers.get('X-AI-Left');
    if (left !== null) A.ai.quota = { left: +left, limit: +res.headers.get('X-AI-Limit') };
    let data = null;
    try { data = await res.json(); } catch { /* пустой ответ */ }
    if (res.ok) return { data, res };
    const code = data?.error || '';
    if (res.status === 429) {
      if (code === 'quota') A.ai.quota = { left: 0, limit: data.limit || A.ai.quota?.limit || 0 };
      throw new AIError(code === 'budget' ? 'budget' : code === 'quota' ? 'quota' : 'rate');
    }
    if (res.status === 503) throw new AIError(code === 'not_configured' ? 'config' : 'busy');
    if (res.status === 413) throw new AIError('too_long');
    if (res.status === 404 && !data) throw new AIError('offline');
    throw new AIError('server');
  }

  const S = () => A.store.settings;
  const pair = () => ({ target: S().target, native: S().native });

  /* локальный кэш браузера — чтобы повторно открытые статьи и главы работали без сети */
  async function cached(key, force, fetcher) {
    if (!force) { const c = A.store.cacheGet(key); if (c) return c; }
    const data = await fetcher();
    if (data) A.store.cacheSet(key, data);
    return data;
  }

  async function words({ topic, custom, level, n, signal }) {
    const have = A.store.cards().map((c) => c.term);
    const { data } = await api('words', { ...pair(), topic, custom, level, n, have }, { signal });
    return Array.isArray(data?.words) ? data.words : [];
  }

  async function fill({ term = '', tr = '' }) {
    const { data } = await api('fill', { ...pair(), level: S().level, term, tr });
    return data;
  }

  async function lookup(q, { force, signal } = {}) {
    const s = S();
    const key = `dict:${s.target}:${s.native}:${q.toLowerCase()}`;
    if (!force) { const c = A.store.cacheGet(key); if (c) return c; }
    const { data } = await api('lookup', { ...pair(), q, fresh: !!force }, { signal });
    if (data && data.found !== false) A.store.cacheSet(key, data);
    return data;
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

  async function limits() {
    const { data } = await api('limits');
    A.ai.quota = data;
    return data;
  }

  const errorText = (e) => {
    if (e?.name === 'AbortError') return '';
    return A.t('err.' + (e?.kind || 'server'));
  };

  A.ai = { api, words, fill, lookup, chapter, ask, translate, uiPart, limits, errorText, AIError, quota: null };
})();
