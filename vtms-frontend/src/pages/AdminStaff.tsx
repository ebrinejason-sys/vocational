import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { ROLE_LABELS, type Role } from '../lib/permissions';
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

export default function AdminStaff() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
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
      .select('id, full_name, email, role, active')
      .order('full_name');
    if (!error && data) {
      setStaff(data.map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, role: r.role, active: r.active })));
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
      setSubmitting(false);
      setMessage({ type: 'error', text: 'Select at least one trade for a trainer' });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/invite-staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        email: form.email,
        fullName: form.fullName,
        role: form.role,
        trades: form.role === 'trainer' ? form.trades : undefined,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: 'error', text: body.error ?? 'Failed to send invite' });
      return;
    }
    setMessage({ type: 'success', text: `Invite sent to ${form.email}` });
    setForm({ email: '', fullName: '', role: 'trainer', trades: [] });
    loadStaff();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Staff & Roles</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Invite staff and manage role assignments. Tag trainer trades here or on the Trainers page.
        </p>
      </div>

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
                    'text-xs font-semibold px-2.5 py-1 rounded-full border',
                    form.trades.includes(trade)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  )}
                >
                  {trade}
                </button>
              ))}
            </div>
          </div>
        )}
        {message && (
          <p className={cn('text-xs', message.type === 'success' ? 'text-green-600' : 'text-red-500')}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            submitting ? 'bg-primary-300 text-white cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'
          )}
        >
          <UserPlus className="w-4 h-4" />
          {submitting ? 'Sending…' : 'Send Invite'}
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Staff ({staff.length})</h3>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.fullName}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                  s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {ROLE_LABELS[s.role] ?? s.role}{!s.active ? ' · inactive' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
