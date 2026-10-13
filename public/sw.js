/* Ordkort service worker: keeps the site usable offline.
   The site itself (HTML, CSS, JS, fonts, icons) is cached; AI requests (/api/*) always go to the network.
   Pages and scripts are network-first, so a new deploy is picked up as soon as you are online.
   The cache is named after the version of the site (js/build.js, written at every deploy): a new deploy
   changes this worker too, so it installs a fresh copy of the site and throws the old one away. */
try { importScripts('/js/build.js'); } catch { /* a copy of public/ without a build */ }
const CACHE = 'ordkort-' + (self.App?.build || 'dev');
const CORE = [
  '/',
  ...(self.App?.build ? ['/js/build.js'] : []),
  '/css/fonts.css',
  '/css/style.css',
  '/js/boot.js',
  '/js/bundle.js', // all scripts of the app in one file (scripts/bundle.mjs)
  '/manifest.webmanifest',
  '/icons/icon-192.png',
];
const TIMEOUT = 3500; // on a very slow network fall back to the cached copy

self.addEventListener('install', (e) => {
  // `reload`: straight from the server, never an older copy from the browser's HTTP cache
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // ?fresh — the app asking the server for its current version: never from the cache
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.searchParams.has('fresh')) return;

  // fonts and icons never change: cache first
  if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // the app lives at "/" (routes are #hashes). Other pages — about the site, Norwegian topics and words,
  // a few thousand of them — are plain HTML: the browser loads them as usual and they stay out of the cache
  const app = url.pathname === '/' || url.pathname === '/index.html';
  if (req.mode === 'navigate' && !app) return;
  const key = req.mode === 'navigate' ? '/' : req;
  e.respondWith((async () => {
    const cached = await caches.match(key, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    });
    if (!cached) return network;
    const slow = new Promise((resolve) => setTimeout(() => resolve(cached), TIMEOUT));
    return Promise.race([network.catch(() => cached), slow]);
  })());
});
