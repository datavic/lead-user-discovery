import { ScoredCandidate } from "@/lib/types";

/**
 * Minimal shape of the D1 binding we rely on, so the app type-checks without
 * pulling in @cloudflare/workers-types.
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
}

export interface StoredFinding extends ScoredCandidate {
  firstSeenAt: string;
  isNew: boolean;
}

/**
 * Persists one sweep and its findings, returning which URLs had never been
 * seen before — that delta is the point of running daily, since re-reporting
 * the same people every morning is noise.
 */
export async function recordSweep(
  db: D1Database,
  topic: string,
  candidates: ScoredCandidate[],
  notes: string[]
): Promise<{ sweepId: number; newUrls: string[] }> {
  const now = new Date().toISOString();

  const sweep = await db
    .prepare("INSERT INTO sweeps (topic, started_at, notes) VALUES (?, ?, ?) RETURNING id")
    .bind(topic, now, notes.join("\n"))
    .first<{ id: number }>();

  if (!sweep) throw new Error("Failed to create sweep row");

  const newUrls: string[] = [];

  for (const candidate of candidates) {
    const seen = await db
      .prepare("SELECT 1 AS hit FROM findings WHERE url = ? LIMIT 1")
      .bind(candidate.url)
      .first<{ hit: number }>();

    if (!seen) newUrls.push(candidate.url);

    await db
      .prepare(
        `INSERT OR IGNORE INTO findings (
           sweep_id, url, source, author, title, problem, self_built_solution,
           solubility_score, expected_benefit_score, theme, reasoning, posted_at, first_seen_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        sweep.id,
        candidate.url,
        candidate.source,
        candidate.author,
        candidate.title,
        candidate.problem,
        candidate.selfBuiltSolution,
        candidate.solubilityScore,
        candidate.expectedBenefitScore,
        candidate.theme,
        candidate.reasoning,
        candidate.date,
        now
      )
      .run();
  }

  return { sweepId: sweep.id, newUrls };
}

/** Most recent stored findings for a topic, newest sweep first. */
export async function latestFindings(
  db: D1Database,
  topic: string,
  limit = 50
): Promise<StoredFinding[]> {
  const { results } = await db
    .prepare(
      `SELECT f.*, s.started_at AS sweep_started
         FROM findings f
         JOIN sweeps s ON s.id = f.sweep_id
        WHERE s.topic = ?
        ORDER BY s.started_at DESC,
                 (f.solubility_score + f.expected_benefit_score) DESC
        LIMIT ?`
    )
    .bind(topic, limit)
    .all<any>();

  return (results || []).map((row) => ({
    source: row.source,
    url: row.url,
    author: row.author,
    title: row.title,
    snippet: "",
    date: row.posted_at,
    isLeadUserSignal: true,
    problem: row.problem,
    selfBuiltSolution: row.self_built_solution,
    solubilityScore: row.solubility_score,
    expectedBenefitScore: row.expected_benefit_score,
    theme: row.theme,
    reasoning: row.reasoning,
    firstSeenAt: row.first_seen_at,
    isNew: row.first_seen_at === row.sweep_started,
  }));
}
