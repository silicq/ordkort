// The mail of the site (src/mail.js): every letter reaches the inbox, and a person gets one note that it arrived
import test from 'node:test';
import assert from 'node:assert/strict';
import { langOf, decodeSubject, wantsNote, noteMessage, receive } from '../src/mail.js';

const H = (o = {}) => new Headers(o);

test('the note speaks the language of the subject, English when it cannot tell', () => {
  assert.equal(langOf('Вопрос про карточки'), 'ru');
  assert.equal(langOf('Привіт! Питання щодо карток'), 'uk');
  assert.equal(langOf('Pytanie o fiszki – błąd'), 'pl');
  assert.equal(langOf('Spørsmål om ordkort'), 'nb');
  assert.equal(langOf('سؤال عن البطاقات'), 'ar');
  assert.equal(langOf('Question'), 'en');
  assert.equal(langOf(''), 'en');
});

test('encoded subjects are decoded, adjacent words joined', () => {
  assert.equal(decodeSubject('=?UTF-8?B?0JLQvtC/0YDQvtGB?='), 'Вопрос');
  assert.equal(decodeSubject('=?utf-8?Q?Sp=C3=B8rsm=C3=A5l_om_ord?='), 'Spørsmål om ord');
  assert.equal(decodeSubject('=?UTF-8?B?0JLQvg==?= =?UTF-8?B?0L/RgNC+0YE=?='), 'Вопрос');
  assert.equal(decodeSubject('Plain subject'), 'Plain subject');
});

test('no note to robots, lists, autoresponders or ourselves', () => {
  assert.ok(wantsNote(H(), 'kari@example.no'));
  assert.ok(!wantsNote(H(), 'noreply@example.com'));
  assert.ok(!wantsNote(H(), 'mailer-daemon@example.com'));
  assert.ok(!wantsNote(H(), 'hei@ordkort.com'));
  assert.ok(!wantsNote(H({ 'Auto-Submitted': 'auto-replied' }), 'kari@example.no'));
  assert.ok(wantsNote(H({ 'Auto-Submitted': 'no' }), 'kari@example.no'));
  assert.ok(!wantsNote(H({ Precedence: 'bulk' }), 'kari@example.no'));
  assert.ok(!wantsNote(H({ 'List-Id': '<news.example.com>' }), 'kari@example.no'));
  assert.ok(!wantsNote(H({ 'X-Autoreply': 'yes' }), 'kari@example.no'));
});

test('the note is threaded under the letter, marked as automatic, and readable', () => {
  const raw = noteMessage({ from: 'post@ordkort.com', to: 'kari@example.no', subject: 'Re: Spørsmål', lang: 'nb', messageId: '<a@x>', references: '<z@x>', id: 'n1', date: new Date(Date.UTC(2026, 9, 18)) });
  const [head, body] = raw.split('\r\n\r\n');
  assert.match(head, /^From: Ordkort <post@ordkort\.com>\r\nTo: kari@example\.no\r\n/);
  assert.match(head, /\r\nIn-Reply-To: <a@x>\r\nReferences: <z@x> <a@x>\r\n/);
  assert.match(head, /\r\nAuto-Submitted: auto-replied\r\n/);
  assert.equal(decodeSubject(/Subject: (.+)/.exec(head)[1]), 'Re: Spørsmål');
  const text = new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\r\n/g, '')), (c) => c.charCodeAt(0)));
  assert.match(text, /meldingen din har kommet fram/);
  assert.match(text, /innen 2 dager/);
  assert.ok(body.split('\r\n').every((l) => l.length <= 76));
});

function fakeDB() {
  const hits = new Map();
  return {
    prepare: () => ({ bind: (k, by) => ({ first: async () => { hits.set(k, (hits.get(k) || 0) + by); return { n: hits.get(k) }; } }) }),
  };
}
function letter(from, headers = {}) {
  const m = { from, to: 'hei@ordkort.com', headers: H({ Subject: 'Hello', 'Message-ID': '<1@x>', ...headers }), forwarded: [], replies: [] };
  m.forward = async (to) => { m.forwarded.push(to); };
  m.reply = async (e) => { m.replies.push(e); };
  return m;
}

test('every letter is forwarded; a person gets one note a week, a list none', async () => {
  const env = { DB: fakeDB(), MAIL_TO: 'me@example.com' };
  const a = letter('kari@example.no'), b = letter('kari@example.no'), c = letter('news@example.com', { 'List-Id': '<l>' });
  class EmailMessage { constructor(from, to, raw) { Object.assign(this, { from, to, raw }); } }
  for (const m of [a, b, c]) await receive(m, env, { EmailMessage });
  for (const m of [a, b, c]) assert.deepEqual(m.forwarded, ['me@example.com']);
  assert.equal(a.replies.length, 1);
  assert.deepEqual([a.replies[0].from, a.replies[0].to], ['hei@ordkort.com', 'kari@example.no']);
  assert.equal(b.replies.length, 0, 'the same sender again within a week');
  assert.equal(c.replies.length, 0, 'a mailing list');
  // a note that cannot be sent (no valid DMARC on the letter, say) leaves the forwarded letter alone
  const d = letter('ola@example.no');
  d.reply = async () => { throw new Error('no DMARC'); };
  await receive(d, env, { EmailMessage });
  assert.deepEqual(d.forwarded, ['me@example.com']);
});
