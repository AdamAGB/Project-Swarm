import type { LLMProvider } from './llm-providers';

/**
 * Fetches current web context for a question.
 * Uses Gemini with Google Search grounding when a Gemini key is available,
 * otherwise falls back to a regular provider call.
 */

const CONTEXT_PROMPT = `You are a research assistant. The user is about to poll AI voters on a question. Your job is to provide brief, factual, current context about the topic so the voters can make informed decisions.

Rules:
- If the topic involves current events, recent data, or anything time-sensitive, provide the latest known facts
- If the topic is evergreen (e.g. "best pizza topping"), just return "No additional context needed."
- Keep it to 3-5 sentences max — factual, neutral, no opinions
- Include specific names, dates, numbers when available
- If you're unsure about current details, say so rather than guessing

Return JSON: { "needsContext": boolean, "context": "Your factual summary or empty string" }`;

/**
 * Call Gemini native API with Google Search grounding enabled.
 * This gives the model access to live web search results.
 */
async function fetchWithGeminiGrounding(
  geminiKey: string,
  question: string,
  options: string[],
): Promise<string | null> {
  const userMessage = `Question: "${question}"\nOptions: ${options.join(', ')}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: CONTEXT_PROMPT }],
        },
        contents: [
          { role: 'user', parts: [{ text: userMessage }] },
        ],
        tools: [
          { google_search: {} },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini grounding ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ?? null;
}

/**
 * Fetch web context. Tries Gemini with search grounding first (for live web results),
 * falls back to regular provider call (training data only).
 */
/**
 * Try server-side grounding endpoint (for hosted/subscriber mode).
 */
async function fetchViaServerProxy(
  question: string,
  options: string[],
  auth: { inviteCode?: string; subscriberEmail?: string },
): Promise<string | null> {
  const res = await fetch('/api/web-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, options, ...auth }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.context ?? null;
}

export async function fetchWebContext(
  fallbackProvider: LLMProvider,
  question: string,
  options: string[],
  geminiKey?: string,
  serverAuth?: { inviteCode?: string; subscriberEmail?: string },
): Promise<string | null> {
  try {
    // Try direct Gemini grounding (BYOK mode)
    if (geminiKey) {
      try {
        const content = await fetchWithGeminiGrounding(geminiKey, question, options);
        if (content) {
          const parsed = JSON.parse(content);
          if (!parsed.needsContext) return null;
          const ctx = String(parsed.context ?? '').trim();
          if (ctx.length > 0) return ctx;
        }
      } catch (err) {
        console.warn('[web-context] Gemini grounding failed, falling back:', err);
      }
    }

    // Try server proxy (hosted/subscriber mode)
    if (serverAuth && (serverAuth.inviteCode || serverAuth.subscriberEmail)) {
      try {
        const ctx = await fetchViaServerProxy(question, options, serverAuth);
        if (ctx) return ctx;
      } catch (err) {
        console.warn('[web-context] Server proxy failed, falling back:', err);
      }
    }

    // Final fallback: regular provider (training data only)
    const content = await fallbackProvider.complete(
      [
        { role: 'system', content: CONTEXT_PROMPT },
        { role: 'user', content: `Question: "${question}"\nOptions: ${options.join(', ')}` },
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
