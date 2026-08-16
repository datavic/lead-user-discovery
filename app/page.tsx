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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const [activeTopic, setActiveTopic] = useState(SWEPT_TOPICS[0] || "");
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

      <div className="stats">
        <Stat value={totalSignals} label="Signals swept" tone="accent" />
        <Stat value={SWEPT_TOPICS.length} label="Topics tracked" />
        <Stat value={newSignals} label="New in last sweep" tone="good" />
        <Stat value={formatDate(SWEEP.ranAt)} label="Last sweep" />
      </div>

      <SearchForm
        topics={SWEPT_TOPICS}
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
        !loading && (
          <div className="empty">
            No lead-user signals recorded for this topic yet — the next nightly sweep may find some.
          </div>
        )
      )}
    </main>
  );
}
