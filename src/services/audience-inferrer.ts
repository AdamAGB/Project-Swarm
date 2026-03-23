import type OpenAI from 'openai';

interface AudienceInference {
  shouldTarget: boolean;
  segmentDescription: string | null;
}

const SYSTEM_PROMPT = `You detect whether a poll question implies a specific target audience.

Return a JSON object with:
- "shouldTarget": true if the question implies a specific demographic, age group, profession, or lifestyle segment
- "segmentDescription": a natural-language audience description (e.g. "College students aged 18-24", "Parents with children under 12", "PC gamers aged 18-35"), or null if shouldTarget is false

Examples:
- "Which name is best for a college student app?" → { "shouldTarget": true, "segmentDescription": "College students aged 18-24" }
- "Which logo looks best?" → { "shouldTarget": false, "segmentDescription": null }
- "What should I name my kids' coding school?" → { "shouldTarget": true, "segmentDescription": "Parents with children aged 6-14 interested in education" }
- "Best name for a senior fitness app?" → { "shouldTarget": true, "segmentDescription": "Adults aged 60+ interested in fitness and health" }

Only return shouldTarget: true when there is a clearly implied audience. Generic questions should return false.`;

export async function inferAudience(
  client: OpenAI,
  question: string,
): Promise<AudienceInference> {
  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: question },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 150,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return { shouldTarget: false, segmentDescription: null };

  const parsed = JSON.parse(content);
  return {
    shouldTarget: Boolean(parsed.shouldTarget),
    segmentDescription: parsed.shouldTarget ? String(parsed.segmentDescription) : null,
  };
}
