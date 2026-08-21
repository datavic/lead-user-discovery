"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import latestSweep from "@/data/latest.json";
import SearchForm from "@/components/SearchForm";
import ThemeClusters from "@/components/ThemeClusters";
import ResultsTable from "@/components/ResultsTable";
import SignalHighlights from "@/components/SignalHighlights";
import { DiscoverResponse, ScoredCandidate, ThemeCluster } from "@/lib/types";

type SweptCandidate = ScoredCandidate & { topic: string; isNew?: boolean };

// Results from the nightly sweep (.github/workflows/sweep.yml), committed to
// the repo. Rendering these means a visitor sees real findings immediately
// rather than waiting out a rate-limited live scan.
const SWEEP = latestSweep as unknown as {
  ranAt: string;
  topics: string[];
  candidates: SweptCandidate[];
  themesByTopic: Record<string, ThemeCluster[]>;
  notesByTopic: Record<string, string[]>;
};

const SWEPT_TOPICS = SWEEP.topics ?? [];

/**
 * Open on whichever topic the last sweep found most for. Defaulting to the
 * first topic meant a visitor could land on a nearly empty table purely
 * because of that day's yield.
 */
const TOPIC_COUNTS: Record<string, number> = (SWEEP.candidates || []).reduce(
  (acc, candidate) => {
    acc[candidate.topic] = (acc[candidate.topic] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>
);

function richestTopic(): string {
  return (
    SWEPT_TOPICS.slice().sort((a, b) => (TOPIC_COUNTS[b] || 0) - (TOPIC_COUNTS[a] || 0))[0] ||
    SWEPT_TOPICS[0] ||
    ""
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * An empty result has very different causes — a source failing, a live scan's
 * narrower reach, or genuinely nothing on the platforms covered. Saying the
 * wrong one sends people chasing the wrong problem.
 */
function EmptyState({ isLive, notes }: { isLive: boolean; notes: string[] }) {
  const unavailable = notes
    .filter((note) => note.includes("unavailable"))
    .map((note) => note.split(" unavailable")[0]);

  if (unavailable.length > 0) {
    return (
      <div className="empty">
        <strong>No signals — but {unavailable.join(" and ")} could not be reached</strong>
        <span>
          {unavailable.includes("Bluesky")
            ? "Bluesky is the only source searched by language, so results in a non-English query depend on it. This scan was effectively blind."
            : "These results are incomplete; the sources that failed may well hold signals."}
        </span>
      </div>
    );
  }

  if (isLive) {
    return (
      <div className="empty">
        <strong>No signals found for this scan</strong>
        <span>
          A live scan covers a narrower slice than the nightly sweep — fewer queries and a short
          time budget. The topic may still have signals in a full sweep.
        </span>
      </div>
    );
  }

  return (
    <div className="empty">
      <strong>No signals for this topic in the last sweep</strong>
      <span>
        The people who discuss it are mostly on platforms this tool cannot reach yet — see the
        roadmap on the About page.
      </span>
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: "accent" | "good";
}) {
  return (
    <div className="stat">
      <div className={`stat-value ${tone || ""}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState(richestTopic);
  const [liveResult, setLiveResult] = useState<(DiscoverResponse & { topic: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Either the pre-computed slice for the selected chip, or the result of a
  // live scan if one has been run.
  const view = useMemo(() => {
    if (liveResult) {
      return {
        topic: liveResult.topic,
        candidates: liveResult.candidates as SweptCandidate[],
        themes: liveResult.themes,
        notes: liveResult.sourceNotes,
        isLive: true,
      };
    }

    return {
      topic: activeTopic,
      candidates: (SWEEP.candidates || []).filter((c) => c.topic === activeTopic),
      themes: SWEEP.themesByTopic?.[activeTopic] || [],
      notes: SWEEP.notesByTopic?.[activeTopic] || [],
      isLive: false,
    };
  }, [liveResult, activeTopic]);

  function selectTopic(topic: string) {
    setLiveResult(null);
    setError(null);
    setActiveTopic(topic);
  }

  async function handleLiveScan(topic: string, extraTopics: string[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, extraTopics }),
      });

      // A timed-out serverless function returns an HTML error page, so parsing
      // the body blind produces a confusing "not valid JSON" error.
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          "The live scan timed out. Free-tier rate limits make a full pass take about a minute, " +
            "which exceeds the hosting timeout — the nightly results below are unaffected."
        );
      }

      if (!res.ok) throw new Error(json.error || "Scan failed");
      setLiveResult({ ...json, topic });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalSignals = SWEEP.candidates?.length || 0;
  const newSignals = (SWEEP.candidates || []).filter((c) => c.isNew).length;

  return (
    <main>
      <div className="hero">
        <div className="hero-copy">
          <h1>Lead User Discovery</h1>
          <p className="subtitle">
            Finds people who hit a problem before the market did and built their own fix anyway. It
            sweeps public communities nightly, discards the noise, and scores what is left on how
            concretely they solved it and how far ahead of the mainstream they are — Eric von
            Hippel&apos;s Lead User method, run automatically.{" "}
            <Link href="/about" className="about-link">
              Where does this data come from?
            </Link>
          </p>
        </div>

        <div className="stats">
          <Stat value={totalSignals} label="Signals swept" tone="accent" />
          <Stat value={SWEPT_TOPICS.length} label="Topics tracked" />
          <Stat value={newSignals} label="New in last sweep" tone="good" />
          <Stat value={formatDate(SWEEP.ranAt)} label="Last sweep" />
        </div>
      </div>

      <SearchForm
        topics={SWEPT_TOPICS}
        topicCounts={TOPIC_COUNTS}
        activeTopic={view.isLive ? "" : activeTopic}
        onSelectTopic={selectTopic}
        onLiveScan={handleLiveScan}
        loading={loading}
      />

      {error && <div className="error">{error}</div>}

      <div className="view-header">
        <h2>{view.topic || "Results"}</h2>
        <span className="view-badge">
          {view.isLive ? "Live scan" : `Nightly sweep · ${formatDate(SWEEP.ranAt)}`}
        </span>
      </div>

      {view.notes.length > 0 && (
        <details className="diagnostics">
          <summary>Source diagnostics ({view.notes.length})</summary>
          <div className="diagnostics-body">
            {view.notes.map((note, i) => (
              <div key={i}>{note}</div>
            ))}
          </div>
        </details>
      )}

      {view.candidates.length > 0 && <SignalHighlights candidates={view.candidates} />}

      {view.themes.length > 0 && <ThemeClusters themes={view.themes} />}

      {view.candidates.length > 0 ? (
        <ResultsTable candidates={view.candidates} />
      ) : (
        !loading && <EmptyState isLive={view.isLive} notes={view.notes} />
      )}
    </main>
  );
}
