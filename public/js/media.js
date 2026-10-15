/* Pictures on cards. A picture is shrunk on the device (640 px at most, JPEG), named after a hash of its bytes and
   kept in IndexedDB (js/idb.js); the card keeps only that name (img), where the picture came from (imgUrl) and
   whom to credit (imgBy). The name syncs, the bytes do not: another device fetches a picture again from imgUrl
   when it needs it, so only photos of your own stay on the device they were added on. */
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

  // a picture from the web, through the site's own proxy (src/images.js)
  async function fetchUrl(u) {
    const r = await fetch('/api/img?u=' + encodeURIComponent(u));
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

  // free pictures for a word (Openverse, through the site)
  async function search(q) {
    const { data } = await A.ai.api('images', { q });
    return Array.isArray(data?.results) ? data.results : [];
  }

  // pictures no card refers to any more, once in a while
  async function tidy() {
    try {
      const used = new Set();
      for (const p of Object.values(JSON.parse(localStorage.getItem(A.config.storageKey) || '{}').pairs || {})) {
        for (const c of Object.values(p.cards || {})) if (c.img) used.add(c.img);
      }
      for (const k of await A.idb.mediaKeys()) if (!used.has(k)) await A.idb.mediaDel(k);
    } catch { /* next time */ }
  }

  A.media = { add, addUrl, url, blob, el, search, tidy, _test: { shrink } };
})();
