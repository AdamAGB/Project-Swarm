export type AgeBand = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
export type Gender = 'male' | 'female' | 'non_binary';
export type Region = 'northeast' | 'southeast' | 'midwest' | 'southwest' | 'west' | 'pacific';
export type Urbanicity = 'urban' | 'suburban' | 'rural';
export type IncomeBand = 'under_25k' | '25k_50k' | '50k_75k' | '75k_100k' | '100k_150k' | '150k_plus';
export type EducationLevel = 'high_school' | 'some_college' | 'bachelors' | 'masters' | 'doctorate';
export type HouseholdType = 'single' | 'couple_no_kids' | 'young_family' | 'established_family' | 'empty_nester' | 'retired';
export type ChannelPreference = 'online_only' | 'online_preferred' | 'no_preference' | 'store_preferred' | 'store_only';

export interface PersonaTraits {
  age_band: AgeBand;
  gender: Gender;
  region: Region;
  urbanicity: Urbanicity;
  income_band: IncomeBand;
  education_level: EducationLevel;
  household_type: HouseholdType;
  channel_preference: ChannelPreference;

  // Consumer psychology (0-100)
  price_sensitivity: number;
  brand_loyalty: number;
  novelty_seeking: number;
  risk_tolerance: number;
  convenience_orientation: number;
  quality_orientation: number;
  value_orientation: number;
  habit_inertia: number;
  social_proof_sensitivity: number;
  trust_in_brands: number;
  health_consciousness: number;
  status_seeking: number;
  sustainability_concern: number;
  promotion_sensitivity: number;
  premium_willingness: number;

  // Survey response tendencies (0-100)
  ad_skepticism: number;
  attention_level: number;
  survey_fatigue_susceptibility: number;
  social_desirability_bias: number;
  verbosity: number;
  certainty_level: number;
  contrarian_tendency: number;
  response_randomness: number;

  // Shopping behavior (0-100)
  shopping_frequency_level: number;
  research_depth: number;
  budget_pressure: number;
  trial_openness: number;
  recommendation_likelihood_baseline: number;
}

export type NumericTraitKey = {
  [K in keyof PersonaTraits]: PersonaTraits[K] extends number ? K : never;
}[keyof PersonaTraits];

export type Archetype =
  | 'budget_conscious_pragmatist'
  | 'premium_curious_trend_seeker'
  | 'brand_loyal_mainstream_buyer'
  | 'health_focused_skeptic'
  | 'convenience_first_shopper';

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  budget_conscious_pragmatist: 'Budget Conscious Pragmatist',
  premium_curious_trend_seeker: 'Premium Curious Trend Seeker',
  brand_loyal_mainstream_buyer: 'Brand Loyal Mainstream Buyer',
  health_focused_skeptic: 'Health-Focused Skeptic',
  convenience_first_shopper: 'Convenience-First Shopper',
};

export function getArchetypeLabels(framework?: import('./poll').QuestionFramework): Record<Archetype, string> {
  if (framework?.archetypeLabels) return framework.archetypeLabels;
  return ARCHETYPE_LABELS;
}

export const ARCHETYPE_COLORS: Record<Archetype, string> = {
  budget_conscious_pragmatist: '#3b82f6',
  premium_curious_trend_seeker: '#ec4899',
  brand_loyal_mainstream_buyer: '#8b5cf6',
  health_focused_skeptic: '#10b981',
  convenience_first_shopper: '#f59e0b',
};

export interface Persona {
  id: number;
  name: string;
  traits: PersonaTraits;
  archetype: Archetype;
  bio: string;
  customSegment?: string;
}
