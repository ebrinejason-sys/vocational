import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, getCallerFromRequest } from '../auth';
import { logActivity } from '../activity';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || caller.profile.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can delete staff' });
      return;
    }

    const { userId } = (req.body ?? {}) as { userId?: string };
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (userId === caller.id) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    const admin = getAdminClient();
    const { data: target } = await admin
      .from('profiles')
      .select('role, active, email, full_name, hidden_from_staff')
      .eq('id', userId)
      .single();
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.hidden_from_staff) {
      res.status(403).json({ error: 'This account cannot be deleted from Staff' });
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

    await admin.from('profile_trades').delete().eq('profile_id', userId);
    const { error: delError } = await admin.from('profiles').delete().eq('id', userId);
    if (delError) {
      res.status(500).json({ error: delError.message });
      return;
    }

    await logActivity(admin, {
      actorId: caller.id,
      actorEmail: caller.profile.email,
      actorName: caller.profile.full_name,
      action: 'staff_delete',
      entityType: 'profile',
      entityId: userId,
      summary: `Deleted staff ${target.full_name ?? ''} (${target.email ?? userId})`,
      metadata: { role: target.role },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Delete failed',
    });
  }
}
