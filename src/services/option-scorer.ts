import type OpenAI from 'openai';
import type { ParsedPoll, ScoredOptions, OptionScoreVector } from '../types';
import type { QuestionFramework } from '../types/poll';
import { CONSUMER_FALLBACK_FRAMEWORK } from './question-framework';

function buildSystemPrompt(framework: QuestionFramework): string {
  const dimDescriptions = framework.dimensions
    .map((d) => `- ${d.key}: ${d.description}`)
    .join('\n');

  return `You are an expert evaluator. Your job is to score poll options on perceptual dimensions relevant to the question domain.

For each option provided, score it 0-100 on these ${framework.dimensions.length} dimensions:
${dimDescriptions}

For yes/no and yes/maybe/no questions, score the options based on how the proposition itself feels:
- "Yes" represents endorsing the idea — score it based on how the product/idea feels
- "No" represents rejecting it — give it neutral/opposite scores
- "Maybe" should be scored between Yes and No

Return JSON: { "options": { "<option_text>": { "${framework.dimensions[0].key}": number, ... }, ... } }

Be thoughtful and specific. Score each dimension independently based on how the option genuinely performs on that axis.`;
}

function clampScore(val: unknown): number {
  const n = Number(val);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function validateOptionScores(raw: Record<string, unknown>, dimensionKeys: string[]): OptionScoreVector {
  const result: Record<string, number> = {};
  for (const dim of dimensionKeys) {
    result[dim] = clampScore(raw[dim]);
  }
  return result;
}

export async function scoreOptions(
  client: OpenAI,
  poll: ParsedPoll,
  framework?: QuestionFramework,
): Promise<ScoredOptions> {
  const fw = framework ?? CONSUMER_FALLBACK_FRAMEWORK;
  const dimensionKeys = fw.dimensions.map((d) => d.key);

  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: buildSystemPrompt(fw) },
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
      scoredOptions[option] = validateOptionScores(rawScores as Record<string, unknown>, dimensionKeys);
    } else {
      scoredOptions[option] = validateOptionScores({}, dimensionKeys);
    }
  }

  return { options: scoredOptions };
}
