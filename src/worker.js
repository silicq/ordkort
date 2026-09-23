/* Ordkort: статический сайт + небольшой API на Cloudflare Workers.
   Статика (public/) раздаётся Cloudflare напрямую, этот код выполняется только для /api/*. */
import './shared.js';
import { initDB, cleanup } from './db.js';
import { clientKey, burst } from './limits.js';
import { HttpError, errorResponse } from './util.js';
import * as api from './api.js';
import * as sync from './sync.js';

const POST = {
  words: api.words,
  fill: api.fill,
  lookup: api.lookup,
  chapter: api.chapter,
  ask: api.ask,
  translate: api.translate,
  ui: api.ui,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      // только свой сайт: чужие страницы не могут тратить лимиты от имени посетителя
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'origin');
      if (request.method !== 'GET' && !String(request.headers.get('Content-Type') || '').startsWith('application/json')
        && request.method !== 'DELETE') throw new HttpError(415, 'json_only');

      const key = await clientKey(request, env);
      burst(key);
      await initDB(env.DB);

      const [name, id] = url.pathname.slice(5).split('/');
      const m = request.method;

      if (m === 'POST' && POST[name] && !id) return await POST[name](request, env, key);
      if (m === 'GET' && name === 'limits') return await api.limits(request, env, key);

      if (name === 'pair') {
        if (m === 'POST' && !id) return await sync.pairCreate(request, env, key);
        if (m === 'GET' && id) return await sync.pairTake(env, key, id, url.searchParams.has('peek'));
      }
      if (name === 'sync' && /^[a-f0-9]{32}$/.test(id || '')) {
        if (m === 'GET') return await sync.syncGet(request, env, key, id);
        if (m === 'PUT') return await sync.syncPut(request, env, key, id);
        if (m === 'DELETE') return await sync.syncDelete(request, env, key, id);
      }
      throw new HttpError(404, 'not_found');
    } catch (e) {
      return errorResponse(e);
    }
  },

  // раз в сутки: удалить истёкшие счётчики, коды и давно заброшенные копии
  async scheduled(event, env, ctx) {
    ctx.waitUntil(initDB(env.DB).then(() => cleanup(env.DB)));
  },
};
