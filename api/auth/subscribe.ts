import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripeKey || !priceId) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const stripe = new Stripe(stripeKey);
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Find or create customer
    let customer: Stripe.Customer;
    const existing = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
    if (existing.data.length > 0) {
      customer = existing.data[0];
    } else {
      customer = await stripe.customers.create({ email: normalizedEmail });
    }

    // Create checkout session
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://project-swarm.vercel.app';

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?subscribed=true`,
      cancel_url: `${origin}/?cancelled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[subscribe] Stripe error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
