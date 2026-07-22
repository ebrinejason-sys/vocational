import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, newToken, tokenExpiry } from '../auth';
import { sendEmail } from '../email';
import { siteUrlFromRequest } from '../siteUrl';

const RESEND_COOLDOWN_SECONDS = 60;

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

  // Always return the same public message so we don't leak whether an account exists.
  const genericMessage = 'If that email is registered, a reset link has been sent.';

  try {
    const admin = getAdminClient();
    const normalized = email.trim().toLowerCase();

    // Case-insensitive match (older profiles may not be lowercased)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, full_name, email, active, password_reset_last_sent_at')
      .ilike('email', normalized)
      .maybeSingle();

    if (profileError) {
      console.error('forgot-password profile lookup', profileError.message);
      res.status(200).json({
        ok: true,
        message: genericMessage,
        emailSent: false,
        emailWarning: 'Could not look up account. Confirm custom-auth SQL was applied.',
      });
      return;
    }

    if (!profile?.active) {
      res.status(200).json({ ok: true, message: genericMessage, emailSent: false });
      return;
    }

    // Cooldown avoids inbox-flooding / Resend quota abuse from repeated clicks.
    // Stays silent (same generic message) so this can't be used to enumerate accounts.
    if (
      profile.password_reset_last_sent_at &&
      Date.now() - new Date(profile.password_reset_last_sent_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000
    ) {
      res.status(200).json({ ok: true, message: genericMessage, emailSent: false });
      return;
    }

    const resetToken = newToken();
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        password_reset_token: resetToken,
        password_reset_expires_at: tokenExpiry(24),
        password_reset_last_sent_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('forgot-password update', updateError.message);
      res.status(200).json({
        ok: true,
        message: genericMessage,
        emailSent: false,
        emailWarning:
          'Could not create reset token. Run docs/migrations/2026-07-21-custom-auth.sql in Supabase.',
      });
      return;
    }

    const siteUrl = siteUrlFromRequest(req).replace(/\/$/, '');
    const resetUrl = `${siteUrl}/reset-password?token=${resetToken}`;

    const mail = await sendEmail({
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

    if (!mail.sent) {
      console.error('forgot-password email', mail.warning);
    }

    res.status(200).json({
      ok: true,
      message: genericMessage,
      emailSent: mail.sent,
      emailWarning: mail.warning,
    });
  } catch (err) {
    console.error('forgot-password', err);
    res.status(200).json({
      ok: true,
      message: genericMessage,
      emailSent: false,
      emailWarning: err instanceof Error ? err.message : 'Unexpected error',
    });
  }
}
