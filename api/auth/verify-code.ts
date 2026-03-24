import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import crypto from 'crypto';

function verifyCode(email: string, code: string, signature: string, secret: string): boolean {
  // Check current and previous 5-min window to handle edge cases
  for (let offset = 0; offset <= 1; offset++) {
    const payload = `${email}:${code}:${Math.floor(Date.now() / 1000 / 300) - offset}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expected === signature) return true;
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, code, signature } = req.body;
  if (!email || !code || !signature) {
    return res.status(400).json({ error: 'Email, code, and signature required' });
  }

  const secret = process.env.AUTH_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !stripeKey) {
    return res.status(503).json({ error: 'Auth not configured' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Verify the code signature
  if (!verifyCode(normalizedEmail, code, signature, secret)) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  // Check Stripe for active subscription
  const stripe = new Stripe(stripeKey);
  try {
    const customers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
    if (customers.data.length === 0) {
      return res.status(200).json({ verified: true, subscribed: false });
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    return res.status(200).json({
      verified: true,
      subscribed: subscriptions.data.length > 0,
      customerId: customer.id,
    });
  } catch (err) {
    console.error('[verify-code] Stripe error:', err);
    return res.status(200).json({ verified: true, subscribed: false });
  }
}
