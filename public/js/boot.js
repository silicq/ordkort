/* The theme is set before the page is drawn — no flash of a light background. A separate file, so that inline scripts stay forbidden (CSP). */
try {
  // the theme is kept apart (js/store.js): the cards themselves are in IndexedDB, which cannot be read this early
  var theme = localStorage.getItem('ordkort.theme');
  if (theme == null) { var saved = JSON.parse(localStorage.getItem('ordkort.v1') || 'null'); theme = saved && saved.settings && saved.settings.theme; }
  if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
} catch (e) { /* storage unavailable */ }
// a shared deck or look by its own address (/s/ID, /look/ID: the Worker gave the page a preview of it for chat apps)
// becomes the app's route, so the app opens it as it always did
var shared = /^\/(s|look)\/([0-9A-Z]{8})\/?$/.exec(location.pathname);
if (shared) history.replaceState(null, '', '/#/' + shared[1] + '/' + shared[2]);
// JavaScript runs: the description for search engines inside #app is not drawn (the app replaces it)
document.documentElement.classList.add('js');
