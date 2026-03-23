export type Sensitivity = 'HIGH' | 'MEDIUM' | 'LOW';

/** Common-sense prior with confidence */
export interface PriorResult {
  /** option name → probability (sums to ~1.0) */
  distribution: Record<string, number>;
  /** 0–1: how confident the prior is (strong known sentiment → high, novel/vague → low) */
  confidence: number;
}

export interface Segment {
  name: string;
  description: string;
  populationShare: number; // 0–1, all segments sum to 1
}

export interface Variable {
  key: string;
  label: string;
  description: string; // "0 = X, 100 = Y"
}

export interface ScoringPass {
  lens: string;           // e.g. "Baseline Consumer", "Strict Literal", "Critical/Skeptical"
  description: string;    // human-readable label for debug UI
  rankings: Record<string, Record<string, number>>; // option → variable key → rank (1 = best)
}

export interface OptionScoreResult {
  rankings: Record<string, Record<string, number>>; // option → variable key → average rank
  definitions: Record<string, string>;               // variable key → baseline definition from step 1
  passes: ScoringPass[];                              // raw per-lens data for transparency
}

export interface SegmentFramework {
  reasoning: string;             // why this many segments, what makes each distinct
  segments: Segment[];           // 2–8 segments — as many as needed to capture real behavioral differences
  variables: Variable[];         // always 6 variables — rich dimensional space regardless of segment count
  weights: Record<string, Record<string, Sensitivity>>; // segment name → variable key → sensitivity
}

export interface V2SegmentVoteResult {
  segmentName: string;
  populationShare: number;
  votesAllocated: number;
  voteCounts: Record<string, number>;
  votePercentages: Record<string, number>;
  preferenceScores: Record<string, number>;
  winnerInSegment: string;
}

export interface V2VoteAggregates {
  totalVotes: number;
  voteCounts: Record<string, number>;
  votePercentages: Record<string, number>;
  winner: string;
  winnerCount: number;
  winnerPercentage: number;
  runnerUp: string;
  runnerUpCount: number;
  runnerUpPercentage: number;
}

export interface VariableDriver {
  variableKey: string;
  variableLabel: string;
  contribution: number;
  contributionShare: number;
  winnerScore: number;
  runnerUpScore: number;
}

export interface SegmentDriver {
  segmentName: string;
  populationShare: number;
  contribution: number;
  contributionShare: number;
  winnerScore: number;
  runnerUpScore: number;
  delta: number;
}

export interface DriverDecomposition {
  winner: string;
  runnerUp: string;
  totalAdvantage: number;
  byVariable: VariableDriver[];
  bySegment: SegmentDriver[];
}

export interface V2Narrative {
  headline: string;
  body: string;
  keyInsights: string[];
}

export interface V2AggregationResult {
  weightedScores: Record<string, number>;
  segmentScores: Record<string, Record<string, number>>;
  aggregates: V2VoteAggregates;
  segmentVotes: V2SegmentVoteResult[];
  drivers: DriverDecomposition;
  narrative: V2Narrative;
}
