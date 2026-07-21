import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import {
  getAdminClient,
  getCallerFromRequest,
  newToken,
  tokenExpiry,
} from './_lib/auth';
import { sendEmail } from './_lib/email';
import { siteUrlFromRequest } from './_lib/siteUrl';

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

  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || caller.profile.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can invite staff' });
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

    const TRADE_VALUES = ['Carpentry', 'Tailoring', 'Masonry', 'Electricity'] as const;
    const trainerTrades = role === 'trainer'
      ? (trades ?? []).filter((t): t is (typeof TRADE_VALUES)[number] =>
          TRADE_VALUES.includes(t as (typeof TRADE_VALUES)[number]))
      : [];
    if (role === 'trainer' && trainerTrades.length === 0) {
      res.status(400).json({ error: 'Trainers need at least one trade assigned' });
      return;
    }

    const admin = getAdminClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (existing) {
      res.status(409).json({ error: 'A staff member with this email already exists' });
      return;
    }

    const userId = randomUUID();
    const inviteToken = newToken();
    const siteUrl = siteUrlFromRequest(req);
    const welcomeUrl = `${siteUrl}/welcome?token=${inviteToken}`;

    const { error: insertError } = await admin.from('profiles').insert({
      id: userId,
      full_name: fullName.trim(),
      email: normalizedEmail,
      role,
      active: true,
      invite_token: inviteToken,
      invite_token_expires_at: tokenExpiry(72),
    });

    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    if (trainerTrades.length) {
      const { error: tradesError } = await admin.from('profile_trades').insert(
        trainerTrades.map((trade) => ({ profile_id: userId, trade })),
      );
      if (tradesError) {
        await admin.from('profiles').delete().eq('id', userId);
        res.status(500).json({ error: tradesError.message });
        return;
      }
    }

    const mail = await sendEmail({
      to: normalizedEmail,
      subject: 'You\'re invited to Street Children Ministry VTMS',
      text:
        `Hi ${fullName.trim()},\n\n` +
        `You've been invited to join the VTMS workspace as ${role.replace(/_/g, ' ')}.\n\n` +
        `Set your password here (link valid for 72 hours):\n${welcomeUrl}\n\n` +
        `— Street Children Ministry`,
      html:
        `<p>Hi ${fullName.trim()},</p>` +
        `<p>You've been invited to join the VTMS workspace as <strong>${role.replace(/_/g, ' ')}</strong>.</p>` +
        `<p><a href="${welcomeUrl}">Click here to set your password and sign in</a> (valid for 72 hours).</p>`,
    });

    res.status(200).json({
      ok: true,
      emailSent: mail.sent,
      emailWarning: mail.warning,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to invite staff',
    });
  }
}
