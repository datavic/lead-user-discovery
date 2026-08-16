# Lead User Discovery

A small tool that automates the first step of Eric von Hippel's Lead User
methodology: scanning public communities for people who describe a need and
have already built their own fix for it, then using an LLM to separate real
lead-user signals from casual complaints.

It searches GitHub, Reddit, and Hacker News for problem/self-solution
phrasing ("I built my own...", "workaround for...", "hacked together a...",
etc.), classifies each hit with an LLM (solubility, expected benefit, theme),
clusters results by theme, and can suggest analogous markets to search next.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

- At least one LLM key: `GROQ_API_KEY` (free tier) or `OPENAI_API_KEY`.
- Optional but recommended: `GITHUB_TOKEN`, `REDDIT_CLIENT_ID` +
  `REDDIT_CLIENT_SECRET`. Hacker News needs no key and works out of the box.

```bash
npm run dev
```

Open http://localhost:3000, enter a topic (e.g. "advanced OpenAI users"),
and run a search.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub.
2. In Cloudflare Pages, create a project connected to the repo.
3. Build command: `npx @cloudflare/next-on-pages`
4. Build output directory: `.vercel/output/static`
5. Add the same environment variables from `.env.local` in the Pages project
   settings.

API routes run on the Edge runtime, so they only use `fetch`-based calls
(no Node-specific APIs), which keeps them compatible with Cloudflare's
Workers runtime.

## How it works

1. `lib/scoring.ts` builds search queries by combining the topic with a set
   of problem→self-solution phrases.
2. `lib/sources/*` fetch candidates from GitHub, Reddit, and Hacker News in
   parallel; any source without credentials is skipped gracefully.
3. Candidates are deduped and heuristically pre-ranked, then the top N are
   sent to the LLM (`lib/llm.ts`, Groq or OpenAI) for classification.
4. Results that the LLM confirms as genuine lead-user signals are scored,
   sorted, and grouped by theme in `app/api/discover/route.ts`.
5. `app/api/analogous/route.ts` asks the LLM for adjacent markets facing the
   same underlying bottleneck, which can be folded into the search.
