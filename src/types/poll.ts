import type { AgeBand, Gender, Region, Urbanicity, IncomeBand, EducationLevel, HouseholdType, NumericTraitKey, Archetype } from './persona';
import type { WeightedOption } from '../engine/seeded-random';

export type PollType = 'forced_choice' | 'yes_no' | 'yes_maybe_no';

export interface AudienceSegment {
  description: string;
  weight: number; // 0-1, all weights sum to 1
  label: string;  // short label derived by LLM or truncated from description
}

export type AudienceMode = 'general' | 'single' | 'multi';

export interface AudienceConfig {
  mode: AudienceMode;
  segments: AudienceSegment[]; // empty for 'general', 1 for 'single', 2+ for 'multi'
}

export interface SegmentTraitOverrides {
  label: string;
  age_band?: WeightedOption<AgeBand>[];
  gender?: WeightedOption<Gender>[];
  region?: WeightedOption<Region>[];
  urbanicity?: WeightedOption<Urbanicity>[];
  income_band?: WeightedOption<IncomeBand>[];
  education_level?: WeightedOption<EducationLevel>[];
  household_type?: WeightedOption<HouseholdType>[];
  trait_mean_overrides?: Partial<Record<NumericTraitKey, number>>;
}

export interface ParsedPoll {
  poll_type: PollType;
  category: string;
  context: string;
  options: string[];
  original_question: string;
  allowMultiple: boolean;
  audienceConfig?: AudienceConfig;
}

export type OptionScoreVector = Record<string, number>;

export type OptionDimension = string;

export interface ScoredOptions {
  options: Record<string, OptionScoreVector>;
}

export interface DimensionDef {
  key: string;
  label: string;
  description: string;  // e.g. "How naturally it fits the domain (0=doesn't fit, 100=perfect fit)"
}

export interface QuestionFramework {
  domain: string;
  dimensions: DimensionDef[];
  weightMatrix: Record<string, [NumericTraitKey, number][]>;
  baselineWeights: Record<string, number>;
  archetypeLabels: Record<Archetype, string>;
  archetypeDescriptions: Record<Archetype, string>;
  segmentTraits: { key: NumericTraitKey; label: string }[];
}
