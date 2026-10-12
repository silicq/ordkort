# Content of the static Norwegian pages

`scripts/seo-pages.mjs` builds the pages under `public/<ui>/<learn>/` and `public/<ui>/ordbok/nb/` from these files.
Run `npm run seo` after changing any of them and commit the result.

| File | What it holds | Where it comes from |
|---|---|---|
| `nb-frequent.txt` | ~530 of the most frequent Bokmål words, with their word class | hand-made list, roughly in order of frequency |
| `dict/*.json` | one entry per word: translations (en, ru, uk), a plain Norwegian explanation, example sentences with translations, useful phrases, a note for learners in four languages | written for this site, forms and senses checked against Bokmålsordboka |
| `topics/*.json` | the 29 topics of `public/js/topics.js`: an introduction per interface language and ~22 words each, with translations and an example | written for this site |
| `ordbok-nb.json` | word class, gender, every form, definitions, examples, fixed expressions and compounds from Bokmålsordboka | `npm run seo:ordbok` (needs the network; answers are cached) |
| `bank.json` | the Norwegian part of the shared word bank (D1 table `words`), added to the topic lists after the hand-made words | `npm run seo:bank` reads the local `wrangler dev` database; `npm run seo:bank -- --remote` reads production |

Bokmålsordboka data: *Bokmålsordboka, Universitetet i Bergen og Språkrådet, ordbøkene.no, CC-BY 4.0* — every page that shows
it says so and links to the entry.

A page is published only when it has at least 150 words of its own (`MIN_WORDS`); the generator prints the pages it left
out. To add a word, add a line to `nb-frequent.txt` and an entry to `dict/`, run `npm run seo:ordbok`, then `npm run seo`.
