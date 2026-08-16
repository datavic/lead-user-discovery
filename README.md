# Lead User Discovery

Automates the sourcing step of Eric von Hippel's Lead User methodology (MIT,
1986). Lead users face needs months or years ahead of the mainstream and expect
high benefit from a solution, so they build their own fix rather than wait for
one. Those self-built fixes leave a public trail — this tool finds it.

It scans public communities for problem-and-self-solution phrasing ("I built my
own...", "I use ChatGPT to...", "workaround for..."), discards automated noise,
then uses an LLM to separate genuine lead-user signals from casual complaints,
scoring each on solubility and expected benefit and clustering them by theme.

## Sources

| Source | Reaches | Auth |
| --- | --- | --- |
| Reddit | Non-technical practitioners — the broadest source | None (public Atom feed) |
| Hacker News | Founders, engineers, technical professionals | None |
| GitHub | Developers building their own tooling | Optional token (raises rate limit) |
| Bluesky | Scientists, academics, journalists | None |
| Stack Exchange | Domain experts on non-programming sites | None (300 req/day) |

Twitter/X, LinkedIn and YouTube comments are not wired in. X search requires a
paid API tier and LinkedIn has no content-search API — scraping either violates
their terms, so neither is included. YouTube is viable but needs quota planning.

Every source is queried live. Nothing is bought, scraped from behind a login,
or taken from private data — these are public posts their authors chose to
publish.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

- At least one LLM key: `GROQ_API_KEY` (free tier) or `OPENAI_API_KEY`.
- Optional: `GITHUB_TOKEN` raises GitHub's rate limit (unauthenticated search
  allows only ~10 requests/minute). Reddit, Hacker News, Bluesky and Stack
  Exchange need no credentials.

```bash
npm run dev
```

Open http://localhost:3000, enter a topic, and run a search. `/about` documents
where each result came from.

> A search takes roughly a minute. Groq's free tier allows 6,000 tokens per
> minute and every candidate needs a classification call, so the pipeline
> deliberately trickles requests rather than failing half of them.

## How it works

1. `lib/scoring.ts` builds queries by combining the topic with self-solution
   phrases, and pre-filters results: automated digests and bot accounts match
   keywords well but have no person behind them, so they are dropped before any
   model sees them. Ranking rewards first-person narration and phrases that
   actually appear in the retrieved text.
2. `lib/sources/*` fetch candidates in parallel; any source without credentials
   is skipped gracefully. Each has its own query dialect — Hacker News ANDs
   every term so it is searched by bare topic, while Reddit honours quoted
   phrases.
3. `lib/discover.ts` runs the shared pipeline: fan out, de-duplicate (by URL and
   by author+title, since crossposts surface the same post twice), classify,
   then cluster by theme.
4. `lib/llm.ts` calls any OpenAI-compatible endpoint (Groq or OpenAI) and backs
   off on rate limits using the retry hint in the error body.

## Scheduled sweeps (optional)

A daily sweep stores results in Cloudflare D1 and tracks `first_seen_at` per
URL, so it reports who is *newly* appearing rather than repeating the same
people every morning.

Cloudflare Pages cannot run cron triggers, so the schedule lives in a small
companion Worker (`worker/`) that calls the app's `/api/sweep` endpoint.

```bash
npx wrangler d1 create lead-user-db          # paste the id into wrangler.toml
npx wrangler d1 execute lead-user-db --remote --file=./schema.sql

cd worker
npx wrangler deploy
npx wrangler secret put SWEEP_SECRET          # must match the Pages variable
```

Set `SWEEP_SECRET` and `SWEEP_TOPICS` in the Pages project settings too. The
sweep endpoint writes to the database and spends API quota, so it rejects any
request without the shared secret.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub.
2. In Cloudflare Pages, create a project connected to the repo.
3. Build command: `npx @cloudflare/next-on-pages`
4. Build output directory: `.vercel/output/static`
5. Add the environment variables from `.env.local` in the Pages project
   settings, and bind the D1 database as `DB`.

API routes run on the Edge runtime and use only `fetch`-based calls, which keeps
them compatible with the Workers runtime.

## Limits worth knowing

- Coverage skews toward English-language, public, text-based communities.
  Practitioners who share their work in videos, group chats, or other languages
  are systematically under-counted.
- The tool surfaces candidates for a human to judge. It does not replace talking
  to them, which is where the actual insight comes from.
