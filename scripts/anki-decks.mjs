// Anki decks of the Norwegian topics, for the topic pages and for AnkiWeb: public/anki/ordkort-norsk-<ui>-<topic>.apkg
// for each topic and public/anki/ordkort-norsk-<ui>.apkg with every topic, in each language that has deck names
// (ankiRoot in scripts/seo-text.mjs). The words are those of the topic pages, with the forms they show.
// The packages are written by the app's own writer (public/js/apkg.js) with a fixed date, fixed ids and one guid per
// word, so the same words make the same files and a new version of a deck updates the notes it already gave.
// The same words go to public/ready/nb/<ui>/<topic>.json too: the app fills a topic deck from them when the AI is
// down or busy (public/js/app.js).
// Run `npm run decks` after `npm run seo` and commit the result (a test checks that every linked deck exists).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import { UI, UIS, slug } from './seo-text.mjs';
import { build, deckPath, topicWords, keyForms, topicPath, topicsHubPath, TOPIC_IDS, SITE, t } from './seo-pages.mjs';

const NOW = Date.UTC(2026, 9, 1); // the date inside every package: changing it changes every file
const ROOT = new URL('../', import.meta.url);
globalThis.window ??= globalThis;
vm.runInThisContext(readFileSync(new URL('public/js/apkg.js', ROOT), 'utf8'), { filename: 'public/js/apkg.js' });
const K = globalThis.App.apkg;

// a topic as Anki deck names sort it: "Norwegian by topic (ordkort.com)::03 Numbers & amounts"
const deckName = (ui, id) => `${UI[ui].ankiRoot}::${String(TOPIC_IDS.indexOf(id) + 1).padStart(2, '0')} ${t(ui, 'topic.' + id)}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function deck(ui, id) {
  const U = UI[ui];
  const cards = topicWords(ui, id).filter((x) => x.tr).map((x) => ({
    term: x.term, tr: x.tr, pron: '', gram: U.pos[x.pos] || '', forms: keyForms(x.a, x.lemma) || '', ex: x.ex || '', exTr: x.exTr || '',
    guid: `ordkort-${ui}-${id}-${slug(x.lemma)}`,
  }));
  const url = SITE + topicPath(ui, id);
  return { name: deckName(ui, id), desc: `${esc(U.ankiDesc(cards.length))} <a href="${esc(url)}">${esc(url)}</a>`, cards };
}

export async function decks(live = build().live) {
  const SQL = await initSqlJs();
  const out = new Map(); // public path → bytes
  for (const ui of UIS) {
    if (!UI[ui].ankiRoot) continue;
    const ids = TOPIC_IDS.filter((id) => live.topics[ui].has(id));
    const all = ids.map((id) => deck(ui, id));
    // the parent deck carries the description too: Anki shows it above the topics
    const hub = SITE + topicsHubPath(ui);
    const root = { name: UI[ui].ankiRoot, desc: `${esc(UI[ui].ankiDesc(all.reduce((n, d) => n + d.cards.length, 0)))} <a href="${esc(hub)}">${esc(hub)}</a>`, cards: [] };
    // each topic's ids start from its own place, so decks imported one by one never share an id
    for (const [i, d] of all.entries()) out.set(deckPath(ui, ids[i]), await K.write([root, d], new Map(), { SQL, now: NOW, base: NOW + (i + 1) * 1e5 }));
    out.set(deckPath(ui), await K.write([root, ...all], new Map(), { SQL, now: NOW, base: NOW + 1e8 }));
  }
  return out;
}

// a topic's words for the app, in the shape /api/words gives them: forms from Bokmålsordboka count as checked
export const readyPath = (ui, id) => `/ready/nb/${ui}/${id}.json`;
export function ready(live = build().live) {
  const out = new Map(); // public path → JSON
  for (const ui of UIS) {
    if (ui === 'nb') continue; // no translations: Norwegian learnt in Norwegian
    for (const id of TOPIC_IDS.filter((x) => live.topics[ui].has(x))) {
      const words = topicWords(ui, id).filter((x) => x.tr).map((x) => {
        const w = { term: x.term, tr: x.tr, pos: x.pos, forms: keyForms(x.a, x.lemma) || '', ex: x.ex || '', ex_tr: x.exTr || '' };
        if (x.a) w.chk = 1;
        return w;
      });
      out.set(readyPath(ui, id), JSON.stringify({ words }) + '\n');
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = await decks();
  const dir = fileURLToPath(new URL('public/anki/', ROOT));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let size = 0;
  for (const [p, bytes] of out) { writeFileSync(fileURLToPath(new URL('public' + p, ROOT)), bytes); size += bytes.length; }
  console.log(`${out.size} Anki decks, ${Math.round(size / 1024)} KB, in public/anki/`);
  const json = ready();
  rmSync(fileURLToPath(new URL('public/ready/', ROOT)), { recursive: true, force: true });
  for (const [p, text] of json) {
    const file = new URL('public' + p, ROOT);
    mkdirSync(new URL('./', file), { recursive: true });
    writeFileSync(file, text);
  }
  console.log(`${json.size} ready topics in public/ready/`);
}
