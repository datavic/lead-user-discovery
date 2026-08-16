"use client";

import { useMemo, useState } from "react";
import { ScoredCandidate } from "@/lib/types";

export const SOURCE_LABEL: Record<string, string> = {
  github: "GitHub",
  reddit: "Reddit",
  hackernews: "Hacker News",
  bluesky: "Bluesky",
  stackexchange: "Stack Exchange",
};

type SortKey = "score" | "solubility" | "benefit" | "date" | "source";

interface Props {
  candidates: (ScoredCandidate & { isNew?: boolean })[];
}

export default function ResultsTable({ candidates }: Props) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string>("all");
  const [theme, setTheme] = useState<string>("all");
  const [minScore, setMinScore] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [descending, setDescending] = useState(true);

  const sources = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.source))).sort(),
    [candidates]
  );

  const themes = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.theme))).sort(),
    [candidates]
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = candidates.filter((candidate) => {
      if (source !== "all" && candidate.source !== source) return false;
      if (theme !== "all" && candidate.theme !== theme) return false;
      if (candidate.solubilityScore + candidate.expectedBenefitScore < minScore) return false;
      if (!needle) return true;

      return [
        candidate.title,
        candidate.author,
        candidate.problem,
        candidate.selfBuiltSolution,
        candidate.theme,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const value = (candidate: (typeof candidates)[number]): number | string => {
      switch (sortKey) {
        case "solubility":
          return candidate.solubilityScore;
        case "benefit":
          return candidate.expectedBenefitScore;
        case "date":
          return candidate.date ? Date.parse(candidate.date) || 0 : 0;
        case "source":
          return candidate.source;
        default:
          return candidate.solubilityScore + candidate.expectedBenefitScore;
      }
    };

    return [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const comparison = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return descending ? -comparison : comparison;
    });
  }, [candidates, query, source, theme, minScore, sortKey, descending]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDescending((prev) => !prev);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  }

  const arrow = (key: SortKey) => (key === sortKey ? (descending ? " ↓" : " ↑") : "");

  return (
    <section className="table-section">
      <div className="filter-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="Filter by keyword, person or theme…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s] || s}
            </option>
          ))}
        </select>

        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="all">All themes</option>
          {themes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
          <option value={0}>Any score</option>
          <option value={120}>Combined 120+</option>
          <option value={150}>Combined 150+</option>
          <option value={170}>Combined 170+</option>
        </select>
      </div>

      <div className="table-meta">
        {rows.length} of {candidates.length} signals
        {rows.length !== candidates.length && (
          <button
            type="button"
            className="clear-filters"
            onClick={() => {
              setQuery("");
              setSource("all");
              setTheme("all");
              setMinScore(0);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="table-scroll">
        <table className="results-table">
          <thead>
            <tr>
              <th className="col-signal">Signal</th>
              <th className="sortable" onClick={() => toggleSort("source")}>
                Source{arrow("source")}
              </th>
              <th>Problem</th>
              <th>What they built</th>
              <th>Theme</th>
              <th className="sortable num" onClick={() => toggleSort("solubility")}>
                Sol.{arrow("solubility")}
              </th>
              <th className="sortable num" onClick={() => toggleSort("benefit")}>
                Ben.{arrow("benefit")}
              </th>
              <th className="sortable" onClick={() => toggleSort("date")}>
                Date{arrow("date")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((candidate) => (
              <tr key={candidate.url}>
                <td className="col-signal">
                  <a href={candidate.url} target="_blank" rel="noreferrer">
                    {candidate.title}
                  </a>
                  <div className="row-author">
                    {candidate.author}
                    {candidate.isNew && <span className="new-pill">new</span>}
                  </div>
                </td>
                <td>
                  <span className="badge">{SOURCE_LABEL[candidate.source] || candidate.source}</span>
                </td>
                <td className="col-text">{candidate.problem}</td>
                <td className="col-text">{candidate.selfBuiltSolution}</td>
                <td>
                  <span className="theme-cell">{candidate.theme}</span>
                </td>
                <td className="num">
                  <ScorePip value={candidate.solubilityScore} />
                </td>
                <td className="num">
                  <ScorePip value={candidate.expectedBenefitScore} />
                </td>
                <td className="col-date">
                  {candidate.date ? new Date(candidate.date).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="empty">No signals match these filters.</div>
        )}
      </div>
    </section>
  );
}

function ScorePip({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone = clamped >= 80 ? "high" : clamped >= 50 ? "mid" : "low";
  return <span className={`pip ${tone}`}>{clamped}</span>;
}
