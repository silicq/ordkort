// The app's scripts as one file: public/js/bundle.js (not in git), written by scripts/build.mjs before every deploy,
// `wrangler dev` and the tests. The page loads it instead of thirty separate files, so the first screen no longer
// waits for a chain of requests. The scripts stay plain files in public/js/ and keep their order here: each
// one only adds to window.App inside its own function, so joined together they behave exactly as before.
// esbuild (which wrangler already brings) minifies the result; without it the files are simply joined.
import { readFileSync } from 'node:fs';

export const APP_SCRIPTS = [
  'js/config.js',
  'js/langs.js',
  'js/i18n/en.js',
  'js/i18n/ru.js',
  'js/i18n/uk.js',
  'js/i18n/nb.js',
  'js/i18n/ar.js',
  'js/i18n/zh.js',
  'js/i18n.js',
  'js/topics.js',
  'js/idb.js',
  'js/media.js',
  'js/fsrs.js',
  'js/store.js',
  'js/ai.js',
  'js/ordbok.js',
  'js/ui.js',
  'js/qr.js',
  'js/sync.js',
  'js/apkg.js',
  'js/anki.js', // after ui.js: it takes h, icon and t from it when it loads
  'js/look.js',
  'js/views/home.js',
  'js/views/deck.js',
  'js/views/study.js',
  'js/views/dict.js',
  'js/views/grammar.js',
  'js/views/translate.js',
  'js/views/settings.js',
  'js/views/onboarding.js',
  'js/views/devices.js',
  'js/views/about.js',
  'js/views/read.js',
  'js/views/share.js',
  'js/views/library.js',
  'js/views/stats.js',
  'js/views/insights.js',
  'js/app.js',
];

const PUBLIC = new URL('../public/', import.meta.url);

// the joined source: each file under a /*! name */ line (kept by the minifier, so an error is easy to place)
export function joined() {
  return APP_SCRIPTS.map((f) => `/*! ${f} */\n${readFileSync(new URL(f, PUBLIC), 'utf8').trimEnd()}\n`).join(';\n');
}

export async function bundle() {
  const src = joined();
  let esbuild = null;
  try { esbuild = await import('esbuild'); } catch { /* not installed: ship the joined files as they are */ }
  if (!esbuild) return { code: src, map: null, minified: false };
  const r = await esbuild.transform(src, {
    loader: 'js', minify: true, target: 'es2022', charset: 'utf8', legalComments: 'inline',
    sourcemap: 'external', sourcefile: 'bundle-src.js', sourcesContent: true,
  });
  return { code: r.code + '//# sourceMappingURL=bundle.js.map\n', map: r.map, minified: true };
}
