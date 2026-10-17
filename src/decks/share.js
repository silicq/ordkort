/* Decks shared by link (#/s/ID), and the looks an AI makes through MCP: kept for a year under a random code.
   Nothing in them says who shared them. */
import { App, LEVELS, pairOf } from '../core/shared.js';
import { takeSimple, takeStore } from '../core/limits.js';
import { HttpError, json, readJSON, str, arr, randomCode, isCode } from '../core/util.js';
import { cleanWord } from '../ai/prompts.js';

// a deck someone shares (here or through MCP), cleaned: at most 500 words, each with a term and a translation
export function cleanDeck(d) {
  const { target, native } = pairOf(d || {});
  const words = arr(d.words, 500).map(cleanWord).filter((w) => w.term && (w.tr || /\{\{[^{}]+\}\}/.test(w.term))); // a card with gaps may have no translation
  if (!words.length) throw new HttpError(400, 'empty');
  return {
    title: str(d.title, 80), emoji: str(d.emoji, 8), level: LEVELS.includes(d.level) ? d.level : '',
    topic: typeof d.topic === 'string' && App.topics.get(d.topic) ? d.topic : '',
    group: str(d.group, 12), target, native, words, ...cover(d),
  };
}
// a deck's cover: a small picture as a data: URL (made on the device) or an https address (from an AI through MCP)
function cover(d) {
  const c = typeof d.cover === 'string' ? d.cover : '';
  const ok = (c.length <= 40000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c)) || (c.length <= 600 && /^https:\/\/[^\s]+$/.test(c));
  if (!ok) return {};
  const by = str(d.cover_by, 200);
  return by ? { cover: c, cover_by: by } : { cover: c };
}
// kept for a year under a random 8-letter code (a deck, or a look made through MCP)
export async function storeShare(env, key, data) {
  const d = JSON.stringify(data);
  await takeStore(env, key, d.length);
  for (let i = 0; i < 5; i++) {
    const id = randomCode(8);
    const r = await env.DB.prepare('INSERT OR IGNORE INTO shares (id, d, t) VALUES (?, ?, ?)').bind(id, d, Date.now()).run();
    if (r.meta.changes) return id;
  }
  throw new HttpError(503, 'busy');
}

export async function shareCreate(request, env, key) {
  await takeSimple(env, 'share', key, 20, 36e5);
  const b = await readJSON(request, 400000);
  return json({ id: await storeShare(env, key, cleanDeck(b.deck || {})) });
}

export async function shareGet(env, id) {
  if (!isCode(id, 8)) throw new HttpError(404, 'gone');
  const row = await env.DB.prepare('SELECT d FROM shares WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'gone');
  return json({ deck: JSON.parse(row.d) });
}
