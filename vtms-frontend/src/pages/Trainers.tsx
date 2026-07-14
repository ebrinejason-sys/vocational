import { useEffect, useState, type FormEvent } from 'react';
import { GraduationCap, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { TRADE_OPTIONS, type TradeType } from '../types';

interface TrainerRow {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  trades: TradeType[];
}

const EMPTY_FORM = { fullName: '', email: '', trades: [] as TradeType[] };

export default function Trainers() {
  const { profile } = useAuth();
  const canCreate = profile?.role === 'admin' || profile?.role === 'director';
  const canEditTags = canCreate;
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, active, profile_trades(trade)')
      .eq('role', 'trainer')
      .order('full_name');
    if (!error && data) {
      setTrainers(
        data.map((r) => ({
          id: r.id as string,
          fullName: r.full_name as string,
          email: r.email as string,
          active: Boolean(r.active),
          trades: ((r.profile_trades as { trade: string }[] | null) ?? []).map((t) => t.trade as TradeType),
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggleFormTrade(trade: TradeType) {
    setForm((prev) => ({
      ...prev,
      trades: prev.trades.includes(trade)
        ? prev.trades.filter((t) => t !== trade)
        : [...prev.trades, trade],
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setSubmitting(true);
    setBanner(null);

    if (!form.trades.length) {
      setSubmitting(false);
      setBanner({ type: 'error', text: 'Select at least one trade this trainer will teach.' });
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
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        role: 'trainer',
        trades: form.trades,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setBanner({ type: 'error', text: body.error ?? 'Failed to create trainer' });
      return;
    }

    setBanner({
      type: 'success',
      text: `Invite sent to ${form.email.trim()}. They set a password via the welcome link, then appear here with their trades.`,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    load();
  }

  async function toggleTrade(trainer: TrainerRow, trade: TradeType) {
    if (!canEditTags) return;
    setSavingId(trainer.id);
    setBanner(null);
    const has = trainer.trades.includes(trade);
    if (has) {
      const { error } = await supabase
        .from('profile_trades')
        .delete()
        .eq('profile_id', trainer.id)
        .eq('trade', trade);
      if (error) setBanner({ type: 'error', text: error.message });
    } else {
      const { error } = await supabase
        .from('profile_trades')
        .insert({ profile_id: trainer.id, trade });
      if (error) setBanner({ type: 'error', text: error.message });
    }
    await load();
    setSavingId(null);
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-300 bg-white';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Trainers</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Create trainers with their trade(s). Those tags power the trainer dropdown when creating batches.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setBanner(null);
            }}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0',
              showForm
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            )}
          >
            {showForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Create Trainer'}
          </button>
        )}
      </div>

      {banner && (
        <p
          className={cn(
            'text-sm rounded-lg px-3 py-2 border',
            banner.type === 'success'
              ? 'text-green-700 bg-green-50 border-green-100'
              : 'text-red-600 bg-red-50 border-red-100'
          )}
        >
          {banner.text}
        </p>
      )}

      {showForm && canCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4"
        >
          <h3 className="text-sm font-bold text-gray-800">New trainer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full name *</label>
              <input
                required
                className={inputCls}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Chol Deng"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
              <input
                required
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="trainer@example.com"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Trades they teach *</p>
            <div className="flex flex-wrap gap-2">
              {TRADE_OPTIONS.map((trade) => (
                <button
                  key={trade}
                  type="button"
                  onClick={() => toggleFormTrade(trade)}
                  className={cn(
                    'text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors',
                    form.trades.includes(trade)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  )}
                >
                  {trade}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Pick one or more. An invite email is sent so they can set their password.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white',
                submitting ? 'bg-primary-300 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
              )}
            >
              <UserPlus className="w-4 h-4" />
              {submitting ? 'Sending invite…' : 'Create & invite'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading trainers…</p>
      ) : trainers.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500">
          No trainers yet.{canCreate ? ' Use Create Trainer to add the first one.' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {trainers.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{t.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{t.email}</p>
                  {!t.active && <p className="text-xs text-amber-700 mt-1">Inactive</p>}
                  <p className="text-[11px] text-gray-400 mt-2 mb-1">
                    {canEditTags ? 'Tap to set / change trades:' : 'Trades:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TRADE_OPTIONS.map((trade) => {
                      const on = t.trades.includes(trade);
                      return (
                        <button
                          key={trade}
                          type="button"
                          disabled={!canEditTags || savingId === t.id}
                          onClick={() => toggleTrade(t, trade)}
                          className={cn(
                            'text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors',
                            on
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300',
                            (!canEditTags || savingId === t.id) && 'opacity-70 cursor-default'
                          )}
                        >
                          {trade}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
