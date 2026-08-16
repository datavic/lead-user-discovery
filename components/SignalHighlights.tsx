import { ScoredCandidate } from "@/lib/types";
import { SOURCE_LABEL } from "@/components/ResultsTable";

/**
 * The strongest few signals, shown as people rather than rows. The table below
 * carries the full set; this is what a reader should actually look at first,
 * since the point of the tool is the person, not the record.
 */
export default function SignalHighlights({
  candidates,
}: {
  candidates: (ScoredCandidate & { isNew?: boolean })[];
}) {
  const top = candidates.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <div className="highlights">
      {top.map((candidate) => (
        <a
          key={candidate.url}
          className="highlight"
          href={candidate.url}
          target="_blank"
          rel="noreferrer"
        >
          <div className="highlight-top">
            <span className="highlight-author">
              <span className="avatar" aria-hidden="true">
                {(candidate.author || "?").replace(/^@/, "").charAt(0).toUpperCase()}
              </span>
              {candidate.author}
            </span>
            <span className="badge">{SOURCE_LABEL[candidate.source] || candidate.source}</span>
          </div>

          <p className="highlight-built">{candidate.selfBuiltSolution}</p>

          <p className="highlight-problem">
            <span className="highlight-key">Need</span>
            {candidate.problem}
          </p>

          <div className="highlight-foot">
            <span className="theme-cell">{candidate.theme}</span>
            <span className="highlight-scores">
              <Meter label="Solubility" value={candidate.solubilityScore} />
              <Meter label="Benefit" value={candidate.expectedBenefitScore} />
            </span>
          </div>

          {candidate.isNew && <span className="highlight-new">New</span>}
        </a>
      ))}
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className="meter" title={`${label}: ${clamped}`}>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${clamped}%` }} />
      </span>
      <span className="meter-value">{clamped}</span>
    </span>
  );
}
