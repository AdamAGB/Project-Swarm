import type { AgeBand, Gender, Region, Urbanicity, IncomeBand, EducationLevel, HouseholdType, NumericTraitKey } from './persona';
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

export interface OptionScoreVector {
  category_fit: number;
  trustworthiness: number;
  clarity: number;
  memorability: number;
  premium_feel: number;
  playfulness: number;
  weirdness: number;
  safety_mismatch: number;
  organic_fit: number;
}

export type OptionDimension = keyof OptionScoreVector;

export interface ScoredOptions {
  options: Record<string, OptionScoreVector>;
}
