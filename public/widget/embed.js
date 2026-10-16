/* The cards of one topic in a frame on another site (/embed/<ui>/<topic>/, written by scripts/seo-pages.mjs).
   The words come with the page as JSON; the card turns over on a tap, the arrows and Shuffle go through them.
   Nothing is stored and nothing is sent: the frame works the same on any site. */
(() => {
  let words = JSON.parse(document.getElementById('data').textContent);
  let i = 0, back = false;
  const $ = (id) => document.getElementById(id);
  const card = $('card');

  function show() {
    const w = words[i];
    $('term').textContent = w.term;
    $('tr').textContent = w.tr;
    $('forms').textContent = w.forms;
    $('ex').textContent = w.ex;
    $('extr').textContent = w.exTr;
    $('n').textContent = `${i + 1} / ${words.length}`;
    card.classList.toggle('turned', back);
    card.setAttribute('aria-pressed', String(back));
  }
  const go = (d) => { i = (i + d + words.length) % words.length; back = false; show(); };

  card.addEventListener('click', () => { back = !back; show(); });
  $('prev').addEventListener('click', () => go(-1));
  $('next').addEventListener('click', () => go(1));
  $('shuffle').addEventListener('click', () => {
    words = words.slice();
    for (let k = words.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [words[k], words[j]] = [words[j], words[k]]; }
    i = 0; back = false; show();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  });
  show();
})();
