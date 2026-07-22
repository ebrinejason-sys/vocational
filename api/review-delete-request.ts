import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, getCallerFromRequest } from './_lib/auth';
import { logActivity } from './_lib/activity';
import { sendEmail } from './_lib/email';

async function executeDelete(
  admin: ReturnType<typeof getAdminClient>,
  entityType: string,
  entityId: string,
): Promise<void> {
  switch (entityType) {
    case 'inventory_item': {
      await admin.from('inventory_usage').delete().eq('item_id', entityId);
      await admin.from('procurement_requests').delete().eq('item_id', entityId);
      const { error } = await admin.from('inventory_items').delete().eq('id', entityId);
      if (error) throw new Error(error.message);
      return;
    }
    case 'trainee': {
      const { error } = await admin.from('trainees').delete().eq('id', entityId);
      if (error) throw new Error(error.message);
      return;
    }
    case 'batch': {
      await admin.from('batch_trades').delete().eq('batch_id', entityId);
      const { error } = await admin.from('batches').delete().eq('id', entityId);
      if (error) throw new Error(error.message);
      return;
    }
    case 'financial_transaction': {
      await admin.from('receipts').update({ financial_transaction_id: null }).eq('financial_transaction_id', entityId);
      const { error } = await admin.from('financial_transactions').delete().eq('id', entityId);
      if (error) throw new Error(error.message);
      return;
    }
    case 'trainee_interview': {
      const { error } = await admin.from('trainee_interviews').delete().eq('id', entityId);
      if (error) throw new Error(error.message);
      return;
    }
    case 'trainee_document': {
      const { data: doc } = await admin
        .from('trainee_documents')
        .select('storage_path')
        .eq('id', entityId)
        .maybeSingle();
      if (doc?.storage_path) {
        await admin.storage.from('trainee-documents').remove([doc.storage_path]);
      }
      const { error } = await admin.from('trainee_documents').delete().eq('id', entityId);
      if (error) throw new Error(error.message);
      return;
    }
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }
}

/**
 * Admin reviews a delete request.
 * POST { requestId, decision: 'approve' | 'reject', reviewNote? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || caller.profile.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can review delete requests' });
      return;
    }

    const body = (req.body ?? {}) as {
      requestId?: string;
      decision?: 'approve' | 'reject';
      reviewNote?: string;
    };

    if (!body.requestId || (body.decision !== 'approve' && body.decision !== 'reject')) {
      res.status(400).json({ error: 'requestId and decision (approve|reject) are required' });
      return;
    }

    const admin = getAdminClient();
    const { data: request, error } = await admin
      .from('delete_requests')
      .select('id, entity_type, entity_id, entity_label, reason, status, requested_by')
      .eq('id', body.requestId)
      .maybeSingle();

    if (error || !request) {
      res.status(404).json({ error: 'Delete request not found' });
      return;
    }
    if (request.status !== 'pending') {
      res.status(409).json({ error: `Request already ${request.status}` });
      return;
    }

    if (body.decision === 'approve') {
      await executeDelete(admin, request.entity_type, request.entity_id);
    }

    const { error: updateError } = await admin
      .from('delete_requests')
      .update({
        status: body.decision === 'approve' ? 'approved' : 'rejected',
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
        review_note: body.reviewNote?.trim() || null,
      })
      .eq('id', request.id);

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    await logActivity(admin, {
      actorId: caller.id,
      actorEmail: caller.profile.email,
      actorName: caller.profile.full_name,
      action: body.decision === 'approve' ? 'delete_approved' : 'delete_rejected',
      entityType: request.entity_type,
      entityId: request.entity_id,
      summary:
        `${body.decision === 'approve' ? 'Approved' : 'Rejected'} delete of ` +
        `${request.entity_type} “${request.entity_label}”` +
        (body.reviewNote?.trim() ? ` — ${body.reviewNote.trim()}` : ''),
      metadata: { requestId: request.id, reason: request.reason },
    });

    if (request.requested_by) {
      const { data: requester } = await admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', request.requested_by)
        .maybeSingle();
      if (requester?.email) {
        const outcome = body.decision === 'approve' ? 'approved' : 'rejected';
        await sendEmail({
          to: requester.email,
          subject: `[VTMS] Delete request ${outcome}: ${request.entity_label}`,
          text:
            `Hi ${requester.full_name},\n\n` +
            `Your request to delete ${request.entity_type} “${request.entity_label}” was ${outcome}` +
            ` by ${caller.profile.full_name}.\n` +
            (body.reviewNote?.trim() ? `Note: ${body.reviewNote.trim()}\n` : '') +
            `\n— Street Children Ministry VTMS`,
        });
        await admin.from('notifications').insert({
          user_id: request.requested_by,
          kind: 'delete_request_review',
          title: `Delete request ${outcome}`,
          body: `“${request.entity_label}” was ${outcome}.`,
          entity_type: 'delete_request',
          entity_id: request.id,
        });
      }
    }

    res.status(200).json({ ok: true, decision: body.decision });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Could not review delete request',
    });
  }
}
