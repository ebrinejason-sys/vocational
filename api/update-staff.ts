import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ALLOWED_ROLES = [
  'admin', 'director', 'project_coordinator', 'trainer',
  'case_worker', 'finance_officer', 'logistics_officer',
] as const;
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

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', callerData.user.id)
    .single();

  if (!callerProfile?.active || callerProfile.role !== 'admin') {
    res.status(403).json({ error: 'Only admins can manage staff' });
    return;
  }

  const { userId, role, active } = (req.body ?? {}) as {
    userId?: string;
    role?: string;
    active?: boolean;
  };

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  if (userId === callerData.user.id && (role !== undefined || active === false)) {
    res.status(400).json({ error: 'You cannot change your own role or deactivate yourself' });
    return;
  }

  const { data: target } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', userId)
    .single();

  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const updates: { role?: Role; active?: boolean } = {};

  if (role !== undefined) {
    if (!ALLOWED_ROLES.includes(role as Role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    updates.role = role as Role;
  }

  if (active !== undefined) {
    updates.active = Boolean(active);
  }

  if (!Object.keys(updates).length) {
    res.status(400).json({ error: 'Provide role and/or active to update' });
    return;
  }

  if (updates.active === false && target.role === 'admin') {
    const { count: otherAdmins } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('active', true)
      .neq('id', userId);
    if ((otherAdmins ?? 0) < 1) {
      res.status(409).json({ error: 'Cannot deactivate the last active admin' });
      return;
    }
  }

  if (updates.role && updates.role !== 'admin' && target.role === 'admin') {
    const { count: otherAdmins } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('active', true)
      .neq('id', userId);
    if ((otherAdmins ?? 0) < 1) {
      res.status(409).json({ error: 'Cannot remove admin role from the last active admin' });
      return;
    }
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  res.status(200).json({ ok: true });
}
