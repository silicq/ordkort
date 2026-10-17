/* Code shared with the site: languages, topics and chapters, English interface strings, the ordbokene parser.
   These files live in public/js and are loaded in the browser as plain scripts. */
import { HttpError } from './util.js';
import '../../public/js/langs.js';
import '../../public/js/topics.js';
import '../../public/js/i18n/en.js';
import '../../public/js/ordbok.js';

export const App = globalThis.App;

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const lang = (v) => (typeof v === 'string' && App.langs.has(v) ? v : null);
export { lang };
// the pair of languages a request is about: the one learnt (target) and the one the translations are in (native)
export function pairOf(b) {
  const target = lang(b.target), native = lang(b.native);
  if (!target || !native || target === native) throw new HttpError(400, 'bad_lang');
  return { target, native };
}
