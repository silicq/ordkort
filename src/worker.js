/* Ordkort: a static site plus a small API on Cloudflare Workers, and the mail of the site (src/mail.js).
   Static files (public/) are served by Cloudflare directly; this code runs only for /api/*. */
import './core/shared.js';
import { initDB, cleanup } from './core/db.js';
import { clientKey, burst } from './core/limits.js';
import { HttpError, errorResponse } from './core/util.js';
import * as api from './ai/routes.js';
import * as sync from './decks/sync.js';
import * as share from './decks/share.js';
import * as images from './sources/images.js';
import * as voice from './sources/voice.js';
import * as library from './decks/library.js';
import * as mcp from './mcp.js';
import * as preview from './decks/preview.js';
import { warmOne } from './ai/warm.js';
import * as mail from './mail.js';

const DAILY = '17 3 * * *'; // the daily cron in wrangler.jsonc; the other one fills the word bank

/* The site's own pages may ask the API at another address of this Worker (its workers.dev one, public/js/config.js
   spareApi) when a network blocks ordkort.com on the way: a school's filter answers DNS for the site with its own
   address, while workers.dev still gets through. Only the site's pages, and only to read what they need. */
const SITE = 'https://ordkort.com';
const CORS = {
  'Access-Control-Allow-Origin': SITE,
  'Access-Control-Expose-Headers': 'X-AI-Left, X-AI-Limit, X-UI-Parts, X-Cache, X-Voice-By, CF-Ray',
  Vary: 'Origin',
};
const PREFLIGHT = {
  ...CORS,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Token, X-Lib-Token',
  'Access-Control-Max-Age': '86400',
};
function forSite(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

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

async function route(request, env, url) {
  try {
    // our own site only (at any address of this Worker): other pages cannot spend limits on a visitor's behalf
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin && origin !== SITE) throw new HttpError(403, 'origin');
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
      if (m === 'POST' && !id) return await share.shareCreate(request, env, key);
      if (m === 'GET' && id) return await share.shareGet(env, id);
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
}

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
    if (url.pathname === '/.well-known/mcp-registry-auth') {
      return new Response(mcp.REGISTRY_AUTH, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    }
    // how AI clients find the MCP server: a catalog of what the site offers agents, and the server's card
    if (url.pathname === '/.well-known/ai-catalog.json' || url.pathname === '/mcp/server-card') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      const body = url.pathname === '/mcp/server-card' ? mcp.serverCard() : mcp.aiCatalog();
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(body, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    // a shared deck or look by its own address: the app's page with a link preview of what is shared (src/decks/preview.js)
    const shared = preview.match(url.pathname);
    if (shared) {
      try {
        await initDB(env.DB);
        return await preview.page(request, env, shared);
      } catch (e) {
        console.error(e);
        return env.ASSETS.fetch(new Request(new URL('/', request.url)));
      }
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    // the site's page at another address of this Worker: answered with CORS, the browser asks first for anything but GET
    const fromSite = request.headers.get('Origin') === SITE && url.origin !== SITE;
    if (request.method === 'OPTIONS') return fromSite ? new Response(null, { status: 204, headers: PREFLIGHT }) : errorResponse(new HttpError(403, 'origin'));
    const res = await route(request, env, url);
    return fromSite ? forSite(res) : res;
  },

  // once a day: delete expired counters and codes, and long-abandoned copies;
  // every 15 minutes: one more group of ready words for the shared bank, while the site is quiet (src/ai/warm.js)
  // letters to hei@, post@, help@ and support@ordkort.com, handed over by Email Routing (src/mail.js)
  async email(message, env) {
    await initDB(env.DB).catch(() => {});
    await mail.receive(message, env);
  },

  async scheduled(event, env, ctx) {
    if (event.cron === DAILY) ctx.waitUntil(initDB(env.DB).then(() => cleanup(env.DB)));
    else ctx.waitUntil(initDB(env.DB).then(() => warmOne(env)).then((r) => console.log('warm:', r), (e) => console.log('warm failed:', e.message)));
  },
};
