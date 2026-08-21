"use client";

import { useState } from "react";
import { AnalogousMarket } from "@/lib/types";
import { findMarket } from "@/lib/markets";

interface Props {
  topics: string[];
  topicCounts: Record<string, number>;
  activeTopic: string;
  onSelectTopic: (topic: string) => void;
  onLiveScan: (topic: string, extraTopics: string[]) => void;
  loading: boolean;
}

export default function SearchForm({
  topics,
  topicCounts,
  activeTopic,
  onSelectTopic,
  onLiveScan,
  loading,
}: Props) {
  const [query, setQuery] = useState("");
  const [includeAnalogous, setIncludeAnalogous] = useState(false);
  const [analogousLoading, setAnalogousLoading] = useState(false);
  const [analogousMarkets, setAnalogousMarkets] = useState<AnalogousMarket[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(new Set());
  const [analogousError, setAnalogousError] = useState<string | null>(null);

  async function fetchAnalogous(currentTopic: string) {
    if (!currentTopic) return;
    setAnalogousLoading(true);
    setAnalogousError(null);
    try {
      const res = await fetch("/api/analogous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: currentTopic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch analogous markets");
      setAnalogousMarkets(data.markets || []);
    } catch (err: any) {
      setAnalogousError(err.message);
    } finally {
      setAnalogousLoading(false);
    }
  }

  function toggleMarket(domain: string) {
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function handleIncludeToggle(checked: boolean) {
    setIncludeAnalogous(checked);
    if (checked && analogousMarkets.length === 0) {
      fetchAnalogous(query || activeTopic);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    onLiveScan(query.trim(), Array.from(selectedMarkets));
  }

  return (
    <div className="panel">
      <div className="panel-section">
        <div className="panel-label">
          Swept nightly — switch instantly
        </div>
        <p className="panel-note">
          <strong>Searches in 6 languages:</strong> English, Japanese, Korean, Indonesian,
          Vietnamese and Thai. Country topics are searched in that country&apos;s own language —
          searching &ldquo;Japan ChatGPT&rdquo; in English mostly returns news outlets writing about
          AI, while <span className="inline-native">ChatGPTで作った</span> (&ldquo;made with
          ChatGPT&rdquo;) returns people describing what they actually built.
        </p>
        <div className="chip-row">
          {topics.map((topic) => {
            const count = topicCounts[topic] ?? 0;
            const market = findMarket(topic);
            return (
              <button
                key={topic}
                type="button"
                // Show the yield up front: a chip that leads to an empty table
                // should look empty before it is clicked, not after.
                className={`chip ${activeTopic === topic ? "active" : ""} ${count === 0 ? "empty-topic" : ""}`}
                onClick={() => onSelectTopic(topic)}
                title={
                  market
                    ? `Searched in ${market.language} · ${count} signals`
                    : count === 0
                      ? "No signals in the last sweep"
                      : `${count} signals`
                }
              >
                {topic}
                {market && <span className="chip-lang">{market.language}</span>}
                <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form className="panel-section bordered" onSubmit={handleSubmit}>
        <div className="panel-label">
          Scan a different topic live
          <span className="panel-hint">scans a narrower slice than the nightly sweep, in about ten seconds</span>
        </div>

        <div className="row">
          <input
            type="text"
            placeholder="e.g. self-hosted AI tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? "Scanning…" : "Run live scan"}
          </button>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={includeAnalogous}
            onChange={(e) => handleIncludeToggle(e.target.checked)}
          />
          Include analogous markets (adjacent domains facing the same bottleneck)
        </label>

        {includeAnalogous && (
          <div className="chip-row">
            {analogousLoading && <span className="panel-hint">Finding analogous markets…</span>}
            {analogousError && <span className="error-inline">{analogousError}</span>}
            {analogousMarkets.map((market) => (
              <button
                key={market.domain}
                type="button"
                title={market.rationale}
                className={`chip ${selectedMarkets.has(market.domain) ? "active" : ""}`}
                onClick={() => toggleMarket(market.domain)}
              >
                {market.domain}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
