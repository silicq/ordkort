/* Синхронизация без аккаунтов и паролей.

   Постоянная связка: случайный секрет S (32 байта) хранится только на ваших устройствах.
   Из него выводятся (HKDF): id копии на сервере, токен записи и ключ AES-256-GCM.
   На сервер уходит только зашифрованный и сжатый снимок данных — прочитать его без S нельзя.

   Привязка устройства: одноразовый код из 16 символов = 6 символов «ящика» на сервере + 10 символов ключа.
   Ключевая часть никогда не покидает устройства (в QR-ссылке она после #, а это браузер серверу не отправляет).
   В ящик кладётся S (или весь снимок при разовом переносе), зашифрованный ключом из кода; ящик живёт 3 минуты
   и удаляется при первом же чтении. */
(() => {
  const A = window.App;
  const enc = new TextEncoder();
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  class SyncError extends Error {
    constructor(kind) { super(kind); this.kind = kind; }
  }

  /* ---------- байты и шифрование ---------- */
  function toB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const b64url = (bytes) => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const randomB32 = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => B32[b & 31]).join('');

  async function gzip(text) {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function gunzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await gzip(JSON.stringify(obj))));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return toB64(out);
  }
  async function unseal(key, b64) {
    const buf = fromB64(b64);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12) }, key, buf.subarray(12));
    return JSON.parse(await gunzip(new Uint8Array(plain)));
  }

  async function derive(secretB64) {
    const base = await crypto.subtle.importKey('raw', fromB64(secretB64), 'HKDF', false, ['deriveBits']);
    const bits = async (info, n) => new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('ordkort-sync-v1'), info: enc.encode(info) }, base, n * 8));
    return {
      id: hex(await bits('id', 16)),
      token: b64url(await bits('auth', 32)),
      key: await crypto.subtle.importKey('raw', await bits('enc', 32), 'AES-GCM', false, ['encrypt', 'decrypt']),
    };
  }
  async function pairKey(keyPart) {
    const base = await crypto.subtle.importKey('raw', enc.encode(keyPart), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('ordkort-pair-v1'), iterations: 250000 },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /* ---------- состояние (отдельный ключ localStorage: в резервные копии не попадает) ---------- */
  let cfg = null; // { s, v, at, dirty, first }
  let keys = null;
  const status = { state: 'off', at: 0 };
  const listeners = new Set();

  function loadCfg() {
    try { cfg = JSON.parse(A.store.kvGet(A.config.syncKey) || 'null'); } catch { cfg = null; }
    if (cfg && !cfg.s) cfg = null;
    status.state = cfg ? 'idle' : 'off';
    status.at = cfg?.at || 0;
  }
  function saveCfg() {
    if (cfg) A.store.kvSet(A.config.syncKey, JSON.stringify(cfg));
    else A.store.kvDel(A.config.syncKey);
  }
  function setStatus(state, extra = {}) {
    Object.assign(status, { state, ...extra });
    listeners.forEach((fn) => { try { fn(status); } catch { /* ignore */ } });
  }
  const enabled = () => !!cfg?.s;
  async function ready() {
    if (!keys && cfg?.s) keys = await derive(cfg.s);
    return keys;
  }

  async function request(path, opts = {}) {
    if (location.protocol === 'file:') throw new SyncError('offline');
    try {
      return await fetch('/api/' + path, opts);
    } catch {
      throw new SyncError('network');
    }
  }

  /* ---------- цикл синхронизации ---------- */
  let running = null;
  function syncNow() {
    if (!enabled()) return Promise.resolve();
    if (running) return running;
    running = (async () => {
      setStatus('syncing');
      try {
        const k = await ready();
        const headers = { 'X-Sync-Token': k.token };
        for (let attempt = 0; attempt < 4; attempt++) {
          const r = await request(`sync/${k.id}?since=${cfg.v}`, { headers });
          if (r.status === 404 && cfg.v > 0) {
            // копию удалили с другого устройства
            cfg = null; keys = null; saveCfg();
            setStatus('off');
            A.toast(A.t('sync.removed'));
            return;
          }
          if (r.status === 403) throw new SyncError('forbidden');
          if (!r.ok && r.status !== 404 && r.status !== 204) throw new SyncError('server');
          let ahead = cfg.dirty || cfg.v === 0;
          if (r.status === 200) {
            const { v, d } = await r.json();
            const remote = await unseal(k.key, d);
            const res = A.store.merge(remote, { preferRemoteSettings: !!cfg.first });
            cfg.first = false;
            cfg.v = v;
            ahead = cfg.dirty || res.ahead;
            if (res.changed) { A.applyTheme?.(); A.refresh?.(); }
          }
          if (!ahead) break;
          const body = JSON.stringify({ v: cfg.v, d: await seal(k.key, A.store.snapshot()) });
          const p = await request(`sync/${k.id}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body });
          if (p.status === 409) continue; // кто-то успел раньше — заберём его версию и сольём
          if (p.status === 413) throw new SyncError('too_large');
          if (!p.ok) throw new SyncError(p.status === 429 ? 'slow' : 'server');
          cfg.v = (await p.json()).v;
          cfg.dirty = false;
          break;
        }
        cfg.at = Date.now();
        saveCfg();
        setStatus('idle', { at: cfg.at, error: '' });
      } catch (e) {
        setStatus('error', { error: e.kind || 'server' });
      } finally {
        running = null;
      }
    })();
    return running;
  }

  let timer = null;
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(() => syncNow(), ms);
  }

  async function enable() {
    cfg = { s: toB64(crypto.getRandomValues(new Uint8Array(32))), v: 0, at: 0, dirty: true };
    keys = null;
    saveCfg();
    await syncNow();
    if (status.state === 'error') throw new SyncError(status.error);
  }

  async function disable({ deleteRemote = false } = {}) {
    if (deleteRemote && enabled()) {
      const k = await ready();
      const r = await request(`sync/${k.id}`, { method: 'DELETE', headers: { 'X-Sync-Token': k.token } });
      if (!r.ok) throw new SyncError('server');
    }
    cfg = null; keys = null;
    saveCfg();
    setStatus('off');
  }

  /* ---------- коды привязки ---------- */
  async function createCode(mode) {
    if (mode === 'link' && !enabled()) await enable();
    const keyPart = randomB32(10);
    const payload = mode === 'link' ? { kind: 'link', s: cfg.s } : { kind: 'transfer', data: A.store.snapshot() };
    const d = await seal(await pairKey(keyPart), payload);
    const r = await request('pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ d }) });
    if (r.status === 429) throw new SyncError('slow');
    if (r.status === 413) throw new SyncError('too_large');
    if (!r.ok) throw new SyncError('server');
    const { id, ttl } = await r.json();
    return { code: id + keyPart, slot: id, expires: Date.now() + ttl * 1000 };
  }

  async function codeAlive(slot) {
    const r = await request(`pair/${slot}?peek=1`);
    if (!r.ok) return false;
    return !!(await r.json()).alive;
  }

  const normCode = (raw) => String(raw || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V')
    .replace(/[^0-9A-Z]/g, '');
  const formatCode = (c) => c.match(c.length > 16 ? /.{1,6}/g : /.{1,4}/g).join('-');

  /* ---------- ключ восстановления: секрет S в виде 54 символов (52 + 2 контрольных) ---------- */
  const KEY_LEN = 54;
  function b32encode(bytes) {
    let bits = 0, val = 0, out = '';
    for (const b of bytes) {
      val = (val << 8) | b; bits += 8;
      while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits) out += B32[(val << (5 - bits)) & 31];
    return out;
  }
  function b32decode(str) {
    let bits = 0, val = 0;
    const out = [];
    for (const ch of str) {
      val = (val << 5) | B32.indexOf(ch); bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
  }
  async function checksum(bytes) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return B32[h[0] & 31] + B32[h[1] & 31];
  }
  async function recoveryKey() {
    if (!enabled()) return '';
    const s = fromB64(cfg.s);
    return formatCode(b32encode(s) + (await checksum(s)));
  }
  async function restore(code) {
    const s = b32decode(code.slice(0, 52)).subarray(0, 32);
    if (s.length !== 32 || (await checksum(s)) !== code.slice(52)) throw new SyncError('bad_code');
    const prev = cfg;
    cfg = { s: toB64(s), v: 0, at: 0, dirty: false, first: true, restore: true };
    keys = null;
    const k = await ready();
    const r = await request(`sync/${k.id}`, { headers: { 'X-Sync-Token': k.token } });
    if (r.status === 404) { cfg = prev; keys = null; throw new SyncError('no_copy'); }
    if (!r.ok) { cfg = prev; keys = null; throw new SyncError(r.status === 429 ? 'slow' : 'server'); }
    cfg.dirty = A.store.ready;
    delete cfg.restore;
    saveCfg();
    await syncNow();
    if (status.state === 'error') throw new SyncError(status.error);
    return 'link';
  }

  async function join(raw) {
    const code = normCode(raw);
    if ([...code].some((c) => !B32.includes(c))) throw new SyncError('bad_code');
    if (code.length === KEY_LEN) return restore(code);
    if (code.length !== 16) throw new SyncError('bad_code');
    const r = await request(`pair/${code.slice(0, 6)}`);
    if (r.status === 404) throw new SyncError('gone');
    if (r.status === 429) throw new SyncError('slow');
    if (!r.ok) throw new SyncError('server');
    const { d } = await r.json();
    let payload;
    try { payload = await unseal(await pairKey(code.slice(6)), d); } catch { throw new SyncError('bad_code'); }

    if (payload.kind === 'transfer' && payload.data) {
      A.store.merge(payload.data, { preferRemoteSettings: true });
      return 'transfer';
    }
    if (payload.kind === 'link' && payload.s) {
      cfg = { s: payload.s, v: 0, at: 0, dirty: A.store.ready, first: true };
      keys = null;
      saveCfg();
      await syncNow();
      if (status.state === 'error') throw new SyncError(status.error);
      return 'link';
    }
    throw new SyncError('bad_code');
  }

  /* ---------- запуск ---------- */
  function start() {
    loadCfg();
    A.store.onChange(() => {
      if (!enabled()) return;
      cfg.dirty = true;
      saveCfg();
      schedule(5000);
    });
    document.addEventListener('visibilitychange', () => {
      if (!enabled()) return;
      if (document.visibilityState === 'visible') schedule(400);
      else if (cfg.dirty) syncNow();
    });
    setInterval(() => { if (enabled() && document.visibilityState === 'visible') syncNow(); }, 10 * 60 * 1000);
    if (enabled()) schedule(1200);
  }

  const errorText = (e) => A.t('sync.err_' + ({ gone: 'gone', bad_code: 'code', slow: 'slow', network: 'net', offline: 'net', too_large: 'large', no_copy: 'nocopy' }[e?.kind] || 'server'));

  A.sync = {
    start, syncNow, enable, disable, createCode, codeAlive, join, normCode, formatCode, errorText, recoveryKey, KEY_LEN,
    get enabled() { return enabled(); },
    get status() { return status; },
    onStatus: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    SyncError,
  };
})();
