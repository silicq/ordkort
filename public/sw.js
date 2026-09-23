/* Ordkort service worker: keeps the site usable offline.
   The site itself (HTML, CSS, JS, fonts, icons) is cached; AI requests (/api/*) always go to the network.
   Pages and scripts are network-first, so a new deploy is picked up as soon as you are online. */
const CACHE = 'ordkort-v2';
const CORE = [
  '/',
  '/css/fonts.css',
  '/css/style.css',
  '/js/boot.js',
  '/js/config.js',
  '/js/langs.js',
  '/js/i18n/en.js',
  '/js/i18n/ru.js',
  '/js/i18n/uk.js',
  '/js/i18n/nb.js',
  '/js/i18n/ar.js',
  '/js/i18n/zh.js',
  '/js/i18n.js',
  '/js/topics.js',
  '/js/store.js',
  '/js/ai.js',
  '/js/ordbok.js',
  '/js/ui.js',
  '/js/qr.js',
  '/js/sync.js',
  '/js/views/home.js',
  '/js/views/deck.js',
  '/js/views/study.js',
  '/js/views/dict.js',
  '/js/views/grammar.js',
  '/js/views/translate.js',
  '/js/views/settings.js',
  '/js/views/onboarding.js',
  '/js/views/devices.js',
  '/js/views/about.js',
  '/js/views/read.js',
  '/js/views/share.js',
  '/js/views/stats.js',
  '/js/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
];
const TIMEOUT = 3500; // on a very slow network fall back to the cached copy

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
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
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // fonts and icons never change: cache first
  if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // the app lives at "/" (routes are #hashes); other files opened directly keep their own entry
  const key = req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html') ? '/' : req;
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
