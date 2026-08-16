"use client";

import { useState } from "react";
import { AnalogousMarket } from "@/lib/types";

interface Props {
  topics: string[];
  activeTopic: string;
  onSelectTopic: (topic: string) => void;
  onLiveScan: (topic: string, extraTopics: string[]) => void;
  loading: boolean;
}

export default function SearchForm({
  topics,
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
        <div className="chip-row">
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              className={`chip ${activeTopic === topic ? "active" : ""}`}
              onClick={() => onSelectTopic(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <form className="panel-section bordered" onSubmit={handleSubmit}>
        <div className="panel-label">
          Scan a different topic live
          <span className="panel-hint">takes about a minute; may time out on free hosting</span>
        </div>

        <div className="row">
          <input
            type="text"
            placeholder="e.g. beekeepers using ChatGPT"
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
