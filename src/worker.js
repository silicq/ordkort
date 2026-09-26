/* Ordkort: a static site plus a small API on Cloudflare Workers.
   Static files (public/) are served by Cloudflare directly; this code runs only for /api/*. */
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
  report: api.report,
  gloss: api.gloss,
  check: api.check,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      // our own site only: other pages cannot spend limits on a visitor's behalf
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

      if (name === 'share') {
        if (m === 'POST' && !id) return await api.shareCreate(request, env, key);
        if (m === 'GET' && id) return await api.shareGet(env, id);
      }
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

  // once a day: delete expired counters and codes, and long-abandoned copies
  async scheduled(event, env, ctx) {
    ctx.waitUntil(initDB(env.DB).then(() => cleanup(env.DB)));
  },
};
