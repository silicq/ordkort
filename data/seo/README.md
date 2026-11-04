# Content of the static Norwegian pages

`scripts/seo-pages.mjs` builds the pages under `public/<ui>/<learn>/` and `public/<ui>/ordbok/nb/` from these files.
Run `npm run seo` after changing any of them and commit the result.

| File | What it holds | Where it comes from |
|---|---|---|
| `nb-frequent.txt` | ~530 of the most frequent Bokmål words, with their word class | hand-made list, roughly in order of frequency |
| `dict/*.json` | one entry per word: translations (en, ru, uk), a plain Norwegian explanation, example sentences with translations, useful phrases, a note for learners in four languages | written for this site, forms and senses checked against Bokmålsordboka |
| `topics/*.json` | the 29 topics of `public/js/topics.js`: an introduction per interface language and ~22 words each, with translations and an example | written for this site; only these checked words are published (the AI words of the shared bank are not) |
| `ordbok-nb.json` | word class, gender, every form, definitions, examples, fixed expressions and compounds from Bokmålsordboka | `npm run seo:ordbok` (needs the network; answers are cached) |
| `homographs.json` | which Bokmålsordboka article a word means when several are spelt alike (`"hete verb": [23468]`, to be called, not to heat); with two ids the page shows the senses of both, and of the forms only those they share | chosen by hand; a test fails while a word has several articles and no choice here |
| `dates.json` | for every generated page: a hash of its text and the date that text last changed, shown on the page, in its schema and in the sitemap | written by `npm run seo`: a page whose text changed gets the day's date (Norwegian time, or `SEO_TODAY=2026-11-04`), the others keep theirs; markup alone is no change |
| `checked.json` | the date the pages about the site (`/en/`, `/ru/`… and the app's page) last changed, for the sitemap | by hand, when their text changes |

Bokmålsordboka data: *Bokmålsordboka, Universitetet i Bergen og Språkrådet, ordbøkene.no, CC-BY 4.0* — every page that shows
it says so and links to the entry.

A page is published only when it has at least 150 words of its own (`MIN_WORDS`); the generator prints the pages it left
out. To add a word, add a line to `nb-frequent.txt` and an entry to `dict/`, run `npm run seo:ordbok`, then `npm run seo`.

The button on every page opens the app with the page's language pair: `/#/dict/hus?from=ru&learn=nb` on a word,
`/#/?from=ru&learn=nb&topic=food` on a topic. A first-time visitor starts the setup with those languages (and that
topic) already chosen and lands on the word afterwards (`public/js/views/onboarding.js`); for someone who already
uses the app the parameters change nothing.
