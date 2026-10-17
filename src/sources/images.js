/* Pictures for cards.
   search — free, openly licensed images for a word. Openverse alone answers by matching the words of titles and
            descriptions, so "hus" or "ключ" bring photos of anything that mentions them. So first the word is looked
            up in Wikidata, in its own language: the item it names ("hus" → house) has a picture on Wikimedia Commons
            chosen by people for exactly that meaning, and an English name. Pixabay (when the PIXABAY_KEY secret is
            set) is asked next, in the word's own language where it knows it: good photos and drawings under its own
            free licence. Openverse is then asked in English, and its answers are sorted so that pictures whose title
            or tags hold the word come first. The answers are kept in the shared cache (Pixabay's for a day, as it
            asks; the rest for 30 days), so a word someone looked up before costs nobody anything.
            A result has `thumb` (to show it in the list) and may have `url`, the address to keep: Pixabay's own
            picture addresses last a day, so a Pixabay picture is kept by the address of its page, which the proxy
            below turns into the picture each time.
   proxy  — fetches one picture for the browser, which then shrinks it and keeps it on the device. The page may load
            nothing from other sites (CSP), and the person's IP never reaches them. Only https, only raster images
            (no SVG), at most 5 MB, under a per-person hourly limit. */
import { cacheGet, cacheSet } from '../core/db.js';
import { takeSimple } from '../core/limits.js';
import { HttpError, json, readJSON, readBytes, str, sha256, UA } from '../core/util.js';

const MONTH = 30 * 864e5;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const ovLicense = (r) => `${r.license === 'cc0' || r.license === 'pdm' ? r.license.toUpperCase() : 'CC ' + String(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim();

export async function search(request, env, key) {
  const b = await readJSON(request, 2000);
  return json(await find(env, key, b.q, b.lang));
}

// an article or "to" in front of a word only gets in the way of a search
export const bare = (x) => String(x || '').trim().replace(/^(?:(?:en|ei|et|ein|eine|eit|der|die|das|le|la|les|el|los|las|il|lo|gli|un|une|una|uno|the|an?|to|å|att)\s+|l['’])/i, '');

/* Items that are not what a learner's word means: a person, a name, a work, a place, a page about pages.
   Wikidata's "instance of" (P31) tells them apart; the item for "house" is a class, not an instance of these. */
const NOT_A_THING = new Set([
  'Q5', 'Q4167410', 'Q4167836', 'Q13442814', 'Q101352', 'Q202444', 'Q12308941', 'Q11879590', 'Q11424', 'Q482994', 'Q7366', 'Q134556',
  'Q7725634', 'Q571', 'Q47461344', 'Q5398426', 'Q215380', 'Q4830453', 'Q43229', 'Q783794', 'Q13406463', 'Q11266439', 'Q17442446',
  'Q532', 'Q486972', 'Q515', 'Q1549591', 'Q3957', 'Q747074', 'Q15284', 'Q23397', 'Q8502', 'Q4022', 'Q2221906', 'Q1093829', 'Q3024240',
  'Q105543609', 'Q1002697', 'Q15632617', 'Q95074', 'Q21191270', 'Q7889', 'Q1344', 'Q3305213',
]);
const WD = 'https://www.wikidata.org/w/api.php';
const DAY = 864e5;
// the languages Pixabay understands a query in (its "no" is Norwegian)
const PX_LANGS = new Set('cs da de en es fr id it hu nl no pl pt ro sk fi sv tr vi th bg ru el ja ko zh'.split(' '));
const PX_PAGE = /^https:\/\/pixabay\.com\/(?:[a-z]{2}\/)?(?:photos|illustrations|vectors)\/(?:[^/?#]*-)?(\d{1,12})\/?$/;
export const OV_PAGE = 20;
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

async function getJSON(url, ms = 6000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) }).catch(() => null);
  if (!res?.ok) return null;
  return res.json().catch(() => null);
}
const plainText = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

/* The word in its language → up to 3 items that mean it, each with a Commons file and an English name.
   wbsearchentities finds items by their name or other names in that language (and in English, which every
   language falls back to); only those whose name is the word itself are kept. */
export async function wikidata(q, lang) {
  const uselang = lang && /^[a-z]{2,3}$/.test(lang) ? lang : 'en';
  const found = await getJSON(`${WD}?action=wbsearchentities&format=json&type=item&limit=8&search=${encodeURIComponent(q)}&language=${uselang}&uselang=${uselang}`);
  const want = q.toLowerCase();
  const ids = (Array.isArray(found?.search) ? found.search : [])
    .filter((e) => /^Q\d+$/.test(e.id || '') && String(e.match?.text || e.label || '').toLowerCase() === want)
    .map((e) => e.id).slice(0, 5);
  if (!ids.length) return [];
  const data = await getJSON(`${WD}?action=wbgetentities&format=json&props=claims|labels&languages=en&ids=${ids.join('|')}`, 8000);
  const out = [];
  for (const id of ids) {
    const e = data?.entities?.[id];
    if (!e?.claims) continue;
    const kinds = (e.claims.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id);
    if (kinds.some((k) => NOT_A_THING.has(k))) continue;
    const file = e.claims.P18?.find((c) => c.rank !== 'deprecated')?.mainsnak?.datavalue?.value;
    out.push({ id, file: typeof file === 'string' ? file : '', en: e.labels?.en?.value || '' });
  }
  return out.slice(0, 3);
}

// Commons files → pictures with a thumbnail, an author and a licence
async function commons(files) {
  if (!files.length) return [];
  const titles = files.map((f) => 'File:' + f).join('|');
  const data = await getJSON(`${COMMONS}?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640`
    + `&iiextmetadatafilter=Artist|LicenseShortName|ObjectName&titles=${encodeURIComponent(titles)}`);
  const pages = Object.values(data?.query?.pages || {});
  const byTitle = new Map(pages.map((p) => [String(p.title || '').replace(/^File:/, '').replace(/_/g, ' '), p]));
  return files.map((f) => {
    const p = byTitle.get(f.replace(/_/g, ' '));
    const ii = p?.imageinfo?.[0];
    const thumb = ii?.thumburl || ii?.url;
    if (!thumb || !/^https:\/\//.test(thumb) || /\.svg$/i.test(ii.url || '') && !ii.thumburl) return null;
    const m = ii.extmetadata || {};
    const who = plainText(m.Artist?.value);
    return {
      thumb,
      by: str([`“${plainText(m.ObjectName?.value) || f.replace(/\.\w+$/, '')}”`, who].filter(Boolean).join(', '), 160),
      license: str(plainText(m.LicenseShortName?.value) || 'Wikimedia Commons', 40),
      page: str(ii.descriptionurl || '', 400),
    };
  }).filter(Boolean);
}

// does a picture's title or one of its tags hold the word? (whole words; "house" is in "Old house", not in "Lighthouse")
export function relevant(r, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const has = (s) => {
    const text = ' ' + String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
    return words.every((w) => new RegExp(`\\s${w.replace(/[^\p{L}\p{N}]/gu, '')}(s|es|er|en|e)?\\s`, 'u').test(text));
  };
  return has(r.title) || (Array.isArray(r.tags) && r.tags.some((t) => has(t?.name)));
}

async function openverse(q) {
  // licences that allow changes: the picture is shrunk and re-encoded on the device.
  // Without a key Openverse gives at most 20 at a time and refuses a larger page_size.
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${OV_PAGE}&mature=false&license_type=modification`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const all = (Array.isArray(data?.results) ? data.results : []).filter((r) => r.thumbnail && /^https:\/\//.test(r.thumbnail));
  // the ones that are about the word first; the rest only when there are too few of those
  const good = all.filter((r) => relevant(r, q));
  const list = good.length >= 6 ? good : [...good, ...all.filter((r) => !good.includes(r)).slice(0, 6 - good.length)];
  return list.map((r) => ({
    thumb: r.thumbnail,
    by: str([r.title ? `“${r.title}”` : '', r.creator ? `${r.creator}` : ''].filter(Boolean).join(', '), 160),
    license: ovLicense(r),
    page: str(r.foreign_landing_url || '', 400),
  }));
}

/* Pixabay: up to 20 pictures for a word, asked in its own language when Pixabay knows it, else in English.
   null when Pixabay did not answer, [] when it has no key here. */
async function pixabay(env, key, q, lang, en) {
  if (!env.PIXABAY_KEY) return [];
  const pl = lang === 'nb' || lang === 'nn' ? 'no' : lang;
  const [query, ql] = PX_LANGS.has(pl) ? [q, pl] : [en, 'en'];
  const k = 'pxb1:' + (await sha256(ql + '\n' + query.toLowerCase())).slice(0, 32);
  const hit = await cacheGet(env.DB, k, DAY);
  if (hit) return hit;
  await takeSimple(env, 'pxq', key, 60, 36e5);
  const url = `https://pixabay.com/api/?key=${encodeURIComponent(env.PIXABAY_KEY)}&q=${encodeURIComponent(query.slice(0, 100))}`
    + `&lang=${ql}&image_type=all&safesearch=true&per_page=20`;
  const data = await getJSON(url, 8000);
  if (!data) return null;
  const out = (Array.isArray(data.hits) ? data.hits : [])
    .filter((r) => /^https:\/\//.test(r.previewURL || '') && PX_PAGE.test(r.pageURL || ''))
    .map((r) => ({
      thumb: r.previewURL,
      url: r.pageURL,
      by: str([`“${String(r.tags || '').split(',')[0].trim()}”`, r.user].filter((x) => x && x !== '“”').join(', '), 160),
      license: 'Pixabay License',
      page: r.pageURL,
    }));
  await cacheSet(env.DB, k, out);
  return out;
}

// a Pixabay page → the address of its picture now (those last a day); kept for 20 hours
async function pixabayImage(env, id) {
  if (!env.PIXABAY_KEY) return null;
  const k = 'pxu1:' + id;
  const hit = await cacheGet(env.DB, k, 20 * 36e5);
  if (hit) return hit.u;
  const data = await getJSON(`https://pixabay.com/api/?key=${encodeURIComponent(env.PIXABAY_KEY)}&id=${id}`, 8000);
  const u = data?.hits?.[0]?.webformatURL;
  if (!/^https:\/\//.test(u || '')) return null;
  await cacheSet(env.DB, k, { u });
  return u;
}

/* { results: [{ thumb, url?, by, license, page }] } for a word or phrase in the language `lang` (also used by the
   MCP server): first the pictures of the Wikidata items the word names, then Pixabay's, then Openverse's. */
export async function find(env, key, query, lang) {
  const q = str(bare(query), 80);
  if (!q) throw new HttpError(400, 'empty');
  const L = typeof lang === 'string' && /^[a-z]{2,3}$/.test(lang) ? lang : 'en';
  const k = 'img3:' + (await sha256(L + '\n' + q.toLowerCase())).slice(0, 32);
  const hit = await cacheGet(env.DB, k, MONTH);
  if (hit) return withPixabay(hit, (await pixabay(env, key, q, L, hit.en || q).catch(() => null)) || []);
  await takeSimple(env, 'imgq', key, 60, 36e5);
  const items = await wikidata(q, L).catch(() => []);
  const en = L === 'en' ? q : (items.find((i) => i.en)?.en || q);
  const [wd, ov, px] = await Promise.all([
    commons([...new Set(items.map((i) => i.file).filter(Boolean))]).catch(() => []),
    openverse(en),
    pixabay(env, key, q, L, en).catch(() => null),
  ]);
  if (!wd.length && !ov && !px?.length) throw new HttpError(503, 'busy');
  const seen = new Set();
  const keep = (list) => list.filter((r) => !seen.has(r.thumb) && seen.add(r.thumb));
  const mine = { results: keep([...wd, ...(ov || [])]).slice(0, 18), wd: wd.length }; // wd: how many lead, from Wikidata
  if (en !== q) mine.en = en;
  // Pixabay's part has its own cache (a day): the month-long one holds Wikidata's and Openverse's
  if (ov) await cacheSet(env.DB, k, mine); // when Openverse did not answer, the next search tries it again
  return withPixabay(mine, px || []);
}

// Wikidata's pictures first, then Pixabay's, then Openverse's: 24 at most
function withPixabay(base, px) {
  if (!px.length) return base;
  const n = base.wd ?? base.results.filter((r) => /wikimedia\.org/.test(r.thumb)).length; // kept before `wd` was
  const wd = base.results.slice(0, n), rest = base.results.slice(n);
  const seen = new Set(base.results.map((r) => r.thumb));
  return { ...base, results: [...wd, ...px.filter((r) => !seen.has(r.thumb)).slice(0, 12), ...rest].slice(0, 24) };
}

export async function proxy(request, env, key) {
  const u = new URL(request.url).searchParams.get('u') || '';
  let target;
  try { target = new URL(u); } catch { throw new HttpError(400, 'bad_url'); }
  if (target.protocol !== 'https:' || target.username || target.password) throw new HttpError(400, 'bad_url');
  await takeSimple(env, 'img', key, 300, 36e5);
  // a Pixabay picture is kept by its page: the address of the picture itself changes every day
  const px = PX_PAGE.exec(target.href);
  if (px) {
    const u = await pixabayImage(env, px[1]).catch(() => null);
    if (!u) throw new HttpError(502, 'unavailable');
    target = new URL(u);
  }
  const res = await fetch(target.href, {
    headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' }, // Openverse refuses a narrower list (406); the type is checked below
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
    cf: { cacheTtl: 7 * 86400, cacheEverything: true },
  }).catch(() => null);
  if (!res?.ok) throw new HttpError(502, 'unavailable');
  // a redirect may not lead away from https
  if (res.url && !/^https:\/\//i.test(res.url)) throw new HttpError(400, 'bad_url');
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!TYPES.includes(type)) throw new HttpError(415, 'not_image');
  if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) throw new HttpError(413, 'too_large');
  // read as a stream and stopped at 5 MB: an answer without Content-Length cannot fill the Worker's memory
  const body = await readBytes(res.body, MAX_BYTES);
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=604800',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
