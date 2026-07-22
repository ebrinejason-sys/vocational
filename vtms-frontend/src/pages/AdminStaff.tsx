import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus, Trash2, Shield, ChevronDown, ChevronUp, KeyRound } from 'lucide-react';
import { getAccessToken } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { confirmAdminDelete } from '../lib/deleteRequests';
import {
  ROLE_LABELS,
  DOMAIN_LABELS,
  accessibleDomains,
  type Role,
} from '../lib/permissions';
import { TRADE_OPTIONS, type TradeType } from '../types';

interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
}

const ROLE_OPTIONS: Role[] = [
  'admin', 'director', 'project_coordinator', 'trainer',
  'case_worker', 'finance_officer', 'logistics_officer',
];

function AccessPreview({ role }: { role: Role }) {
  const domains = accessibleDomains(role);
  if (!domains.length) {
    return <p className="text-xs text-gray-400">This role has no module access.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {domains.map(({ domain, level }) => (
        <li
          key={domain}
          className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
            level === 'full' || level === 'edit'
              ? 'bg-primary-100 text-primary-800'
              : 'bg-gray-100 text-gray-600',
          )}
        >
          {DOMAIN_LABELS[domain]}
          {level === 'edit' || level === 'full' ? ' (edit)' : ''}
        </li>
      ))}
    </ul>
  );
}

async function staffApi(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; sent?: number; failed?: number; warning?: string }> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as {
    error?: string;
    sent?: number;
    failed?: number;
    warning?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error ?? 'Request failed', sent: data.sent, failed: data.failed };
  }
  return {
    ok: true,
    sent: data.sent,
    failed: data.failed,
    warning: data.warning,
  };
}

export default function AdminStaff() {
  const { profile: currentUser } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkResetting, setBulkResetting] = useState(false);
  const [form, setForm] = useState<{
    email: string;
    fullName: string;
    role: Role;
    trades: TradeType[];
  }>({
    email: '', fullName: '', role: 'trainer', trades: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadStaff() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, active, hidden_from_staff')
      .eq('hidden_from_staff', false)
      .order('full_name');
    if (!error && data) {
      setStaff(data.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        role: r.role as Role,
        active: r.active,
      })));
    }
    setLoading(false);
  }

  useEffect(() => { loadStaff(); }, []);

  function toggleTrade(trade: TradeType) {
    setForm((prev) => ({
      ...prev,
      trades: prev.trades.includes(trade)
        ? prev.trades.filter((t) => t !== trade)
        : [...prev.trades, trade],
    }));
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    if (form.role === 'trainer' && form.trades.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one trade for trainers' });
      setSubmitting(false);
      return;
    }
    const result = await staffApi('/api/invite-staff', {
      email: form.email,
      fullName: form.fullName,
      role: form.role,
      trades: form.role === 'trainer' ? form.trades : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Invite failed' });
      return;
    }
    setMessage({ type: 'success', text: `Invite sent to ${form.email}` });
    setForm({ email: '', fullName: '', role: 'trainer', trades: [] });
    loadStaff();
  }

  async function handleRoleChange(userId: string, role: Role) {
    setPendingId(userId);
    setMessage(null);
    const result = await staffApi('/api/update-staff', { userId, role });
    setPendingId(null);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Could not update role' });
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === userId ? { ...s, role } : s)));
    setMessage({ type: 'success', text: 'Role updated. Access changes take effect on next sign-in.' });
  }

  async function handleToggleActive(member: StaffProfile) {
    if (member.id === currentUser?.id) return;
    setPendingId(member.id);
    setMessage(null);
    const result = await staffApi('/api/update-staff', { userId: member.id, active: !member.active });
    setPendingId(null);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Could not update account status' });
      return;
    }
    setStaff((prev) => prev.map((s) => (
      s.id === member.id ? { ...s, active: !member.active } : s
    )));
    setMessage({
      type: 'success',
      text: member.active ? `${member.fullName} deactivated` : `${member.fullName} reactivated`,
    });
  }

  async function handleSendPasswordReset(member: StaffProfile) {
    setPendingId(member.id);
    setMessage(null);
    const result = await staffApi('/api/reset-staff-password', { userId: member.id });
    setPendingId(null);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Could not send password reset' });
      return;
    }
    setMessage({
      type: 'success',
      text: result.warning
        ? `Reset emailed to ${member.email} (note: ${result.warning})`
        : `Password reset link sent to ${member.email}`,
    });
  }

  async function handleSendPasswordResetAll() {
    const activeCount = staff.filter((s) => s.active).length;
    const confirmed = window.confirm(
      `Email a password-reset link to all ${activeCount} active staff?\n\n` +
        'They will set a new password (72-hour link), then sign in with email + password + OTP.',
    );
    if (!confirmed) return;
    setBulkResetting(true);
    setMessage(null);
    const result = await staffApi('/api/reset-staff-password', { all: true });
    setBulkResetting(false);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Could not send password resets' });
      return;
    }
    const sent = result.sent ?? 0;
    const failed = result.failed ?? 0;
    setMessage({
      type: failed > 0 && sent === 0 ? 'error' : 'success',
      text: failed > 0
        ? `Sent ${sent} reset email(s); ${failed} failed.${result.warning ? ` ${result.warning}` : ''}`
        : `Password reset links sent to ${sent} staff member(s).`,
    });
  }

  async function handleDelete(member: StaffProfile) {
    if (member.id === currentUser?.id) return;
    if (!confirmAdminDelete(`${member.fullName} (${member.email})`)) return;

    setPendingId(member.id);
    setMessage(null);
    const result = await staffApi('/api/delete-staff', { userId: member.id });
    setPendingId(null);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Could not delete user' });
      return;
    }
    setStaff((prev) => prev.filter((s) => s.id !== member.id));
    setMessage({ type: 'success', text: `${member.fullName} deleted` });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Staff &amp; Roles</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Invite staff, assign roles (which control module access), send password resets after the auth update, or remove users.
        </p>
      </div>

      {message && (
        <p className={cn(
          'text-xs rounded-lg px-3 py-2 border',
          message.type === 'success'
            ? 'text-green-700 bg-green-50 border-green-100'
            : 'text-red-600 bg-red-50 border-red-100',
        )}>
          {message.text}
        </p>
      )}

      <form onSubmit={handleInvite} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-800">Invite Staff Member</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input
            required
            type="text"
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role, trades: [] })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
          >
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Access for {ROLE_LABELS[form.role]}
          </p>
          <AccessPreview role={form.role} />
        </div>
        {form.role === 'trainer' && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Trainer trades *</p>
            <div className="flex flex-wrap gap-2">
              {TRADE_OPTIONS.map((trade) => (
                <button
                  key={trade}
                  type="button"
                  onClick={() => toggleTrade(trade)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                    form.trades.includes(trade)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300',
                  )}
                >
                  {trade}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            submitting ? 'bg-primary-300 text-white cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700',
          )}
        >
          <UserPlus className="w-4 h-4" />
          {submitting ? 'Sending…' : 'Send Invite'}
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Staff ({staff.length})</h3>
          <button
            type="button"
            disabled={bulkResetting || loading || staff.length === 0}
            onClick={() => void handleSendPasswordResetAll()}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
              bulkResetting || loading
                ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                : 'border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100',
            )}
          >
            <KeyRound className="w-3.5 h-3.5" />
            {bulkResetting ? 'Sending resets…' : 'Invite all to reset password'}
          </button>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {staff.map((s) => {
              const isSelf = s.id === currentUser?.id;
              const busy = pendingId === s.id || bulkResetting;
              const expanded = expandedId === s.id;
              return (
                <li key={s.id} className="px-5 py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {s.fullName}
                        {isSelf && <span className="text-gray-400 font-normal"> (you)</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{s.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={s.role}
                        disabled={isSelf || busy}
                        onChange={(e) => handleRoleChange(s.id, e.target.value as Role)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-50"
                        aria-label={`Role for ${s.fullName}`}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={isSelf || busy}
                        onClick={() => handleToggleActive(s)}
                        className={cn(
                          'text-[10px] font-bold px-2 py-1 rounded-full transition-colors disabled:opacity-50',
                          s.active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                        )}
                      >
                        {s.active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        type="button"
                        disabled={!s.active || busy}
                        onClick={() => void handleSendPasswordReset(s)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                        title="Email password reset link"
                      >
                        <KeyRound className="w-3 h-3" />
                        Reset password
                      </button>
                      <button
                        type="button"
                        disabled={isSelf || busy}
                        onClick={() => handleDelete(s)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                        title="Delete user"
                        aria-label={`Delete ${s.fullName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : s.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                        aria-label="Show access"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Module access — {ROLE_LABELS[s.role]}
                      </p>
                      <AccessPreview role={s.role} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
