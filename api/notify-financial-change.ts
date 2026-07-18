import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.FINANCIAL_NOTIFY_FROM ?? process.env.EMAIL_FROM ?? 'VTMS <onboarding@resend.dev>';

const MUTATOR_ROLES = ['finance_officer', 'director', 'admin'] as const;
type MutatorRole = (typeof MUTATOR_ROLES)[number];

const ACTIONS = ['transaction_update', 'transaction_delete', 'currency_change'] as const;

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

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server is missing Supabase credentials' });
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerData, error: callerError } = await admin.auth.getUser(callerToken);
  if (callerError || !callerData.user) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, email, role, active')
    .eq('id', callerData.user.id)
    .single();

  if (profileError || !callerProfile || !callerProfile.active) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }

  const role = callerProfile.role as MutatorRole;
  if (!MUTATOR_ROLES.includes(role)) {
    res.status(403).json({ error: 'Only finance officers, directors, or admins can send financial change notices' });
    return;
  }

  const body = (req.body ?? {}) as {
    action?: string;
    reason?: string;
    title?: string;
    body?: string;
    entityType?: string;
    entityId?: string;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
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

  // Audit row is written by the client before calling this endpoint.
  // This handler fans out in-app notifications + optional email.

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
    `Changed by: ${callerProfile.full_name} (${callerProfile.email})\n` +
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

  let emailSent = false;
  let emailWarning: string | undefined;

  const emails = (recipients ?? [])
    .map((r) => r.email)
    .filter((e): e is string => Boolean(e && e.includes('@')));

  if (!RESEND_API_KEY) {
    emailWarning = 'RESEND_API_KEY not configured — in-app notifications were created; email was skipped.';
  } else if (emails.length === 0) {
    emailWarning = 'No admin/director email addresses found.';
  } else {
    try {
      const mailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: emails,
          subject: `[VTMS] ${body.title!.trim()}`,
          text: noticeBody,
        }),
      });
      if (!mailRes.ok) {
        const errText = await mailRes.text();
        emailWarning = `Email send failed: ${errText.slice(0, 200)}`;
      } else {
        emailSent = true;
      }
    } catch (err) {
      emailWarning = err instanceof Error ? err.message : 'Email send failed';
    }
  }

  res.status(200).json({ ok: true, notified: rows.length, emailSent, emailWarning });
}
