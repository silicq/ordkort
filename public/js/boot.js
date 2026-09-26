/* The theme is set before the page is drawn — no flash of a light background. A separate file, so that inline scripts stay forbidden (CSP). */
try {
  var saved = JSON.parse(localStorage.getItem('ordkort.v1') || 'null');
  var theme = saved && saved.settings && saved.settings.theme;
  if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
} catch (e) { /* storage unavailable */ }
// JavaScript runs: the description for search engines inside #app is not drawn (the app replaces it)
document.documentElement.classList.add('js');
