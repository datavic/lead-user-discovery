import { Candidate, DiscoverResponse, ScoredCandidate, ThemeCluster } from "@/lib/types";
import { buildSearchQueries, classifyCandidates, preFilterCandidates } from "@/lib/scoring";
import { searchGithub } from "@/lib/sources/github";
import { getRedditAccessToken, searchReddit, searchRedditRss } from "@/lib/sources/reddit";
import { searchHackerNews } from "@/lib/sources/hackernews";
import { searchBluesky } from "@/lib/sources/bluesky";
import { SE_SITES, searchStackExchange } from "@/lib/sources/stackexchange";
import { findMarket } from "@/lib/markets";

const MAX_CANDIDATES_TO_CLASSIFY = Number(process.env.MAX_CANDIDATES_TO_CLASSIFY || 20);
const MAX_QUERIES = 6;
const PER_SOURCE_LIMIT = 10;
const RSS_QUERY_LIMIT = 2;

/**
 * The full pipeline: fan out across sources, drop noise, classify what is
 * left, then group by theme. Shared by the interactive search and the
 * scheduled sweep so both report identical results.
 */
export interface DiscoverOptions {
  /**
   * Cap on how many candidates reach the LLM. The nightly sweep can afford the
   * full budget; an interactive request cannot, because free-tier rate limits
   * make a full pass outlast the hosting timeout.
   */
  maxCandidates?: number;

  /**
   * Per-source deadline. Sources rate-limit and retry with backoff — Reddit's
   * RSS fallback alone can spend 30s per query — which is what made
   * interactive scans exceed the hosting timeout even with few candidates.
   * A source that misses the deadline is reported as unavailable rather than
   * holding up every other source.
   */
  sourceTimeoutMs?: number;

  /** Wall-clock budget for classification; leftover candidates are skipped. */
  classifyBudgetMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
}

export async function runDiscovery(
  topics: string[],
  options: DiscoverOptions = {}
): Promise<DiscoverResponse> {
  const maxCandidates = options.maxCandidates ?? MAX_CANDIDATES_TO_CLASSIFY;
  const sourceTimeoutMs = options.sourceTimeoutMs ?? 120_000;
  const queries = topics.flatMap((topic) => buildSearchQueries(topic)).slice(0, MAX_QUERIES);

  const sourceNotes: string[] = [];
  const allCandidates: Candidate[] = [];

  const [githubResults, redditResults, hnResults, blueskyResults, seResults] =
    await Promise.allSettled([
      withTimeout(fetchGithub(queries), sourceTimeoutMs, "GitHub"),
      withTimeout(fetchReddit(queries), sourceTimeoutMs, "Reddit"),
      // HN's Algolia index ANDs every term, so the quoted self-solution phrases
      // used for GitHub/Reddit match nothing there. Search the bare topics and
      // let the heuristic prefilter + LLM do the narrowing instead.
      withTimeout(fetchHackerNews(topics), sourceTimeoutMs, "Hacker News"),
      // Bluesky ANDs every term too, so a topic combined with a quoted
      // self-solution phrase matches nothing. Search the bare topics.
      withTimeout(fetchBluesky(topics, queries), sourceTimeoutMs, "Bluesky"),
      withTimeout(fetchStackExchange(topics), sourceTimeoutMs, "Stack Exchange"),
    ]);

  collectResults(githubResults, "GitHub", allCandidates, sourceNotes);
  collectResults(redditResults, "Reddit", allCandidates, sourceNotes);
  collectResults(hnResults, "Hacker News", allCandidates, sourceNotes);
  collectResults(blueskyResults, "Bluesky", allCandidates, sourceNotes);
  collectResults(seResults, "Stack Exchange", allCandidates, sourceNotes);

  if (allCandidates.length === 0) {
    return { candidates: [], themes: [], sourceNotes };
  }

  const topCandidates = preFilterCandidates(allCandidates, maxCandidates, topics);
  const classified = await classifyCandidates(topCandidates, options.classifyBudgetMs);

  const candidates: ScoredCandidate[] = classified
    .filter((entry) => entry.classification && entry.classification.isLeadUserSignal)
    .map((entry) => ({
      ...entry.candidate,
      ...(entry.classification as NonNullable<typeof entry.classification>),
    }))
    .sort(
      (a, b) =>
        b.solubilityScore + b.expectedBenefitScore - (a.solubilityScore + a.expectedBenefitScore)
    );

  const failedCount = classified.filter((entry) => entry.error).length;
  if (failedCount > 0) {
    sourceNotes.push(`${failedCount} candidate(s) failed LLM classification and were skipped.`);
  }

  const themeCounts = new Map<string, number>();
  for (const candidate of candidates) {
    themeCounts.set(candidate.theme, (themeCounts.get(candidate.theme) || 0) + 1);
  }

  const themes: ThemeCluster[] = Array.from(themeCounts.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);

  return { candidates, themes, sourceNotes };
}

async function fetchGithub(queries: string[]): Promise<Candidate[]> {
  const results = await Promise.all(queries.map((q) => searchGithub(q, PER_SOURCE_LIMIT)));
  return results.flat();
}

async function fetchReddit(queries: string[]): Promise<Candidate[]> {
  const token = await getRedditAccessToken();

  if (token) {
    const results = await Promise.all(queries.map((q) => searchReddit(q, token, PER_SOURCE_LIMIT)));
    return results.flat();
  }

  // No API app configured: fall back to the open RSS feed. It rate-limits
  // aggressively, so fetch sequentially and only run the strongest couple of
  // queries — a single one already yields ~20 posts.
  const results: Candidate[] = [];
  for (const query of queries.slice(0, RSS_QUERY_LIMIT)) {
    try {
      results.push(...(await searchRedditRss(query, PER_SOURCE_LIMIT)));
    } catch (err: any) {
      console.error(`[reddit-rss] "${query}" -> ${err?.message || "failed"}`);
    }
  }

  if (results.length === 0) {
    throw new Error("RSS fallback returned no results (Reddit may be rate-limiting)");
  }

  return results;
}

async function fetchHackerNews(topics: string[]): Promise<Candidate[]> {
  const searches = topics.flatMap((topic) => {
    const market = findMarket(topic);

    // Hacker News exposes no location for its users, so a market topic must be
    // searched in that market's language — the written language is the only
    // available signal that an author belongs to it. Searching the English
    // label instead matched anything containing the country's name, which
    // returned conference announcements and posts about other countries.
    if (market) {
      return market.phrases.slice(0, 4).map((phrase) => searchHackerNews(phrase, 20));
    }

    return [searchHackerNews(topic, 30)];
  });

  const results = await Promise.all(searches);
  return results.flat();
}

async function fetchBluesky(topics: string[], queries: string[]): Promise<Candidate[]> {
  const searches = topics.flatMap((topic) => {
    const market = findMarket(topic);

    // For a market, restrict by language and search its native phrasing: the
    // language filter alone reaches practitioners an English query never sees.
    if (market) {
      return [
        searchBluesky("ChatGPT", 25, market.lang),
        ...market.phrases.slice(0, 4).map((phrase) => searchBluesky(phrase, 25, market.lang)),
      ];
    }

    return [searchBluesky(topic, 25)];
  });

  const results = await Promise.all(searches);
  return results.flat();
}

async function fetchStackExchange(topics: string[]): Promise<Candidate[]> {
  // Skipped for market topics: these sites are English-language, so a native
  // query finds nothing and the English label would match posts from anywhere.
  const searchable = topics.filter((topic) => !findMarket(topic));

  // Anonymous quota is 300 requests/day and each site costs one, so search the
  // bare topics across the site list rather than every phrase variation.
  const pairs = searchable.flatMap((topic) => SE_SITES.map((site) => ({ topic, site })));
  const results = await Promise.all(
    pairs.map(({ topic, site }) => searchStackExchange(topic, site, PER_SOURCE_LIMIT))
  );
  return results.flat();
}

function collectResults(
  result: PromiseSettledResult<Candidate[]>,
  label: string,
  allCandidates: Candidate[],
  sourceNotes: string[]
) {
  if (result.status === "fulfilled") {
    allCandidates.push(...result.value);
  } else {
    sourceNotes.push(`${label} unavailable: ${result.reason?.message || "unknown error"}`);
  }
}
