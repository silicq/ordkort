/* Deck tools: CSV export / import (works with Anki "Notes in plain text" exports too)
   and sharing a deck by link. A shared deck contains only words — never progress. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  const COLS = ['term', 'translation', 'pos', 'grammar', 'forms', 'pronunciation', 'example', 'example_translation'];

  /* ---------- CSV ---------- */
  const q = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  function toCSV(cards) {
    const rows = cards.map((c) => [c.term, c.tr, c.pos, c.gram, c.forms, c.pron, c.ex, c.exTr].map(q).join(','));
    return '﻿' + [COLS.join(','), ...rows].join('\r\n'); // BOM so that Excel opens UTF-8 correctly
  }

  function parseCSV(text) {
    text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#')); // Anki adds "#separator:tab" lines
    if (!lines.length) return [];
    const head = lines[0];
    const counts = { '\t': head.split('\t').length, ';': head.split(';').length, ',': head.split(',').length };
    const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = '', inQ = false;
    const body = lines.join('\n') + '\n';
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (inQ) {
        if (ch === '"' && body[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cell += ch;
      } else if (ch === '"' && !cell) inQ = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    let data = rows.map((r) => r.map(strip));
    if (/^(term|word|front|слово|ord)$/i.test(data[0]?.[0] || '')) data = data.slice(1); // header row
    return data.filter((r) => r[0] && r[1]).map((r) => ({
      term: r[0], tr: r[1], pos: (r[2] || '').toLowerCase(), gram: r[3] || '', forms: r[4] || '', pron: r[5] || '', ex: r[6] || '', ex_tr: r[7] || '',
    }));
  }

  const fileName = (d) => (A.deckTitle(d) || 'deck').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) || 'deck';

  function exportCSV(d) {
    A.download(fileName(d) + '.csv', toCSV(A.store.cards(d.id).sort((a, b) => a.created - b.created)), 'text/csv;charset=utf-8');
  }

  function importCSV(d) {
    const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      let words = [];
      try { words = parseCSV(await f.text()); } catch { words = []; }
      if (!words.length) { A.toast(t('csv.empty'), 'error'); return; }
      const m = A.modal({
        title: t('csv.import_title'),
        body: h('div', null,
          h('p', { class: 'muted' }, t('csv.found', { n: words.length })),
          h('ul', { class: 'share-preview' }, words.slice(0, 8).map((w) => h('li', null, A.lt(w.term, A.store.settings.target, 'serif'), ' — ', w.tr)))),
        actions: [
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onclick: () => { const n = A.store.addCards(d.id, words.map((w) => ({ ...w, src: 'csv' }))); m.close(); A.toast(n ? t('csv.added', { n }) : t('csv.none_new'), n ? 'ok' : ''); A.refresh(); },
          }, t('csv.add')),
        ],
      });
    });
    document.body.append(file);
    file.click();
    setTimeout(() => file.remove(), 60000);
  }

  /* ---------- sharing ---------- */
  async function shareLink(d) {
    const s = A.store.settings;
    const cards = A.store.cards(d.id).sort((a, b) => a.created - b.created);
    if (!cards.length) { A.toast(t('deck.empty'), 'error'); return; }
    const body = h('div', { class: 'share-box' }, A.loading(t('share.creating')));
    A.modal({ title: t('share.title'), body });
    try {
      const id = await A.ai.shareDeck({
        title: A.deckTitle(d), emoji: d.emoji, level: d.level, topic: d.topic, group: d.group,
        target: s.target, native: s.native,
        words: cards.map((c) => ({ term: c.term, tr: c.tr, pos: c.pos, gram: c.gram, forms: c.forms, pron: c.pron, ex: c.ex, ex_tr: c.exTr })),
      });
      const url = `${location.origin}/#/s/${id}`;
      const copy = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, icon('copy', 16), t('sync.copy'));
      copy.addEventListener('click', () => navigator.clipboard?.writeText(url).then(() => A.toast(t('sync.copied'))));
      const native = navigator.share ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => navigator.share({ title: A.deckTitle(d), url }).catch(() => {}) }, icon('share', 16), t('share.send')) : null;
      body.replaceChildren(
        h('p', { class: 'muted small' }, t('share.hint')),
        h('div', { class: 'share-main' },
          h('div', { class: 'qr-box small' }, A.qr.svg(url, { size: 160, dark: '#1d1a16' })),
          h('div', { class: 'share-side' },
            h('input', { class: 'input share-url', readonly: true, value: url, onfocus: (e) => e.target.select() }),
            h('div', { class: 'row gap wrap' }, copy, native))),
        h('p', { class: 'small muted safe-note' }, icon('info', 14), t('share.privacy')));
    } catch (e) {
      body.replaceChildren(h('p', { class: 'error-text' }, A.ai.errorText(e)));
    }
  }

  function menu(d) {
    const m = A.modal({
      title: A.deckTitle(d),
      body: h('div', { class: 'mode-list' },
        row('share', t('share.title'), t('share.row'), () => { m.close(); shareLink(d); }),
        row('download', t('csv.export'), t('csv.export_d'), () => { m.close(); exportCSV(d); }),
        row('upload', t('csv.import'), t('csv.import_d'), () => { m.close(); importCSV(d); })),
    });
  }
  const row = (ic, title, desc, onclick) => h('button', { class: 'mode-row', type: 'button', onclick },
    h('span', { class: 'mode-ico' }, icon(ic, 20)), h('span', null, h('b', null, title), h('small', null, desc)));

  /* ---------- #/s/ID — opening a shared deck ---------- */
  A.views.s = {
    render(root, [id]) {
      const card = h('div', { class: 'link-card share-open' }, A.loading(t('share.loading')));
      root.append(h('section', { class: 'link-page' }, card));
      A.ai.sharedDeck(id).then((deck) => {
        const s = A.store.settings;
        const T = deck.target, N = deck.native;
        const other = s && s.native !== N;
        A.put(card,
          h('div', { class: 'deck-hero-emoji', style: `--tab: var(--t-${deck.group || 'custom'})` }, deck.emoji || '🗂️'),
          h('h1', { class: 'display sm' }, deck.title || t('deck.untitled')),
          h('p', { class: 'muted' }, [A.langs.name(T) + ' → ' + A.langs.name(N), deck.level, A.tn('n_words', deck.words.length)].filter(Boolean).join(' · ')),
          other ? h('p', { class: 'callout' }, icon('info', 18), h('span', null, t('share.other_lang', { lang: A.langs.name(N) }))) : null,
          h('ul', { class: 'share-preview' }, deck.words.slice(0, 10).map((w) => h('li', null, A.lt(w.term, T, 'serif'), ' — ', A.lt(w.tr, N)))),
          h('div', { class: 'row gap center wrap' },
            h('button', {
              class: 'btn btn-primary btn-lg', type: 'button',
              onclick: () => {
                if (!A.store.ready) A.store.init({ native: N, target: T, level: deck.level || 'A1' });
                else if (s.target !== T) A.store.set({ target: T });
                const d = A.store.addDeck({ title: deck.title, emoji: deck.emoji || '🗂️', group: deck.group || 'custom', level: deck.level, manual: true });
                const n = A.store.addCards(d.id, deck.words.map((w) => ({ ...w, src: 'share' })));
                if (!n) { A.store.deleteDeck(d.id); A.toast(t('csv.none_new')); A.go('#/'); return; }
                A.toast(t('csv.added', { n }), 'ok');
                A.go('#/deck/' + d.id);
              },
            }, icon('plus', 18), t('share.add')),
            h('a', { class: 'btn btn-ghost btn-lg', href: '#/' }, t('common.cancel'))));
      }).catch((e) => {
        card.replaceChildren(
          h('div', { class: 'link-ico bad' }, icon('x', 30)),
          h('h1', { class: 'display sm' }, e.kind === 'gone' ? t('share.gone') : A.ai.errorText(e)),
          h('a', { class: 'btn btn-ghost', href: '#/' }, t('study.back')));
      });
    },
  };

  A.deckTools = { menu, exportCSV, importCSV, shareLink, parseCSV, toCSV };
})();
