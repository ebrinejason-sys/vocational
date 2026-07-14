import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    res.status(403).json({ error: 'Only admins can delete staff' });
    return;
  }

  const { userId } = (req.body ?? {}) as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  if (userId === callerData.user.id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }

  const { data: target } = await admin.from('profiles').select('role, active').eq('id', userId).single();
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { count: batchAssignments } = await admin
    .from('batch_trades')
    .select('*', { count: 'exact', head: true })
    .eq('trainer_id', userId);
  if ((batchAssignments ?? 0) > 0) {
    res.status(409).json({
      error: `Cannot delete: still assigned on ${batchAssignments} batch trade(s). Reassign first.`,
    });
    return;
  }

  if (target.role === 'admin') {
    const { count: otherAdmins } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('active', true)
      .neq('id', userId);
    if ((otherAdmins ?? 0) < 1) {
      res.status(409).json({ error: 'Cannot delete the last active admin' });
      return;
    }
  }

  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  if (delError) {
    res.status(500).json({ error: delError.message });
    return;
  }
  res.status(200).json({ ok: true });
}
