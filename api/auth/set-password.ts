import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAdminClient,
  hashPassword,
  signAccessToken,
} from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { token, password } = (req.body ?? {}) as { token?: string; password?: string };
  if (!token?.trim() || !password) {
    res.status(400).json({ error: 'Token and password are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    const admin = getAdminClient();
    const now = new Date().toISOString();

    let profileQuery = admin
      .from('profiles')
      .select('id, full_name, email, role, active, invite_token, invite_token_expires_at, password_reset_token, password_reset_expires_at')
      .eq('invite_token', token.trim())
      .maybeSingle();

    let { data: profile, error } = await profileQuery;
    let mode: 'invite' | 'reset' | null = profile ? 'invite' : null;

    if (!profile) {
      const resetResult = await admin
        .from('profiles')
        .select('id, full_name, email, role, active, invite_token, invite_token_expires_at, password_reset_token, password_reset_expires_at')
        .eq('password_reset_token', token.trim())
        .maybeSingle();
      profile = resetResult.data;
      error = resetResult.error;
      mode = profile ? 'reset' : null;
    }

    if (error || !profile || !mode) {
      res.status(400).json({ error: 'This link is invalid or has expired' });
      return;
    }

    if (!profile.active) {
      res.status(403).json({ error: 'This account has been deactivated' });
      return;
    }

    const expiresAt =
      mode === 'invite' ? profile.invite_token_expires_at : profile.password_reset_expires_at;
    if (!expiresAt || expiresAt < now) {
      res.status(400).json({ error: 'This link has expired. Ask an admin for a new invite.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        password_hash: passwordHash,
        invite_token: null,
        invite_token_expires_at: null,
        password_reset_token: null,
        password_reset_expires_at: null,
      })
      .eq('id', profile.id);

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    const accessToken = signAccessToken(profile.id, profile.email);
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
      error: err instanceof Error ? err.message : 'Could not set password',
    });
  }
}
