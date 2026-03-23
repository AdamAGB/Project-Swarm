import type { NumericTraitKey } from '../types';

export type WeightEntry = [NumericTraitKey, number];

export const DEFAULT_TRAIT_WEIGHT_MATRIX: Record<string, WeightEntry[]> = {
  category_fit: [
    ['attention_level', 0.4],
    ['research_depth', 0.3],
    ['trust_in_brands', 0.2],
    ['habit_inertia', 0.2],
  ],
  trustworthiness: [
    ['trust_in_brands', 0.8],
    ['ad_skepticism', -0.5],
    ['risk_tolerance', -0.3],
    ['social_proof_sensitivity', 0.4],
    ['brand_loyalty', 0.5],
    ['habit_inertia', 0.3],
  ],
  clarity: [
    ['attention_level', 0.5],
    ['survey_fatigue_susceptibility', 0.4],
    ['convenience_orientation', 0.4],
    ['research_depth', -0.2],
    ['novelty_seeking', -0.2],
  ],
  memorability: [
    ['novelty_seeking', 0.6],
    ['social_proof_sensitivity', 0.3],
    ['habit_inertia', -0.3],
    ['attention_level', 0.3],
    ['status_seeking', 0.2],
  ],
  premium_feel: [
    ['premium_willingness', 0.9],
    ['status_seeking', 0.7],
    ['price_sensitivity', -0.8],
    ['budget_pressure', -0.6],
    ['quality_orientation', 0.4],
    ['value_orientation', -0.3],
  ],
  playfulness: [
    ['novelty_seeking', 0.7],
    ['risk_tolerance', 0.3],
    ['contrarian_tendency', 0.3],
    ['habit_inertia', -0.4],
    ['ad_skepticism', -0.2],
    ['trial_openness', 0.3],
  ],
  weirdness: [
    ['novelty_seeking', 0.5],
    ['contrarian_tendency', 0.6],
    ['risk_tolerance', 0.4],
    ['social_proof_sensitivity', -0.7],
    ['habit_inertia', -0.5],
    ['social_desirability_bias', -0.4],
    ['trust_in_brands', -0.3],
  ],
  safety_mismatch: [
    // High safety_mismatch PENALIZES risk-averse personas
    ['risk_tolerance', 0.5],
    ['trust_in_brands', -0.6],
    ['health_consciousness', -0.5],
    ['ad_skepticism', 0.2],
    ['quality_orientation', -0.4],
    ['brand_loyalty', -0.3],
  ],
  organic_fit: [
    ['health_consciousness', 0.8],
    ['sustainability_concern', 0.7],
    ['quality_orientation', 0.3],
    ['price_sensitivity', -0.3],
    ['premium_willingness', 0.3],
    ['value_orientation', 0.2],
  ],
};

// Baseline weights — every persona has some minimum care about these dimensions
// even if their specific traits don't strongly activate them
export const DEFAULT_BASELINE_WEIGHTS: Record<string, number> = {
  category_fit: 0.15,
  clarity: 0.10,
  trustworthiness: 0.08,
  safety_mismatch: -0.12,
};

// Backward compat aliases
export const TRAIT_WEIGHT_MATRIX = DEFAULT_TRAIT_WEIGHT_MATRIX;
export const BASELINE_WEIGHTS = DEFAULT_BASELINE_WEIGHTS;
