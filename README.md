# Ordkort — flashcards, dictionary and grammar for any language

**[ordkort.com](https://ordkort.com)** · free · no sign-up · no ads · no tracking

Ordkort is a lightweight site for learning almost any language from almost any other one:

- **Flashcards** by topic with spaced repetition — “I know / I don’t know” for new words,
  “I remember / I forgot” for reviews. Tap to flip, swipe, keyboard shortcuts, text-to-speech.
- **Topics**: 29 built-in topics in 6 groups (first steps, people, everyday life, the world around,
  work & society, grammar sets), any custom topic, or an empty deck for your own words.
  AI picks real, frequent words for levels A1–C1; “+20 words” keeps extending a deck without repeats.
- **Dictionary** in the spirit of [ordbokene.no](https://ordbokene.no) and
  [Lexin](https://lexin.oslomet.no): translation, inflection tables, meanings with examples,
  fixed expressions, compounds. For Norwegian, the official Bokmål/Nynorsk dictionary data is shown
  alongside and used as ground truth for the AI entry.
- **Grammar book**: 15 chapters by part of speech (nouns, adjectives, verbs, word order…) with tables,
  examples, typical mistakes and exercises, plus free-form grammar questions.
- **Translator with explanations**: every word colour-coded by part of speech, with its form and the rule
  that explains why it is used exactly there.
- **60 languages** to learn and explain in. The interface is hand-translated into English, Russian,
  Ukrainian, Norwegian, Arabic (RTL) and Chinese; other interface languages are translated once by AI
  and shared.

## Architecture

```
public/            the site: HTML, CSS, JS, fonts — served by Cloudflare as static assets
  _headers         security headers (CSP etc.)
src/               Cloudflare Worker — runs only for /api/*
  worker.js        routing and same-origin check
  api.js           AI requests: shared cache → word bank → limits → Groq
  prompts.js       all prompts and validation of AI output
  facts.js         verified Norwegian Bokmål grammar facts used to ground the AI
  groq.js          Groq client with model fallback
  limits.js        burst, hourly, daily and site-wide limits
  sync.js          device sync and one-time codes (the server only ever sees ciphertext)
  db.js            D1: the schema is created automatically on the first request
wrangler.jsonc     Cloudflare configuration
```

**User data** — cards, progress, settings — lives in the browser’s localStorage. Only AI requests
(a word, a topic or a text plus the language pair) reach the server. Answers are stored in a shared
base, so the next person gets them instantly and without using their limit.

**The Groq key** lives only in the Worker secret. The browser sends parameters, not prompts,
so the API can’t be used as someone else’s free chatbot.

**Limits** (change them in `wrangler.jsonc` → `vars` or in the Cloudflare dashboard):
`AI_PER_HOUR` = 40 and `AI_PER_DAY` = 120 per person, `AI_DAILY_BUDGET` = 2500 for the whole site.
A person is identified by a hash of the IP address with a salt that changes every day;
the IP itself is never stored.

**Sync without accounts.** A random 32-byte secret exists only on the user’s devices. It derives the
copy’s id, a write token and an AES-256-GCM key. The server stores ciphertext and a hash of the token.
Devices are linked with a one-time 16-character code (valid for 3 minutes, burnt on first read) or a QR
link whose key part sits after `#` and is never sent to the server. A one-time transfer without cloud
storage is also available. A 54-character **recovery key** restores the encrypted copy if the browser
data is wiped on every device.

Users can read all of this in plain words on the site’s “How it works” page (`#/about`).

## Keeping data safe

- Clearing the browser **cache** does not touch the cards; clearing **site data / cookies** does.
- Safari on iPhone and iPad deletes the data of sites not opened for 7 days — unless the site is
  added to the Home Screen. The site is installable (web app manifest) and explains this in Settings.
- The site asks the browser for persistent storage, so data isn’t evicted when disk space runs low.
- Insurance: sync with a saved recovery key, or a JSON backup file (Settings → Data).

## Run locally

```bash
npm install
```

Copy `.dev.vars.example` to `.dev.vars` and put your Groq key into it, then:

```bash
npm run dev
```

The site runs at http://localhost:8787 together with a local D1 database.

## Deploy to Cloudflare with automatic updates from GitHub

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → pick this
   repository. Leave the build command empty; the deploy command is `npx wrangler deploy`.
2. After the first deploy: Worker → **Settings** → **Variables and Secrets** → add the secret
   `GROQ_API_KEY` (and optionally `IP_SALT`, any long random string).
3. The D1 database `ordkort` is created automatically on the first deploy, its tables on the first request.

From then on every push to `main` is deployed automatically.

The same from a terminal:

```bash
npx wrangler login
```

```bash
npx wrangler secret put GROQ_API_KEY
```

```bash
npm run deploy
```

## Security

- All input is validated on the server (language whitelist, length limits); AI output is checked
  for shape and size before it enters the shared base.
- Cross-site requests are rejected (`Origin` check); the API accepts JSON only.
- Bursts are cut in memory, generations are counted in D1, plus a site-wide daily budget.
- The CSP forbids third-party scripts and framing; fonts are self-hosted. The only third-party
  request is the open ordbokene.no API for Norwegian.
- Worker request logs are off. Limit counters, link codes and abandoned sync copies are deleted
  by a daily scheduled task.
- Cloudflare’s network absorbs volumetric attacks. On a custom domain you can additionally enable
  a WAF rate-limiting rule for `/api/*` and Bot Fight Mode.

## Credits

Official Norwegian dictionary data: [ordbokene.no](https://ordbokene.no) (Språkrådet and the
University of Bergen). AI: [Groq](https://groq.com). Fonts: Geologica, Literata, Readex Pro,
Noto Naskh Arabic — SIL Open Font License 1.1.
