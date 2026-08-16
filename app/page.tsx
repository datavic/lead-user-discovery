"use client";

import { useState } from "react";
import Link from "next/link";
import latestSweep from "@/data/latest.json";
import SearchForm from "@/components/SearchForm";
import ThemeClusters from "@/components/ThemeClusters";
import ResultsTable from "@/components/ResultsTable";
import { DiscoverResponse } from "@/lib/types";

// Results from the nightly sweep (.github/workflows/sweep.yml), committed to
// the repo. Rendering these means a visitor sees real findings immediately
// rather than waiting out a rate-limited live search.
const SWEEP: DiscoverResponse & { ranAt: string } = {
  ranAt: latestSweep.ranAt,
  candidates: latestSweep.candidates as unknown as DiscoverResponse["candidates"],
  themes: latestSweep.themes,
  // The sweep file records these as `notes`; the UI reads `sourceNotes`.
  sourceNotes: latestSweep.notes ?? [],
};

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
  const [data, setData] = useState<DiscoverResponse | null>(SWEEP);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(topic: string, extraTopics: string[]) {
    setLoading(true);
    setError(null);
    setHasSearched(true);
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
          res.status === 504 || res.status === 500
            ? "The live search timed out — free-tier rate limits make a full run take about a minute, which exceeds the hosting timeout. The results below are from the most recent nightly sweep."
            : `Unexpected response from the server (${res.status}).`
        );
      }

      if (!res.ok) throw new Error(json.error || "Search failed");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Lead User Discovery</h1>
      <p className="subtitle">
        Scans Reddit, Hacker News, GitHub, Bluesky and Stack Exchange for people describing a problem
        they solved by building their own fix, then uses an LLM to classify genuine lead-user signals
        — pioneers facing needs ahead of the mainstream who expect high benefit from a solution (Eric
        von Hippel, Lead User Theory).{" "}
        <Link href="/about" className="about-link">
          Where does this data come from?
        </Link>
      </p>

      {data && (
        <div className="stats">
          <Stat value={data.candidates.length} label="Lead-user signals" tone="accent" />
          <Stat value={data.themes.length} label="Distinct themes" />
          <Stat
            value={new Set(data.candidates.map((c) => c.source)).size}
            label="Sources contributing"
          />
          <Stat
            value={hasSearched ? "Live" : formatDate(SWEEP.ranAt)}
            label={hasSearched ? "Scan type" : "Last nightly sweep"}
            tone="good"
          />
        </div>
      )}

      <SearchForm onSearch={handleSearch} loading={loading} />

      {error && <div className="error">{error}</div>}

      {data && data.sourceNotes.length > 0 && (
        <details className="diagnostics">
          <summary>
            Source diagnostics ({data.sourceNotes.length})
          </summary>
          <div className="diagnostics-body">
            {data.sourceNotes.map((note, i) => (
              <div key={i}>{note}</div>
            ))}
          </div>
        </details>
      )}

      {data && data.themes.length > 0 && (
        <>
          <h2>Themes</h2>
          <ThemeClusters themes={data.themes} />
        </>
      )}

      {data && data.candidates.length > 0 && (
        <>
          <h2>Signals</h2>
          <ResultsTable candidates={data.candidates} />
        </>
      )}

      {data && data.candidates.length === 0 && !loading && (
        <div className="empty">No lead-user signals found for this topic. Try a broader term.</div>
      )}

      {!hasSearched && !loading && (
        <div className="sweep-note">
          Showing the nightly sweep from{" "}
          {new Date(SWEEP.ranAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          . Run a search above for a live scan.
        </div>
      )}
    </main>
  );
}
