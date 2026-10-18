/* Mail to hei@, post@, help@ and support@ordkort.com. Email Routing hands each letter to this Worker: it goes on
   unchanged to the inbox in MAIL_TO (a secret, and a verified destination in Email Routing), and the sender gets one
   short note that it arrived and when to expect an answer, in the language of the subject, from the address they
   wrote to. At most one note per sender a week, and none to robots, mailing lists or other autoresponders. */
import { bump } from './core/db.js';
import { sha256 } from './core/util.js';

const WEEK = 7 * 864e5;
export const ANSWER_DAYS = 2; // the answer time the note promises

const NOTE = {
  en: { s: 'We got your message', b: (d) => `Hi,\n\nthank you for writing to Ordkort – your message has arrived.\n\nOrdkort is made by one person, so the answer comes from a human, usually within ${d} days.\n\nThis is an automatic note; there is no need to reply to it.\n\nOrdkort\nhttps://ordkort.com` },
  nb: { s: 'Vi har fått meldingen din', b: (d) => `Hei,\n\ntakk for at du skrev til Ordkort – meldingen din har kommet fram.\n\nOrdkort lages av én person, så svaret kommer fra et menneske, vanligvis innen ${d} dager.\n\nDette er en automatisk melding; du trenger ikke å svare på den.\n\nOrdkort\nhttps://ordkort.com` },
  ru: { s: 'Ваше письмо получено', b: (d) => `Здравствуйте!\n\nСпасибо, что написали в Ordkort, — письмо дошло.\n\nOrdkort делает один человек, поэтому ответит живой человек, обычно в течение ${d} дней.\n\nЭто автоматическое сообщение, отвечать на него не нужно.\n\nOrdkort\nhttps://ordkort.com` },
  uk: { s: 'Ваш лист отримано', b: (d) => `Вітаю!\n\nДякуємо, що написали в Ordkort, — лист дійшов.\n\nOrdkort робить одна людина, тож відповість жива людина, зазвичай протягом ${d} днів.\n\nЦе автоматичне повідомлення, відповідати на нього не потрібно.\n\nOrdkort\nhttps://ordkort.com` },
  pl: { s: 'Twoja wiadomość dotarła', b: (d) => `Cześć,\n\ndziękujemy za wiadomość do Ordkort – dotarła.\n\nOrdkort tworzy jedna osoba, więc odpowie człowiek, zwykle w ciągu ${d} dni.\n\nTo automatyczna wiadomość, nie trzeba na nią odpowiadać.\n\nOrdkort\nhttps://ordkort.com` },
  ar: { s: 'وصلتنا رسالتك', b: (d) => `مرحبًا،\n\nشكرًا لمراسلتك Ordkort، لقد وصلت رسالتك.\n\nيصنع Ordkort شخص واحد، لذلك سيأتيك الرد من إنسان، عادةً خلال ${d} أيام.\n\nهذه رسالة تلقائية، لا داعي للرد عليها.\n\nOrdkort\nhttps://ordkort.com` },
};

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

const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const word = (s) => `=?UTF-8?B?${b64(s)}?=`;

// the note as a raw message, threaded under the letter it answers
export function noteMessage({ from, to, subject, messageId, references, lang, id = crypto.randomUUID(), date = new Date() }) {
  const n = NOTE[lang] || NOTE.en;
  const subj = subject ? `Re: ${subject.replace(/^(re|aw|sv|ответ|відповідь):\s*/i, '')}` : n.s;
  const body = b64(n.b(ANSWER_DAYS)).replace(/.{76}/g, '$&\r\n');
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
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
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
