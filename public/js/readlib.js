/* The texts of reading mode, kept on this device: the recent ones and the ones the person saves, each with its
   analysis, so going back to a text costs no AI again. Editing a text keeps its earlier wording as a version,
   with that wording's analysis, and any version can be brought back.
   Kept in IndexedDB (js/idb.js, key 'read'); without it, in localStorage. Not synced: a text and its analysis can
   weigh more than a whole collection of cards. */
(() => {
  const A = window.App;
  const KEY = 'read', LS = 'ordkort.read.lib', OLD = 'ordkort.read';
  const RECENT = 20; // texts not saved: the most recently opened ones stay
  const SAVED = 200;
  const VERSIONS = 10; // earlier wordings of one text
  let lib = null; // { cur: id | null, texts: [entry] }
  let loading = null;

  // entry: { id, pair, text, parts, showTr, saved, name, created, opened, versions: [{ text, parts, at }] }
  // the time of an action, always later than the one before: the lists are ordered by it, also within one millisecond
  let last = 0;
  const now = () => (last = Math.max(Date.now(), last + 1));
  const newId = () => now().toString(36) + Math.random().toString(36).slice(2, 8);

  // the first line of the text, cut on a word: what the lists show when a text has no name
  function title(text, max = 60) {
    const line = String(text || '').trim().split('\n')[0].trim();
    if (line.length <= max) return line;
    const cut = line.slice(0, max);
    return (cut.includes(' ') ? cut.slice(0, cut.lastIndexOf(' ')) : cut).replace(/[\s,.;:–—-]+$/, '') + '…';
  }

  function fromOld() {
    // the one text reading mode kept before there was a library
    try {
      const r = JSON.parse(globalThis.localStorage?.getItem(OLD) || 'null');
      if (r?.text && r.pair) return { cur: 'old', texts: [{ id: 'old', pair: r.pair, text: r.text, parts: r.parts || [], showTr: !!r.showTr, saved: false, name: '', created: now(), opened: now(), versions: [] }] };
    } catch { /* nothing to bring over */ }
    return null;
  }

  async function ready() {
    if (lib) return lib;
    if (loading) return loading;
    loading = (async () => {
      let got = null;
      try { got = await A.idb?.kvGet(KEY); } catch { got = null; }
      if (!got) { try { got = JSON.parse(globalThis.localStorage?.getItem(LS) || 'null'); } catch { got = null; } }
      lib = got && Array.isArray(got.texts) ? got : (fromOld() || { cur: null, texts: [] });
      if (lib.texts.some((x) => x.id === 'old')) { await persist(); try { globalThis.localStorage?.removeItem(OLD); } catch { /* ignore */ } }
      return lib;
    })();
    return loading;
  }

  let writing = Promise.resolve();
  function persist() {
    trim();
    const copy = JSON.parse(JSON.stringify(lib));
    writing = writing.then(async () => {
      try { await A.idb.kvPut(KEY, copy); return; } catch { /* no IndexedDB */ }
      try { globalThis.localStorage?.setItem(LS, JSON.stringify(copy)); } catch { /* full: the text stays for this visit */ }
    });
    return writing;
  }

  // the recent texts that are not saved beyond RECENT go, the oldest opened first
  function trim() {
    const loose = lib.texts.filter((x) => !x.saved && x.id !== lib.cur).sort((a, b) => b.opened - a.opened);
    const drop = new Set(loose.slice(RECENT - (lib.cur && !find(lib.cur)?.saved ? 1 : 0)).map((x) => x.id));
    const saved = lib.texts.filter((x) => x.saved).sort((a, b) => b.opened - a.opened);
    for (const x of saved.slice(SAVED)) drop.add(x.id);
    if (drop.size) lib.texts = lib.texts.filter((x) => !drop.has(x.id));
  }

  const find = (id) => lib?.texts.find((x) => x.id === id) || null;

  // the text being read in this language pair, if any
  function current(pair) {
    const x = find(lib?.cur);
    return x && x.pair === pair ? x : null;
  }

  // a new text; the same wording read before in this pair opens that one instead, with its analysis
  function start(pair, text, parts) {
    const same = lib.texts.find((x) => x.pair === pair && x.text === text);
    if (same) return open(same.id);
    const x = { id: newId(), pair, text, parts, showTr: false, saved: false, name: '', created: now(), opened: now(), versions: [] };
    lib.texts.push(x);
    lib.cur = x.id;
    persist();
    return x;
  }

  function open(id) {
    const x = find(id);
    if (!x) return null;
    x.opened = now();
    lib.cur = id;
    persist();
    return x;
  }

  // back to writing a new text: the one read stays in the list
  function close() { lib.cur = null; persist(); }

  // the text changed: the wording before becomes a version, with its analysis
  function edit(id, text, parts) {
    const x = find(id);
    if (!x) return null;
    if (text === x.text) return x;
    const back = x.versions.findIndex((v) => v.text === text);
    const old = { text: x.text, parts: x.parts, at: now() };
    if (back >= 0) { const [v] = x.versions.splice(back, 1); x.text = v.text; x.parts = v.parts; }
    else { x.text = text; x.parts = parts; }
    x.versions.unshift(old);
    x.versions = x.versions.slice(0, VERSIONS);
    x.opened = now();
    lib.cur = id;
    persist();
    return x;
  }

  // an earlier wording back: it and the one shown change places
  function restore(id, i) {
    const x = find(id);
    const v = x?.versions[i];
    if (!v) return x;
    x.versions[i] = { text: x.text, parts: x.parts, at: now() };
    x.text = v.text;
    x.parts = v.parts;
    persist();
    return x;
  }

  function star(id, on) {
    const x = find(id);
    if (x) { x.saved = !!on; persist(); }
    return x;
  }

  function rename(id, name) {
    const x = find(id);
    if (x) { x.name = String(name || '').trim().slice(0, 80); persist(); }
    return x;
  }

  function remove(id) {
    lib.texts = lib.texts.filter((x) => x.id !== id);
    if (lib.cur === id) lib.cur = null;
    persist();
  }

  // what the analysis of a text has found, for the lists: its words
  const words = (x) => new Set(x.parts.flatMap((p) => (p.gloss?.words || []).map((w) => w.w))).size;

  // the texts of a language pair: the saved ones, then the recent ones, the last opened first
  function list(pair) {
    const all = (lib?.texts || []).filter((x) => x.pair === pair).sort((a, b) => b.opened - a.opened);
    return { saved: all.filter((x) => x.saved), recent: all.filter((x) => !x.saved) };
  }

  A.readlib = { ready, current, start, open, close, edit, restore, star, rename, remove, list, put: persist, title, words, LIMITS: { RECENT, SAVED, VERSIONS } };
})();
