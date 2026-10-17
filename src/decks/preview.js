/* Link previews for a shared deck or look. A link to share is https://ordkort.com/s/ID (a look: /look/ID), not
   /#/s/ID: the part after # never reaches a server, so Telegram, WhatsApp, Messenger or Slack could only show the
   site's own title. Here the Worker answers such an address with the app's page whose title, description and
   picture tell what is shared ("🍴 Kjøkken: 30 words, Norsk bokmål → Українська", its first words, its cover);
   js/boot.js then turns the address into /#/s/ID and the app opens the deck as before. Old /#/s/ links still work.

   The page is the app itself, so a person who opens the link sees no extra step. It asks search engines not to
   index it (a share is not a page of the site), and /s/ID/cover gives a cover made on the device (a data: URL in
   the share) as a picture that link previews can load. */
import { App } from '../core/shared.js';
import { isCode } from '../core/util.js';

const SITE = 'https://ordkort.com';
const ROUTE = /^\/(s|look)\/([0-9A-Z]{8})(\/cover)?\/?$/;
export const match = (path) => ROUTE.exec(path);

// the words around the deck in the language of its translations (the six hand-made ones; English otherwise)
const SAY = {
  en: { n: (n) => `${n} words`, tag: 'Free flashcards with spaced repetition. Open the link to add the deck — no sign-up.' },
  ru: { n: (n) => `слов: ${n}`, tag: 'Бесплатные карточки с интервальными повторениями. Откройте ссылку, чтобы добавить колоду, — без регистрации.' },
  uk: { n: (n) => `слів: ${n}`, tag: 'Безкоштовні картки з інтервальними повтореннями. Відкрийте посилання, щоб додати колоду, — без реєстрації.' },
  nb: { n: (n) => `${n} ord`, tag: 'Gratis ordkort med repetisjon til rett tid. Åpne lenken for å legge til kortstokken – uten innlogging.' },
  ar: { n: (n) => `عدد الكلمات: ${n}`, tag: 'بطاقات مجانية مع التكرار المتباعد. افتح الرابط لإضافة المجموعة، بلا تسجيل.' },
  zh: { n: (n) => `${n} 个词`, tag: '免费的间隔重复卡片。打开链接即可添加卡组，无需注册。' },
};
const LOOK = 'A look for Ordkort flashcards: open the link to see it on a card and use it if you like it.';

const plain = (s, max) => {
  const t = String(s || '').replace(/\{\{c?\d*:*([^{}:]*)[^{}]*\}\}/g, '$1').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
};

// what the preview says: { title, description, image, alt }
export function describe(kind, id, d) {
  if (kind === 'look' || d.kind === 'look') {
    const name = plain(d.name, 80) || 'Ordkort';
    return { title: `🎨 ${name} — a look for Ordkort`, description: LOOK, image: `${SITE}/og.jpg`, alt: name };
  }
  const say = SAY[d.native] || SAY.en;
  const words = Array.isArray(d.words) ? d.words : [];
  const pair = `${App.langs.name(d.target)} → ${App.langs.name(d.native)}`;
  const title = plain(`${d.emoji ? d.emoji + ' ' : ''}${d.title || 'Ordkort'}`, 90);
  const sample = words.slice(0, 6).map((w) => (w.tr ? `${plain(w.term, 40)} — ${plain(w.tr, 40)}` : plain(w.term, 60))).join(' · ');
  const picture = typeof d.cover === 'string' && d.cover.startsWith('data:image/') ? `${SITE}/s/${id}/cover`
    : typeof d.cover === 'string' && /^https:\/\//.test(d.cover) ? d.cover : `${SITE}/og.jpg`;
  return {
    title: `${title}: ${say.n(words.length)}, ${pair}${d.level ? ` · ${d.level}` : ''}`,
    description: plain(`${sample}${words.length > 6 ? ' …' : ''} ${say.tag}`, 300),
    image: picture,
    alt: title,
  };
}

const shareOf = async (env, id) => {
  if (!isCode(id, 8)) return null;
  const row = await env.DB.prepare('SELECT d FROM shares WHERE id = ?').bind(id).first();
  try { return row ? JSON.parse(row.d) : null; } catch { return null; }
};

// a cover made on the device, as the picture it is
async function cover(env, id) {
  const d = await shareOf(env, id);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(d?.cover || '');
  if (!m) return new Response('Not found', { status: 404 });
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}

export async function page(request, env, [, kind, id, isCover]) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (isCover) return cover(env, id);
  const app = await env.ASSETS.fetch(new Request(new URL('/', request.url))); // never a 304: its body is rewritten
  const d = await shareOf(env, id).catch(() => null);
  // an unknown or expired code: the app itself says so (#/s/ID shows "gone")
  const p = d ? describe(kind, id, d) : null;
  const url = `${SITE}/${kind}/${id}`;
  let rw = new HTMLRewriter()
    .on('head', { element: (el) => el.prepend('<meta name="robots" content="noindex">\n  ', { html: true }) })
    // the page names its own files relative to "/" (css/style.css), and <base> is off by the CSP (base-uri 'none')
    .on('link[href]', { element: (el) => { const v = el.getAttribute('href'); if (/^(css|js)\//.test(v)) el.setAttribute('href', '/' + v); } })
    .on('script[src]', { element: (el) => { const v = el.getAttribute('src'); if (/^js\//.test(v)) el.setAttribute('src', '/' + v); } })
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', url) })
    .on('meta[property="og:url"]', { element: (el) => el.setAttribute('content', url) });
  if (p) {
    const set = (sel, v) => { rw = rw.on(sel, { element: (el) => el.setAttribute('content', v) }); };
    rw = rw.on('title', { element: (el) => el.setInnerContent(`${p.title} | Ordkort`) });
    set('meta[name="description"]', p.description);
    set('meta[property="og:title"]', p.title);
    set('meta[property="og:description"]', p.description);
    set('meta[property="og:image"]', p.image);
    set('meta[property="og:image:alt"]', p.alt);
    set('meta[name="twitter:title"]', p.title);
    set('meta[name="twitter:description"]', p.description);
    set('meta[name="twitter:image"]', p.image);
    if (!p.image.endsWith('/og.jpg')) {
      // the size given is the site's picture's; a cover has its own
      rw = rw.on('meta[property="og:image:width"], meta[property="og:image:height"]', { element: (el) => el.remove() })
        .on('meta[name="twitter:card"]', { element: (el) => el.setAttribute('content', 'summary') });
    }
  }
  const res = rw.transform(app);
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-cache');
  headers.set('X-Robots-Tag', 'noindex');
  headers.delete('ETag');
  return new Response(request.method === 'HEAD' ? null : res.body, { status: 200, headers });
}

export const _test = { describe, ROUTE };
