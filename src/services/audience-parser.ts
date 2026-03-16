import type OpenAI from 'openai';
import type { SegmentTraitOverrides } from '../types';

const SYSTEM_PROMPT = `You convert natural-language audience segment descriptions into demographic and psychographic trait distribution overrides.

You will receive an array of segment descriptions. For each segment, return overrides ONLY for traits that meaningfully differ from the US general population.

Return a JSON object with a "segments" array. Each segment object has:
- "label": a short 2-4 word label for this segment
- Categorical overrides (only include if they differ from general population):
  - "age_band": array of {value, weight} where value is one of: "18-24", "25-34", "35-44", "45-54", "55-64", "65+"
  - "gender": array of {value, weight} where value is one of: "male", "female", "non_binary"
  - "region": array of {value, weight} where value is one of: "northeast", "southeast", "midwest", "southwest", "west", "pacific"
  - "urbanicity": array of {value, weight} where value is one of: "urban", "suburban", "rural"
  - "income_band": array of {value, weight} where value is one of: "under_25k", "25k_50k", "50k_75k", "75k_100k", "100k_150k", "150k_plus"
  - "education_level": array of {value, weight} where value is one of: "high_school", "some_college", "bachelors", "masters", "doctorate"
  - "household_type": array of {value, weight} where value is one of: "single", "couple_no_kids", "young_family", "established_family", "empty_nester", "retired"
- "trait_mean_overrides": object mapping numeric trait keys to override mean values (0-100). Only include traits that differ meaningfully.
  Available numeric trait keys: price_sensitivity, brand_loyalty, novelty_seeking, risk_tolerance, convenience_orientation, quality_orientation, value_orientation, habit_inertia, social_proof_sensitivity, trust_in_brands, health_consciousness, status_seeking, sustainability_concern, promotion_sensitivity, premium_willingness, ad_skepticism, attention_level, survey_fatigue_susceptibility, social_desirability_bias, verbosity, certainty_level, contrarian_tendency, response_randomness, shopping_frequency_level, research_depth, budget_pressure, trial_openness, recommendation_likelihood_baseline

Rules:
- Weights in each categorical array must sum to 1.0
- Only include categorical fields where the distribution meaningfully differs from general US population
- Only include trait_mean_overrides for traits that clearly relate to the segment description
- Be realistic and grounded in demographic data
- Each segment must have a "label" field`;

export async function parseAudienceSegments(
  client: OpenAI,
  segmentDescriptions: string[],
): Promise<SegmentTraitOverrides[]> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Segment descriptions:\n${JSON.stringify(segmentDescriptions)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from audience parser');

  const parsed = JSON.parse(content);
  const segments: SegmentTraitOverrides[] = parsed.segments;

  if (!Array.isArray(segments) || segments.length !== segmentDescriptions.length) {
    throw new Error('Audience parser returned unexpected number of segments');
  }

  // Validate each segment has a label
  for (let i = 0; i < segments.length; i++) {
    if (!segments[i].label) {
      segments[i].label = segmentDescriptions[i].slice(0, 30);
    }
  }

  return segments;
}
