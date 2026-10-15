/* Ordkort as an MCP server (Model Context Protocol), at https://ordkort.com/mcp, for anyone's own AI:
   Claude, ChatGPT or any MCP client can look up the languages and topics, take checked words from the shared
   bank, find free pictures, and make a deck (with pictures) or a look for cards. It never sees anyone's cards:
   what it makes is a link, and opening the link is what adds the deck or the look, on the person's own device.

   Streamable HTTP without sessions: every POST holds one JSON-RPC 2.0 message (or a batch) and gets JSON back.
   No account, no key; tool calls count against a per-client hourly limit like the rest of the API. */
import { App } from './shared.js';
import { takeSimple } from './limits.js';
import { HttpError, str, arr, int } from './util.js';
import { cleanDeck, storeShare, bankWords } from './api.js';
import * as images from './images.js';

const SITE = 'https://ordkort.com';
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const MAX_BODY = 600000;

const INSTRUCTIONS = `Ordkort (${SITE}) is a free site for learning vocabulary with flashcards and spaced repetition. `
  + 'You cannot see or change anyone\'s cards. You make things the person adds themselves: create_deck returns a link '
  + 'that adds a deck to their cards, create_design a link that changes how their cards look. Give them the link. '
  + 'Prefer ready_words (checked against dictionaries) for common topics, and find_pictures for free pictures with '
  + 'their credits. Languages are ISO codes from list_languages; "target" is the language being learnt, "native" the '
  + 'language of the translations.';

const lang = { type: 'string', description: 'A language code from list_languages, such as "nb", "en", "uk"' };
const TOOLS = [
  {
    name: 'list_languages', title: 'Languages',
    description: 'The 60 languages Ordkort teaches and explains in, with their codes.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_topics', title: 'Topics',
    description: 'The built-in topics for word lists (greetings, food, the doctor, documents and public services…), with their ids.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'ready_words', title: 'Ready words for a topic',
    description: 'Words already in Ordkort\'s shared bank for a topic and level, with translations, forms and examples. '
      + 'Nouns and verbs have been checked against dictionaries. May be empty for a rare pair of languages; then write the words yourself.',
    inputSchema: {
      type: 'object', required: ['target', 'native', 'topic'],
      properties: {
        target: lang, native: lang,
        topic: { type: 'string', description: 'A topic id from list_topics' },
        level: { type: 'string', enum: LEVELS, default: 'A1' },
        count: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'find_pictures', title: 'Find free pictures',
    description: 'Openly licensed pictures for a word or phrase (from Openverse; English finds the most). '
      + 'Each has an image_url to put on a card and a credit to show with it.',
    inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string', maxLength: 80 } } },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: 'create_deck', title: 'Make a deck',
    description: 'Makes a deck of up to 500 cards and returns a link. When the person opens the link, Ordkort shows the deck '
      + 'and adds it to their cards if they agree. Pictures are given by an https address (for example from find_pictures). The link works for a year.',
    inputSchema: {
      type: 'object', required: ['title', 'target', 'native', 'cards'],
      properties: {
        title: { type: 'string', maxLength: 80 },
        emoji: { type: 'string', maxLength: 8 },
        target: lang, native: lang,
        level: { type: 'string', enum: LEVELS },
        cards: {
          type: 'array', minItems: 1, maxItems: 500,
          items: {
            type: 'object', required: ['term', 'translation'],
            properties: {
              term: { type: 'string', description: 'The word in the target language, with its article for a noun ("et hus", "der Hund")' },
              translation: { type: 'string' },
              part_of_speech: { type: 'string', enum: ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction', 'numeral', 'interjection', 'phrase'] },
              pronunciation: { type: 'string' }, grammar: { type: 'string' }, forms: { type: 'string', description: 'Inflected forms, comma-separated' },
              example: { type: 'string' }, example_translation: { type: 'string' },
              image_url: { type: 'string', description: 'An https address of a picture' },
              image_credit: { type: 'string', description: 'Whom to credit, with the licence' },
            },
          },
        },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'create_design', title: 'Make a look for cards',
    description: 'Makes a look for Ordkort and returns a link that shows it and applies it if the person agrees. '
      + 'front_html and back_html are card templates with fields in double braces: {{term}}, {{translation}}, {{pronunciation}}, '
      + '{{grammar}}, {{forms}}, {{example}}, {{example_translation}}, {{image}}, {{audio}}, {{deck}}; {{#example}}…{{/example}} shows its '
      + 'inside only when the card has an example. card_css styles the card, site_css the whole site (CSS variables such as '
      + '--paper, --card, --ink, --blue, --red, --font-serif). Scripts and event handlers are removed.',
    inputSchema: {
      type: 'object', required: ['name'],
      properties: {
        name: { type: 'string', maxLength: 80 },
        front_html: { type: 'string', maxLength: 20000 }, back_html: { type: 'string', maxLength: 20000 },
        card_css: { type: 'string', maxLength: 20000 }, site_css: { type: 'string', maxLength: 20000 },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

const text = (s, structured) => ({ content: [{ type: 'text', text: s }], ...(structured ? { structuredContent: structured } : {}) });
const fail = (s) => ({ content: [{ type: 'text', text: s }], isError: true });

async function callTool(name, a, env, key) {
  await takeSimple(env, 'mcp', key, 240, 36e5);
  if (name === 'list_languages') {
    const list = App.langs.list.map((l) => ({ code: l.code, name: l.en, native_name: l.name }));
    return text(list.map((l) => `${l.code} — ${l.name} (${l.native_name})`).join('\n'), { languages: list });
  }
  if (name === 'list_topics') {
    const list = App.topics.list.map((t) => ({ id: t.id, name: t.en, group: t.group }));
    return text(list.map((t) => `${t.id} — ${t.name}`).join('\n'), { topics: list });
  }
  if (name === 'ready_words') {
    const level = LEVELS.includes(a.level) ? a.level : 'A1';
    let words;
    try { words = await bankWords(env, { target: str(a.target, 8), native: str(a.native, 8), topic: str(a.topic, 40), level, n: int(a.count, 1, 100, 30) }); } catch (e) { return fail(`Cannot read that: ${e.code || e.message}. Check the language codes and the topic id.`); }
    const out = words.map((w) => ({ term: w.term, translation: w.tr, part_of_speech: w.pos, forms: w.forms, pronunciation: w.pron, example: w.ex, example_translation: w.ex_tr }));
    if (!out.length) return text('The bank has no words for this yet. Write the words yourself; nouns with their article.', { words: [] });
    return text(out.map((w) => `${w.term} — ${w.translation}${w.example ? `  (${w.example})` : ''}`).join('\n'), { words: out });
  }
  if (name === 'find_pictures') {
    let res;
    try { res = await images.find(env, key, a.query); } catch (e) { return fail(`No pictures: ${e.code || e.message}`); }
    const out = res.results.map((r) => ({ image_url: r.thumb, credit: `${r.by} · ${r.license}`, page: r.page }));
    if (!out.length) return text('No pictures found. Try a simpler word, in English.', { pictures: [] });
    return text(out.map((p, i) => `${i + 1}. ${p.image_url}\n   ${p.credit}`).join('\n'), { pictures: out });
  }
  if (name === 'create_deck') {
    let deck;
    try {
      deck = cleanDeck({
        title: a.title, emoji: a.emoji || '🤖', level: a.level, group: 'custom', target: a.target, native: a.native,
        words: arr(a.cards, 500).map((c) => ({
          term: c?.term, tr: c?.translation, pos: c?.part_of_speech, pron: c?.pronunciation, gram: c?.grammar, forms: c?.forms,
          ex: c?.example, ex_tr: c?.example_translation, img_url: c?.image_url, img_by: c?.image_credit,
        })),
      });
    } catch (e) { return fail(e.code === 'empty' ? 'The deck has no cards with both a term and a translation.' : `Cannot make that deck: ${e.code || e.message}. Check the language codes.`); }
    const id = await storeShare(env, deck);
    const url = `${SITE}/#/s/${id}`;
    return text(`The deck "${deck.title}" (${deck.words.length} cards) is ready. Opening this link adds it to the person's cards: ${url}`, { url, cards: deck.words.length });
  }
  if (name === 'create_design') {
    const look = {
      kind: 'look', name: str(a.name, 80) || 'My look',
      front: String(a.front_html || '').slice(0, 20000), back: String(a.back_html || '').slice(0, 20000),
      css: String(a.card_css || '').slice(0, 20000), site: String(a.site_css || '').slice(0, 20000),
    };
    if (!look.front && !look.back && !look.css && !look.site) return fail('The design is empty: give at least a template or some CSS.');
    const id = await storeShare(env, look);
    const url = `${SITE}/#/look/${id}`;
    return text(`The look "${look.name}" is ready. Opening this link shows it and applies it if the person agrees: ${url}`, { url });
  }
  return null;
}

async function answer(m, env, key) {
  const ok = (result) => ({ jsonrpc: '2.0', id: m.id, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id: m.id ?? null, error: { code, message } });
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return err(-32600, 'Invalid Request');
  const p = m.params || {};
  switch (m.method) {
    case 'initialize': {
      const v = VERSIONS.includes(p.protocolVersion) ? p.protocolVersion : VERSIONS[0];
      return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'ordkort', title: 'Ordkort', version: '1.0.0' }, instructions: INSTRUCTIONS });
    }
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS });
    case 'tools/call': {
      if (!TOOLS.some((t) => t.name === p.name)) return err(-32602, `Unknown tool: ${p.name}`);
      try {
        return ok(await callTool(p.name, p.arguments && typeof p.arguments === 'object' ? p.arguments : {}, env, key));
      } catch (e) {
        if (e instanceof HttpError && e.status === 429) return ok(fail('Too many requests from here for now. Wait a while and try again.'));
        throw e;
      }
    }
    case 'resources/list': return ok({ resources: [] });
    case 'prompts/list': return ok({ prompts: [] });
    default: return err(-32601, `Method not found: ${m.method}`);
  }
}

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export async function handle(request, env, key) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ name: 'ordkort', mcp: `${SITE}/mcp`, transport: 'streamable-http', docs: 'https://github.com/silicq/ordkort#mcp' }), { status: 405, headers: { ...HEADERS, Allow: 'POST' } });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Too large' } }), { status: 413, headers: HEADERS });
  let body;
  try { body = JSON.parse(raw); } catch { return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }), { status: 400, headers: HEADERS }); }
  const list = Array.isArray(body) ? body.slice(0, 20) : [body];
  const out = [];
  for (const m of list) {
    if (m && m.jsonrpc === '2.0' && m.id === undefined) continue; // a notification: nothing to answer
    out.push(await answer(m, env, key));
  }
  if (!out.length) return new Response(null, { status: 202 });
  return new Response(JSON.stringify(Array.isArray(body) ? out : out[0]), { headers: HEADERS });
}

export const _test = { TOOLS, VERSIONS };
