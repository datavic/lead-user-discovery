import { Candidate, DiscoverResponse, ScoredCandidate, ThemeCluster } from "@/lib/types";
import { buildSearchQueries, classifyCandidates, preFilterCandidates } from "@/lib/scoring";
import { searchGithub } from "@/lib/sources/github";
import { getRedditAccessToken, searchReddit, searchRedditRss } from "@/lib/sources/reddit";
import { searchHackerNews } from "@/lib/sources/hackernews";
import { searchBluesky } from "@/lib/sources/bluesky";
import { SE_SITES, searchStackExchange } from "@/lib/sources/stackexchange";

const MAX_CANDIDATES_TO_CLASSIFY = Number(process.env.MAX_CANDIDATES_TO_CLASSIFY || 20);
const MAX_QUERIES = 6;
const PER_SOURCE_LIMIT = 10;
const RSS_QUERY_LIMIT = 2;

/**
 * The full pipeline: fan out across sources, drop noise, classify what is
 * left, then group by theme. Shared by the interactive search and the
 * scheduled sweep so both report identical results.
 */
export async function runDiscovery(topics: string[]): Promise<DiscoverResponse> {
  const queries = topics.flatMap((topic) => buildSearchQueries(topic)).slice(0, MAX_QUERIES);

  const sourceNotes: string[] = [];
  const allCandidates: Candidate[] = [];

  const [githubResults, redditResults, hnResults, blueskyResults, seResults] =
    await Promise.allSettled([
      fetchGithub(queries),
      fetchReddit(queries),
      // HN's Algolia index ANDs every term, so the quoted self-solution phrases
      // used for GitHub/Reddit match nothing there. Search the bare topics and
      // let the heuristic prefilter + LLM do the narrowing instead.
      fetchHackerNews(topics),
      fetchBluesky(queries),
      fetchStackExchange(topics),
    ]);

  collectResults(githubResults, "GitHub", allCandidates, sourceNotes);
  collectResults(redditResults, "Reddit", allCandidates, sourceNotes);
  collectResults(hnResults, "Hacker News", allCandidates, sourceNotes);
  collectResults(blueskyResults, "Bluesky", allCandidates, sourceNotes);
  collectResults(seResults, "Stack Exchange", allCandidates, sourceNotes);

  if (allCandidates.length === 0) {
    return { candidates: [], themes: [], sourceNotes };
  }

  const topCandidates = preFilterCandidates(allCandidates, MAX_CANDIDATES_TO_CLASSIFY, topics);
  const classified = await classifyCandidates(topCandidates);

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
  const results = await Promise.all(topics.map((t) => searchHackerNews(t, 30)));
  return results.flat();
}

async function fetchBluesky(queries: string[]): Promise<Candidate[]> {
  const results = await Promise.all(queries.map((q) => searchBluesky(q, PER_SOURCE_LIMIT)));
  return results.flat();
}

async function fetchStackExchange(topics: string[]): Promise<Candidate[]> {
  // Anonymous quota is 300 requests/day and each site costs one, so search the
  // bare topics across the site list rather than every phrase variation.
  const pairs = topics.flatMap((topic) => SE_SITES.map((site) => ({ topic, site })));
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
