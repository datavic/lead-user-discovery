/**
 * Nightly sweep, run by .github/workflows/sweep.yml.
 *
 * Runs the same pipeline the web app uses, but in a GitHub Action where there
 * is no request timeout — so the free-tier LLM rate limits stop mattering.
 * Every preset topic is swept, and the results are committed so the site can
 * switch between topics instantly instead of making visitors wait a minute.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runDiscovery } from "../lib/discover";
import { PRESET_TOPICS } from "../lib/topics";
import { ScoredCandidate, ThemeCluster } from "../lib/types";

const DATA_DIR = join(process.cwd(), "data");
const LATEST = join(DATA_DIR, "latest.json");

type SweptCandidate = ScoredCandidate & {
  topic: string;
  firstSeenAt: string;
  isNew: boolean;
};

interface SweepFile {
  ranAt: string;
  topics: string[];
  candidates: SweptCandidate[];
  themesByTopic: Record<string, ThemeCluster[]>;
  notesByTopic: Record<string, string[]>;
}

async function main() {
  const topics = (process.env.SWEEP_TOPICS || PRESET_TOPICS.join("|"))
    .split("|")
    .map((topic) => topic.trim())
    .filter(Boolean);

  const ranAt = new Date().toISOString();

  // URLs seen in any previous sweep, so today's run can flag newcomers.
  const seenBefore = new Map<string, string>();
  if (existsSync(LATEST)) {
    try {
      const previous: SweepFile = JSON.parse(readFileSync(LATEST, "utf8"));
      for (const candidate of previous.candidates || []) {
        seenBefore.set(candidate.url, candidate.firstSeenAt);
      }
    } catch {
      console.warn("[sweep] could not read previous latest.json; treating all as new");
    }
  }

  const candidates: SweptCandidate[] = [];
  const themesByTopic: Record<string, ThemeCluster[]> = {};
  const notesByTopic: Record<string, string[]> = {};

  for (const topic of topics) {
    console.log(`\n[sweep] === ${topic} ===`);
    try {
      const result = await runDiscovery([topic]);

      for (const candidate of result.candidates) {
        const firstSeenAt = seenBefore.get(candidate.url) || ranAt;
        candidates.push({ ...candidate, topic, firstSeenAt, isNew: firstSeenAt === ranAt });
      }

      themesByTopic[topic] = result.themes;
      notesByTopic[topic] = result.sourceNotes;
      console.log(`[sweep] ${topic}: ${result.candidates.length} signals`);
    } catch (err: any) {
      console.error(`[sweep] "${topic}" failed: ${err?.message}`);
      themesByTopic[topic] = [];
      notesByTopic[topic] = [`Sweep failed — ${err?.message || "unknown error"}`];
    }
  }

  candidates.sort(
    (a, b) =>
      b.solubilityScore + b.expectedBenefitScore - (a.solubilityScore + a.expectedBenefitScore)
  );

  const output: SweepFile = { ranAt, topics, candidates, themesByTopic, notesByTopic };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(LATEST, JSON.stringify(output, null, 2) + "\n");
  writeFileSync(join(DATA_DIR, `${ranAt.slice(0, 10)}.json`), JSON.stringify(output, null, 2) + "\n");

  const newCount = candidates.filter((c) => c.isNew).length;
  console.log(`\n[sweep] total ${candidates.length} signals (${newCount} new) across ${topics.length} topics`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
