import type OpenAI from 'openai';
import type { ParsedPoll } from '../types';

const SYSTEM_PROMPT = `You parse natural-language poll questions into structured JSON objects.

Return a JSON object with these fields:
- "poll_type": one of "forced_choice", "yes_no", or "yes_maybe_no"
- "category": a short category label (e.g. "pet_food", "technology", "health", "entertainment", "finance", "food_beverage")
- "context": a clean 1-sentence description of what's being asked about

Rules:
- If the user provides explicit options, you do NOT need to extract them (they are provided separately)
- Determine the poll_type based on the nature of the question
- The context should capture the product/idea being evaluated
- Keep category short and lowercase with underscores`;

export async function parseQuestion(
  client: OpenAI,
  rawQuestion: string,
  userOptions: string[],
  allowMultiple: boolean,
): Promise<ParsedPoll> {
  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Question: ${rawQuestion}\nUser-provided options: ${userOptions.join(', ')}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from question parser');

  const parsed = JSON.parse(content);

  return {
    poll_type: parsed.poll_type || 'forced_choice',
    category: String(parsed.category || 'general'),
    context: String(parsed.context || rawQuestion),
    options: userOptions,
    original_question: rawQuestion,
    allowMultiple,
  };
}
