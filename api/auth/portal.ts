import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(503).json({ error: 'Stripe not configured' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const stripe = new Stripe(stripeKey);

  try {
    const customers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 1 });
    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://project-swarm.vercel.app';

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: origin,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[portal] Stripe error:', err);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
}
