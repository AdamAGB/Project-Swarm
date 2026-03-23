import type { Persona, PersonaTraits, Archetype, NumericTraitKey } from '../types';
import type { SegmentTraitOverrides, QuestionFramework } from '../types/poll';
import { SeededRandom } from './seeded-random';
import { ARCHETYPE_DISTRIBUTION, ARCHETYPE_TRAIT_PROFILES } from '../data/archetype-profiles';
import {
  AGE_BAND_DISTRIBUTION,
  GENDER_DISTRIBUTION,
  REGION_DISTRIBUTION,
  URBANICITY_DISTRIBUTION,
  INCOME_BAND_DISTRIBUTION,
  EDUCATION_LEVEL_DISTRIBUTION,
  HOUSEHOLD_TYPE_DISTRIBUTION,
  CHANNEL_PREFERENCE_DISTRIBUTION,
} from '../data/trait-distributions';
import { MALE_NAMES, FEMALE_NAMES, NEUTRAL_NAMES } from '../data/name-bank';
import { generateBio } from '../data/bio-templates';

const NUMERIC_TRAIT_KEYS: NumericTraitKey[] = [
  'price_sensitivity', 'brand_loyalty', 'novelty_seeking', 'risk_tolerance',
  'convenience_orientation', 'quality_orientation', 'value_orientation', 'habit_inertia',
  'social_proof_sensitivity', 'trust_in_brands', 'health_consciousness', 'status_seeking',
  'sustainability_concern', 'promotion_sensitivity', 'premium_willingness',
  'ad_skepticism', 'attention_level', 'survey_fatigue_susceptibility',
  'social_desirability_bias', 'verbosity', 'certainty_level', 'contrarian_tendency',
  'response_randomness', 'shopping_frequency_level', 'research_depth',
  'budget_pressure', 'trial_openness', 'recommendation_likelihood_baseline',
];

function pickName(rng: SeededRandom, gender: string, usedNames: Set<string>): string {
  const namePool = gender === 'male' ? MALE_NAMES
    : gender === 'female' ? FEMALE_NAMES
    : NEUTRAL_NAMES;

  let name = rng.pick(namePool);
  let attempts = 0;
  while (usedNames.has(name) && attempts < 20) {
    name = rng.pick(namePool);
    attempts++;
  }
  if (usedNames.has(name)) {
    name = `${name} ${rng.nextInt(2, 99)}`;
  }
  usedNames.add(name);
  return name;
}

export interface SegmentConfig {
  overrides: SegmentTraitOverrides[];
  weights: number[];
}

export function generatePersonas(
  count: number = 500,
  seed?: number,
  segmentConfig?: SegmentConfig,
  framework?: QuestionFramework,
): Persona[] {
  const rng = new SeededRandom(seed ?? Date.now());
  const personas: Persona[] = [];
  const usedNames = new Set<string>();

  if (segmentConfig && segmentConfig.overrides.length > 0) {
    // Split count across segments by weight
    const segmentCounts = distributeCount(count, segmentConfig.weights);

    let personaId = 1;
    for (let s = 0; s < segmentConfig.overrides.length; s++) {
      const override = segmentConfig.overrides[s];
      const segCount = segmentCounts[s];

      for (let i = 0; i < segCount; i++) {
        const persona = generateSinglePersona(rng, personaId, usedNames, override, framework);
        personas.push(persona);
        personaId++;
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      const persona = generateSinglePersona(rng, i + 1, usedNames, undefined, framework);
      personas.push(persona);
    }
  }

  return personas;
}

function distributeCount(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const normalized = weights.map((w) => w / sum);
  const counts = normalized.map((w) => Math.floor(w * total));

  // Distribute remaining to largest segments
  let remaining = total - counts.reduce((a, b) => a + b, 0);
  const fractional = normalized.map((w, i) => ({ i, frac: w * total - counts[i] }));
  fractional.sort((a, b) => b.frac - a.frac);
  for (let j = 0; j < remaining; j++) {
    counts[fractional[j].i]++;
  }

  return counts;
}

function generateSinglePersona(
  rng: SeededRandom,
  id: number,
  usedNames: Set<string>,
  segmentOverride?: SegmentTraitOverrides,
  framework?: QuestionFramework,
): Persona {
  const archetype: Archetype = rng.weightedChoice(ARCHETYPE_DISTRIBUTION);
  const profile = ARCHETYPE_TRAIT_PROFILES[archetype];

  const gender = segmentOverride?.gender
    ? rng.weightedChoice(segmentOverride.gender)
    : rng.weightedChoice(GENDER_DISTRIBUTION);
  const name = pickName(rng, gender, usedNames);

  const numericTraits: Partial<Record<NumericTraitKey, number>> = {};
  for (const key of NUMERIC_TRAIT_KEYS) {
    const dist = profile[key];
    const overrideMean = segmentOverride?.trait_mean_overrides?.[key];
    const mean = overrideMean !== undefined ? overrideMean : dist.mean;
    numericTraits[key] = rng.clampedGaussian(mean, dist.stddev, 0, 100);
  }

  const traits: PersonaTraits = {
    age_band: segmentOverride?.age_band
      ? rng.weightedChoice(segmentOverride.age_band)
      : rng.weightedChoice(AGE_BAND_DISTRIBUTION),
    gender,
    region: segmentOverride?.region
      ? rng.weightedChoice(segmentOverride.region)
      : rng.weightedChoice(REGION_DISTRIBUTION),
    urbanicity: segmentOverride?.urbanicity
      ? rng.weightedChoice(segmentOverride.urbanicity)
      : rng.weightedChoice(URBANICITY_DISTRIBUTION),
    income_band: segmentOverride?.income_band
      ? rng.weightedChoice(segmentOverride.income_band)
      : rng.weightedChoice(INCOME_BAND_DISTRIBUTION),
    education_level: segmentOverride?.education_level
      ? rng.weightedChoice(segmentOverride.education_level)
      : rng.weightedChoice(EDUCATION_LEVEL_DISTRIBUTION),
    household_type: segmentOverride?.household_type
      ? rng.weightedChoice(segmentOverride.household_type)
      : rng.weightedChoice(HOUSEHOLD_TYPE_DISTRIBUTION),
    channel_preference: rng.weightedChoice(CHANNEL_PREFERENCE_DISTRIBUTION),
    ...(numericTraits as Record<NumericTraitKey, number>),
  };

  const persona: Persona = {
    id,
    name,
    traits,
    archetype,
    bio: '',
    ...(segmentOverride ? { customSegment: segmentOverride.label } : {}),
  };

  persona.bio = generateBio(persona, rng, framework);
  return persona;
}
