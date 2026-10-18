/* Mail to hei@, post@, help@ and support@ordkort.com. Email Routing hands each letter to this Worker: it goes on
   unchanged to the inbox in MAIL_TO (a secret, and a verified destination in Email Routing), and the sender gets one
   short note that it arrived and when to expect an answer, in the language of the subject, from the address they
   wrote to. At most one note per sender a week, and none to robots, mailing lists or other autoresponders. */
import { bump } from './core/db.js';
import { sha256 } from './core/util.js';

const WEEK = 7 * 864e5;
export const ANSWER_DAYS = 2; // the answer time the note promises

// the note in each language: a heading, the greeting, three short paragraphs, the answer time, and a way to the topics
const NOTE = {
  en: { s: 'We got your message', hi: 'Hi,', got: 'thank you for writing to Ordkort – your message has arrived.', who: 'Ordkort is made by one person, so the answer comes from a human.', when: (d) => `Usually within ${d} days`, auto: 'This is an automatic note; there is no need to reply to it.', more: 'Norwegian words by topic', path: '/en/norwegian/' },
  nb: { s: 'Vi har fått meldingen din', hi: 'Hei,', got: 'takk for at du skrev til Ordkort – meldingen din har kommet fram.', who: 'Ordkort lages av én person, så svaret kommer fra et menneske.', when: (d) => `Vanligvis innen ${d} dager`, auto: 'Dette er en automatisk melding; du trenger ikke å svare på den.', more: 'Norske gloser etter tema', path: '/nb/norsk/' },
  ru: { s: 'Ваше письмо получено', hi: 'Здравствуйте!', got: 'Спасибо, что написали в Ordkort, — письмо дошло.', who: 'Ordkort делает один человек, поэтому ответит живой человек.', when: (d) => `Обычно в течение ${d} дней`, auto: 'Это автоматическое сообщение, отвечать на него не нужно.', more: 'Норвежские слова по темам', path: '/ru/norvezhskij/' },
  uk: { s: 'Ваш лист отримано', hi: 'Вітаю!', got: 'Дякуємо, що написали в Ordkort, — лист дійшов.', who: 'Ordkort робить одна людина, тож відповість жива людина.', when: (d) => `Зазвичай протягом ${d} днів`, auto: 'Це автоматичне повідомлення, відповідати на нього не потрібно.', more: 'Норвезькі слова за темами', path: '/uk/norvezka/' },
  pl: { s: 'Twoja wiadomość dotarła', hi: 'Cześć,', got: 'dziękujemy za wiadomość do Ordkort – dotarła.', who: 'Ordkort tworzy jedna osoba, więc odpowie człowiek.', when: (d) => `Zwykle w ciągu ${d} dni`, auto: 'To automatyczna wiadomość, nie trzeba na nią odpowiadać.', more: 'Norweskie słówka według tematów', path: '/pl/norweski/' },
  ar: { s: 'وصلتنا رسالتك', hi: 'مرحبًا،', got: 'شكرًا لمراسلتك Ordkort، لقد وصلت رسالتك.', who: 'يصنع Ordkort شخص واحد، لذلك سيأتيك الرد من إنسان.', when: (d) => `عادةً خلال ${d} أيام`, auto: 'هذه رسالة تلقائية، لا داعي للرد عليها.', more: 'كلمات نرويجية حسب الموضوع', path: '/ar/narwiji/', rtl: true },
};
const SITE = 'https://ordkort.com';
const LOGO = SITE + '/icons/icon-192.png';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// the note as plain text, for mail programs that show no HTML
export function noteText(lang) {
  const n = NOTE[lang] || NOTE.en;
  return `${n.hi}\n\n${n.got}\n\n${n.who} ${n.when(ANSWER_DAYS)}.\n\n${n.auto}\n\n${n.more}: ${SITE}${n.path}\n\nOrdkort\n${SITE}`;
}

/* the note as HTML in the colours of the site: paper, a card, the logo. Mail programs drop most CSS, so the look
   is inline styles on tables; the dark colours come only where a program understands prefers-color-scheme. */
export function noteHtml(lang) {
  const n = NOTE[lang] || NOTE.en;
  const dir = n.rtl ? 'rtl' : 'ltr', side = n.rtl ? 'right' : 'left';
  const ui = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const p = (t, extra = '') => `<p class="ink" style="margin:0 0 14px;font:16px/1.6 ${ui};color:#1d1a16;${extra}">${esc(t)}</p>`;
  return `<!doctype html>
<html lang="${lang in NOTE ? lang : 'en'}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(n.s)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .bg { background: #15130f !important; }
  .card { background: #1e1b16 !important; border-color: #322d24 !important; }
  .ink { color: #f2ece1 !important; }
  .ink2 { color: #bdb4a4 !important; }
  .when { background: #3a3120 !important; color: #f2ece1 !important; }
  .link { color: #a9b6ff !important; }
}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#f4efe6">
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4efe6">
<tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px">
<tr><td dir="ltr" style="padding:0 4px 16px;text-align:${side}">
<a href="${SITE}/" style="text-decoration:none"><img src="${LOGO}" width="36" height="36" alt="" style="vertical-align:middle;border:0;border-radius:9px"><span class="ink" style="vertical-align:middle;margin:0 9px;font:700 22px Georgia,'Times New Roman',serif;color:#1d1a16">ordkort</span></a>
</td></tr>
<tr><td class="card" dir="${dir}" style="background:#fffdf8;border:1px solid #e4dccc;border-radius:18px;padding:30px 28px 18px;text-align:${side}">
<h1 class="ink" style="margin:0 0 18px;font:700 26px/1.25 Georgia,'Times New Roman',serif;color:#1d1a16">${esc(n.s)}</h1>
${p(n.hi, 'margin-bottom:6px')}
${p(n.got)}
${p(n.who)}
<p class="when" style="display:inline-block;margin:2px 0 18px;padding:10px 16px;border-radius:12px;background:#fbf0ce;font:600 16px/1.4 ${ui};color:#1d1a16">${esc(n.when(ANSWER_DAYS))}</p>
<p class="ink2" style="margin:0 0 10px;font:14px/1.55 ${ui};color:#6b6357">${esc(n.auto)}</p>
</td></tr>
<tr><td dir="${dir}" style="padding:16px 4px 0;text-align:${side};font:14px/1.6 ${ui}">
<a class="link" href="${SITE}${n.path}" style="color:#2139b0;font-weight:600">${esc(n.more)}</a><span class="ink2" style="color:#6b6357"> · </span><a class="link" href="${SITE}/" style="color:#2139b0">ordkort.com</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// the language of the note, from the letters of the subject; English when they say nothing
export function langOf(text) {
  const s = String(text || '');
  if (/[؀-ۿ]/.test(s)) return 'ar';
  if (/[Ѐ-ӿ]/.test(s)) return /[ієїґ]/i.test(s) ? 'uk' : 'ru';
  if (/[ąćęłńśźż]/i.test(s)) return 'pl';
  if (/[æøå]/i.test(s)) return 'nb';
  return 'en';
}

// a subject as mail writes it: =?UTF-8?B?…?= and =?UTF-8?Q?…?= words decoded, the rest left as it is
export function decodeSubject(s) {
  return String(s || '').replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=\s*(?==\?)/gi, '=?$1?$2?$3?=').replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (m, cs, enc, data) => {
    try {
      const bytes = enc.toLowerCase() === 'b'
        ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
        : Uint8Array.from(data.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), (c) => c.charCodeAt(0));
      return new TextDecoder(cs).decode(bytes);
    } catch { return m; }
  });
}

// a note only to a person: not to robots, lists, other autoresponders, bounces or ourselves
export function wantsNote(headers, from) {
  const h = (k) => (headers.get(k) || '').toLowerCase();
  const who = String(from || '').toLowerCase();
  if (!who.includes('@') || who.endsWith('@ordkort.com')) return false;
  if (/^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?)[@+.-]/.test(who)) return false;
  if (h('auto-submitted') && h('auto-submitted') !== 'no') return false;
  if (/bulk|list|junk|auto_reply/.test(h('precedence'))) return false;
  if (h('list-id') || h('list-unsubscribe') || h('x-autoreply') || h('x-autorespond') || h('x-auto-response-suppress')) return false;
  return true;
}

const b64 = (s) => { const u = new TextEncoder().encode(s); let r = ''; for (let i = 0; i < u.length; i += 0x8000) r += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(r); };
const word = (s) => `=?UTF-8?B?${b64(s)}?=`;
const part = (type, text) => [`Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', b64(text).replace(/.{76}/g, '$&\r\n')].join('\r\n');

// the note as a raw message, threaded under the letter it answers: plain text and HTML, the program picks one
export function noteMessage({ from, to, subject, messageId, references, lang, id = crypto.randomUUID(), date = new Date() }) {
  const n = NOTE[lang] || NOTE.en;
  const subj = subject ? `Re: ${subject.replace(/^(re|aw|sv|ответ|відповідь):\s*/i, '')}` : n.s;
  const cut = `ordkort-${id}`;
  return [
    `From: Ordkort <${from}>`,
    `To: ${to}`,
    `Subject: ${word(subj)}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: <${id}@ordkort.com>`,
    ...(messageId ? [`In-Reply-To: ${messageId}`, `References: ${[references, messageId].filter(Boolean).join(' ')}`] : []),
    'Auto-Submitted: auto-replied',
    'X-Auto-Response-Suppress: All',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${cut}"`,
    '',
    `--${cut}`,
    part('text/plain', noteText(lang)),
    `--${cut}`,
    part('text/html', noteHtml(lang)),
    `--${cut}--`,
    '',
  ].join('\r\n');
}

export async function receive(message, env, deps = {}) {
  // the letter itself first: whatever happens to the note, it reaches the inbox
  if (env.MAIL_TO) await message.forward(env.MAIL_TO);
  else console.log('mail: MAIL_TO is not set, the letter was not forwarded');
  if (!wantsNote(message.headers, message.from)) return;
  try {
    const n = await bump(env.DB, 'note:' + (await sha256(message.from.toLowerCase())).slice(0, 32), WEEK);
    if (n > 1) return;
    const subject = decodeSubject(message.headers.get('subject')).slice(0, 200);
    const EmailMessage = deps.EmailMessage || (await import('cloudflare:email')).EmailMessage; // the tests pass their own
    const raw = noteMessage({
      from: message.to, to: message.from, subject, lang: langOf(subject),
      messageId: message.headers.get('message-id'), references: message.headers.get('references'),
    });
    await message.reply(new EmailMessage(message.to, message.from, raw));
  } catch (e) {
    console.log('mail: no note:', e.message); // e.g. a letter without a valid DMARC result cannot be answered
  }
}
