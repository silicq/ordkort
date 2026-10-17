# Contributing to Ordkort

Thank you for wanting to help. Ordkort is a small project, so every translation, word fix and bug report
makes a visible difference.

## Without writing code

- **A wrong word, article, form or translation**: press “Report a mistake” on the card or dictionary entry.
  After independent reports the entry is regenerated for everyone. If something is wrong again and again,
  [open an issue](https://github.com/silicq/ordkort/issues/new?template=wrong-word.yml).
- **Something broken or confusing**: [open a bug report](https://github.com/silicq/ordkort/issues/new?template=bug.yml)
  with the browser, the device and what you did.
- **Ideas and questions**: [Discussions](https://github.com/silicq/ordkort/discussions).

## Translate the interface

The interface is translated by hand into English, Russian, Ukrainian, Norwegian, Arabic and Chinese. Every other
language gets a one-time AI translation, which is usable but not great. A hand translation replaces it for
everyone who speaks that language.

1. Find your language's code in [`public/js/langs.js`](public/js/langs.js) (for example `de`, `pl`, `es`).
2. Copy [`public/js/i18n/en.js`](public/js/i18n/en.js) to `public/js/i18n/<code>.js` and change
   `App.i18nData.en` on line 2 to `App.i18nData.<code>`.
3. Translate the values, not the keys. Keep `{placeholders}` as they are. Plural strings come as
   `key_one` / `key_other`; add `key_few`, `key_many` and so on if your language has those forms
   ([CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)).
4. Register the file in two places: `'js/i18n/<code>.js'` in the list at the top of `scripts/bundle.mjs`, next
   to the others, and the code in `BUILT_IN` in `tests/site.test.mjs`.
5. Run `npm test`. It checks that no string is missing and that the placeholders match English.

Not comfortable with git? Open a [translation issue](https://github.com/silicq/ordkort/issues/new?template=translation.yml)
and attach the translated file; it will be added for you.

## Code

```bash
npm install
cp .dev.vars.example .dev.vars   # put a Groq API key in it (free at console.groq.com)
npm run dev                      # http://localhost:8787
npm test
```

The site is plain HTML, CSS and JavaScript with no build step and no framework: `public/` is served as it is,
and `src/` is the Cloudflare Worker behind `/api/*`. The [README](README.md#architecture) explains where
everything lives.

- Keep it dependency-free in the browser. The CSP allows no third-party scripts.
- User data stays in the browser. Nothing new that identifies a person may reach the server.
- Every visible string goes through `t('key')` and exists in all six hand-made translations
  (`npm test` checks it). If you cannot translate one, ask in the pull request.
- Add or update a test in `tests/` when you change behaviour.

## Pull requests

- For anything bigger than a fix, open an issue first, so we agree on the approach before you spend time on it.
- Open the pull request against `main`. It is merged by the maintainer after review, once the tests pass.
- Tests run on GitHub Actions without any secrets. A first pull request from a fork waits for the maintainer to
  start them; preview deployments are made only for branches of this repository, never for forks.
- Keep a pull request to one change; it is easier to review and to undo.

By contributing you agree that your work is published under the [AGPL-3.0](LICENSE), like the rest of the project.
