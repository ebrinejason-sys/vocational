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

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', callerData.user.id)
    .single();

  if (profileError || !callerProfile || !callerProfile.active) {
    res.status(403).json({ error: 'Not allowed to invite staff' });
    return;
  }

  const { email, fullName, role, trades } = (req.body ?? {}) as {
    email?: string;
    fullName?: string;
    role?: string;
    trades?: string[];
  };
  if (!email || !fullName || !role || !ALLOWED_ROLES.includes(role as Role)) {
    res.status(400).json({ error: 'email, fullName, and a valid role are required' });
    return;
  }

  const isAdmin = callerProfile.role === 'admin';
  const isDirectorInvitingTrainer = callerProfile.role === 'director' && role === 'trainer';
  if (!isAdmin && !isDirectorInvitingTrainer) {
    res.status(403).json({ error: 'Only admins can invite staff (directors may invite trainers)' });
    return;
  }

  const TRADE_VALUES = ['Carpentry', 'Tailoring', 'Masonry', 'Electricity'] as const;
  const trainerTrades = role === 'trainer'
    ? (trades ?? []).filter((t): t is (typeof TRADE_VALUES)[number] =>
        TRADE_VALUES.includes(t as (typeof TRADE_VALUES)[number]))
    : [];
  if (role === 'trainer' && trainerTrades.length === 0) {
    res.status(400).json({ error: 'Trainers need at least one trade assigned' });
    return;
  }

  // Send the invited user back to this deployment's /welcome page (where
  // they set their password) instead of Supabase's default Site URL —
  // without this, invite links redirect to localhost. The URL must also be
  // in the Supabase dashboard's Redirect URL allow-list.
  const forwardedHost = req.headers['x-forwarded-host'] ?? req.headers.host;
  const siteUrl = process.env.PUBLIC_SITE_URL ?? `https://${forwardedHost}`;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/welcome`,
  });
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
    // Compensate: the auth user was created but the profile insert failed —
    // remove it so a retry for the same email isn't permanently blocked by
    // Supabase Auth already having a user for it.
    await admin.auth.admin.deleteUser(invited.user.id).catch(() => {});
    res.status(500).json({ error: insertError.message });
    return;
  }

  if (trainerTrades.length) {
    const { error: tradesError } = await admin.from('profile_trades').insert(
      trainerTrades.map((trade) => ({ profile_id: invited.user!.id, trade }))
    );
    if (tradesError) {
      await admin.from('profiles').delete().eq('id', invited.user.id).catch(() => {});
      await admin.auth.admin.deleteUser(invited.user.id).catch(() => {});
      res.status(500).json({ error: tradesError.message });
      return;
    }
  }

  res.status(200).json({ ok: true });
}
