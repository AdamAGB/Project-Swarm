import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, options, inviteCode, subscriberEmail } = req.body;
  if (!question || !options) return res.status(400).json({ error: 'question and options required' });

  // Validate access (same as chat endpoint)
  const validCode = process.env.INVITE_CODE;
  const hasValidInvite = validCode && inviteCode === validCode;

  let hasValidSubscription = false;
  if (!hasValidInvite && subscriberEmail) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(stripeKey);
        const customers = await stripe.customers.list({ email: subscriberEmail.toLowerCase().trim(), limit: 1 });
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: 'active', limit: 1 });
          hasValidSubscription = subs.data.length > 0;
        }
      } catch { /* ignore */ }
    }
  }

  if (!hasValidInvite && !hasValidSubscription) {
    return res.status(403).json({ error: 'Invalid access' });
  }

  // Content moderation
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && question) {
    try {
      const modRes = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ input: question }),
      });
      if (modRes.ok) {
        const modData = await modRes.json();
        if (modData.results?.[0]?.flagged) {
          return res.status(400).json({ error: 'Content flagged', context: null });
        }
      }
    } catch { /* continue on failure */ }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(200).json({ context: null });
  }

  const CONTEXT_PROMPT = `You are a research assistant. The user is about to poll AI voters on a question. Your job is to provide brief, factual, current context about the topic so the voters can make informed decisions.

Rules:
- If the topic involves current events, recent data, or anything time-sensitive, provide the latest known facts
- If the topic is evergreen (e.g. "best pizza topping"), just return "No additional context needed."
- Keep it to 3-5 sentences max — factual, neutral, no opinions
- Include specific names, dates, numbers when available
- If you're unsure about current details, say so rather than guessing

Return JSON: { "needsContext": boolean, "context": "Your factual summary or empty string" }`;

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CONTEXT_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: `Question: "${question}"\nOptions: ${options.join(', ')}` }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      },
    );

    if (!apiRes.ok) {
      console.error('[web-context] Gemini grounding failed:', await apiRes.text());
      return res.status(200).json({ context: null });
    }

    const data = await apiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(200).json({ context: null });

    const parsed = JSON.parse(text);
    if (!parsed.needsContext) return res.status(200).json({ context: null });
    const ctx = String(parsed.context ?? '').trim();
    return res.status(200).json({ context: ctx || null });
  } catch (err) {
    console.error('[web-context] Error:', err);
    return res.status(200).json({ context: null });
  }
}
