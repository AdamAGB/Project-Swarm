import type { LLMProvider } from './llm-providers';

/**
 * Fetches current web context for a question using a provider with search capabilities.
 * Returns a factual summary to inject into voting prompts.
 */

const CONTEXT_PROMPT = `You are a research assistant. The user is about to poll AI voters on a question. Your job is to provide brief, factual, current context about the topic so the voters can make informed decisions.

Rules:
- If the topic involves current events, recent data, or anything time-sensitive, provide the latest known facts
- If the topic is evergreen (e.g. "best pizza topping"), just return "No additional context needed."
- Keep it to 2-4 sentences max — factual, neutral, no opinions
- If you're unsure about current details, say so rather than guessing

Return JSON: { "needsContext": boolean, "context": "Your factual summary or empty string" }`;

export async function fetchWebContext(
  provider: LLMProvider,
  question: string,
  options: string[],
): Promise<string | null> {
  try {
    const content = await provider.complete(
      [
        { role: 'system', content: CONTEXT_PROMPT },
        {
          role: 'user',
          content: `Question: "${question}"\nOptions: ${options.join(', ')}`,
        },
      ],
      { temperature: 0, jsonMode: true },
    );

    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.needsContext) return null;
    const ctx = String(parsed.context ?? '').trim();
    return ctx.length > 0 ? ctx : null;
  } catch (err) {
    console.warn('[web-context] Failed to fetch context:', err);
    return null;
  }
}
