// Runs the browser scripts from public/js inside a fresh Node VM context,
// so each call behaves like a separate browser tab (its own App and localStorage).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const ROOT = new URL('../', import.meta.url);
export const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

export function browser(files, { config = {} } = {}) {
  const storage = new Map();
  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    key: (i) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
  };
  const App = {
    views: {},
    config: { storageKey: 'ordkort.v1', cacheKey: 'ordkort.cache.v1', syncKey: 'ordkort.sync.v1', cacheLimit: 300, ...config },
  };
  const g = {
    App, localStorage, console, crypto: globalThis.crypto,
    TextEncoder, TextDecoder, CompressionStream, DecompressionStream, Blob, Response, URL,
    btoa, atob, setTimeout, clearTimeout,
  };
  g.window = g;
  g.globalThis = g;
  const ctx = vm.createContext(g);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return { App, localStorage, ctx };
}
