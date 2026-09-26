/* Ordkort — browser-side configuration.
   There is no AI key here: requests go to /api on this same site, and the key lives only on the server. */
window.App = window.App || {};
App.views = App.views || {};

App.config = {
  storageKey: 'ordkort.v1',      // cards, progress, settings
  cacheKey: 'ordkort.cache.v1',  // saved AI answers (safe to clear)
  syncKey: 'ordkort.sync.v1',    // sync secret — stays on this device, never goes into backups
  cacheLimit: 300,
  uiVersion: 7,                // bump when UI strings change, so machine-translated UIs are rebuilt
  repoUrl: 'https://github.com/silicq/ordkort', // source code, linked from the About page
};
