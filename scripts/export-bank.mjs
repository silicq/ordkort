// Exports the Norwegian part of the shared word bank (D1 table `words`) to data/seo/bank.json,
// for the topic pages that scripts/seo-pages.mjs builds. Reads the LOCAL database of `wrangler dev`
// by default; `--remote` reads the production database instead (read-only: one SELECT).
//   node scripts/export-bank.mjs            → the local database
//   node scripts/export-bank.mjs --remote   → production (needs `npx wrangler login`)
// Then run `npm run seo` and commit data/seo/bank.json together with the pages.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const remote = process.argv.includes('--remote');
const SQL = "SELECT grp, data FROM words WHERE grp LIKE 'nb:%' ORDER BY grp, id";
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const out = execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'ordkort', remote ? '--remote' : '--local', '--json', '--command', SQL], {
  encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
const rows = JSON.parse(out)[0]?.results || [];

// { "<native>": { "<topic>": [card, …] } } — built-in topics only (custom ones are hashes), levels in order
const bank = {};
for (const lvl of LEVELS) {
  for (const r of rows) {
    const [, native, topic, level] = r.grp.split(':');
    if (level !== lvl || topic.startsWith('c')) continue;
    let w;
    try { w = JSON.parse(r.data); } catch { continue; }
    if (!w?.term || !w?.tr) continue;
    const { term, tr, pos = '', forms = '', ex = '', ex_tr: exTr = '', chk = 0 } = w;
    (((bank[native] ||= {})[topic] ||= [])).push({ term, tr, pos, forms, ex, ex_tr: exTr, level, chk: chk ? 1 : 0 });
  }
}
const sorted = Object.fromEntries(Object.keys(bank).sort().map((n) => [n, Object.fromEntries(Object.keys(bank[n]).sort().map((t) => [t, bank[n][t]]))]));
const file = fileURLToPath(new URL('../data/seo/bank.json', import.meta.url));
writeFileSync(file, JSON.stringify({ source: remote ? 'remote' : 'local', words: sorted }, null, 1) + '\n');
const n = Object.values(sorted).reduce((s, t) => s + Object.values(t).reduce((a, l) => a + l.length, 0), 0);
console.log(`bank.json: ${n} words from the ${remote ? 'production' : 'local'} database`);
