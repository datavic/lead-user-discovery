"use client";

import { useState } from "react";
import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import ThemeClusters from "@/components/ThemeClusters";
import ResultCard from "@/components/ResultCard";
import { DiscoverResponse } from "@/lib/types";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiscoverResponse | null>(null);
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setData(json);
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Lead User Discovery</h1>
      <p className="subtitle">
        Scans GitHub, Reddit, and Hacker News for people describing a problem they solved by building
        their own fix, then uses an LLM to classify genuine lead-user signals — pioneers facing needs
        ahead of the mainstream who expect high benefit from a solution (Eric von Hippel, Lead User
        Theory).{" "}
        <Link href="/about" className="about-link">
          Where does this data come from?
        </Link>
      </p>

      <SearchForm onSearch={handleSearch} loading={loading} />

      {error && <div className="error">{error}</div>}

      {data && data.sourceNotes.length > 0 && (
        <div className="notes">
          {data.sourceNotes.map((note, i) => (
            <div key={i}>{note}</div>
          ))}
        </div>
      )}

      {data && <ThemeClusters themes={data.themes} />}

      {data && data.candidates.length > 0 && (
        <div className="results">
          {data.candidates.map((candidate) => (
            <ResultCard key={candidate.url} candidate={candidate} />
          ))}
        </div>
      )}

      {data && data.candidates.length === 0 && !loading && (
        <div className="empty">No lead-user signals found for this topic. Try a broader term.</div>
      )}

      {!hasSearched && !loading && (
        <div className="empty">Enter a topic above and run a search to get started.</div>
      )}
    </main>
  );
}
