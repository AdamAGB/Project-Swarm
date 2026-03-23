export interface VoteResult {
  personaId: number;
  selectedOption: string;
  selectedOptions: string[];
  score: number;
  probability: number;
}

export interface VoteAggregates {
  totalVotes: number;
  totalPersonas: number;
  voteCounts: Record<string, number>;
  votePercentages: Record<string, number>;
  winner: string;
  winnerCount: number;
  winnerPercentage: number;
  allowMultiple: boolean;
}

export interface SegmentResult {
  segmentName: string;
  segmentValue: string;
  voteCounts: Record<string, number>;
  votePercentages: Record<string, number>;
  totalInSegment: number;
}

export interface SegmentAnalysis {
  byArchetype: SegmentResult[];
  byTrait: SegmentResult[];
  byCustomSegment?: SegmentResult[];
}

export interface GeneratedComment {
  personaId: number;
  personaName: string;
  archetype: string;
  votedFor: string;
  comment: string;
}

export interface PollSummaryText {
  headline: string;
  body: string;
  keyInsights: string[];
}

export type PollStage =
  | 'idle'
  | 'parsing_question'
  | 'parsing_audience'
  | 'generating_framework'
  | 'scoring_options'
  | 'generating_personas'
  | 'voting'
  | 'analyzing_segments'
  | 'generating_comments'
  | 'generating_summary'
  | 'complete'
  | 'error';

export interface PollProgress {
  stage: PollStage;
  stageLabel: string;
  votesCompleted: number;
  totalVotes: number;
  errorMessage?: string;
}

export interface PollResults {
  poll: import('./poll').ParsedPoll;
  framework: import('./poll').QuestionFramework;
  scoredOptions: import('./poll').ScoredOptions;
  votes: VoteResult[];
  aggregates: VoteAggregates;
  segments: SegmentAnalysis;
  comments: GeneratedComment[];
  summary: PollSummaryText | null;
}
