import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, getCallerFromRequest } from '../auth';
import { sendEmail } from '../email';
import { logActivity } from '../activity';
import { siteUrlFromRequest } from '../siteUrl';

export const DELETE_ENTITY_TYPES = [
  'trainee',
  'batch',
  'inventory_item',
  'financial_transaction',
  'trainee_interview',
  'trainee_document',
] as const;

export type DeleteEntityType = (typeof DELETE_ENTITY_TYPES)[number];

/**
 * Non-admin (or any staff) requests permission to delete something.
 * Admins may still use this, but usually delete directly.
 * POST { entityType, entityId, entityLabel, reason }
 */
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

    const body = (req.body ?? {}) as {
      entityType?: string;
      entityId?: string;
      entityLabel?: string;
      reason?: string;
    };

    if (!body.entityType || !DELETE_ENTITY_TYPES.includes(body.entityType as DeleteEntityType)) {
      res.status(400).json({ error: 'Valid entityType is required' });
      return;
    }
    if (!body.entityId?.trim()) {
      res.status(400).json({ error: 'entityId is required' });
      return;
    }
    if (!body.reason?.trim() || body.reason.trim().length < 5) {
      res.status(400).json({ error: 'Provide a reason (at least 5 characters)' });
      return;
    }

    const admin = getAdminClient();

    const { data: existing } = await admin
      .from('delete_requests')
      .select('id')
      .eq('entity_type', body.entityType)
      .eq('entity_id', body.entityId.trim())
      .eq('status', 'pending')
      .maybeSingle();

    if (existing?.id) {
      res.status(409).json({ error: 'A pending delete request already exists for this item' });
      return;
    }

    const label = (body.entityLabel ?? body.entityId).trim();
    const { data: row, error } = await admin
      .from('delete_requests')
      .insert({
        entity_type: body.entityType,
        entity_id: body.entityId.trim(),
        entity_label: label,
        reason: body.reason.trim(),
        requested_by: caller.id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !row) {
      res.status(500).json({ error: error?.message ?? 'Could not create delete request' });
      return;
    }

    const { data: admins } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('active', true)
      .eq('role', 'admin')
      .eq('hidden_from_staff', false);

    const siteUrl = siteUrlFromRequest(req).replace(/\/$/, '');
    const title = `Delete request: ${label}`;
    const notice =
      `${caller.profile.full_name} requested deletion of ${body.entityType} “${label}”.\n` +
      `Reason: ${body.reason.trim()}\n\n` +
      `Review: ${siteUrl}/admin/activity`;

    if (admins?.length) {
      await admin.from('notifications').insert(
        admins.map((a) => ({
          user_id: a.id,
          kind: 'delete_request',
          title,
          body: notice,
          entity_type: 'delete_request',
          entity_id: row.id,
        })),
      );

      await sendEmail({
        to: admins.map((a) => a.email),
        subject: `[VTMS] ${title}`,
        text: notice,
        html:
          `<p><strong>${caller.profile.full_name}</strong> requested deletion of ` +
          `<strong>${body.entityType}</strong> “${label}”.</p>` +
          `<p>Reason: ${body.reason.trim()}</p>` +
          `<p><a href="${siteUrl}/admin/activity">Review on Activity</a></p>`,
      });
    }

    await logActivity(admin, {
      actorId: caller.id,
      actorEmail: caller.profile.email,
      actorName: caller.profile.full_name,
      action: 'delete_requested',
      entityType: body.entityType,
      entityId: body.entityId.trim(),
      summary: `Requested delete of ${body.entityType} “${label}”: ${body.reason.trim()}`,
      metadata: { requestId: row.id },
    });

    res.status(200).json({ ok: true, requestId: row.id });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Could not submit delete request',
    });
  }
}
