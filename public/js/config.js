/* Ordkort — browser-side configuration.
   There is no AI key here: requests go to /api on this same site, and the key lives only on the server. */
window.App = window.App || {};
App.views = App.views || {};
// the site inside its own look preview (Settings → Appearance → on a phone): it shows, and changes nothing
App.framed = (() => { try { return window.self !== window.top; } catch { return true; } })();

App.config = {
  storageKey: 'ordkort.v1',      // cards, progress, settings
  cacheKey: 'ordkort.cache.v1',  // saved AI answers (safe to clear)
  syncKey: 'ordkort.sync.v1',    // sync secret — stays on this device, never goes into backups
  cacheLimit: 300,
  uiVersion: 9,                // bump when UI strings change, so machine-translated UIs are rebuilt
  repoUrl: 'https://github.com/silicq/ordkort', // source code, linked from the About page
  mail: 'hei@ordkort.com', // questions and help: Email Routing hands the letters to the Worker (src/mail.js)
  mails: ['hei@ordkort.com', 'post@ordkort.com', 'help@ordkort.com', 'support@ordkort.com'], // every address, named on the About page so nobody mistakes a real one for a fake
  site: 'https://ordkort.com',
  // the same Worker at its workers.dev address: the site's pages ask there when a network blocks ordkort.com (js/ai.js)
  spareApi: 'https://ordkort.monkeyminiversion.workers.dev',
};
