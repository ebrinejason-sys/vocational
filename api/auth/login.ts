import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAdminClient,
  hashPassword,
  signAccessToken,
  verifyPassword,
} from '../_lib/auth';

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
      .select('id, full_name, email, role, active, password_hash')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error || !profile || !profile.active) {
      res.status(401).json({ error: 'Invalid email or password' });
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
      res.status(401).json({ error: 'Invalid email or password' });
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
      error: err instanceof Error ? err.message : 'Login failed',
    });
  }
}
