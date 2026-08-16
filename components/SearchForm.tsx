"use client";

import { useState } from "react";
import { AnalogousMarket } from "@/lib/types";

const PRESETS = [
  "Advanced OpenAI / ChatGPT users",
  "Farmers using ChatGPT",
  "Scientists using AI in research",
  "Small business owners using ChatGPT",
  "Local LLM tinkerers",
  "AI coding agent power users",
];

interface Props {
  onSearch: (topic: string, extraTopics: string[]) => void;
  loading: boolean;
}

export default function SearchForm({ onSearch, loading }: Props) {
  const [topic, setTopic] = useState("");
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
      fetchAnalogous(topic);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    onSearch(topic.trim(), Array.from(selectedMarkets));
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="row">
        <input
          type="text"
          placeholder="Topic, e.g. advanced OpenAI users"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button type="submit" disabled={loading || !topic.trim()}>
          {loading ? "Searching…" : "Discover"}
        </button>
      </div>

      <div className="chip-row">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`chip ${topic === preset ? "active" : ""}`}
            onClick={() => setTopic(preset)}
          >
            {preset}
          </button>
        ))}
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
          {analogousLoading && <span className="notes">Finding analogous markets…</span>}
          {analogousError && <span className="error">{analogousError}</span>}
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
  );
}
