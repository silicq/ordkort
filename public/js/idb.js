/* IndexedDB: what is too big for localStorage and the encrypted sync copy, kept on this device only.
   kv    — the cards, decks, progress and settings themselves (js/store.js), as one JSON text under 'state':
           localStorage allows about 5 MB for the whole site, IndexedDB a share of the disk.
   log   — every answer: when, which card, the grade, the mode, and for a wrong answer what was typed or picked.
           It is what "What goes wrong" reads, and what fitting FSRS to a person will need. A year is kept.
   media — pictures for cards, by their own key (a hash of the bytes). */
(() => {
  const A = window.App;
  const NAME = 'ordkort', VERSION = 2, YEAR = 365 * 864e5;
  let opening = null;

  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error('no IndexedDB')); return; }
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('log')) {
          const log = db.createObjectStore('log', { autoIncrement: true });
          log.createIndex('t', 't');
        }
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    opening.catch(() => { opening = null; });
    return opening;
  }

  // one request in its own transaction; resolves with the request's result once the transaction is done
  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('aborted'));
    });
  }

  /* ---------- the answer log ---------- */
  let pruned = false;
  async function logAdd(entry) {
    try {
      await run('log', 'readwrite', (s) => s.add(entry));
      if (!pruned) { pruned = true; await prune(); }
    } catch { /* private mode or no IndexedDB: the history is a bonus, studying goes on */ }
  }
  // entries since `since` (ms), optionally only of one language pair
  async function logAll(since = 0, pair = null) {
    try {
      const all = await run('log', 'readonly', (s) => s.index('t').getAll(IDBKeyRange.lowerBound(since)));
      return pair ? all.filter((e) => e.p === pair) : all;
    } catch { return []; }
  }
  // entries older than a year go, once per visit
  async function prune() {
    try {
      const db = await open();
      await new Promise((resolve) => {
        const tx = db.transaction('log', 'readwrite');
        const req = tx.objectStore('log').index('t').openCursor(IDBKeyRange.upperBound(Date.now() - YEAR));
        req.onsuccess = () => { const cur = req.result; if (cur) { cur.delete(); cur.continue(); } };
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      });
    } catch { /* nothing to prune */ }
  }
  const logClear = () => run('log', 'readwrite', (s) => s.clear()).catch(() => {});

  /* ---------- pictures ---------- */
  const mediaPut = (key, blob) => run('media', 'readwrite', (s) => s.put(blob, key));
  const mediaGet = (key) => run('media', 'readonly', (s) => s.get(key)).catch(() => null);
  const mediaDel = (key) => run('media', 'readwrite', (s) => s.delete(key)).catch(() => {});
  const mediaKeys = () => run('media', 'readonly', (s) => s.getAllKeys()).catch(() => []);

  /* ---------- the state (js/store.js) ---------- */
  const kvGet = (key) => run('kv', 'readonly', (s) => s.get(key));
  const kvPut = (key, value) => run('kv', 'readwrite', (s) => s.put(value, key));
  const kvDel = (key) => run('kv', 'readwrite', (s) => s.delete(key));

  A.idb = { logAdd, logAll, logClear, mediaPut, mediaGet, mediaDel, mediaKeys, kvGet, kvPut, kvDel };
})();
