import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, getCallerFromRequest, newToken, tokenExpiry } from '../auth';
import { sendEmail } from '../email';
import { siteUrlFromRequest } from '../siteUrl';
import { logActivity } from '../activity';

/**
 * Admin-only: email a password-reset link to one staff member, or all visible staff.
 * POST { userId: string } | { all: true }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || caller.profile.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can send password reset invites' });
      return;
    }

    const body = (req.body ?? {}) as { userId?: string; all?: boolean };
    const admin = getAdminClient();
    const siteUrl = siteUrlFromRequest(req).replace(/\/$/, '');

    let targets: { id: string; full_name: string; email: string }[] = [];

    if (body.all) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, full_name, email, active, hidden_from_staff')
        .eq('active', true)
        .eq('hidden_from_staff', false);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      targets = (data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
      }));
    } else if (body.userId) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, full_name, email, active, hidden_from_staff')
        .eq('id', body.userId)
        .maybeSingle();
      if (error || !data) {
        res.status(404).json({ error: 'Staff member not found' });
        return;
      }
      if (data.hidden_from_staff) {
        res.status(403).json({ error: 'Cannot send reset for this account' });
        return;
      }
      if (!data.active) {
        res.status(400).json({ error: 'Account is inactive — reactivate before sending a reset' });
        return;
      }
      targets = [{ id: data.id, full_name: data.full_name, email: data.email }];
    } else {
      res.status(400).json({ error: 'Provide userId or all: true' });
      return;
    }

    if (!targets.length) {
      res.status(200).json({ ok: true, sent: 0, failed: 0, message: 'No staff to notify' });
      return;
    }

    let sent = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const target of targets) {
      const resetToken = newToken();
      const { error: updateError } = await admin
        .from('profiles')
        .update({
          password_reset_token: resetToken,
          password_reset_expires_at: tokenExpiry(72),
          password_reset_last_sent_at: new Date().toISOString(),
        })
        .eq('id', target.id);

      if (updateError) {
        failed += 1;
        failures.push(`${target.email}: ${updateError.message}`);
        continue;
      }

      const resetUrl = `${siteUrl}/reset-password?token=${resetToken}`;
      const mail = await sendEmail({
        to: target.email,
        subject: 'Set your VTMS password (auth update)',
        text:
          `Hi ${target.full_name},\n\n` +
          `VTMS sign-in has been updated. Please set a new password using this link (valid for 72 hours):\n` +
          `${resetUrl}\n\n` +
          `After setting your password, you will sign in with your email, password, and a one-time code emailed to you.\n\n` +
          `— Street Children Ministry VTMS`,
        html:
          `<p>Hi ${target.full_name},</p>` +
          `<p>VTMS sign-in has been updated. Please <a href="${resetUrl}">set a new password</a> (link valid for 72 hours).</p>` +
          `<p>After that, you will sign in with your email, password, and a one-time code emailed to you.</p>` +
          `<p>— Street Children Ministry VTMS</p>`,
      });

      if (mail.sent) {
        sent += 1;
      } else {
        failed += 1;
        failures.push(`${target.email}: ${mail.warning ?? 'email failed'}`);
      }
    }

    await logActivity(admin, {
      actorId: caller.id,
      actorEmail: caller.profile.email,
      actorName: caller.profile.full_name,
      action: body.all ? 'staff_password_reset_bulk' : 'staff_password_reset',
      entityType: 'profile',
      entityId: body.userId ?? null,
      summary: body.all
        ? `Sent password reset invites to staff (sent=${sent}, failed=${failed})`
        : `Sent password reset invite to ${targets[0]?.email ?? body.userId}`,
      metadata: { sent, failed, failures: failures.slice(0, 20) },
    });

    if (sent === 0 && failed > 0) {
      res.status(502).json({
        error: failures[0] ?? 'Could not send password reset emails',
        sent,
        failed,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      sent,
      failed,
      warning: failures.length ? failures.join('; ') : undefined,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to send password reset',
    });
  }
}
