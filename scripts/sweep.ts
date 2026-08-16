/**
 * Nightly sweep, run by .github/workflows/sweep.yml.
 *
 * Runs the same pipeline the web app uses, but in a GitHub Action where there
 * is no request timeout — so the free-tier LLM rate limits stop mattering.
 * Results are written to data/ and committed, which both keeps a history and
 * lets the site render instantly instead of making visitors wait a minute.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runDiscovery } from "../lib/discover";
import { ScoredCandidate } from "../lib/types";

const DATA_DIR = join(process.cwd(), "data");
const LATEST = join(DATA_DIR, "latest.json");

interface SweepFile {
  ranAt: string;
  topics: string[];
  candidates: (ScoredCandidate & { firstSeenAt: string; isNew: boolean })[];
  themes: { theme: string; count: number }[];
  notes: string[];
}

async function main() {
  const topics = (process.env.SWEEP_TOPICS || "Advanced OpenAI / ChatGPT users")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const ranAt = new Date().toISOString();

  // URLs seen in any previous sweep, so today's run can flag newcomers.
  const seenBefore = new Map<string, string>();
  if (existsSync(LATEST)) {
    try {
      const previous: SweepFile = JSON.parse(readFileSync(LATEST, "utf8"));
      for (const candidate of previous.candidates) {
        seenBefore.set(candidate.url, candidate.firstSeenAt);
      }
    } catch {
      console.warn("[sweep] could not read previous latest.json; treating all as new");
    }
  }

  const allCandidates: SweepFile["candidates"] = [];
  const allNotes: string[] = [];

  for (const topic of topics) {
    console.log(`[sweep] ${topic}`);
    try {
      const { candidates, sourceNotes } = await runDiscovery([topic]);
      for (const candidate of candidates) {
        const firstSeenAt = seenBefore.get(candidate.url) || ranAt;
        allCandidates.push({ ...candidate, firstSeenAt, isNew: firstSeenAt === ranAt });
      }
      allNotes.push(...sourceNotes.map((note) => `${topic}: ${note}`));
    } catch (err: any) {
      console.error(`[sweep] "${topic}" failed: ${err?.message}`);
      allNotes.push(`${topic}: sweep failed — ${err?.message || "unknown error"}`);
    }
  }

  allCandidates.sort(
    (a, b) =>
      b.solubilityScore + b.expectedBenefitScore - (a.solubilityScore + a.expectedBenefitScore)
  );

  const themeCounts = new Map<string, number>();
  for (const candidate of allCandidates) {
    themeCounts.set(candidate.theme, (themeCounts.get(candidate.theme) || 0) + 1);
  }

  const output: SweepFile = {
    ranAt,
    topics,
    candidates: allCandidates,
    themes: Array.from(themeCounts.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count),
    notes: allNotes,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(LATEST, JSON.stringify(output, null, 2) + "\n");
  writeFileSync(join(DATA_DIR, `${ranAt.slice(0, 10)}.json`), JSON.stringify(output, null, 2) + "\n");

  const newCount = allCandidates.filter((c) => c.isNew).length;
  console.log(`[sweep] ${allCandidates.length} findings (${newCount} new) across ${topics.length} topic(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
