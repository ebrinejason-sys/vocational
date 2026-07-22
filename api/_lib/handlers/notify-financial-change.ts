import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, getCallerFromRequest } from '../auth';
import { sendEmail } from '../email';

const MUTATOR_ROLES = ['finance_officer', 'director', 'admin'] as const;
type MutatorRole = (typeof MUTATOR_ROLES)[number];

const ACTIONS = ['transaction_update', 'transaction_delete', 'currency_change'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const caller = await getCallerFromRequest(req);
    if (!caller) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    const role = caller.profile.role as MutatorRole;
    if (!MUTATOR_ROLES.includes(role)) {
      res.status(403).json({
        error: 'Only finance officers, directors, or admins can send financial change notices',
      });
      return;
    }

    const body = (req.body ?? {}) as {
      action?: string;
      reason?: string;
      title?: string;
      body?: string;
      entityType?: string;
      entityId?: string;
    };

    if (!body.action || !ACTIONS.includes(body.action as (typeof ACTIONS)[number])) {
      res.status(400).json({ error: 'Valid action is required' });
      return;
    }
    if (!body.reason?.trim()) {
      res.status(400).json({ error: 'Reason is required' });
      return;
    }
    if (!body.title?.trim() || !body.entityType || !body.entityId) {
      res.status(400).json({ error: 'title, entityType, and entityId are required' });
      return;
    }

    if (body.action === 'currency_change' && role === 'finance_officer') {
      res.status(403).json({ error: 'Only admin or director can change currency' });
      return;
    }

    const admin = getAdminClient();
    const { data: recipients, error: recipientsError } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('active', true)
      .in('role', ['admin', 'director']);

    if (recipientsError) {
      res.status(500).json({ error: recipientsError.message });
      return;
    }

    const noticeBody =
      `${body.body?.trim() || body.title}\n\n` +
      `Changed by: ${caller.profile.full_name} (${caller.profile.email})\n` +
      `Reason: ${body.reason.trim()}`;

    const rows = (recipients ?? []).map((r) => ({
      user_id: r.id,
      kind: 'financial_change',
      title: body.title!.trim(),
      body: noticeBody,
      entity_type: body.entityType,
      entity_id: body.entityId,
    }));

    if (rows.length) {
      const { error: notifyError } = await admin.from('notifications').insert(rows);
      if (notifyError) {
        res.status(500).json({ error: notifyError.message });
        return;
      }
    }

    const emails = (recipients ?? [])
      .map((r) => r.email)
      .filter((e): e is string => Boolean(e && e.includes('@')));

    const mail = emails.length
      ? await sendEmail({
          to: emails,
          subject: `[VTMS] ${body.title!.trim()}`,
          text: noticeBody,
        })
      : { sent: false, warning: 'No admin/director email addresses found' };

    res.status(200).json({
      ok: true,
      notified: rows.length,
      emailSent: mail.sent,
      emailWarning: mail.warning,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Notification failed',
    });
  }
}
