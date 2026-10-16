/* The library: decks people publish for everybody learning the same pair of languages.

   Publishing is a choice (a deck shared by link stays unlisted). Before a deck is listed, Llama Guard reads its
   title and words and looks at its cover; an unsafe deck is refused, and when the words cannot be checked nothing
   is published (a cover that cannot be looked at is left out). Listed decks can be voted up or down, are counted when added, and can be reported: after
   REPORTS_TO_HIDE reports from different people a deck is hidden until the site's owner looks at it.
   The publisher keeps a token that lets them take the deck down; the site's owner can take down any deck, or any
   deck shared by link, with the ADMIN_TOKEN secret.

   People are told apart only by the same daily-salted fingerprint the limits use: a vote or a report counts once
   per person per day, and nothing about them is kept. */
import { cleanDeck } from './api.js';
import { guard } from './groq.js';
import { takeSimple } from './limits.js';
import { HttpError, json, readJSON, str, int, sha256, randomCode, isCode, safeEqual } from './util.js';
import { App } from './shared.js';

const PAGE = 24;
const REPORTS_TO_HIDE = 3;
const REASONS = ['adult', 'drugs', 'violence', 'hate', 'spam', 'wrong', 'other'];
const MIN_WORDS = 5;

const token = () => randomCode(8) + randomCode(8) + randomCode(8);
const isAdmin = (request, env) => !!env.ADMIN_TOKEN && safeEqual(request.headers.get('X-Admin-Token') || '', env.ADMIN_TOKEN);

/* What the check reads: the title and every word, translation and example, in pieces it can take, and the
   cover on its own. → { bad: the categories found unsafe ([] when all is well), cover: false when the cover could
   not be looked at (it is then left out) }. */
export async function check(env, deck) {
  const lines = [deck.title, ...deck.words.map((w) => [w.term, w.tr, w.ex, w.ex_tr].filter(Boolean).join(' — '))];
  const pieces = [];
  let cur = '';
  for (const l of lines) {
    if (cur.length + l.length > 12000) { pieces.push(cur); cur = ''; }
    cur += l + '\n';
  }
  if (cur) pieces.push(cur);
  const found = new Set();
  const note = (r) => { r.cats.forEach((c) => found.add(c)); if (!r.safe && !r.cats.length) found.add('unsafe'); };
  for (const text of pieces) note(await guard(env, { text: `A vocabulary deck for language learners:\n${text}` }));
  let cover = true;
  if (deck.cover?.startsWith('data:')) {
    try { note(await guard(env, { text: `The cover of a vocabulary deck called "${deck.title}".`, image: deck.cover })); }
    catch (e) { if (e.status !== 503) throw e; cover = false; }
  }
  return { bad: [...found], cover };
}

// pictures on the words: only from the free sources the site's own search uses, not any address someone pasted
const PIC_HOSTS = /(^|\.)(wikimedia\.org|pixabay\.com|openverse\.org|staticflickr\.com)$/;
const picOk = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && PIC_HOSTS.test(x.hostname); } catch { return false; } };

export async function publish(request, env, key) {
  const b = await readJSON(request, 400000);
  const deck = cleanDeck(b.deck || {});
  if (deck.cover && !deck.cover.startsWith('data:')) { delete deck.cover; delete deck.cover_by; } // only a cover made on the device
  for (const w of deck.words) if (w.img_url && !picOk(w.img_url)) { delete w.img_url; delete w.img_by; }
  if (deck.words.length < MIN_WORDS) throw new HttpError(400, 'too_small');
  if (str(deck.title, 80).length < 3) throw new HttpError(400, 'no_title');
  await takeSimple(env, 'lib-pub', key, 10, 864e5);
  const { bad, cover } = await check(env, deck);
  if (bad.length) return json({ error: 'refused', cats: bad }, 422);
  if (!cover) { delete deck.cover; delete deck.cover_by; }
  const own = token();
  for (let i = 0; i < 5; i++) {
    const id = randomCode(8);
    const r = await env.DB.prepare('INSERT OR IGNORE INTO library (id, target, native, title, level, n, d, owner, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, deck.target, deck.native, deck.title, deck.level || '', deck.words.length, JSON.stringify(deck), await sha256(own), Date.now()).run();
    if (r.meta.changes) return json(cover ? { id, token: own } : { id, token: own, cover: false });
  }
  throw new HttpError(503, 'busy');
}

export async function list(request, env) {
  const u = new URL(request.url).searchParams;
  const target = u.get('target') || '', native = u.get('native') || '';
  if (!App.langs.has(target) || !App.langs.has(native)) throw new HttpError(400, 'bad_lang');
  const q = str(u.get('q'), 60).toLowerCase();
  const page = int(u.get('page'), 0, 50, 0);
  const order = u.get('sort') === 'new' ? 't DESC' : '((up + 1.0) / (up + down + 2.0)) * (adds + 3) DESC, t DESC';
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
  const rows = (await env.DB.prepare(`SELECT id, d, n, up, down, adds, t FROM library WHERE target = ? AND native = ? AND hidden = 0 ${q ? "AND lower(title) LIKE ? ESCAPE '\\'" : ''} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .bind(...[target, native, ...(q ? [like] : []), PAGE + 1, page * PAGE]).all()).results || [];
  const decks = rows.slice(0, PAGE).map((r) => {
    const d = JSON.parse(r.d);
    return { id: r.id, title: d.title, emoji: d.emoji, cover: d.cover, level: d.level, n: r.n, up: r.up, down: r.down, adds: r.adds, t: r.t, sample: d.words.slice(0, 4).map((w) => w.term) };
  });
  return json({ decks, more: rows.length > PAGE });
}

export async function get(env, id) {
  if (!isCode(id, 8)) throw new HttpError(404, 'gone');
  const row = await env.DB.prepare('SELECT d, up, down, adds, hidden FROM library WHERE id = ?').bind(id).first();
  if (!row || row.hidden) throw new HttpError(404, 'gone');
  return json({ deck: JSON.parse(row.d), up: row.up, down: row.down, adds: row.adds });
}

// one mark of a kind per person per day; → true when it is new
async function mark(env, id, who, kind, v) {
  const r = await env.DB.prepare('INSERT OR IGNORE INTO libmarks (id, who, kind, v, t) VALUES (?, ?, ?, ?, ?)').bind(id, who, kind, v, Date.now()).run();
  return !!r.meta.changes;
}

export async function act(request, env, key, id, what) {
  if (!isCode(id, 8)) throw new HttpError(404, 'gone');
  await takeSimple(env, 'lib-act', key, 120, 36e5);
  const row = await env.DB.prepare('SELECT hidden FROM library WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'gone');
  const b = await readJSON(request, 2000);
  if (what === 'add') {
    if (await mark(env, id, key, 'add', 1)) await env.DB.prepare('UPDATE library SET adds = adds + 1 WHERE id = ?').bind(id).run();
  } else if (what === 'vote') {
    const v = b.v === -1 ? -1 : 1;
    if (await mark(env, id, key, 'vote', v)) await env.DB.prepare(`UPDATE library SET ${v > 0 ? 'up = up + 1' : 'down = down + 1'} WHERE id = ?`).bind(id).run();
  } else if (what === 'report') {
    const why = REASONS.indexOf(b.why);
    if (why < 0) throw new HttpError(400, 'bad_reason');
    if (await mark(env, id, key, 'report', why)) {
      await env.DB.prepare(`UPDATE library SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= ${REPORTS_TO_HIDE} THEN 1 ELSE hidden END WHERE id = ?`).bind(id).run();
    }
  } else throw new HttpError(404, 'not_found');
  return json({ ok: true });
}

// the publisher (with their token) or the site's owner (ADMIN_TOKEN) takes a deck down
export async function remove(request, env, id) {
  if (!isCode(id, 8)) throw new HttpError(404, 'gone');
  const admin = isAdmin(request, env);
  const own = request.headers.get('X-Lib-Token') || '';
  if (!admin && !own) throw new HttpError(401, 'no_token');
  const r = admin
    ? await env.DB.prepare('DELETE FROM library WHERE id = ?').bind(id).run()
    : await env.DB.prepare('DELETE FROM library WHERE id = ? AND owner = ?').bind(id, await sha256(own)).run();
  if (!r.meta.changes) throw new HttpError(admin ? 404 : 403, admin ? 'gone' : 'forbidden');
  await env.DB.prepare('DELETE FROM libmarks WHERE id = ?').bind(id).run();
  return json({ deleted: true });
}

// the site's owner takes down a deck shared by link (or a look made through MCP)
export async function removeShare(request, env, id) {
  if (!isAdmin(request, env)) throw new HttpError(403, 'forbidden');
  if (!isCode(id, 8)) throw new HttpError(404, 'gone');
  const r = await env.DB.prepare('DELETE FROM shares WHERE id = ?').bind(id).run();
  return json({ deleted: !!r.meta.changes });
}

// the hidden decks waiting for a look, for the site's owner
export async function hidden(request, env) {
  if (!isAdmin(request, env)) throw new HttpError(403, 'forbidden');
  const rows = (await env.DB.prepare('SELECT id, title, target, native, reports, t FROM library WHERE hidden = 1 ORDER BY t DESC LIMIT 100').all()).results || [];
  return json({ decks: rows });
}

export const _test = { REASONS, REPORTS_TO_HIDE, MIN_WORDS };
