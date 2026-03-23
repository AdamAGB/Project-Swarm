import type OpenAI from 'openai';
import type { PriorResult } from '../types/v2';

const MAX_ATTEMPTS = 3;

const SYSTEM_PROMPT = `You estimate the baseline public response to a poll question — before considering any specific audience segment, personality, or demographic.

Given a question and answer options, return a probability distribution representing what the general public would likely choose, along with a confidence score.

Guidelines:
- Use your knowledge of real-world public opinion, cultural consensus, and known sentiment when relevant. For example, if a topic is widely loved or widely disliked, the prior should strongly reflect that — do not artificially balance it.
- For vague or context-free questions (e.g. "what do you think of this pitch?" with no pitch provided), assign higher probability to cautious or hedging options like "Need more context" or "Can't evaluate"
- For clear, well-defined questions, distribute probability based on what common sense, general knowledge, and known public sentiment suggest
- Be honest and direct — if something is widely disliked, the distribution should reflect that. Do not soften or hedge when public opinion is well-established.
- Probabilities must be positive and sum to 1.0

Confidence score (0.0 to 1.0):
- 0.0–0.2: No basis to judge — question is too vague, references missing context, or is entirely novel with no known public opinion
- 0.3–0.5: Mild lean — some common-sense intuition but no strong consensus (e.g. "which color is better?")
- 0.6–0.8: Clear consensus — well-known public opinion or obvious common-sense answer (e.g. widely disliked movie, popular product)
- 0.9–1.0: Overwhelming consensus — near-universal agreement (e.g. "is clean water good?")

Return JSON: { "priors": { "Option text": probability, ... }, "confidence": number }`;

function uniformFallback(options: string[]): PriorResult {
  const p = 1 / options.length;
  const distribution: Record<string, number> = {};
  for (const opt of options) {
    distribution[opt] = p;
  }
  return { distribution, confidence: 0 };
}

function validateAndNormalize(
  raw: Record<string, unknown>,
  options: string[],
): PriorResult | null {
  const priors = raw.priors as Record<string, unknown> | undefined;
  if (!priors || typeof priors !== 'object') return null;

  const distribution: Record<string, number> = {};
  let sum = 0;

  for (const opt of options) {
    const val = Number(priors[opt]);
    if (isNaN(val) || val < 0) return null;
    distribution[opt] = val;
    sum += val;
  }

  if (sum <= 0) return null;

  // Normalize to sum to 1.0
  for (const opt of options) {
    distribution[opt] /= sum;
  }

  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));

  return { distribution, confidence };
}

export async function generatePrior(
  client: OpenAI,
  question: string,
  options: string[],
): Promise<PriorResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Question: "${question}"\nOptions:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[prior-gen] Attempt ${attempt}: empty response`);
        continue;
      }

      const parsed = JSON.parse(content);
      const result = validateAndNormalize(parsed, options);
      if (result) return result;

      console.warn(`[prior-gen] Attempt ${attempt}: validation failed`);
    } catch (err) {
      console.warn(`[prior-gen] Attempt ${attempt}: error`, err);
    }
  }

  // Fallback: uniform distribution with zero confidence (no-op prior)
  return uniformFallback(options);
}
