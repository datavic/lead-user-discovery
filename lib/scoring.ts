import { Candidate, Classification } from "@/lib/types";
import { chatJSON } from "@/lib/llm";

// Interleaved so the first MAX_QUERIES phrases (see app/api/discover/route.ts)
// always include a mix of AI-usage and generic self-solution signals, even
// for bare domain topics (e.g. "veterinary medicine") that don't mention AI.
export const SELF_SOLUTION_PHRASES = [
  "I use ChatGPT to",
  "I built my own",
  "I've been using ChatGPT to",
  "workaround for",
  "ChatGPT helped me",
  "hacked together a",
  "I built a custom GPT for",
  "so I made",
  "I use Codex to",
  "I ended up building",
  "asked ChatGPT to help me",
  "I created a tool to",
  "I taught ChatGPT to",
  "I automated",
  "I wrote a script to",
  "custom solution for",
];

export function buildSearchQueries(topic: string): string[] {
  return SELF_SOLUTION_PHRASES.map((phrase) => `${topic} "${phrase}"`);
}

/**
 * Keyed on URL and on author+title, because crossposts and multi-query hits
 * surface the same post under different URLs.
 */
function dedupeByUrl(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const result: Candidate[] = [];

  for (const candidate of candidates) {
    const titleKey = `${candidate.author}::${candidate.title.toLowerCase().replace(/\W+/g, " ").trim()}`;
    if (seen.has(candidate.url) || seen.has(titleKey)) continue;

    seen.add(candidate.url);
    seen.add(titleKey);
    result.push(candidate);
  }

  return result;
}

// Automated digests keyword-match well but have no human behind them, which
// made them dominate results before this filter existed.
const BOT_TITLE_PATTERNS = [
  /new submissions for/i,
  /daily (content )?summary/i,
  /weekly (digest|summary|update)/i,
  /^\s*\[?(cs|stat|eess|math)[.\-\]]/i,
  /【.*?】/,
  /arxiv/i,
  /release notes/i,
  /dependency (update|bump)/i,
];

const BOT_AUTHOR_PATTERNS = [/\[bot\]$/i, /-bot$/i, /^bot-/i, /dependabot/i, /automoderator/i];

// A real lead user narrates their own work. Digests and marketing copy do not.
const FIRST_PERSON_MARKERS = [/\bi\s/i, /\bmy\b/i, /\bi'?ve\b/i, /\bwe\s/i, /\bour\b/i];

function looksAutomated(candidate: Candidate): boolean {
  return (
    BOT_TITLE_PATTERNS.some((re) => re.test(candidate.title)) ||
    BOT_AUTHOR_PATTERNS.some((re) => re.test(candidate.author))
  );
}

function heuristicScore(candidate: Candidate): number {
  const text = `${candidate.title} ${candidate.snippet}`.toLowerCase();
  let score = 0;

  // The phrase must actually appear in the retrieved text. Previously any
  // result matched simply because the phrase was in the *query*.
  for (const phrase of SELF_SOLUTION_PHRASES) {
    if (text.includes(phrase.toLowerCase())) score += 3;
  }

  for (const marker of FIRST_PERSON_MARKERS) {
    if (marker.test(text)) score += 1;
  }

  // Enough substance to judge, but length itself is no longer a reward —
  // that is what promoted the bot digests.
  if (candidate.snippet.length < 80) score -= 2;

  return score;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "using", "use", "used", "how", "who", "what",
  "their", "them", "from", "that", "this", "are", "was", "has", "have", "its",
  "advanced", "users", "user", "people", "own",
]);

/** Significant words from the topic, used to verify a result is on-topic. */
function topicKeywords(topics: string[]): string[] {
  const words = topics
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  return Array.from(new Set(words));
}

/**
 * Deduplicates and ranks raw candidates with a cheap heuristic so we only
 * spend LLM calls on the most promising results. Automated posts are dropped
 * outright rather than ranked, since no score threshold reliably excludes them.
 *
 * Results must also mention the topic: some sources (notably Stack Exchange)
 * match loosely and otherwise return entirely unrelated questions.
 */
export function preFilterCandidates(
  candidates: Candidate[],
  maxCount: number,
  topics: string[] = []
): Candidate[] {
  const keywords = topicKeywords(topics);

  const onTopic = (candidate: Candidate): boolean => {
    if (keywords.length === 0) return true;
    const text = `${candidate.title} ${candidate.snippet}`.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  };

  return dedupeByUrl(candidates)
    .filter((candidate) => !looksAutomated(candidate) && onTopic(candidate))
    .map((candidate) => ({ candidate, score: heuristicScore(candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map((entry) => entry.candidate);
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are an analyst applying Eric von Hippel's Lead User Theory to source \
"mavens": domain experts (in any field — farming, science, medicine, sports, trades, small business, etc.) \
who use ChatGPT, Codex, or other AI tools in sophisticated, creative, or high-impact ways within their own \
work, well ahead of how the mainstream uses these tools. This mirrors work done by teams that find advanced \
AI users and turn their workflows into product insight and stories. Given a forum/code post, decide whether \
the author shows a genuine lead-user signal: a real professional or personal need PLUS concrete evidence they \
actively used or built with AI to address it themselves — a specific workflow, not a vague mention, marketing \
copy, tutorial, or trivial one-off prompt (e.g. "I asked ChatGPT to write an email" does not count). \
Respond ONLY with a JSON object matching this shape: \
{"isLeadUserSignal": boolean, "problem": string, "selfBuiltSolution": string, \
"solubilityScore": number (0-100, how concretely they solved it themselves), \
"expectedBenefitScore": number (0-100, how much they stand to gain / how far ahead of the mainstream need this is), \
"theme": string (a short 2-4 word category for this need), "reasoning": string (one sentence)}.`;

export async function classifyCandidate(
  candidate: Candidate,
  expiryMs?: number
): Promise<Classification> {
  const userPrompt = `Source: ${candidate.source}\nTitle: ${candidate.title}\nText: ${candidate.snippet}`;

  return chatJSON<Classification>(
    [
      { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    expiryMs
  );
}

// Groq's free tier allows ~6k tokens/minute and each classification costs
// ~600, so a wide fan-out just burns the budget on retries. Keep this low and
// let chatJSON's backoff absorb the rest.
const CONCURRENCY_LIMIT = 2;

export async function classifyCandidates(
  candidates: Candidate[],
  /**
   * Wall-clock budget for the whole batch. When the provider starts rate
   * limiting, each retry backs off and the batch can outlast an interactive
   * request's timeout — returning partial results beats returning a 504, so
   * remaining candidates are abandoned rather than the request failing.
   */
  deadlineMs?: number
): Promise<{ candidate: Candidate; classification: Classification | null; error?: string }[]> {
  const results: { candidate: Candidate; classification: Classification | null; error?: string }[] =
    new Array(candidates.length);

  const expiry = deadlineMs ? Date.now() + deadlineMs : Infinity;

  let index = 0;
  let abandoned = 0;

  async function worker() {
    while (index < candidates.length) {
      const current = index++;
      const candidate = candidates[current];

      if (Date.now() >= expiry) {
        abandoned++;
        results[current] = { candidate, classification: null, error: "skipped: time budget reached" };
        continue;
      }

      try {
        const classification = await classifyCandidate(candidate, isFinite(expiry) ? expiry : undefined);
        results[current] = { candidate, classification };
      } catch (err: any) {
        const message = err?.message || "classification failed";
        console.error(`[classify] ${candidate.source} ${candidate.url} -> ${message}`);
        results[current] = { candidate, classification: null, error: message };
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, candidates.length) }, () => worker());
  await Promise.all(workers);

  if (abandoned > 0) {
    console.warn(`[classify] abandoned ${abandoned} candidate(s) after the time budget`);
  }

  return results;
}
