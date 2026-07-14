import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
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

export default function Trainers() {
  const { profile } = useAuth();
  const canEditTags = profile?.role === 'admin' || profile?.role === 'director';
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
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

  async function toggleTrade(trainer: TrainerRow, trade: TradeType) {
    if (!canEditTags) return;
    setSavingId(trainer.id);
    setMessage(null);
    const has = trainer.trades.includes(trade);
    if (has) {
      const { error } = await supabase
        .from('profile_trades')
        .delete()
        .eq('profile_id', trainer.id)
        .eq('trade', trade);
      if (error) setMessage(error.message);
    } else {
      const { error } = await supabase
        .from('profile_trades')
        .insert({ profile_id: trainer.id, trade });
      if (error) setMessage(error.message);
    }
    await load();
    setSavingId(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Trainers</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Tag which trades each trainer login teaches. Those tags power the trainer dropdown when creating batches.
          Invite new trainers from Staff (admin).
        </p>
      </div>

      {message && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{message}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading trainers…</p>
      ) : trainers.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500">
          No trainer accounts yet. An admin can invite them under Staff.
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
                  <div className="flex flex-wrap gap-2 mt-3">
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
