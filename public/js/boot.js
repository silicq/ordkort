/* Тема до отрисовки страницы — без вспышки светлого фона. Отдельный файл, чтобы не разрешать inline-скрипты (CSP). */
try {
  var saved = JSON.parse(localStorage.getItem('ordkort.v1') || 'null');
  var theme = saved && saved.settings && saved.settings.theme;
  if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
} catch (e) { /* хранилище недоступно */ }
