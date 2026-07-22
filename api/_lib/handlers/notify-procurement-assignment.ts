import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, getCallerFromRequest } from '../auth';
import { sendEmail } from '../email';
import { logActivity } from '../activity';
import { siteUrlFromRequest } from '../siteUrl';

/**
 * Email (+ in-app notice) the staff member assigned to a procurement request.
 * POST { requestId?, assignedToId, itemName, quantityRequested, estimatedCost }
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
      requestId?: string;
      assignedToId?: string;
      itemName?: string;
      quantityRequested?: number;
      estimatedCost?: number;
    };

    if (!body.assignedToId || !body.itemName?.trim()) {
      res.status(400).json({ error: 'assignedToId and itemName are required' });
      return;
    }

    const admin = getAdminClient();
    const { data: assignee, error } = await admin
      .from('profiles')
      .select('id, full_name, email, active')
      .eq('id', body.assignedToId)
      .maybeSingle();

    if (error || !assignee || !assignee.active) {
      res.status(404).json({ error: 'Assigned staff member not found or inactive' });
      return;
    }

    const qty = body.quantityRequested ?? 0;
    const cost = body.estimatedCost ?? 0;
    const siteUrl = siteUrlFromRequest(req).replace(/\/$/, '');
    const title = `Procurement assigned: ${body.itemName.trim()}`;
    const noticeBody =
      `${caller.profile.full_name} assigned you a procurement request.\n\n` +
      `Item: ${body.itemName.trim()}\n` +
      `Quantity: ${qty}\n` +
      `Estimated cost: ${cost}\n\n` +
      `Open Procurement: ${siteUrl}/procurement`;

    await admin.from('notifications').insert({
      user_id: assignee.id,
      kind: 'procurement_assignment',
      title,
      body: noticeBody,
      entity_type: 'procurement_request',
      entity_id: body.requestId ?? null,
    });

    const mail = await sendEmail({
      to: assignee.email,
      subject: `[VTMS] ${title}`,
      text: `Hi ${assignee.full_name},\n\n${noticeBody}\n\n— Street Children Ministry VTMS`,
      html:
        `<p>Hi ${assignee.full_name},</p>` +
        `<p><strong>${caller.profile.full_name}</strong> assigned you a procurement request.</p>` +
        `<ul>` +
        `<li>Item: <strong>${body.itemName.trim()}</strong></li>` +
        `<li>Quantity: ${qty}</li>` +
        `<li>Estimated cost: ${cost}</li>` +
        `</ul>` +
        `<p><a href="${siteUrl}/procurement">Open Procurement</a></p>`,
    });

    await logActivity(admin, {
      actorId: caller.id,
      actorEmail: caller.profile.email,
      actorName: caller.profile.full_name,
      action: 'procurement_assigned',
      entityType: 'procurement_request',
      entityId: body.requestId ?? body.assignedToId,
      summary: `Assigned procurement “${body.itemName.trim()}” to ${assignee.full_name} (${assignee.email})`,
      metadata: { emailSent: mail.sent, quantityRequested: qty, estimatedCost: cost },
    });

    res.status(200).json({
      ok: true,
      emailSent: mail.sent,
      emailWarning: mail.warning,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Could not notify assignee',
    });
  }
}
