// Before every deploy: the app's scripts joined into public/js/bundle.js (scripts/bundle.mjs), and the version of
// the site, a hash of everything in public/, written to public/js/build.js. None of these files is in git.
// Wrangler runs this before every `wrangler deploy` and `wrangler dev` ("build" in wrangler.jsonc), npm before the tests.
// The app compares its own version with the server's to notice a new deploy; the service worker names its cache after it.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const out = join(root, 'js', 'build.js');
const bundleFile = join(root, 'js', 'bundle.js');
const mapFile = bundleFile + '.map';

const b = await bundle();
writeFileSync(bundleFile, b.code);
if (b.map) writeFileSync(mapFile, b.map);

// the bundle is made from the scripts, which are hashed themselves
const derived = new Set([out, bundleFile, mapFile]);
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (!derived.has(p)) files.push(p);
  }
})(root);

const hash = createHash('sha256');
for (const f of files.sort()) hash.update(relative(root, f).replace(/\\/g, '/')).update('\0').update(readFileSync(f)).update('\0');
const id = hash.digest('hex').slice(0, 12);

writeFileSync(out, `/* The version of the site, written by scripts/build.mjs at every deploy. */\n(globalThis.App ||= {}).build = '${id}';\n`);
console.log(`build ${id} (${files.length} files), bundle ${Math.round(b.code.length / 1024)} KiB${b.minified ? ' minified' : ''}`);
