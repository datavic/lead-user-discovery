export type Source = "github" | "reddit" | "hackernews" | "bluesky" | "stackexchange";

export interface Candidate {
  source: Source;
  url: string;
  author: string;
  title: string;
  snippet: string;
  date: string | null;
}

export interface Classification {
  isLeadUserSignal: boolean;
  problem: string;
  selfBuiltSolution: string;
  solubilityScore: number;
  expectedBenefitScore: number;
  theme: string;
  reasoning: string;
}

export type ScoredCandidate = Candidate & Classification;

export interface ThemeCluster {
  theme: string;
  count: number;
}

export interface DiscoverResponse {
  candidates: ScoredCandidate[];
  themes: ThemeCluster[];
  sourceNotes: string[];
}

export interface AnalogousMarket {
  domain: string;
  rationale: string;
}

export interface AnalogousResponse {
  markets: AnalogousMarket[];
}
