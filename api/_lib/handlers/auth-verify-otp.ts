import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAdminClient,
  signAccessToken,
  verifyPassword,
} from '../auth';
import { logActivity } from '../activity';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email, otp } = (req.body ?? {}) as { email?: string; otp?: string };
  if (!email?.trim() || !otp?.trim()) {
    res.status(400).json({ error: 'Email and OTP code are required' });
    return;
  }

  try {
    const admin = getAdminClient();
    const { data: profile, error } = await admin
      .from('profiles')
      .select(
        'id, full_name, email, role, active, login_otp_hash, login_otp_expires_at',
      )
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error || !profile || !profile.active) {
      res.status(401).json({ error: 'Invalid or expired code' });
      return;
    }

    if (!profile.login_otp_hash || !profile.login_otp_expires_at) {
      res.status(401).json({ error: 'No login code pending. Sign in with your password again.' });
      return;
    }

    if (new Date(profile.login_otp_expires_at) < new Date()) {
      await admin
        .from('profiles')
        .update({ login_otp_hash: null, login_otp_expires_at: null })
        .eq('id', profile.id);
      res.status(401).json({ error: 'Code expired. Sign in again to get a new code.' });
      return;
    }

    const ok = await verifyPassword(otp.trim(), profile.login_otp_hash);
    if (!ok) {
      res.status(401).json({ error: 'Invalid or expired code' });
      return;
    }

    await admin
      .from('profiles')
      .update({
        login_otp_hash: null,
        login_otp_expires_at: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    const accessToken = signAccessToken(profile.id, profile.email);

    await logActivity(admin, {
      actorId: profile.id,
      actorEmail: profile.email,
      actorName: profile.full_name,
      action: 'login_success',
      entityType: 'profile',
      entityId: profile.id,
      summary: `${profile.full_name} signed in`,
    });

    res.status(200).json({
      accessToken,
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
        active: profile.active,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'OTP verification failed',
    });
  }
}
