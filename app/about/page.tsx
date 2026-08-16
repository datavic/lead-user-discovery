import Link from "next/link";
import { SE_SITES } from "@/lib/sources/stackexchange";

interface SourceRow {
  name: string;
  reaches: string;
  method: string;
  auth: string;
  status: "live" | "partial" | "planned";
}

const SOURCES: SourceRow[] = [
  {
    name: "Reddit",
    reaches: "Non-technical practitioners — the broadest source of people describing their own workflows",
    method: "Public Atom feed (search.rss), queried with topic + self-solution phrases",
    auth: "None",
    status: "live",
  },
  {
    name: "Hacker News",
    reaches: "Founders, engineers and technical professionals",
    method: "Algolia index, stories and comments, searched by bare topic",
    auth: "None",
    status: "live",
  },
  {
    name: "GitHub",
    reaches: "Developers building their own tooling",
    method: "Issue and pull-request search",
    auth: "Optional token (raises rate limit)",
    status: "live",
  },
  {
    name: "Bluesky",
    reaches: "Scientists, academics and journalists — the audience that left Twitter",
    method: "Public AppView post search",
    auth: "None",
    status: "live",
  },
  {
    name: "Stack Exchange",
    reaches: `Domain experts on non-programming sites (${SE_SITES.join(", ")})`,
    method: "Excerpt search across selected sites",
    auth: "None (300 requests/day)",
    status: "partial",
  },
  {
    name: "Twitter / X",
    reaches: "Broad professional commentary",
    method: "Search requires a paid API tier; scraping violates their terms",
    auth: "—",
    status: "planned",
  },
  {
    name: "LinkedIn",
    reaches: "Professional self-reporting",
    method: "No content-search API; scraping violates their terms",
    auth: "—",
    status: "planned",
  },
  {
    name: "YouTube comments",
    reaches: "Practitioners narrating hands-on work",
    method: "Data API — high volume, needs quota planning",
    auth: "—",
    status: "planned",
  },
];

const STATUS_LABEL: Record<SourceRow["status"], string> = {
  live: "Live",
  partial: "Partial",
  planned: "Work in progress",
};

export default function About() {
  return (
    <main>
      <Link href="/" className="back-link">
        ← Back to search
      </Link>

      <h1>About this tool</h1>
      <p className="subtitle">
        This automates the sourcing step of Eric von Hippel&apos;s Lead User methodology (MIT, 1986).
        Lead users face needs months or years ahead of the mainstream and expect high benefit from a
        solution, so they build their own fix rather than wait for one. Those self-built fixes leave a
        public trail — this tool finds it.
      </p>

      <h2>Where the data comes from</h2>
      <p className="section-note">
        Every source below is queried live at search time. Nothing is bought, scraped behind a login,
        or taken from private data — these are public posts their authors chose to publish.
      </p>

      <div className="source-table">
        {SOURCES.map((source) => (
          <div key={source.name} className={`source-row ${source.status}`}>
            <div className="source-head">
              <strong>{source.name}</strong>
              <span className={`status-pill ${source.status}`}>{STATUS_LABEL[source.status]}</span>
            </div>
            <div className="source-reaches">{source.reaches}</div>
            <div className="source-meta">
              {source.method} · Auth: {source.auth}
            </div>
          </div>
        ))}
      </div>

      <h2>How often it runs</h2>
      <p className="section-note">
        Searches run on demand — every result you see was fetched when you pressed Discover, not read
        from a cache. A scheduled daily sweep is planned, which will track how themes shift over time
        and surface newly-appearing lead users rather than re-reporting the same ones.
      </p>

      <h2>How a result is judged</h2>
      <ol className="method-list">
        <li>
          <strong>Query construction.</strong> The topic is combined with problem-and-self-solution
          phrasing — &ldquo;I built my own&rdquo;, &ldquo;I use ChatGPT to&rdquo;, &ldquo;workaround
          for&rdquo; — since lead users describe fixes, not just complaints.
        </li>
        <li>
          <strong>Noise removal.</strong> Automated digests and bot accounts keyword-match well but
          have no person behind them, so they are dropped before any model sees them.
        </li>
        <li>
          <strong>Classification.</strong> An LLM decides whether each post shows a real need plus
          concrete evidence the author built or adapted something themselves, scoring solubility (how
          concretely they solved it) and expected benefit (how far ahead of the mainstream they are).
        </li>
        <li>
          <strong>Clustering.</strong> Confirmed signals are grouped by theme, so recurring needs
          stand out from one-offs.
        </li>
      </ol>

      <h2>Limits worth knowing</h2>
      <ul className="method-list">
        <li>
          Classification runs on a free LLM tier, which rate-limits heavily — a search takes roughly a
          minute.
        </li>
        <li>
          Coverage is skewed toward English-language, public, text-based communities. Practitioners who
          share their work in videos, group chats, or other languages are systematically under-counted.
        </li>
        <li>
          The tool surfaces candidates for a human to judge. It does not replace talking to them, which
          is where the actual insight comes from.
        </li>
      </ul>
    </main>
  );
}
