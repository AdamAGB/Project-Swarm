/* ------------------------------------------------------------------ */
/*  Multi-LLM provider abstraction                                     */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}

export interface LLMProvider {
  name: string;
  complete(messages: ChatMessage[], options?: ChatOptions): Promise<string | null>;
}

/* ------------------------------------------------------------------ */
/*  OpenAI                                                             */
/* ------------------------------------------------------------------ */

export function createOpenAIProvider(apiKey: string, model = 'gpt-5.4-mini'): LLMProvider {
  return {
    name: 'OpenAI',
    async complete(messages, options = {}) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI ${res.status}: ${err}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? null;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Anthropic (Claude)                                                 */
/* ------------------------------------------------------------------ */

export function createClaudeProvider(apiKey: string, model = 'claude-sonnet-4-20250514'): LLMProvider {
  return {
    name: 'Claude',
    async complete(messages, options = {}) {
      // Anthropic API separates system from user messages
      const systemMsg = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const userMsgs = messages.filter((m) => m.role === 'user').map((m) => ({
        role: 'user' as const,
        content: m.content,
      }));

      const body: Record<string, unknown> = {
        model,
        max_tokens: options.maxTokens ?? 4096,
        messages: userMsgs,
        ...(systemMsg ? { system: systemMsg } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      };

      // Claude doesn't have json_mode — we rely on the prompt to return JSON
      // But we can add a prefill to nudge it
      if (options.jsonMode) {
        body.messages = [
          ...userMsgs,
          { role: 'assistant', content: '{' },
        ];
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude ${res.status}: ${err}`);
      }
      const data = await res.json();
      const text = data.content?.[0]?.text ?? null;

      // If we prefilled with '{', prepend it back
      if (options.jsonMode && text) {
        return '{' + text;
      }
      return text;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Google Gemini (OpenAI-compatible endpoint)                         */
/* ------------------------------------------------------------------ */

export function createGeminiProvider(apiKey: string, model = 'gemini-2.5-flash'): LLMProvider {
  return {
    name: 'Gemini',
    async complete(messages, options = {}) {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini ${res.status}: ${err}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? null;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get all available providers from the keys the user has entered */
/* ------------------------------------------------------------------ */
/*  Demo mode (proxied through Vercel API route)                       */
/* ------------------------------------------------------------------ */

function createDemoProvider(inviteCode: string, providerName: 'openai' | 'anthropic' | 'gemini', displayName: string): LLMProvider {
  return {
    name: displayName,
    async complete(messages, options = {}) {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode,
          provider: providerName,
          messages,
          temperature: options.temperature,
          jsonMode: options.jsonMode,
          maxTokens: options.maxTokens,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Demo proxy ${res.status}`);
      }
      const data = await res.json();
      return data.content ?? null;
    },
  };
}

/** Get providers for demo mode (using invite code through server proxy) */
export function getDemoProviders(inviteCode: string): LLMProvider[] {
  return [
    createDemoProvider(inviteCode, 'openai', 'OpenAI'),
    createDemoProvider(inviteCode, 'anthropic', 'Claude'),
    createDemoProvider(inviteCode, 'gemini', 'Gemini'),
  ];
}

/** Get providers for subscriber mode (using email through server proxy) */
function createSubscriberProvider(email: string, providerName: 'openai' | 'anthropic' | 'gemini', displayName: string): LLMProvider {
  return {
    name: displayName,
    async complete(messages, options = {}) {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriberEmail: email,
          provider: providerName,
          messages,
          temperature: options.temperature,
          jsonMode: options.jsonMode,
          maxTokens: options.maxTokens,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Subscriber proxy ${res.status}`);
      }
      const data = await res.json();
      return data.content ?? null;
    },
  };
}

export function getSubscriberProviders(email: string): LLMProvider[] {
  return [
    createSubscriberProvider(email, 'openai', 'OpenAI'),
    createSubscriberProvider(email, 'anthropic', 'Claude'),
    createSubscriberProvider(email, 'gemini', 'Gemini'),
  ];
}

/** Get all available providers from the keys the user has entered */
export function getAvailableProviders(keys: {
  openai?: string;
  anthropic?: string;
  gemini?: string;
}): LLMProvider[] {
  const providers: LLMProvider[] = [];
  if (keys.openai) providers.push(createOpenAIProvider(keys.openai));
  if (keys.anthropic) providers.push(createClaudeProvider(keys.anthropic));
  if (keys.gemini) providers.push(createGeminiProvider(keys.gemini));
  return providers;
}

/** Run a task across multiple providers in parallel, return all successful results */
export async function runAcrossProviders<T>(
  providers: LLMProvider[],
  task: (provider: LLMProvider) => Promise<T>,
): Promise<{ provider: string; result: T }[]> {
  const results = await Promise.allSettled(
    providers.map(async (p) => ({
      provider: p.name,
      result: await task(p),
    })),
  );
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<{ provider: string; result: T }>).value);
}
