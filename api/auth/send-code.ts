import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import crypto from 'crypto';

function signCode(email: string, code: string, secret: string): string {
  const payload = `${email}:${code}:${Math.floor(Date.now() / 1000 / 300)}`; // 5-min window
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const secret = process.env.AUTH_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  if (!secret || !resendKey) {
    return res.status(503).json({ error: 'Auth not configured' });
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const signature = signCode(email.toLowerCase().trim(), code, secret);

  // Send email via Resend
  const resend = new Resend(resendKey);
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Decision Wolf <noreply@projectswarm.app>',
      to: email.toLowerCase().trim(),
      subject: 'Your Decision Wolf verification code',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #059669; margin-bottom: 8px;">Decision Wolf</h2>
          <p style="color: #333; font-size: 16px;">Your verification code is:</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #0a1f18; margin: 16px 0; padding: 12px; background: #f2f8f6; border-radius: 8px; text-align: center;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 5 minutes.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[send-code] Email failed:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  return res.status(200).json({ signature });
}
