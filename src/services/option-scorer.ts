import type OpenAI from 'openai';
import type { ParsedPoll, ScoredOptions, OptionScoreVector, OptionDimension } from '../types';

const DIMENSIONS: OptionDimension[] = [
  'category_fit', 'trustworthiness', 'clarity', 'memorability',
  'premium_feel', 'playfulness', 'weirdness', 'safety_mismatch', 'organic_fit',
];

const SYSTEM_PROMPT = `You are a brand strategist and consumer psychologist. Your job is to score poll options on perceptual dimensions.

For each option provided, score it 0-100 on these 9 dimensions:
- category_fit: How naturally it fits the product category (0=doesn't fit, 100=perfect fit)
- trustworthiness: How safe/institutional/established it feels (0=sketchy, 100=very trustworthy)
- clarity: How easy it is to understand what the product/choice is (0=confusing, 100=crystal clear)
- memorability: How sticky/catchy it is (0=forgettable, 100=unforgettable)
- premium_feel: How luxurious/high-end it feels (0=cheap, 100=premium)
- playfulness: How fun/whimsical it feels (0=serious, 100=very playful)
- weirdness: How unconventional/niche it is (0=mainstream, 100=very weird)
- safety_mismatch: How much it feels risky or off-brand for the category (0=safe, 100=alarming mismatch)
- organic_fit: How much it signals natural/health/eco values (0=none, 100=very organic/natural)

For yes/no and yes/maybe/no questions, score the options based on how the proposition itself feels:
- "Yes" represents endorsing the idea — score it based on how the product/idea feels
- "No" represents rejecting it — give it neutral/opposite scores
- "Maybe" should be scored between Yes and No

Return JSON: { "options": { "<option_text>": { "category_fit": number, ... }, ... } }

Be thoughtful and specific. A confusing or mismatched name should score high on safety_mismatch and weirdness. A clean, professional name should score high on trustworthiness and clarity.`;

function clampScore(val: unknown): number {
  const n = Number(val);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function validateOptionScores(raw: Record<string, unknown>): OptionScoreVector {
  const result: Record<string, number> = {};
  for (const dim of DIMENSIONS) {
    result[dim] = clampScore(raw[dim]);
  }
  return result as unknown as OptionScoreVector;
}

export async function scoreOptions(
  client: OpenAI,
  poll: ParsedPoll,
): Promise<ScoredOptions> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Category: ${poll.category}\nContext: ${poll.context}\nPoll type: ${poll.poll_type}\nOptions:\n${poll.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from option scorer');

  const parsed = JSON.parse(content);
  const rawOptions = parsed.options || parsed;

  const scoredOptions: Record<string, OptionScoreVector> = {};
  for (const option of poll.options) {
    const rawScores = rawOptions[option];
    if (rawScores && typeof rawScores === 'object') {
      scoredOptions[option] = validateOptionScores(rawScores as Record<string, unknown>);
    } else {
      // Fallback: neutral scores
      scoredOptions[option] = validateOptionScores({});
    }
  }

  return { options: scoredOptions };
}
