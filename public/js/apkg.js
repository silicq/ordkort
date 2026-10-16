/* Anki packages (.apkg), both ways. Pure functions: the SQLite engine (sql.js) and the zstd decoder (fzstd) are
   passed in, so the same code runs in the browser (js/anki.js loads them when needed) and in the tests.

   Reading takes what any Anki writes: the current format (collection.anki21b and its media, both compressed
   with zstd, the tables of schema 18) and the older ones (collection.anki21 or .anki2, schema 11, media listed
   in JSON). Writing makes the most widely read one: collection.anki2 (schema 11) with media listed in JSON, which
   every Anki from 2.1 on opens. */
(() => {
  const A = window.App;
  const DAY = 864e5;
  const enc = new TextEncoder(), dec = new TextDecoder();

  /* ---------- zip ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  async function stream(bytes, how) {
    const s = new Blob([bytes]).stream().pipeThrough(how);
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const inflate = (b) => stream(b, new DecompressionStream('deflate-raw'));
  const deflate = (b) => stream(b, new CompressionStream('deflate-raw'));

  // every file of a zip archive → Map(name → bytes)
  async function unzip(bytes) {
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip file');
    const count = u16(bytes, eocd + 10);
    let p = u32(bytes, eocd + 16);
    const out = new Map();
    for (let n = 0; n < count; n++) {
      if (u32(bytes, p) !== 0x02014b50) throw new Error('broken zip');
      const method = u16(bytes, p + 10), size = u32(bytes, p + 20);
      const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32);
      const local = u32(bytes, p + 42);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      if (size === 0xffffffff) throw new Error('zip64 is not supported');
      const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
      const data = bytes.subarray(start, start + size);
      out.set(name, method === 8 ? await inflate(data) : method === 0 ? data : null);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  // [[name, bytes, compress]] → a zip archive
  async function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    for (const [name, raw, squeeze] of files) {
      const nameB = enc.encode(name);
      const data = squeeze ? await deflate(raw) : raw;
      const crc = crc32(raw), method = squeeze ? 8 : 0;
      const head = new Uint8Array(30 + nameB.length);
      const v = new DataView(head.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, method, true);
      v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, raw.length, true); v.setUint16(26, nameB.length, true);
      head.set(nameB, 30);
      const c = new Uint8Array(46 + nameB.length);
      const w = new DataView(c.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint16(10, method, true);
      w.setUint32(16, crc, true); w.setUint32(20, data.length, true); w.setUint32(24, raw.length, true); w.setUint16(28, nameB.length, true);
      w.setUint32(42, offset, true);
      c.set(nameB, 46);
      parts.push(head, data);
      central.push(c);
      offset += head.length + data.length;
    }
    const size = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Uint8Array(await new Blob([...parts, ...central, end]).arrayBuffer());
  }

  /* ---------- protobuf, as much as Anki's package needs ---------- */
  function pb(b) {
    const out = [];
    let i = 0;
    const varint = () => { let v = 0, s = 1, x; do { x = b[i++]; v += (x & 0x7f) * s; s *= 128; } while (x >= 0x80 && i < b.length); return v; };
    while (i < b.length) {
      const key = varint(), f = Math.floor(key / 8), wt = key % 8;
      if (wt === 0) out.push([f, varint()]);
      else if (wt === 2) { const n = varint(); out.push([f, b.subarray(i, i + n)]); i += n; } else if (wt === 1) i += 8;
      else if (wt === 5) i += 4;
      else break;
    }
    return out;
  }
  const pbStr = (fields, n) => { const x = fields.find((f) => f[0] === n); return x && typeof x[1] !== 'number' ? dec.decode(x[1]) : ''; };

  /* ---------- reading ---------- */
  // → { types: {id: {name, fields, qfmt}}, decks: {id: [path…]}, notes, cards, crt (s), media: Map(name → bytes) }
  async function read(bytes, { SQL, zstd }) {
    const files = await unzip(bytes);
    const meta = files.get('meta');
    const version = meta ? pb(meta).find((f) => f[0] === 1)?.[1] || 1 : 1; // 3: the current format, with zstd
    let raw;
    if (files.has('collection.anki21b')) raw = zstd(files.get('collection.anki21b'));
    else raw = files.get('collection.anki21') || files.get('collection.anki2');
    if (!raw) throw new Error('not an Anki package');

    let db = new SQL.Database(raw);
    // Anki sorts names with its own collation (unicase), which SQLite here does not have and then refuses any query
    // on those tables. The copy forgets it: every row is read anyway, so the order of the indexes does not matter.
    if (db.exec("select 1 from sqlite_master where sql like '%unicase%' limit 1").length) {
      db.run('PRAGMA writable_schema = ON');
      db.run("UPDATE sqlite_master SET sql = replace(replace(sql, 'COLLATE unicase', ''), 'collate unicase', '') WHERE sql LIKE '%unicase%'");
      const plain = db.export();
      db.close();
      db = new SQL.Database(plain);
    }
    const rows = (sql) => {
      const r = db.exec(sql)[0];
      return r ? r.values.map((v) => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : [];
    };
    try {
      const tables = new Set(rows("select name from sqlite_master where type = 'table'").map((r) => r.name));
      const crt = rows('select crt from col')[0]?.crt || Math.floor(Date.now() / 1000);
      const types = {}, decks = {};
      if (tables.has('notetypes')) {
        for (const t of rows('select id, name from notetypes')) types[t.id] = { name: t.name, fields: [], qfmt: '' };
        for (const f of rows('select ntid, ord, name from fields order by ntid, ord')) types[f.ntid]?.fields.push(f.name);
        for (const t of rows('select ntid, ord, config from templates order by ntid, ord')) {
          if (types[t.ntid] && !types[t.ntid].qfmt) types[t.ntid].qfmt = pbStr(pb(t.config), 1);
        }
        for (const d of rows('select id, name from decks')) decks[d.id] = d.name.split('\x1f');
      } else {
        const col = rows('select models, decks from col')[0] || {};
        for (const m of Object.values(JSON.parse(col.models || '{}'))) {
          types[m.id] = { name: m.name, fields: [...(m.flds || [])].sort((a, b) => a.ord - b.ord).map((f) => f.name), qfmt: m.tmpls?.[0]?.qfmt || '' };
        }
        for (const d of Object.values(JSON.parse(col.decks || '{}'))) decks[d.id] = String(d.name).split('::');
      }
      const notes = rows('select id, mid, flds, tags from notes').map((n) => ({ id: n.id, mid: n.mid, fields: String(n.flds).split('\x1f'), tags: String(n.tags || '').trim() }));
      const cards = rows('select id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses, data from cards order by nid, ord');

      const media = new Map();
      const list = files.get('media');
      if (list) {
        if (version >= 3) {
          pb(zstd(list)).filter((f) => f[0] === 1).forEach(([, entry], i) => {
            const file = files.get(String(i));
            if (file) media.set(pbStr(pb(entry), 1), zstd(file));
          });
        } else {
          for (const [k, name] of Object.entries(JSON.parse(dec.decode(list) || '{}'))) if (files.has(k)) media.set(name, files.get(k));
        }
      }
      return { types, decks, notes, cards, crt, media };
    } finally { db.close(); }
  }

  /* ---------- Anki notes → Ordkort cards ---------- */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  // a field's HTML as plain text
  function text(html) {
    return String(html || '')
      .replace(/\[sound:[^\]]*\]/g, ' ')
      .replace(/<br\s*\/?>|<\/(div|p|li|h\d)>/gi, ' ')
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
        if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; }
        return ENT[e.toLowerCase()] ?? m;
      })
      .replace(/\s+/g, ' ').trim();
  }
  // the first picture in a field: <img src="a%20b.jpg">
  function imgOf(html) {
    const m = /<img[^>]*?\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(String(html || ''));
    const src = m && (m[1] || m[2] || m[3]);
    if (!src || /^(https?:|data:)/i.test(src)) return '';
    try { return decodeURIComponent(src); } catch { return src; }
  }

  // the first recording in a field: [sound:hus.mp3]
  function soundOf(html) {
    const m = /\[sound:([^\]]+)\]/.exec(String(html || ''));
    return m ? m[1].trim() : '';
  }

  const GUESS = [
    ['exTr', /(example|sentence|eksempel|пример|приклад|beispiel|exemple|ejemplo).*(transl|meaning|english|перевод|переклад|overs)|(transl|перевод).*(example|sentence|пример)/i],
    ['ex', /example|sentence|eksempel|пример|приклад|beispiel|exemple|ejemplo|frase/i],
    ['pron', /reading|pronunc|ipa|pinyin|romaji|kana|furigana|uttale|транскрип|произнош|вимов/i],
    ['term', /^(front|word|term|expression|vocab|target|question|kanji|hanzi|ord|слово|lemma|headword|front side)/i],
    ['tr', /^(back|meaning|translation|definition|answer|english|gloss|перевод|переклад|значение|betydning|back side)/i],
  ];
  // which field of a note type holds what: { term, tr, ex, exTr, pron } as field numbers, -1 for none
  function guess(fields) {
    const m = { term: -1, tr: -1, ex: -1, exTr: -1, pron: -1 };
    fields.forEach((name, i) => {
      const k = GUESS.find(([key, re]) => m[key] < 0 && re.test(name))?.[0];
      if (k) m[k] = i;
    });
    const free = () => fields.findIndex((_, i) => !Object.values(m).includes(i));
    if (m.term < 0) m.term = free();
    if (m.tr < 0) m.tr = free();
    return m;
  }

  // Anki's schedule for a card → Ordkort's FSRS state, or null for a card never studied
  function schedule(c, crt, now = Date.now()) {
    if (!c || c.type === 0) return null;
    let data = {};
    try { data = JSON.parse(c.data || '{}') || {}; } catch { /* no memory state */ }
    const reps = c.reps || 0, lapses = c.lapses || 0;
    if (c.type === 2) {
      const ivl = Math.max(1, c.ivl || 1);
      const due = (crt + c.due * 86400) * 1000;
      const s = data.s > 0 ? data.s : ivl;
      const d = data.d >= 1 ? Math.min(10, data.d) : Math.min(10, Math.max(1, 5 - ((c.factor || 2500) / 1000 - 2.5) * 4));
      return { s, d, due, last: due - ivl * DAY, reps, lapses };
    }
    // learning or relearning: comes back now, as a word just met
    return { s: data.s > 0 ? data.s : 1, d: data.d >= 1 ? data.d : 5, due: now, last: now - DAY, reps, lapses };
  }

  /* The notes of a package as Ordkort words, grouped by deck. maps: {note type id: guess(...)} (the person's choice);
     → [{ path: [...], words: [{ term, tr, ex, ex_tr, pron, imgName, audioName, sched, sus }] }]
     The recording is the first one in the note outside the example fields (those read the sentence, not the word). */
  function words(pkg, maps, { now = Date.now(), withSchedule = true } = {}) {
    const firstCard = new Map();
    for (const c of pkg.cards) if (!firstCard.has(c.nid)) firstCard.set(c.nid, c);
    const groups = new Map();
    for (const n of pkg.notes) {
      const m = maps[n.mid] || guess(pkg.types[n.mid]?.fields || []);
      const f = (i) => (i >= 0 ? n.fields[i] || '' : '');
      const term = text(f(m.term)), tr = text(f(m.tr));
      if (!term || !tr) continue;
      const c = firstCard.get(n.id);
      const path = pkg.decks[c?.did] || ['Anki'];
      const key = path.join('\x1f');
      if (!groups.has(key)) groups.set(key, { path, words: [] });
      groups.get(key).words.push({
        term: term.slice(0, 200), tr: tr.slice(0, 300), ex: text(f(m.ex)).slice(0, 300), ex_tr: text(f(m.exTr)).slice(0, 300), pron: text(f(m.pron)).slice(0, 100),
        imgName: n.fields.map(imgOf).find(Boolean) || '',
        audioName: n.fields.map((x, i) => (i === m.ex || i === m.exTr ? '' : soundOf(x))).find(Boolean) || '',
        sched: withSchedule ? schedule(c, pkg.crt, now) : null,
        sus: !!(withSchedule && c && c.queue === -1),
      });
    }
    return [...groups.values()];
  }

  /* ---------- writing ---------- */
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const FIELDS = ['Term', 'Translation', 'Pronunciation', 'Grammar', 'Forms', 'Example', 'Example translation', 'Picture', 'Audio'];
  const CSS = '.card { font-family: system-ui, sans-serif; font-size: 22px; text-align: center; color: #1d1a16; background: #fffdf8; }\n'
    + '.term { font: 600 1.6em Georgia, serif; } .small { font-size: 0.7em; color: #5a5347; } .ex { margin-top: 1em; font-style: italic; }\n'
    + 'img { max-width: 90%; max-height: 300px; border-radius: 12px; }\n.nightMode.card { color: #f2ece1; background: #1e1b16; } .nightMode .small { color: #bdb4a4; }';
  const QFMT = '<div class="term">{{Term}}</div>\n<div class="small">{{Pronunciation}}</div>\n{{Audio}}';
  const AFMT = '{{FrontSide}}\n\n<hr id=answer>\n\n{{Translation}}\n<div class="small">{{Grammar}} {{Forms}}</div>\n'
    + '{{#Example}}<div class="ex">{{Example}}<div class="small">{{Example translation}}</div></div>{{/Example}}\n{{Picture}}';
  const SCHEMA = [
    'CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null)',
    'CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null)',
    'CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null)',
    'CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null)',
    'CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null)',
    'CREATE INDEX ix_notes_usn on notes (usn)', 'CREATE INDEX ix_cards_usn on cards (usn)', 'CREATE INDEX ix_revlog_usn on revlog (usn)',
    'CREATE INDEX ix_cards_nid on cards (nid)', 'CREATE INDEX ix_cards_sched on cards (did, queue, due)', 'CREATE INDEX ix_revlog_cid on revlog (cid)', 'CREATE INDEX ix_notes_csum on notes (csum)',
  ];
  async function sha1hex(s) {
    const d = await crypto.subtle.digest('SHA-1', enc.encode(s));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const GUID = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  const guid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => GUID[b % GUID.length]).join('');

  const EXT = { 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/flac': 'flac' };
  /* decks: [{ name: 'Ordkort::Norsk::Mat', cards: [Ordkort cards] }], media: Map(name → bytes, or → { bytes, type }
     for a recording) → .apkg bytes */
  async function write(decks, media, { SQL, now = Date.now() }) {
    const db = new SQL.Database();
    try {
      for (const s of SCHEMA) db.run(s);
      const secs = Math.floor(now / 1000);
      const crt = Math.floor(now / DAY) * 86400; // midnight UTC today: due days count from here
      const mid = now, deckBase = now + 1;
      const model = {
        id: mid, name: 'Ordkort', type: 0, mod: secs, usn: -1, sortf: 0, did: deckBase, css: CSS,
        latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
        latexPost: '\\end{document}', latexsvg: false, req: [[0, 'any', [0]]], tags: [], vers: [],
        flds: FIELDS.map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] })),
        tmpls: [{ name: 'Ordkort', ord: 0, qfmt: QFMT, afmt: AFMT, bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 }],
      };
      const deckJson = { 1: { id: 1, name: 'Default', conf: 1, desc: '', dyn: 0, collapsed: false, browserCollapsed: false, extendNew: 0, extendRev: 0, mod: secs, usn: 0, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0] } };
      decks.forEach((d, i) => {
        const id = deckBase + i;
        deckJson[id] = { ...deckJson[1], id, name: d.name, usn: -1 };
      });
      const conf = { activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true, curModel: String(mid), nextPos: 1, sortType: 'noteFld', sortBackwards: false, addToCur: true, schedVer: 2 };
      const dconf = { 1: { id: 1, name: 'Default', mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
        new: { delays: [1, 10], ints: [1, 4, 0], initialFactor: 2500, order: 1, perDay: 20, bury: false },
        rev: { perDay: 200, ease4: 1.3, ivlFct: 1, maxIvl: 36500, bury: false, hardFactor: 1.2 },
        lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 1 } } };
      db.run('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)',
        [crt, now, now, JSON.stringify(conf), JSON.stringify({ [mid]: model }), JSON.stringify(deckJson), JSON.stringify(dconf), '{}']);

      const files = new Map(); // file name in the package → name on the device
      const nameOf = (img) => {
        if (!img || !media.has(img)) return '';
        const file = img + '.jpg';
        if (!files.has(file)) files.set(file, img);
        return file;
      };
      const soundName = (a) => {
        const m = a && media.get(a);
        if (!m?.bytes) return '';
        const file = a + '.' + (EXT[m.type] || 'mp3');
        if (!files.has(file)) files.set(file, a);
        return file;
      };
      let id = now, pos = 0;
      for (const [i, d] of decks.entries()) {
        for (const c of d.cards) {
          const nid = ++id, cid = ++id;
          const pic = nameOf(c.img);
          const snd = soundName(c.audio);
          const flds = [c.term, c.tr, c.pron, c.gram, c.forms, c.ex, c.exTr].map(esc).concat(pic ? `<img src="${pic}">` : '', snd ? `[sound:${snd}]` : '').join('\x1f');
          const csum = parseInt((await sha1hex(c.term)).slice(0, 8), 16);
          db.run('INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, ?)', [nid, guid(), mid, secs, ' ordkort ', flds, c.term, csum, '']);
          const review = c.box > 0 && c.s > 0;
          const ivl = review ? Math.max(1, Math.round(Math.max(c.due - (c.last || c.due), DAY) / DAY)) : 0;
          const factor = review ? Math.round(Math.min(3500, Math.max(1300, (2.5 - ((c.d || 5) - 5) / 4) * 1000))) : 0;
          const due = review ? Math.floor((c.due / 1000 - crt) / 86400) : ++pos; // the day it falls due
          const queue = c.sus ? -1 : review ? 2 : 0;
          db.run('INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)',
            [cid, nid, deckBase + i, secs, review ? 2 : 0, queue, due, ivl, factor, c.reps || 0, c.lapses || 0, review ? JSON.stringify({ s: c.s, d: c.d }) : '']);
        }
      }
      const list = {};
      const out = [['collection.anki2', db.export(), true]];
      [...files.keys()].forEach((file, n) => { const m = media.get(files.get(file)); list[n] = file; out.push([String(n), m.bytes || m, false]); });
      out.push(['media', enc.encode(JSON.stringify(list)), false]);
      return zip(out);
    } finally { db.close(); }
  }

  A.apkg = { read, write, words, guess, text, imgOf, soundOf, schedule, unzip, zip, crc32 };
})();
