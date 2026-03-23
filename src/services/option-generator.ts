import type OpenAI from 'openai';
import type { Attachment } from '../types/attachments';
import { buildUserContent } from './attachments';

const MAX_ATTEMPTS = 3;

export async function generateOptions(
  client: OpenAI,
  question: string,
  attachments: Attachment[] = [],
): Promise<string[]> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages: [
          {
            role: 'system',
            content:
              'You generate concise polling answer options for survey questions. Given a question, produce 3-5 short, distinct answer options that cover the realistic range of responses. Return JSON: { "options": ["Option 1", "Option 2", ...] }. Each option should be 1-5 words. Do not number them. CRITICAL: Options must be specific, concrete things — not abstract categories. Say "Golden Retriever" not "Medium-sized calm breed". Say "The Godfather" not "Classic crime drama". Always name real, specific things. If the question is too vague or references something not provided, include one option like "Need more context". Only do this when the question genuinely cannot be answered well.',
          },
          { role: 'user', content: buildUserContent(question, attachments) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[option-gen] Attempt ${attempt}: empty response`);
        continue;
      }

      const parsed = JSON.parse(content);
      const options = parsed.options;

      if (
        Array.isArray(options) &&
        options.length >= 3 &&
        options.length <= 5 &&
        options.every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0)
      ) {
        return options.map((o: string) => o.trim());
      }

      console.warn(`[option-gen] Attempt ${attempt}: invalid shape`, options);
    } catch (err) {
      lastError = err;
      console.warn(`[option-gen] Attempt ${attempt}: error`, err);
    }
  }

  const detail = lastError instanceof Error ? `: ${lastError.message}` : '';
  throw new Error(`Failed to generate polling options after retries${detail}`);
}

/**
 * Generate an expanded set of options (10-12) for the advanced editing pool.
 * Returns { shown: string[], pool: string[] } where shown is the first 4
 * and pool is the remainder for per-option refresh.
 */
export async function generateOptionsExpanded(
  client: OpenAI,
  question: string,
  attachments: Attachment[] = [],
): Promise<{ shown: string[]; pool: string[] }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages: [
          {
            role: 'system',
            content:
              'You generate concise polling answer options for survey questions. Given a question, produce 12 short, distinct answer options that cover a wide range of realistic and creative responses. Return JSON: { "options": ["Option 1", "Option 2", ...] }. Each option should be 1-5 words. Do not number them. All 12 options must be meaningfully different from each other. If the question is too vague, references something not provided (e.g. "this pitch", "the proposal", "our product" with no details), or lacks the context needed to form a meaningful opinion, include one option like "Need more context" or "Can\'t evaluate without details". Only do this when the question genuinely cannot be answered well — not for straightforward questions like "Cats or dogs?".',
          },
          { role: 'user', content: buildUserContent(question, attachments) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[option-gen-expanded] Attempt ${attempt}: empty response`);
        continue;
      }

      const parsed = JSON.parse(content);
      const options = parsed.options;

      if (
        Array.isArray(options) &&
        options.length >= 6 &&
        options.every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0)
      ) {
        const trimmed = options.map((o: string) => o.trim());
        return { shown: trimmed.slice(0, 4), pool: trimmed.slice(4) };
      }

      console.warn(`[option-gen-expanded] Attempt ${attempt}: invalid shape`, options);
    } catch (err) {
      console.warn(`[option-gen-expanded] Attempt ${attempt}: error`, err);
    }
  }

  // Fallback to normal generator if expanded fails
  const fallback = await generateOptions(client, question, attachments);
  return { shown: fallback, pool: [] };
}
