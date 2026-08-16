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
    method:
      "Reddit blocks datacenter IP ranges, so the anonymous feed returns nothing from a scheduled server. Restoring it needs an OAuth app — tracked on the roadmap",
    auth: "OAuth app required",
    status: "planned",
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
    method: "Authenticated post search (app.bsky.feed.searchPosts). The anonymous AppView refuses search, so a session is created from an app password",
    auth: "App password",
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

interface Phase {
  title: string;
  status: "live" | "partial" | "planned";
  items: string[];
}

const ROADMAP: Phase[] = [
  {
    title: "Shipped",
    status: "live",
    items: [
      "Multi-source mining across Reddit, Hacker News, GitHub, Bluesky and Stack Exchange",
      "LLM classification scoring solubility and expected benefit, with theme clustering",
      "Noise filtering: automated digests, bot accounts, crossposts and off-topic matches removed",
      "Nightly sweep running unattended on a schedule, with results committed and served instantly",
      "Analogous-market suggestions for adjacent domains facing the same bottleneck",
    ],
  },
  {
    title: "Next",
    status: "partial",
    items: [
      "Sharper Stack Exchange queries; its search matches too loosely to be trusted raw",
      "Trend view: how themes shift week over week, so a rising need is visible before it peaks",
    ],
  },
  {
    title: "Later",
    status: "planned",
    items: [
      "Reddit via an OAuth app — it reaches non-technical practitioners no other source does, but needs credentials Reddit only issues through a manual approval flow",
      "YouTube comments — where practitioners narrate hands-on work, but the volume needs quota planning",
      "Outreach tracking: who has been contacted, who replied, what they said",
      "Network mapping to find people cited by several other lead users",
      "Non-English sources, which are the largest blind spot in current coverage",
    ],
  },
];

const PHASE_LABEL: Record<Phase["status"], string> = {
  live: "Done",
  partial: "In progress",
  planned: "Planned",
};

export default function About() {
  return (
    <main>
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
        A sweep runs automatically every day at 06:00 UTC. It executes the full pipeline, records
        which URLs it has never seen before, and commits the results — so the table on the home page
        is already populated when you arrive, and anything marked <em>new</em> appeared in the most
        recent run. Because each sweep is a commit, the repository history doubles as a record of
        every run.
      </p>
      <p className="section-note">
        Running a search yourself scans live instead. That path is slower — free-tier LLM rate limits
        mean a full pass takes about a minute, which can exceed the hosting timeout — so the nightly
        results are the reliable view.
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

      <h2>Roadmap</h2>
      <div className="roadmap">
        {ROADMAP.map((phase) => (
          <div key={phase.title} className={`roadmap-phase ${phase.status}`}>
            <div className="roadmap-head">
              <strong>{phase.title}</strong>
              <span className={`status-pill ${phase.status}`}>{PHASE_LABEL[phase.status]}</span>
            </div>
            <ul className="roadmap-items">
              {phase.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

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
