/* Anki in and out (the formats themselves are in js/apkg.js). SQLite (sql.js) and the zstd decoder (fzstd) are big,
   so they load the first time someone imports or exports, from /vendor (copied there by scripts/build.mjs). */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  let deps = null;

  const script = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('could not load ' + src));
    document.head.append(s);
  });
  async function load() {
    if (deps) return deps;
    await Promise.all([window.initSqlJs ? null : script('/vendor/sql/sql-wasm-browser.js'), window.fzstd ? null : script('/vendor/fzstd.js')]);
    const SQL = await window.initSqlJs({ locateFile: (f) => '/vendor/sql/' + f });
    deps = { SQL, zstd: (b) => window.fzstd.decompress(b) };
    return deps;
  }

  const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: '' };
  const typeOf = (name) => TYPES[String(name).split('.').pop().toLowerCase()];
  const SOUNDS = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm', flac: 'audio/flac' };
  const soundType = (name) => SOUNDS[String(name).split('.').pop().toLowerCase()];

  /* ---------- import ---------- */
  function pick() {
    const input = h('input', { type: 'file', accept: '.apkg,.colpkg', hidden: true });
    input.addEventListener('change', () => { const f = input.files?.[0]; if (f) open(f); input.remove(); });
    document.body.append(input);
    input.click();
  }

  async function open(file) {
    const s = A.store.settings;
    const box = h('div', { class: 'anki-box' }, A.loading(t('anki.reading')));
    const m = A.modal({ title: t('anki.import_title'), body: box, wide: true });
    let pkg;
    try {
      pkg = await A.apkg.read(new Uint8Array(await file.arrayBuffer()), await load());
    } catch (e) {
      console.error(e);
      box.replaceChildren(h('p', { class: 'error-text' }, t('anki.bad_file')));
      return;
    }
    if (!pkg.notes.length) { box.replaceChildren(h('p', { class: 'muted' }, t('anki.empty'))); return; }

    // one choice of fields per note type in use
    const used = new Map();
    for (const n of pkg.notes) used.set(n.mid, (used.get(n.mid) || 0) + 1);
    const name = file.name.replace(/\.(apkg|colpkg)$/i, '');

    /* The language of each field, from its first notes ("щека" is Russian, "cheek" English; a file called
       "Russian-English…" settles what letters alone cannot). The side in the person's own language is the
       translation, the other one the word, and the deck goes to that word's language. */
    const hints = [...A.langs.named(name + ' ' + Object.values(pkg.decks).flat().join(' ')), s.target, s.native];
    const langs = {};
    const maps = {};
    let target = '';
    for (const [mid] of [...used].sort((a, b) => b[1] - a[1])) {
      const fields = pkg.types[mid]?.fields || [];
      const notes = pkg.notes.filter((n) => n.mid === mid).slice(0, 60);
      const L = langs[mid] = fields.map((_, i) => A.langs.guess(notes.map((n) => A.apkg.text(n.fields[i])), hints));
      const m = maps[mid] = A.apkg.guess(fields);
      if (L[m.tr] !== s.native && L[m.term] === s.native) [m.term, m.tr] = [m.tr, m.term];
      if (!target && L[m.term] && L[m.term] !== s.native) target = L[m.term];
    }
    if (!target || !A.langs.has(target)) target = s.target;

    const N = A.langs.name(s.native);
    const termLabels = [];
    const into = h('span');
    const other = h('p', { class: 'callout', hidden: true });
    const keep = h('input', { type: 'checkbox', class: 'switch', role: 'switch', checked: true });
    // empty fields (no example, no grammar, a translation that is not one) filled in by the AI after the import
    const fill = h('input', { type: 'checkbox', class: 'switch', role: 'switch', checked: true });
    const fillHint = h('small');
    const preview = h('ul', { class: 'share-preview' });
    const go = h('button', { class: 'btn btn-primary', type: 'button' });
    const targetSel = A.langSelect(target, { exclude: [s.native], onChange: (v) => { target = v; labels(); sample(); } });

    function labels() {
      into.textContent = t('anki.into', { target: A.langs.name(target), native: N });
      for (const el of termLabels) el.textContent = t('anki.role_term', { lang: A.langs.name(target) });
    }
    function sample() {
      const all = A.apkg.words(pkg, maps, { withSchedule: false }).flatMap((g) => g.words);
      preview.replaceChildren(...all.slice(0, 6).map((w) => h('li', null, A.lt(w.term, target, 'serif'), ' — ', A.lt(w.tr, s.native), w.ex ? h('small', { class: 'muted d-block' }, w.ex) : null)));
      const n = new Set(all.map((w) => A.store.norm(w.term))).size; // a word met twice is one card
      go.textContent = t('anki.go', { n });
      const empty = all.filter((w) => !w.ex || w.tr.length < 2).length;
      fillHint.textContent = t('anki.fill_d', { req: Math.ceil(Math.min(n, empty || n) / A.fill.BATCH) });
      go.disabled = !all.length;
      // translations that look like another language than the person's own: say so, it is their choice
      const off = Object.keys(maps).map((mid) => langs[mid][maps[mid].tr]).find((l) => l && l !== s.native);
      other.hidden = !off;
      if (off) other.replaceChildren(icon('info', 18), h('span', null, t('anki.other_tr', { lang: A.langs.name(off), native: N })));
    }

    const ROLES = ['term', 'tr', 'ex', 'exTr', 'pron'];
    const roleLabel = { tr: t('anki.role_tr', { lang: N }), ex: t('anki.role_ex'), exTr: t('anki.role_extr'), pron: t('anki.role_pron') };
    const types = [...used].map(([mid, count]) => {
      const type = pkg.types[mid] || { name: '?', fields: [] };
      return h('fieldset', { class: 'anki-type' },
        h('legend', null, t('anki.type', { name: type.name, n: count })),
        h('div', { class: 'anki-roles' }, ROLES.map((role) => {
          const sel = h('select', { class: 'select' },
            h('option', { value: -1 }, '—'),
            type.fields.map((f, i) => h('option', { value: i }, langs[mid][i] && (role === 'term' || role === 'tr') ? `${f} · ${A.langs.name(langs[mid][i])}` : f)));
          sel.value = String(maps[mid][role]);
          sel.addEventListener('change', () => { maps[mid][role] = +sel.value; sample(); });
          const label = h('span', null, roleLabel[role] || '');
          if (role === 'term') termLabels.push(label);
          return h('label', { class: 'field' }, label, sel);
        })));
    });

    const decks = new Set(pkg.cards.map((c) => c.did)).size;
    A.put(box,
      h('p', { class: 'muted' }, t('anki.summary', { notes: pkg.notes.length, decks, pics: [...pkg.media.keys()].filter(typeOf).length, sounds: [...pkg.media.keys()].filter(soundType).length })),
      h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, h('b', null, t('anki.target')), h('small', null, t('anki.target_d'))), h('div', { class: 'set-ctl' }, targetSel)),
      h('p', { class: 'callout' }, icon('info', 18), into),
      types,
      other,
      h('label', { class: 'set-row' }, h('span', { class: 'set-label' }, h('b', null, t('anki.keep')), h('small', null, t('anki.keep_d'))), keep),
      h('label', { class: 'set-row' }, h('span', { class: 'set-label' }, h('b', null, t('anki.fill')), fillHint), fill),
      h('h3', null, t('anki.preview')), preview,
      h('div', { class: 'row gap' }, go));
    labels();
    sample();

    go.addEventListener('click', async () => {
      go.disabled = true;
      go.textContent = t('anki.importing');
      try {
        if (target !== A.store.settings.target) A.store.set({ target }); // the deck goes to its own language
        const res = await add(pkg, maps, { keep: keep.checked, name });
        m.close();
        A.toast(res.added ? t('anki.imported', { n: res.added, decks: res.decks }) : t('anki.nothing'), res.added ? 'ok' : '');
        A.go('#/');
        A.route();
        if (fill.checked) (async () => { for (const id of res.ids) await A.fill.start(id); })(); // one deck after another; a big one asks first
      } catch (e) {
        console.error(e);
        A.toast(t('anki.bad_file'), 'error');
        go.disabled = false;
        sample();
      }
    });
  }

  // the words of a package into decks of the language in use, with their pictures and (if asked) their progress
  async function add(pkg, maps, { keep, name }) {
    const groups = A.apkg.words(pkg, maps, { withSchedule: keep });
    let added = 0, decks = 0;
    const ids = [];
    for (const g of groups) {
      const leaf = g.path[g.path.length - 1];
      const title = (leaf === 'Default' ? name : leaf) || name || 'Anki';
      const words = [];
      for (const w of g.words) {
        const word = { ...w };
        const bytes = w.imgName && pkg.media.get(w.imgName);
        const type = bytes && typeOf(w.imgName);
        if (type) { try { word.img = await A.media.add(new Blob([bytes], { type })); } catch { /* a picture the browser cannot read */ } }
        const sound = w.audioName && pkg.media.get(w.audioName);
        const st = sound && soundType(w.audioName);
        if (st) { try { word.audio = await A.media.addAudio(new Blob([sound], { type: st })); } catch { /* too big */ } }
        words.push(word);
      }
      // the same word twice ("dry" — сухой, "dry" — сушить) is one card with both translations
      const one = new Map();
      for (const w of words) {
        const k = A.store.norm(w.term);
        const had = one.get(k);
        if (!had) { one.set(k, w); continue; }
        if (!had.tr.split('; ').includes(w.tr)) had.tr = (had.tr + '; ' + w.tr).slice(0, 300);
        had.img ||= w.img;
        had.audio ||= w.audio;
        had.ex ||= w.ex;
        had.ex_tr ||= w.ex_tr;
        had.extra ||= w.extra;
        if (w.sched && (!had.sched || w.sched.s > had.sched.s)) had.sched = w.sched;
      }
      words.length = 0;
      words.push(...one.values());
      const deck = A.store.addDeck({ title: title.slice(0, 80), emoji: '📥', group: 'custom', manual: true });
      const before = new Set(A.store.cards(deck.id).map((c) => c.id));
      const n = A.store.addCards(deck.id, words.map((w) => ({ term: w.term, tr: w.tr, ex: w.ex, ex_tr: w.ex_tr, pron: w.pron, img: w.img, audio: w.audio, extra: w.extra, src: 'anki' })));
      if (!n) { A.store.deleteDeck(deck.id); continue; }
      added += n;
      decks++;
      ids.push(deck.id);
      // progress: the new cards of this deck, found by their word
      const byTerm = new Map(words.map((w) => [A.store.norm(w.term), w]));
      const patches = [];
      for (const c of A.store.cards(deck.id)) {
        if (before.has(c.id)) continue;
        const w = byTerm.get(A.store.norm(c.term));
        if (!w) continue;
        const p = {};
        if (w.sched) Object.assign(p, { s: Math.round(w.sched.s * 1000) / 1000, d: Math.round(w.sched.d * 1000) / 1000, due: w.sched.due, last: w.sched.last, reps: w.sched.reps, lapses: w.sched.lapses, box: A.store.boxFromS(w.sched.s) });
        if (w.sus) p.sus = 1;
        if (Object.keys(p).length) patches.push({ id: c.id, ...p });
      }
      A.store.updateCards(patches);
    }
    return { added, decks, ids };
  }

  /* ---------- export ---------- */
  async function exportDecks(decks, file) {
    const s = A.store.settings;
    A.toast(t('anki.exporting'));
    try {
      const d = await load();
      const media = new Map();
      const groups = [];
      let n = 0;
      for (const dk of decks) {
        const cards = A.store.cards(dk.id).sort((a, b) => a.created - b.created);
        for (const c of cards) {
          if (c.audio && !media.has(c.audio)) {
            const b = await A.idb.mediaGet(c.audio).catch(() => null);
            if (b) media.set(c.audio, { bytes: new Uint8Array(await b.arrayBuffer()), type: b.type });
          }
          if (!c.img || media.has(c.img)) continue;
          const blob = await A.media.blob(c);
          if (blob) media.set(c.img, new Uint8Array(await blob.arrayBuffer()));
        }
        n += cards.length;
        groups.push({ name: ['Ordkort', A.langs.name(s.target), A.deckTitle(dk)].map((x) => String(x).replace(/::/g, ':')).join('::'), cards });
      }
      const bytes = await A.apkg.write(groups, media, { SQL: d.SQL });
      A.download(file + '.apkg', bytes, 'application/octet-stream');
      A.toast(t('anki.exported', { n }), 'ok');
    } catch (e) {
      console.error(e);
      A.toast(t('anki.export_failed'), 'error');
    }
  }
  const slug = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'deck';
  const exportDeck = (d) => exportDecks([d], 'ordkort-' + slug(A.deckTitle(d)));
  const exportAll = () => exportDecks(A.store.decks(), `ordkort-${A.store.settings.target}-${new Date().toISOString().slice(0, 10)}`);

  A.anki = { pick, open, exportDeck, exportAll, _test: { add } };
})();
