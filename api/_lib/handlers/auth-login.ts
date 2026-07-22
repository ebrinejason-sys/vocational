import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAdminClient,
  hashPassword,
  signAccessToken,
  verifyPassword,
} from '../auth';
import { sendEmail } from '../email';
import { generateOtpCode, logActivity } from '../activity';

const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;
const OTP_MINUTES = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const admin = getAdminClient();
    const { data: profile, error } = await admin
      .from('profiles')
      .select(
        'id, full_name, email, role, active, password_hash, failed_login_attempts, locked_until',
      )
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error || !profile || !profile.active) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
      const minutesLeft = Math.max(
        1,
        Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60_000),
      );
      res.status(429).json({
        error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      });
      return;
    }

    if (!profile.password_hash) {
      res.status(401).json({
        error: 'Password not set yet. Use the link from your invite email or reset your password.',
      });
      return;
    }

    const valid = await verifyPassword(password, profile.password_hash);
    if (!valid) {
      const attempts = (profile.failed_login_attempts ?? 0) + 1;
      const update: { failed_login_attempts: number; locked_until?: string } = {
        failed_login_attempts: attempts,
      };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
      }
      await admin.from('profiles').update(update).eq('id', profile.id);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Password OK — send email OTP before issuing a session.
    const otp = generateOtpCode();
    const otpHash = await hashPassword(otp);
    const otpExpires = new Date(Date.now() + OTP_MINUTES * 60_000).toISOString();

    await admin
      .from('profiles')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        login_otp_hash: otpHash,
        login_otp_expires_at: otpExpires,
      })
      .eq('id', profile.id);

    const mail = await sendEmail({
      to: profile.email,
      subject: 'Your VTMS login code',
      text:
        `Hi ${profile.full_name},\n\n` +
        `Your one-time login code is: ${otp}\n\n` +
        `It expires in ${OTP_MINUTES} minutes. If you did not try to sign in, ignore this email.\n\n` +
        `— Street Children Ministry VTMS`,
      html:
        `<p>Hi ${profile.full_name},</p>` +
        `<p>Your one-time login code is:</p>` +
        `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>` +
        `<p>It expires in ${OTP_MINUTES} minutes.</p>`,
    });

    if (!mail.sent) {
      console.error('login OTP email failed', mail.warning);
      res.status(502).json({
        error: mail.warning ?? 'Could not send login code email. Check Resend configuration.',
      });
      return;
    }

    await logActivity(admin, {
      actorId: profile.id,
      actorEmail: profile.email,
      actorName: profile.full_name,
      action: 'login_otp_sent',
      entityType: 'profile',
      entityId: profile.id,
      summary: `Login OTP emailed to ${profile.email}`,
    });

    res.status(200).json({
      requiresOtp: true,
      email: profile.email,
      message: 'We sent a 6-digit code to your email. Enter it to finish signing in.',
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Login failed',
    });
  }
}
