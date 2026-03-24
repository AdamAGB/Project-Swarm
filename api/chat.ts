import type { VercelRequest, VercelResponse } from '@vercel/node';

/* ------------------------------------------------------------------ */
/*  Rate limiting (in-memory, resets on cold start)                     */
/* ------------------------------------------------------------------ */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;       // max polls per window
const RATE_WINDOW_MS = 3600_000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Provider routing                                                   */
/* ------------------------------------------------------------------ */

interface ChatRequest {
  inviteCode?: string;
  subscriberEmail?: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  messages: { role: string; content: string }[];
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}

async function callOpenAI(
  apiKey: string,
  messages: ChatRequest['messages'],
  opts: { temperature?: number; jsonMode?: boolean; maxTokens?: number },
): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages,
      temperature: opts.temperature ?? 0.7,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function callClaude(
  apiKey: string,
  messages: ChatRequest['messages'],
  opts: { temperature?: number; jsonMode?: boolean; maxTokens?: number },
): Promise<string | null> {
  const systemMsg = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const userMsgs = messages.filter((m) => m.role === 'user').map((m) => ({
    role: 'user' as const,
    content: m.content,
  }));

  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: opts.maxTokens ?? 4096,
    messages: userMsgs,
    ...(systemMsg ? { system: systemMsg } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };

  if (opts.jsonMode) {
    body.messages = [...userMsgs, { role: 'assistant', content: '{' }];
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? null;
  return opts.jsonMode && text ? '{' + text : text;
}

async function callGemini(
  apiKey: string,
  messages: ChatRequest['messages'],
  opts: { temperature?: number; jsonMode?: boolean; maxTokens?: number },
): Promise<string | null> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages,
      temperature: opts.temperature ?? 0.7,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body as ChatRequest;

  // Validate access: invite code OR active subscriber
  const validCode = process.env.INVITE_CODE;
  const hasValidInvite = validCode && body.inviteCode === validCode;

  let hasValidSubscription = false;
  if (!hasValidInvite && body.subscriberEmail) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(stripeKey);
        const customers = await stripe.customers.list({ email: body.subscriberEmail.toLowerCase().trim(), limit: 1 });
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: 'active', limit: 1 });
          hasValidSubscription = subs.data.length > 0;
        }
      } catch (err) {
        console.error('[chat] Stripe check failed:', err);
      }
    }
  }

  if (!hasValidInvite && !hasValidSubscription) {
    return res.status(403).json({ error: 'Invalid access' });
  }

  // Rate limit
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in an hour.' });
  }

  // Validate provider
  const { provider, messages, temperature, jsonMode, maxTokens } = body;
  if (!['openai', 'anthropic', 'gemini'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  // Get API key from env
  const keyMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  const apiKey = keyMap[provider];
  if (!apiKey) {
    return res.status(503).json({ error: `${provider} not configured` });
  }

  try {
    const opts = { temperature, jsonMode, maxTokens };
    let content: string | null = null;

    if (provider === 'openai') content = await callOpenAI(apiKey, messages, opts);
    else if (provider === 'anthropic') content = await callClaude(apiKey, messages, opts);
    else if (provider === 'gemini') content = await callGemini(apiKey, messages, opts);

    return res.status(200).json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[chat] ${provider} error:`, message);
    return res.status(502).json({ error: message });
  }
}
