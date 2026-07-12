import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ALLOWED_ROLES = ['admin', 'director', 'trainer', 'case_worker', 'finance_officer'] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }
  const callerToken = authHeader.slice('Bearer '.length);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerData, error: callerError } = await admin.auth.getUser(callerToken);
  if (callerError || !callerData.user) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', callerData.user.id)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.active) {
    res.status(403).json({ error: 'Only active admins can invite staff' });
    return;
  }

  const { email, fullName, role } = (req.body ?? {}) as { email?: string; fullName?: string; role?: string };
  if (!email || !fullName || !role || !ALLOWED_ROLES.includes(role as Role)) {
    res.status(400).json({ error: 'email, fullName, and a valid role are required' });
    return;
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited.user) {
    res.status(500).json({ error: inviteError?.message ?? 'Failed to send invite' });
    return;
  }

  const { error: insertError } = await admin.from('profiles').insert({
    id: invited.user.id,
    full_name: fullName,
    email,
    role,
    active: true,
  });

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  res.status(200).json({ ok: true });
}
