import type OpenAI from 'openai';
import type { ParsedPoll, QuestionFramework, DimensionDef } from '../types';
import type { NumericTraitKey, Archetype } from '../types';

const VALID_TRAIT_KEYS: Set<string> = new Set([
  'price_sensitivity', 'brand_loyalty', 'novelty_seeking', 'risk_tolerance',
  'convenience_orientation', 'quality_orientation', 'value_orientation', 'habit_inertia',
  'social_proof_sensitivity', 'trust_in_brands', 'health_consciousness', 'status_seeking',
  'sustainability_concern', 'promotion_sensitivity', 'premium_willingness',
  'ad_skepticism', 'attention_level', 'survey_fatigue_susceptibility',
  'social_desirability_bias', 'verbosity', 'certainty_level', 'contrarian_tendency',
  'response_randomness', 'shopping_frequency_level', 'research_depth',
  'budget_pressure', 'trial_openness', 'recommendation_likelihood_baseline',
]);

const VALID_ARCHETYPES: Archetype[] = [
  'budget_conscious_pragmatist', 'premium_curious_trend_seeker',
  'brand_loyal_mainstream_buyer', 'health_focused_skeptic', 'convenience_first_shopper',
];

const SYSTEM_PROMPT = `You generate evaluation frameworks for poll questions across any domain.

You have 28 personality trait axes (each 0-100) that define synthetic personas:
- price_sensitivity, brand_loyalty, novelty_seeking, risk_tolerance
- convenience_orientation, quality_orientation, value_orientation, habit_inertia
- social_proof_sensitivity, trust_in_brands, health_consciousness, status_seeking
- sustainability_concern, promotion_sensitivity, premium_willingness
- ad_skepticism, attention_level, survey_fatigue_susceptibility
- social_desirability_bias, verbosity, certainty_level, contrarian_tendency
- response_randomness, shopping_frequency_level, research_depth
- budget_pressure, trial_openness, recommendation_likelihood_baseline

There are 5 archetype behavioral profiles (internal IDs shown — you provide display labels):
1. budget_conscious_pragmatist — cautious, value-driven, high price sensitivity, low risk tolerance, sticks with what works
2. premium_curious_trend_seeker — adventurous, high novelty seeking, status-oriented, willing to pay more, loves discovering new things
3. brand_loyal_mainstream_buyer — trusts established options, high habit inertia, follows social proof, values reliability
4. health_focused_skeptic — analytical, skeptical of marketing, high research depth, quality-oriented, independent thinker
5. convenience_first_shopper — time-optimizing, low research depth, goes with what's easy/familiar, moderate on most traits

Your job: given a poll question, generate an evaluation framework with dimensions relevant to that question's domain.

Return JSON with this exact structure:
{
  "domain": "short domain label",
  "dimensions": [
    { "key": "snake_case_key", "label": "Human Label", "description": "What 0 means vs what 100 means" }
  ],
  "weightMatrix": {
    "dimension_key": [["trait_key", multiplier], ...]
  },
  "baselineWeights": { "dimension_key": number },
  "archetypeLabels": {
    "budget_conscious_pragmatist": "Domain-Appropriate Label",
    "premium_curious_trend_seeker": "Domain-Appropriate Label",
    "brand_loyal_mainstream_buyer": "Domain-Appropriate Label",
    "health_focused_skeptic": "Domain-Appropriate Label",
    "convenience_first_shopper": "Domain-Appropriate Label"
  },
  "archetypeDescriptions": {
    "budget_conscious_pragmatist": "1-2 sentence personality description for comment generation",
    "premium_curious_trend_seeker": "...",
    "brand_loyal_mainstream_buyer": "...",
    "health_focused_skeptic": "...",
    "convenience_first_shopper": "..."
  },
  "segmentTraits": [
    { "key": "trait_key", "label": "Human Label" }
  ]
}

Rules:
- Generate 6-9 dimensions relevant to the question domain
- Each dimension's weightMatrix entry should have 3-6 trait mappings with multipliers between -1 and 1
- baselineWeights: pick 2-4 dimensions that matter to everyone (values between -0.15 and 0.15)
- segmentTraits: pick 6-8 traits most relevant for segmenting responses in this domain
- Archetype labels should map the behavioral profiles to the question domain naturally
- All trait keys must be from the 28 listed above
- All 5 archetype keys must be present`;

function validateFramework(raw: Record<string, unknown>): QuestionFramework | null {
  try {
    const domain = String(raw.domain || 'general');

    // Validate dimensions
    const rawDims = raw.dimensions;
    if (!Array.isArray(rawDims) || rawDims.length < 6 || rawDims.length > 9) return null;
    const dimensions: DimensionDef[] = rawDims.map((d: Record<string, unknown>) => ({
      key: String(d.key),
      label: String(d.label),
      description: String(d.description),
    }));
    const dimKeys = new Set(dimensions.map((d) => d.key));

    // Validate weight matrix
    const rawMatrix = raw.weightMatrix as Record<string, unknown>;
    if (!rawMatrix || typeof rawMatrix !== 'object') return null;
    const weightMatrix: Record<string, [NumericTraitKey, number][]> = {};
    for (const dimKey of dimKeys) {
      const entries = rawMatrix[dimKey];
      if (!Array.isArray(entries)) return null;
      weightMatrix[dimKey] = entries
        .filter((e: unknown[]) => Array.isArray(e) && e.length === 2 && VALID_TRAIT_KEYS.has(String(e[0])))
        .map((e: unknown[]) => [String(e[0]) as NumericTraitKey, Math.max(-1, Math.min(1, Number(e[1])))]);
      if (weightMatrix[dimKey].length === 0) return null;
    }

    // Validate baseline weights
    const rawBaseline = raw.baselineWeights as Record<string, unknown>;
    const baselineWeights: Record<string, number> = {};
    if (rawBaseline && typeof rawBaseline === 'object') {
      for (const [k, v] of Object.entries(rawBaseline)) {
        if (dimKeys.has(k)) {
          baselineWeights[k] = Math.max(-0.15, Math.min(0.15, Number(v)));
        }
      }
    }

    // Validate archetype labels
    const rawLabels = raw.archetypeLabels as Record<string, unknown>;
    if (!rawLabels || typeof rawLabels !== 'object') return null;
    const archetypeLabels = {} as Record<Archetype, string>;
    for (const arch of VALID_ARCHETYPES) {
      if (!rawLabels[arch]) return null;
      archetypeLabels[arch] = String(rawLabels[arch]);
    }

    // Validate archetype descriptions
    const rawDescs = raw.archetypeDescriptions as Record<string, unknown>;
    if (!rawDescs || typeof rawDescs !== 'object') return null;
    const archetypeDescriptions = {} as Record<Archetype, string>;
    for (const arch of VALID_ARCHETYPES) {
      if (!rawDescs[arch]) return null;
      archetypeDescriptions[arch] = String(rawDescs[arch]);
    }

    // Validate segment traits
    const rawSegTraits = raw.segmentTraits;
    if (!Array.isArray(rawSegTraits)) return null;
    const segmentTraits = rawSegTraits
      .filter((t: Record<string, unknown>) => VALID_TRAIT_KEYS.has(String(t.key)))
      .map((t: Record<string, unknown>) => ({ key: String(t.key) as NumericTraitKey, label: String(t.label) }));
    if (segmentTraits.length < 4) return null;

    return { domain, dimensions, weightMatrix, baselineWeights, archetypeLabels, archetypeDescriptions, segmentTraits };
  } catch {
    return null;
  }
}

export const CONSUMER_FALLBACK_FRAMEWORK: QuestionFramework = {
  domain: 'consumer',
  dimensions: [
    { key: 'category_fit', label: 'Category Fit', description: 'How naturally it fits the product category (0=doesn\'t fit, 100=perfect fit)' },
    { key: 'trustworthiness', label: 'Trustworthiness', description: 'How safe/institutional/established it feels (0=sketchy, 100=very trustworthy)' },
    { key: 'clarity', label: 'Clarity', description: 'How easy it is to understand what the product/choice is (0=confusing, 100=crystal clear)' },
    { key: 'memorability', label: 'Memorability', description: 'How sticky/catchy it is (0=forgettable, 100=unforgettable)' },
    { key: 'premium_feel', label: 'Premium Feel', description: 'How luxurious/high-end it feels (0=cheap, 100=premium)' },
    { key: 'playfulness', label: 'Playfulness', description: 'How fun/whimsical it feels (0=serious, 100=very playful)' },
    { key: 'weirdness', label: 'Weirdness', description: 'How unconventional/niche it is (0=mainstream, 100=very weird)' },
    { key: 'safety_mismatch', label: 'Safety Mismatch', description: 'How much it feels risky or off-brand for the category (0=safe, 100=alarming mismatch)' },
    { key: 'organic_fit', label: 'Organic Fit', description: 'How much it signals natural/health/eco values (0=none, 100=very organic/natural)' },
  ],
  weightMatrix: {
    category_fit: [['attention_level', 0.4], ['research_depth', 0.3], ['trust_in_brands', 0.2], ['habit_inertia', 0.2]],
    trustworthiness: [['trust_in_brands', 0.8], ['ad_skepticism', -0.5], ['risk_tolerance', -0.3], ['social_proof_sensitivity', 0.4], ['brand_loyalty', 0.5], ['habit_inertia', 0.3]],
    clarity: [['attention_level', 0.5], ['survey_fatigue_susceptibility', 0.4], ['convenience_orientation', 0.4], ['research_depth', -0.2], ['novelty_seeking', -0.2]],
    memorability: [['novelty_seeking', 0.6], ['social_proof_sensitivity', 0.3], ['habit_inertia', -0.3], ['attention_level', 0.3], ['status_seeking', 0.2]],
    premium_feel: [['premium_willingness', 0.9], ['status_seeking', 0.7], ['price_sensitivity', -0.8], ['budget_pressure', -0.6], ['quality_orientation', 0.4], ['value_orientation', -0.3]],
    playfulness: [['novelty_seeking', 0.7], ['risk_tolerance', 0.3], ['contrarian_tendency', 0.3], ['habit_inertia', -0.4], ['ad_skepticism', -0.2], ['trial_openness', 0.3]],
    weirdness: [['novelty_seeking', 0.5], ['contrarian_tendency', 0.6], ['risk_tolerance', 0.4], ['social_proof_sensitivity', -0.7], ['habit_inertia', -0.5], ['social_desirability_bias', -0.4], ['trust_in_brands', -0.3]],
    safety_mismatch: [['risk_tolerance', 0.5], ['trust_in_brands', -0.6], ['health_consciousness', -0.5], ['ad_skepticism', 0.2], ['quality_orientation', -0.4], ['brand_loyalty', -0.3]],
    organic_fit: [['health_consciousness', 0.8], ['sustainability_concern', 0.7], ['quality_orientation', 0.3], ['price_sensitivity', -0.3], ['premium_willingness', 0.3], ['value_orientation', 0.2]],
  },
  baselineWeights: {
    category_fit: 0.15,
    clarity: 0.10,
    trustworthiness: 0.08,
    safety_mismatch: -0.12,
  },
  archetypeLabels: {
    budget_conscious_pragmatist: 'Budget Conscious Pragmatist',
    premium_curious_trend_seeker: 'Premium Curious Trend Seeker',
    brand_loyal_mainstream_buyer: 'Brand Loyal Mainstream Buyer',
    health_focused_skeptic: 'Health-Focused Skeptic',
    convenience_first_shopper: 'Convenience-First Shopper',
  },
  archetypeDescriptions: {
    budget_conscious_pragmatist: 'Budget Conscious Pragmatists focus on value, deals, and practical concerns.',
    premium_curious_trend_seeker: 'Premium Curious Trend Seekers focus on novelty, branding, and excitement.',
    brand_loyal_mainstream_buyer: 'Brand Loyal Mainstream Buyers focus on familiarity, trust, and reliability.',
    health_focused_skeptic: 'Health-Focused Skeptics focus on safety, ingredients, transparency, and are wary of marketing.',
    convenience_first_shopper: 'Convenience-First Shoppers focus on simplicity, speed, and ease of understanding.',
  },
  segmentTraits: [
    { key: 'novelty_seeking', label: 'Novelty Seeking' },
    { key: 'trust_in_brands', label: 'Trust in Brands' },
    { key: 'premium_willingness', label: 'Premium Willingness' },
    { key: 'price_sensitivity', label: 'Price Sensitivity' },
    { key: 'health_consciousness', label: 'Health Consciousness' },
    { key: 'risk_tolerance', label: 'Risk Tolerance' },
    { key: 'brand_loyalty', label: 'Brand Loyalty' },
    { key: 'convenience_orientation', label: 'Convenience Orientation' },
  ],
};

export async function generateQuestionFramework(
  client: OpenAI,
  poll: ParsedPoll,
): Promise<QuestionFramework> {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Question: "${poll.original_question}"\nCategory: ${poll.category}\nContext: ${poll.context}\nOptions: ${poll.options.join(', ')}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return CONSUMER_FALLBACK_FRAMEWORK;

    const parsed = JSON.parse(content);
    const framework = validateFramework(parsed);
    return framework ?? CONSUMER_FALLBACK_FRAMEWORK;
  } catch {
    return CONSUMER_FALLBACK_FRAMEWORK;
  }
}
