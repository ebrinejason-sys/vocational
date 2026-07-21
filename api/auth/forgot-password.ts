import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, newToken, tokenExpiry } from '../_lib/auth';
import { sendEmail } from '../_lib/email';
import { siteUrlFromRequest } from '../_lib/siteUrl';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email } = (req.body ?? {}) as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const genericOk = {
    ok: true,
    message: 'If that email is registered, a reset link has been sent.',
  };

  try {
    const admin = getAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, email, active')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (!profile?.active) {
      res.status(200).json(genericOk);
      return;
    }

    const resetToken = newToken();
    await admin
      .from('profiles')
      .update({
        password_reset_token: resetToken,
        password_reset_expires_at: tokenExpiry(24),
      })
      .eq('id', profile.id);

    const siteUrl = siteUrlFromRequest(req);
    const resetUrl = `${siteUrl}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: profile.email,
      subject: 'Reset your VTMS password',
      text:
        `Hi ${profile.full_name},\n\n` +
        `Use this link to choose a new password (valid for 24 hours):\n${resetUrl}\n\n` +
        `If you did not request this, you can ignore this email.\n\n— Street Children Ministry VTMS`,
      html:
        `<p>Hi ${profile.full_name},</p>` +
        `<p><a href="${resetUrl}">Click here to choose a new password</a> (valid for 24 hours).</p>` +
        `<p>If you did not request this, you can ignore this email.</p>`,
    });

    res.status(200).json(genericOk);
  } catch {
    res.status(200).json(genericOk);
  }
}
