/* Storage: everything lives in this browser's localStorage.
   Spaced repetition uses FSRS-4.5 (stability and difficulty per card); `box` 0..7 is derived from stability for display.
   For sync every deck and card has a modification time (u), and deletions are remembered
   as tombstones (del) — so devices merge their data without a server acting as referee. */
(() => {
  const A = window.App;
  const MIN = 6e4, DAY = 864e5;
  const INTERVALS = [0, 10 * MIN, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY, 90 * DAY];
  const MAX_BOX = INTERVALS.length - 1;
  const KNOWN_BOX = 4;

  const mem = {};
  const read = (k) => { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { mem[k] = v; return false; } };
  const remove = (k) => { try { localStorage.removeItem(k); } catch { delete mem[k]; } };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const defaultSettings = () => ({
    native: 'en', target: 'nb', ui: '', theme: 'auto', direction: 'forward',
    newPerDay: 15, sessionSize: 20, batch: 20, level: 'A1',
    autoSpeak: false, studyMode: 'flip', goal: 20,
  });
  const DEVICE_ONLY = ['theme']; // not synced: a phone may use the dark theme while a laptop uses the light one
  const blank = () => ({ v: 1, settings: null, pairs: {}, days: {}, recent: [] });

  let state = blank();
  let warned = false;
  let silent = 0;
  const listeners = [];
  const now = () => Date.now();

  function load() {
    let s = null;
    try { s = JSON.parse(read(A.config.storageKey) || 'null'); } catch { s = null; }
    state = s && typeof s === 'object' ? s : blank();
    state.pairs ||= {};
    state.days ||= {};
    state.recent ||= [];
    if (state.settings) {
      state.settings = { ...defaultSettings(), ...state.settings };
      delete state.settings.apiKey;
      delete state.settings.model;
    }
  }

  function save() {
    if (!write(A.config.storageKey, JSON.stringify(state)) && !warned) {
      warned = true;
      A.toast?.(A.t('err.storage'), 'error');
    }
    if (!silent) listeners.forEach((fn) => fn());
  }
  const onChange = (fn) => listeners.push(fn);

  /* ---------- settings and language pairs ---------- */
  const pairKey = () => `${state.settings.target}:${state.settings.native}`;
  function pair() {
    const k = pairKey();
    const p = (state.pairs[k] ||= { decks: {}, cards: {} });
    p.del ||= {};
    return p;
  }

  function init({ native, target, level }) {
    state.settings = { ...defaultSettings(), native, target, level: level || 'A1', u: now() };
    save();
  }
  function set(patch) {
    Object.assign(state.settings, patch);
    if (Object.keys(patch).some((k) => !DEVICE_ONLY.includes(k))) state.settings.u = now();
    save();
  }
  function pairs() {
    const native = state.settings.native;
    return Object.entries(state.pairs)
      .map(([k, p]) => { const [target, nat] = k.split(':'); return { target, native: nat, count: Object.keys(p.cards).length }; })
      .filter((p) => p.native === native);
  }

  /* ---------- decks ---------- */
  const decks = () => Object.values(pair().decks).sort((a, b) => a.created - b.created);
  const deck = (id) => pair().decks[id] || null;

  function addDeck(d) {
    const dk = { id: uid(), created: now(), u: now(), group: 'custom', emoji: '🗂️', ...d };
    pair().decks[dk.id] = dk;
    save();
    return dk;
  }
  function updateDeck(id, patch) {
    const d = deck(id);
    if (d) { Object.assign(d, patch, { u: now() }); save(); }
  }
  function deleteDeck(id) {
    const p = pair();
    delete p.decks[id];
    p.del[id] = now();
    for (const c of Object.values(p.cards)) if (c.deck === id) { delete p.cards[c.id]; p.del[c.id] = now(); }
    save();
  }
  function mineDeck() {
    let d = decks().find((x) => x.kind === 'mine');
    if (!d) d = addDeck({ kind: 'mine', emoji: '📌', group: 'custom' });
    return d;
  }

  /* ---------- cards ---------- */
  const ART = /^(a|an|the|to|en|ei|et|å|der|die|das|ein|eine|le|la|les|un|une|el|los|las|il|lo|gli|uno|o|os|as|um|uma|het|ett|att|at)\s+/i;
  const norm = (s) => (s || '').toLowerCase().normalize('NFC')
    .replace(/[.,!?;:"«»“”„()[\]¿¡]/g, '').replace(/^l['’]/, '').trim().replace(ART, '').trim();

  /* Examples copied from a longer text (reading, translator): only the sentence with the word.
     A line counts as a sentence too — song lyrics have no full stops — and a sentence that is
     still too long is cut to the words around the word. */
  const isLetter = (ch) => !!ch && /[\p{L}\p{M}\p{N}]/u.test(ch);
  // where the word starts in the text: at the start of a word ("øre" in "øret", not in "høre"),
  // else anywhere unless `strict`; -1 if not found
  function findWord(text, word, strict) {
    const low = text.toLowerCase(), w = String(word || '').toLowerCase().trim();
    if (!w) return -1;
    let first = -1;
    for (let i = low.indexOf(w); i >= 0; i = low.indexOf(w, i + 1)) {
      if (!isLetter(text[i - 1])) return i;
      if (first < 0) first = i;
    }
    return strict ? -1 : first;
  }
  const sentences = (text) => String(text || '').replace(/\r/g, '')
    .replace(/\[[^\]\n]{1,30}\]/g, ' ') // [Chorus], [Vers 1]
    .split(/(?<=[.!?…。！？])\s+|\s*\n+\s*/u)
    .map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  function sentenceWith(text, word, max = 120) {
    const all = sentences(text);
    const s = all.find((x) => findWord(x, word, true) >= 0) || all.find((x) => findWord(x, word) >= 0) || all[0] || '';
    if (s.length <= max) return s;
    const at = Math.max(0, findWord(s, word));
    let a = at, b = Math.min(s.length, at + String(word || '').length);
    while (b - a < max && (a > 0 || b < s.length)) { // grow around the word, one side at a time
      if (a > 0) a--;
      if (b < s.length && b - a < max) b++;
    }
    // don't cut words in half (texts without spaces, like Chinese, are cut anywhere)
    const left = s.indexOf(' ', a), right = s.lastIndexOf(' ', b);
    if (a > 0 && left >= 0 && left < at) a = left + 1;
    if (b < s.length && right > at) b = right;
    return (a > 0 ? '… ' : '') + s.slice(a, b).trim() + (b < s.length ? ' …' : '');
  }
  const EX_MAX = 200;
  const bareTerm = (term) => String(term || '').replace(ART, '').trim();
  /* The example to show on a card: a long one (from a card saved before examples were cut) is cut here */
  function example(c) {
    if (!c?.ex || c.ex.length <= EX_MAX) return { text: c?.ex || '', tr: c?.exTr || '' };
    const base = bareTerm(c.term);
    const stem = base.includes(' ') ? base : base.slice(0, Math.max(3, Math.ceil(base.length * 0.6)));
    return { text: sentenceWith(c.ex, stem), tr: '' };
  }

  /* What a card shows, tidied up. Cards written by the AI before its answers were checked may call
     "en tallerken" feminine, put the article into the pronunciation ("/en bʉˈtɪk/") or leave out the spaces
     between forms. A noun's gender is its article's, so the label comes from the article — in the language
     the card is explained in when there is a table for it. Hand-made cards keep what the person wrote. */
  function shown(c) {
    const s = state.settings;
    const g = c.pos === 'noun' && c.src !== 'user' && A.langs.articleGender(s.target, c.term);
    const art = ART.exec(c.term || '')?.[1];
    const same = (x) => c.pos && [s.native, A.i18n.lang()].some((l) => A.i18n.tIn(l, 'pos.' + c.pos).toLowerCase() === x.trim().toLowerCase());
    return {
      gram: g ? A.i18n.tIn(s.native, 'gender.' + g) : c.gram && !same(c.gram) ? c.gram : '', // not "verb" again for a verb
      pron: art && c.pron ? c.pron.replace(new RegExp(`^([/[])${art}\\s+`, 'i'), '$1') : c.pron || '',
      forms: (c.forms || '').split(/\s*,\s*/).filter(Boolean).join(', '),
    };
  }

  const cards = (deckId) => {
    const all = Object.values(pair().cards);
    return deckId ? all.filter((c) => c.deck === deckId) : all;
  };
  const card = (id) => pair().cards[id] || null;
  const hasTerm = (term) => cards().some((c) => norm(c.term) === norm(term));

  function addCards(deckId, words) {
    const p = pair();
    const seen = new Set(Object.values(p.cards).map((c) => norm(c.term)));
    let added = 0;
    const t = now();
    for (const w of words || []) {
      const term = String(w.term || '').trim();
      const tr = String(w.tr || '').trim();
      if (!term || !tr) continue;
      const n = norm(term);
      if (seen.has(n)) continue;
      seen.add(n);
      const c = {
        id: uid(), deck: deckId, term, tr,
        pos: w.pos || '', gram: w.gram || '', forms: w.forms || '', pron: w.pron || '',
        ex: w.ex || '', exTr: w.ex_tr || w.exTr || '',
        box: 0, due: 0, reps: 0, lapses: 0, last: 0, created: t + added, u: t,
      };
      if (w.src) c.src = w.src; // where the card came from: bank (AI words for a topic), user, dict, read, tr, csv, share
      if (w.chk) c.chk = 1; // already checked against the official dictionary (Norwegian)
      p.cards[c.id] = c;
      added++;
    }
    save();
    return added;
  }
  function updateCard(id, patch) {
    const c = card(id);
    if (c) { Object.assign(c, patch, { u: now() }); save(); }
  }
  function deleteCard(id) {
    const p = pair();
    delete p.cards[id];
    p.del[id] = now();
    save();
  }
  function resetCard(id) {
    updateCard(id, { box: 0, due: 0, reps: 0, lapses: 0, s: 0, d: 0 });
  }
  /* Results of the check against the official dictionary, saved at once: a fix is a real edit (it syncs
     to other devices), a card found right only remembers here that it was checked. */
  function applyChecks(results) {
    let fixed = 0;
    for (const { id, fix } of results) {
      const c = card(id);
      if (!c) continue;
      c.chk = 1;
      if (fix) { Object.assign(c, fix, { u: now() }); fixed++; }
    }
    if (results.length) save();
    return fixed;
  }
  /* A word from the shared bank of AI words for a topic (only those can be reported as a mistake).
     Cards saved before `src` existed are recognised by their batch: one generation adds cards created 1 ms apart. */
  function fromBank(c) {
    if (c.src) return c.src === 'bank';
    return cards(c.deck).some((x) => x.id !== c.id && Math.abs(x.created - c.created) === 1);
  }

  /* ---------- statistics ---------- */
  const today = () => state.days[dayKey()] || { rev: 0, ok: 0, new: 0 };
  function bump(ok, wasNew) {
    const d = (state.days[dayKey()] ||= { rev: 0, ok: 0, new: 0 });
    d.rev++;
    if (ok) d.ok++;
    if (wasNew) d.new++;
  }
  function streak() {
    const d = new Date();
    if (!state.days[dayKey(d)]?.rev) d.setDate(d.getDate() - 1);
    let n = 0;
    while (state.days[dayKey(d)]?.rev) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function week() {
    const out = [];
    const d = new Date();
    d.setDate(d.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      out.push({ date: new Date(d), rev: state.days[dayKey(d)]?.rev || 0, today: i === 6 });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function overview(deckId) {
    const now = Date.now();
    const o = { total: 0, due: 0, fresh: 0, learning: 0, known: 0 };
    for (const c of cards(deckId)) {
      o.total++;
      if (c.box === 0) { o.fresh++; continue; }
      if (c.due <= now) o.due++;
      if (c.box >= KNOWN_BOX) o.known++; else o.learning++;
    }
    o.newLeft = Math.max(0, state.settings.newPerDay - today().new);
    return o;
  }

  /* ---------- study session ---------- */
  function buildSession(deckId, extraNew = 0) {
    const now = Date.now();
    const s = state.settings;
    const all = cards(deckId);
    const due = all.filter((c) => c.box > 0 && c.due <= now).sort((a, b) => a.due - b.due);
    const fresh = all.filter((c) => c.box === 0).sort((a, b) => a.created - b.created);
    const size = Math.max(s.sessionSize, extraNew);
    const dueTake = due.slice(0, size);
    const newLimit = extraNew || Math.max(0, s.newPerDay - today().new);
    const newTake = fresh.slice(0, Math.max(0, Math.min(newLimit, size - dueTake.length)));
    const q = [];
    let i = 0, j = 0;
    while (i < dueTake.length || j < newTake.length) {
      if (i < dueTake.length) q.push(dueTake[i++].id);
      if (i < dueTake.length) q.push(dueTake[i++].id);
      if (j < newTake.length) q.push(newTake[j++].id);
    }
    return q;
  }
  function cramQueue(deckId) {
    const ids = cards(deckId).filter((c) => c.box > 0).map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, state.settings.sessionSize);
  }
  /* FSRS-4.5 (Free Spaced Repetition Scheduler, the algorithm used by Anki) with default weights.
     Each card keeps stability s (days until recall drops to 90%) and difficulty d (1–10).
     `box` is still derived from s so that stages and progress bars keep working. */
  const FW = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const DECAY = -0.5, FACTOR = 19 / 81, RETENTION = 0.9;
  const clampD = (d) => Math.min(10, Math.max(1, d));
  const initD = (g) => clampD(FW[4] - (g - 3) * FW[5]);
  const initS = (g) => Math.max(0.1, FW[g - 1]);
  const recall = (days, s) => Math.pow(1 + (FACTOR * days) / s, DECAY);
  const intervalDays = (s) => (s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);
  const nextD = (d, g) => clampD(FW[7] * initD(4) + (1 - FW[7]) * (d - FW[6] * (g - 3)));
  const sAfterRecall = (d, s, r, g) =>
    s * (Math.exp(FW[8]) * (11 - d) * Math.pow(s, -FW[9]) * (Math.exp(FW[10] * (1 - r)) - 1) * (g === 2 ? FW[15] : 1) * (g === 4 ? FW[16] : 1) + 1);
  const sAfterLapse = (d, s, r) => FW[11] * Math.pow(d, -FW[12]) * (Math.pow(s + 1, FW[13]) - 1) * Math.exp(FW[14] * (1 - r));
  const LEGACY_S = [0, 0.5, 1, 3, 7, 16, 35, 90];
  const boxFromS = (s) => (s < 1 ? 1 : s < 3 ? 2 : s < 7 ? 3 : s < 16 ? 4 : s < 35 ? 5 : s < 90 ? 6 : 7);

  function schedule(c, ok, now, hard = false) {
    const wasNew = c.box === 0 && !c.s;
    if (!c.s && c.box > 0) { c.s = LEGACY_S[c.box]; c.d = 5; } // cards from the old Leitner scheduler
    // grades: 1 = again, 2 = hard (the right word in a wrong form: remembered, but due sooner),
    // 3 = good, 4 = easy ("I already know this" on a brand-new card)
    const g = !ok ? 1 : hard ? 2 : wasNew ? 4 : 3;
    if (wasNew) {
      c.d = initD(g);
      c.s = initS(g);
    } else {
      const r = recall(Math.max(0, (now - (c.last || now)) / DAY), c.s);
      c.s = ok ? sAfterRecall(c.d, c.s, r, g) : Math.min(c.s, sAfterLapse(c.d, c.s, r));
      c.d = nextD(c.d, g);
    }
    c.s = Math.round(c.s * 1000) / 1000;
    c.d = Math.round(c.d * 1000) / 1000;
    if (ok) {
      c.due = now + Math.min(365, Math.max(1, Math.round(intervalDays(c.s)))) * DAY;
      c.box = boxFromS(c.s);
    } else {
      if (!wasNew) c.lapses++;
      c.due = now + 10 * MIN; // relearn: comes back in the session and again soon
      c.box = 1;
    }
  }

  function answer(id, ok, cram, hard = false) {
    const c = card(id);
    if (!c) return;
    const wasNew = c.box === 0;
    if (!cram) {
      const now = Date.now();
      schedule(c, ok, now, hard);
      c.reps++;
      c.last = now;
      c.u = now;
    }
    bump(ok, wasNew && !cram);
    save();
  }
  const stage = (box) => (box === 0 ? 'new' : box < KNOWN_BOX ? 'learning' : box < MAX_BOX ? 'known' : 'mastered');

  /* ---------- dictionary search history ---------- */
  function addRecent(q) {
    const lang = state.settings.target;
    state.recent = [{ q, lang }, ...state.recent.filter((r) => !(r.lang === lang && r.q.toLowerCase() === q.toLowerCase()))].slice(0, 40);
    save();
  }
  const recent = () => state.recent.filter((r) => r.lang === state.settings.target).slice(0, 8).map((r) => r.q);

  /* ---------- cache of AI answers (LRU) ---------- */
  let cache = null;
  function cacheObj() {
    if (!cache) { try { cache = JSON.parse(read(A.config.cacheKey) || '{}') || {}; } catch { cache = {}; } }
    return cache;
  }
  function cacheWrite() {
    for (let tries = 0; tries < 4; tries++) {
      if (write(A.config.cacheKey, JSON.stringify(cache))) return;
      const keys = Object.keys(cache).sort((a, b) => cache[a].t - cache[b].t);
      if (!keys.length) return;
      keys.slice(0, Math.ceil(keys.length / 3)).forEach((k) => delete cache[k]);
    }
  }
  function cacheGet(k) {
    const e = cacheObj()[k];
    if (!e) return null;
    e.t = Date.now();
    return e.v;
  }
  function cacheHas(k) { return !!cacheObj()[k]; }
  function cacheSet(k, v) {
    const c = cacheObj();
    c[k] = { v, t: Date.now() };
    const keys = Object.keys(c);
    if (keys.length > A.config.cacheLimit) {
      keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - A.config.cacheLimit).forEach((x) => delete c[x]);
    }
    cacheWrite();
  }
  function cacheClear() { cache = {}; remove(A.config.cacheKey); }
  function cacheDel(k) { const c = cacheObj(); if (c[k]) { delete c[k]; cacheWrite(); } }

  /* ---------- sync: snapshot and merge ---------- */
  const DEL_TTL = 180 * 864e5;
  const stamp = (e) => e?.u || e?.created || 0;

  function snapshot() {
    const cutoff = now() - DEL_TTL;
    for (const p of Object.values(state.pairs)) {
      for (const [id, t] of Object.entries(p.del || {})) if (t < cutoff) delete p.del[id];
    }
    const settings = state.settings ? { ...state.settings } : null;
    if (settings) DEVICE_ONLY.forEach((k) => delete settings[k]);
    return { v: 1, settings, pairs: state.pairs, days: state.days, recent: state.recent };
  }

  /* Merge another device's snapshot into local data: the newer version of each deck/card wins.
     changed — local data changed; ahead — we have something the other snapshot lacks. */
  function merge(remote, { preferRemoteSettings = false } = {}) {
    if (!remote || typeof remote !== 'object' || !remote.pairs) throw new Error('bad snapshot');
    let changed = false, ahead = false;

    const rs = remote.settings;
    if (rs) {
      if (!state.settings || preferRemoteSettings || (rs.u || 0) > (state.settings.u || 0)) {
        const theme = state.settings?.theme || 'auto';
        state.settings = { ...defaultSettings(), ...rs, theme };
        changed = true;
      } else if ((state.settings.u || 0) > (rs.u || 0)) ahead = true;
    } else if (state.settings) ahead = true;

    const keys = new Set([...Object.keys(state.pairs), ...Object.keys(remote.pairs || {})]);
    for (const key of keys) {
      const L = (state.pairs[key] ||= { decks: {}, cards: {} });
      L.del ||= {};
      const R = remote.pairs[key] || {};
      const rdel = R.del || {};
      for (const [id, t] of Object.entries(rdel)) if (!(L.del[id] >= t)) { L.del[id] = t; changed = true; }
      for (const [id, t] of Object.entries(L.del)) if (!(rdel[id] >= t)) ahead = true;

      for (const kind of ['decks', 'cards']) {
        const lm = (L[kind] ||= {}), rm = R[kind] || {};
        for (const [id, re] of Object.entries(rm)) {
          const le = lm[id];
          if (L.del[id] >= stamp(re)) continue; // deleted after its last edit
          if (!le || stamp(re) > stamp(le)) { lm[id] = re; changed = true; }
          else if (stamp(le) > stamp(re)) ahead = true;
        }
        for (const [id, le] of Object.entries(lm)) {
          if (L.del[id] >= stamp(le)) { delete lm[id]; changed = true; continue; }
          if (!rm[id]) ahead = true;
        }
      }
    }

    // daily stats: take the maximum (so repeated merges never double them)
    for (const [d, rv] of Object.entries(remote.days || {})) {
      const lv = (state.days[d] ||= { rev: 0, ok: 0, new: 0 });
      for (const f of ['rev', 'ok', 'new']) {
        if ((rv[f] || 0) > (lv[f] || 0)) { lv[f] = rv[f]; changed = true; } else if ((lv[f] || 0) > (rv[f] || 0)) ahead = true;
      }
    }
    for (const d of Object.keys(state.days)) if (!remote.days?.[d]) ahead = true;

    // search history: union
    const seen = new Set(state.recent.map((r) => r.lang + '|' + r.q.toLowerCase()));
    for (const r of remote.recent || []) {
      if (!r?.q || seen.has(r.lang + '|' + r.q.toLowerCase())) continue;
      state.recent.push(r);
      seen.add(r.lang + '|' + r.q.toLowerCase());
      changed = true;
    }
    state.recent = state.recent.slice(0, 40);
    if ((remote.recent || []).length < state.recent.length) ahead = true;

    silent++;
    try { save(); } finally { silent--; }
    return { changed, ahead };
  }

  /* ---------- import / export ---------- */
  function exportData() {
    return JSON.stringify({ app: 'ordkort', exported: new Date().toISOString(), ...state }, null, 1);
  }
  function importData(obj) {
    if (!obj || typeof obj !== 'object' || !obj.pairs || !obj.settings) throw new Error('bad file');
    state = { v: 1, settings: { ...defaultSettings(), ...obj.settings, u: now() }, pairs: obj.pairs, days: obj.days || {}, recent: obj.recent || [] };
    delete state.settings.apiKey;
    delete state.settings.model;
    save();
  }
  function resetAll() {
    state = blank();
    remove(A.config.storageKey);
    cacheClear();
  }
  function usage() {
    const a = (read(A.config.storageKey) || '').length;
    const b = (read(A.config.cacheKey) || '').length;
    return Math.round((a + b) * 2 / 1024);
  }

  A.store = {
    load, save, init, set, pairs, onChange, snapshot, merge,
    get settings() { return state.settings; },
    get ready() { return !!state.settings; },
    decks, deck, addDeck, updateDeck, deleteDeck, mineDeck,
    cards, card, addCards, updateCard, deleteCard, resetCard, hasTerm, norm, fromBank, applyChecks,
    sentences, sentenceWith, example, shown,
    overview, streak, week, today,
    buildSession, cramQueue, answer, stage, MAX_BOX, schedule, dayKey,
    get days() { return state.days; },
    addRecent, recent,
    cacheGet, cacheSet, cacheHas, cacheClear, cacheDel,
    kvGet: read, kvSet: write, kvDel: remove,
    exportData, importData, resetAll, usage,
  };
})();
