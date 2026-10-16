/* Ordkort: a static site plus a small API on Cloudflare Workers.
   Static files (public/) are served by Cloudflare directly; this code runs only for /api/*. */
import './shared.js';
import { initDB, cleanup } from './db.js';
import { clientKey, burst } from './limits.js';
import { HttpError, errorResponse } from './util.js';
import * as api from './api.js';
import * as sync from './sync.js';
import * as images from './images.js';
import * as voice from './voice.js';
import * as library from './library.js';
import * as mcp from './mcp.js';
import { warmOne } from './warm.js';

const DAILY = '17 3 * * *'; // the daily cron in wrangler.jsonc; the other one fills the word bank

const POST = {
  words: api.words,
  fill: api.fill,
  fillmany: api.fillMany,
  lookup: api.lookup,
  chapter: api.chapter,
  ask: api.ask,
  translate: api.translate,
  ui: api.ui,
  report: api.report,
  gloss: api.gloss,
  check: api.check,
  wikt: api.wikt,
  images: images.search,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // the MCP server for people's own AI (src/mcp.js): called by their AI's servers, so no Origin check
    if (url.pathname === '/mcp') {
      try {
        const key = await clientKey(request, env);
        burst(key);
        await initDB(env.DB);
        return await mcp.handle(request, env, key);
      } catch (e) { return errorResponse(e); }
    }
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

      const [name, id, sub] = url.pathname.slice(5).split('/');
      const m = request.method;

      if (m === 'POST' && POST[name] && !id) return await POST[name](request, env, key);
      if (m === 'GET' && name === 'limits') return await api.limits(request, env, key);
      if (m === 'GET' && name === 'img' && !id) return await images.proxy(request, env, key);
      if (m === 'GET' && name === 'tts' && !id) return await voice.tts(request, env, key);

      if (name === 'share') {
        if (m === 'POST' && !id) return await api.shareCreate(request, env, key);
        if (m === 'GET' && id) return await api.shareGet(env, id);
        if (m === 'DELETE' && id) return await library.removeShare(request, env, id);
      }
      if (name === 'library') {
        if (m === 'GET' && !id) return await library.list(request, env);
        if (m === 'POST' && !id) return await library.publish(request, env, key);
        if (m === 'GET' && id === 'hidden') return await library.hidden(request, env);
        if (m === 'GET' && id && !sub) return await library.get(env, id);
        if (m === 'POST' && id && sub) return await library.act(request, env, key, id, sub);
        if (m === 'DELETE' && id) return await library.remove(request, env, id);
      }
      if (name === 'pair') {
        if (m === 'POST' && !id) return await sync.pairCreate(request, env, key);
        if (m === 'GET' && id) return await sync.pairTake(env, key, id, url.searchParams.has('peek'));
      }
      if (name === 'media' && /^[a-f0-9]{32}$/.test(id || '')) {
        if (m === 'GET' && !sub) return await sync.mediaList(request, env, key, id);
        if (m === 'GET' && sub) return await sync.mediaGet(request, env, key, id, sub);
        if (m === 'PUT' && sub) return await sync.mediaPut(request, env, key, id, sub);
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

  // once a day: delete expired counters and codes, and long-abandoned copies;
  // every 15 minutes: one more group of ready words for the shared bank, while the site is quiet (src/warm.js)
  async scheduled(event, env, ctx) {
    if (event.cron === DAILY) ctx.waitUntil(initDB(env.DB).then(() => cleanup(env.DB)));
    else ctx.waitUntil(initDB(env.DB).then(() => warmOne(env)).then((r) => console.log('warm:', r), (e) => console.log('warm failed:', e.message)));
  },
};
