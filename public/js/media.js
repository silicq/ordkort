/* Pictures on cards. A picture is shrunk on the device (640 px at most, JPEG), named after a hash of its bytes and
   kept in IndexedDB (js/idb.js); the card keeps only that name (img), where the picture came from (imgUrl) and
   whom to credit (imgBy). The name syncs with the cards: another device fetches a picture again from imgUrl when it
   needs it, and a photo of your own (or a recording) comes to linked devices file by file, encrypted (js/sync.js). */
(() => {
  const A = window.App;
  const MAX = 640;
  const urls = new Map(); // name → object URL, for this visit

  async function hashOf(blob) {
    const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return 'p' + [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // any picture → a JPEG of at most MAX px on its longer side
  async function shrink(blob) {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs get a white ground, not a black one
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.84));
  }

  // keep a picture; returns its name
  async function add(blob) {
    if (!blob || !/^image\//.test(blob.type || 'image/')) throw new Error('not an image');
    const small = await shrink(blob);
    const name = await hashOf(small);
    await A.idb.mediaPut(name, small);
    return name;
  }

  // a picture from the web, through the site's own proxy (src/sources/images.js)
  async function fetchUrl(u) {
    const r = await A.ai.call('img?u=' + encodeURIComponent(u));
    if (!r.ok) throw new Error('fetch ' + r.status);
    return r.blob();
  }
  const addUrl = async (u) => add(await fetchUrl(u));

  // an object URL for a card's picture, fetching it again from imgUrl if this device does not have it yet
  async function url(c) {
    if (!c?.img) return null;
    if (urls.has(c.img)) return urls.get(c.img);
    let blob = await A.idb.mediaGet(c.img).catch(() => null);
    if (!blob && c.imgUrl) {
      try {
        const name = await addUrl(c.imgUrl);
        blob = await A.idb.mediaGet(name);
        if (name !== c.img) A.store.updateCard(c.id, { img: name }); // the source changed: keep what we have now
      } catch { return null; }
    }
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.set(c.img, u);
    return u;
  }

  // the bytes of a card's picture (for an export), fetched again if this device does not have them
  async function blob(c) {
    if (!c?.img) return null;
    const have = await A.idb.mediaGet(c.img).catch(() => null);
    if (have) return have;
    return (await url(c)) ? A.idb.mediaGet(c.img).catch(() => null) : null;
  }

  // an <img> that fills in when the picture is ready, or nothing if the card has none
  function el(c, cls = 'card-img') {
    if (!c?.img) return null;
    const img = A.h('img', { class: cls, alt: '', decoding: 'async', title: c.imgBy || '' });
    img.hidden = true;
    url(c).then((u) => { if (u) { img.src = u; img.hidden = false; } });
    return img;
  }

  // free pictures for a word in the language lang (Wikidata/Commons, then Openverse, through the site)
  async function search(q, lang) {
    const { data } = await A.ai.api('images', { q, lang });
    return Array.isArray(data?.results) ? data.results : [];
  }

  /* A deck's cover: a small square picture instead of the emoji. It is cut to a square and kept as a data: URL
     inside the deck itself (a few kilobytes), so it syncs and goes with a shared deck like the title does. */
  const COVER = 128;
  const COVER_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
  const isCover = (x) => typeof x === 'string' && x.length <= 40000 && COVER_RE.test(x);
  async function cover(blob) {
    const bmp = await createImageBitmap(blob);
    const side = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = COVER;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, COVER, COVER);
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, COVER, COVER);
    bmp.close?.();
    return canvas.toDataURL('image/jpeg', 0.82);
  }
  const coverUrl = async (u) => cover(await fetchUrl(u));
  // what a built-in topic is looked for by: its English name, which finds the most ("Food and drink" → "Food")
  const topicQuery = (tp) => tp.en.split(/,| and /)[0].trim();
  // a new deck of a built-in topic gets the first picture found for it as its cover (Settings can turn this off)
  async function autoCover(id) {
    const d = A.store.deck(id);
    const tp = d?.topic && A.topics.get(d.topic);
    if (!tp || d.cover || A.store.settings.autoCover === false || A.framed || !navigator.onLine) return;
    try {
      for (const r of (await search(topicQuery(tp), 'en')).slice(0, 3)) {
        const c = await coverUrl(r.url || r.thumb).catch(() => '');
        if (!c) continue;
        if (A.store.deck(id) && !A.store.deck(id).cover) { A.store.updateDeck(id, { cover: c, coverBy: `${r.by} · ${r.license}` }); A.refresh(); }
        return;
      }
    } catch { /* no picture: the emoji stays */ }
  }
  // a shared deck's cover: a data: URL as it is, a web address fetched (through the site) and made small
  const coverOf = async (x) => (isCover(x) ? x : /^https:\/\//.test(x || '') ? coverUrl(x).catch(() => '') : '');
  // what stands for a deck: its cover, or its emoji
  const face = (d, cls = 'deck-cover') => (isCover(d?.cover) ? A.h('img', { class: cls, src: d.cover, alt: '', title: d.coverBy || '' }) : (d?.emoji || '🗂️'));

  /* A card's own recording (from an Anki deck): kept as it is in IndexedDB under 'a' + a hash of its bytes, on this
     device only, like a photo of your own. The speaker button plays it instead of the system's voice. */
  const AUDIO_MAX = 3 * 1024 * 1024;
  async function addAudio(blob) {
    if (!blob || !/^audio\//.test(blob.type) || blob.size > AUDIO_MAX) throw new Error('not a recording');
    const name = 'a' + (await hashOf(blob)).slice(1);
    await A.idb.mediaPut(name, blob);
    return name;
  }
  // the recording's address when it is ready already: a phone plays sound only straight from a tap, not after a wait
  const audioNow = (c) => (c?.audio && urls.get(c.audio)) || null;
  async function audio(c) {
    if (!c?.audio) return null;
    if (urls.has(c.audio)) return urls.get(c.audio);
    const b = await A.idb.mediaGet(c.audio).catch(() => null);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    urls.set(c.audio, u);
    return u;
  }

  /* Recordings on Wiktionary are as loud as their speakers made them, and many are hard to hear next to the others.
     A site voice is decoded on the device and brought to one level of speech: what is measured is its 20 ms windows
     within 30 dB of the loudest one (the silence around a word does not count, however long), the gain is kept
     between a fifth and ten times, and the few peaks the gain would push past full scale are rounded off below it
     instead of clipped. It then plays as a WAV made
     here, by the same audio element as before. A voice that cannot be decoded plays as it came. */
  const LEVEL = 0.12, GAIN_MIN = 0.2, GAIN_MAX = 10, KNEE = 0.9, CEIL = 0.98, RATE = 24000;
  function speechLevel(x, rate) {
    const n = Math.max(1, Math.round(rate * 0.02)), windows = [];
    for (let i = 0; i + n <= x.length; i += n) {
      let e = 0;
      for (let j = i; j < i + n; j++) e += x[j] * x[j];
      windows.push(e / n);
    }
    const top = Math.max(0, ...windows);
    if (!(top > 0)) return 0;
    const speech = windows.filter((e) => e >= top / 1000);
    return Math.sqrt(speech.reduce((a, b) => a + b, 0) / speech.length);
  }
  function even(x, rate) {
    const level = speechLevel(x, rate);
    if (!(level > 1e-4)) return x; // silence: nothing to bring up
    const gain = Math.min(GAIN_MAX, Math.max(GAIN_MIN, LEVEL / level));
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const v = x[i] * gain, a = Math.abs(v);
      out[i] = a <= KNEE ? v : Math.sign(v) * (KNEE + (CEIL - KNEE) * Math.tanh((a - KNEE) / (CEIL - KNEE)));
    }
    return out;
  }
  // samples (-1…1) → a 16-bit mono WAV
  function wavOf(x, rate) {
    const b = new Uint8Array(44 + x.length * 2), v = new DataView(b.buffer);
    const w = (o, t) => { for (let i = 0; i < 4; i++) b[o + i] = t.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) v.setInt16(44 + 2 * i, Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), true);
    return b;
  }
  async function evened(blob) {
    try {
      const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Ctx) return blob;
      const ctx = new Ctx(1, 1, RATE), data = await blob.arrayBuffer();
      const buf = await new Promise((ok, no) => { const p = ctx.decodeAudioData(data, ok, no); if (p?.then) p.then(ok, no); });
      const mono = new Float32Array(buf.length);
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const ch = buf.getChannelData(c);
        for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / buf.numberOfChannels;
      }
      return new Blob([wavOf(even(mono, buf.sampleRate), buf.sampleRate)], { type: 'audio/wav' });
    } catch {
      return blob;
    }
  }

  /* The site's voice for a card without a recording (src/sources/voice.js): a native speaker's recording from Wiktionary,
     or a synthetic one, brought to one level (evened). Kept for the visit by language and text: an object URL, '' when
     the site has none (the system's voice then speaks), or the promise while it loads. */
  const voices = new Map();
  const vkey = (text, lang) => lang + '\n' + String(text || '').trim().toLowerCase();
  function voice(text, lang) {
    const k = vkey(text, lang);
    if (voices.has(k)) return Promise.resolve(voices.get(k));
    const p = A.ai.call(`tts?l=${encodeURIComponent(lang)}&q=${encodeURIComponent(String(text).trim().slice(0, 200))}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b && /^audio\//.test(b.type) ? evened(b) : null))
      .then((b) => { const u = b ? URL.createObjectURL(b) : ''; voices.set(k, u); return u; })
      .catch(() => { voices.delete(k); return ''; }); // offline: ask again next time
    voices.set(k, p);
    return p;
  }
  // the voice's address when it is ready, '' when there is none, null while unknown or loading
  const voiceNow = (text, lang) => { const v = voices.get(vkey(text, lang)); return typeof v === 'string' ? v : null; };

  // pictures and recordings no card refers to any more, once in a while
  async function tidy() {
    try {
      const used = new Set();
      for (const p of Object.values(A.store.allPairs || {})) {
        for (const c of Object.values(p.cards || {})) { if (c.img) used.add(c.img); if (c.audio) used.add(c.audio); }
      }
      for (const k of await A.idb.mediaKeys()) if (!used.has(k)) await A.idb.mediaDel(k);
    } catch { /* next time */ }
  }

  A.media = { add, addUrl, url, blob, el, search, tidy, addAudio, audio, audioNow, voice, voiceNow, cover, coverUrl, coverOf, autoCover, topicQuery, isCover, face, _test: { shrink, speechLevel, even, wavOf, evened } };
})();
