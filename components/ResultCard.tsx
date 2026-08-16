import { ScoredCandidate } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  github: "GitHub",
  reddit: "Reddit",
  hackernews: "Hacker News",
};

export default function ResultCard({ candidate }: { candidate: ScoredCandidate }) {
  return (
    <div className="card">
      <div className="card-header">
        <a href={candidate.url} target="_blank" rel="noreferrer">
          {candidate.title}
        </a>
        <span className="badge">{SOURCE_LABEL[candidate.source] || candidate.source}</span>
      </div>
      <div className="meta">
        by {candidate.author}
        {candidate.date ? ` · ${new Date(candidate.date).toLocaleDateString()}` : ""} · theme: {candidate.theme}
      </div>

      <div className="problem-solution">
        <div>
          <b>Problem:</b> {candidate.problem}
        </div>
        <div>
          <b>Self-built solution:</b> {candidate.selfBuiltSolution}
        </div>
      </div>

      <div className="scores">
        <ScoreBar label="Solubility" value={candidate.solubilityScore} />
        <ScoreBar label="Expected benefit" value={candidate.expectedBenefitScore} />
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="score">
      <div className="score-label">
        {label} · {clamped}
      </div>
      <div className="score-bar">
        <div className="score-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
