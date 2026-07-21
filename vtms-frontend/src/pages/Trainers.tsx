import { useEffect, useState, type FormEvent } from 'react';
import {
  GraduationCap, UserPlus, X, Pencil, PauseCircle, PlayCircle, Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAccessToken } from '../lib/session';
import { useAuth } from '../contexts/AuthContext';
import { cn, friendlyError } from '../lib/utils';
import { countTrainerDependencies } from '../lib/deleteGuards';
import { formatDependencyBlock } from '../lib/lifecycle';
import Modal from '../components/Modal';
import { TRADE_OPTIONS, type TradeType } from '../types';

interface TrainerRow {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  trades: TradeType[];
}

interface EditForm {
  fullName: string;
  trades: TradeType[];
}

const EMPTY_FORM = { fullName: '', email: '', trades: [] as TradeType[] };

export default function Trainers() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const canCreate = isAdmin || profile?.role === 'director';
  const canEdit = canCreate;
  const canEditTags = canCreate;
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<TrainerRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainerRow | null>(null);
  const [deleteCounts, setDeleteCounts] = useState<Record<string, number> | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  function toggleEditTrade(trade: TradeType) {
    setEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        trades: prev.trades.includes(trade)
          ? prev.trades.filter((t) => t !== trade)
          : [...prev.trades, trade],
      };
    });
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

    const res = await fetch('/api/invite-staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
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

  function openEdit(trainer: TrainerRow) {
    setEditTarget(trainer);
    setEditForm({ fullName: trainer.fullName, trades: [...trainer.trades] });
    setEditError(null);
    setShowEdit(true);
  }

  async function replaceTrades(profileId: string, trades: TradeType[]) {
    const { error: delError } = await supabase
      .from('profile_trades')
      .delete()
      .eq('profile_id', profileId);
    if (delError) throw delError;
    if (trades.length) {
      const { error: insError } = await supabase
        .from('profile_trades')
        .insert(trades.map((trade) => ({ profile_id: profileId, trade })));
      if (insError) throw insError;
    }
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editTarget || !editForm) return;
    if (!editForm.trades.length) {
      setEditError('Select at least one trade.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      if (isAdmin) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: editForm.fullName.trim() })
          .eq('id', editTarget.id);
        if (error) throw error;
      }
      await replaceTrades(editTarget.id, editForm.trades);
      setShowEdit(false);
      setEditTarget(null);
      setEditForm(null);
      await load();
    } catch (err) {
      setEditError(friendlyError(err, 'Failed to update trainer.'));
    } finally {
      setEditSaving(false);
    }
  }

  async function handlePause(trainer: TrainerRow) {
    setBanner(null);
    setLifecycleLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active: false })
        .eq('id', trainer.id);
      if (error) throw error;
      await load();
    } catch (err) {
      setBanner({ type: 'error', text: friendlyError(err, 'Failed to pause trainer.') });
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function handleResume(trainer: TrainerRow) {
    setBanner(null);
    setLifecycleLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active: true })
        .eq('id', trainer.id);
      if (error) throw error;
      await load();
    } catch (err) {
      setBanner({ type: 'error', text: friendlyError(err, 'Failed to resume trainer.') });
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function openDelete(trainer: TrainerRow) {
    setDeleteTarget(trainer);
    setDeleteError(null);
    setDeleteCounts(null);
    setDeleteBlocked(false);
    setShowDelete(true);
    setDeleteLoading(true);
    try {
      const counts = await countTrainerDependencies(trainer.id);
      setDeleteCounts(counts);
      setDeleteBlocked(Object.values(counts).some((n) => n > 0));
    } catch (err) {
      setDeleteError(friendlyError(err, 'Failed to check dependencies.'));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBlocked) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/delete-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken() ?? ''}`,
        },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to delete trainer');
      }
      setShowDelete(false);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteError(friendlyError(err, 'Failed to delete trainer.'));
    } finally {
      setDeleteLoading(false);
    }
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
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{t.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{t.email}</p>
                      {!t.active && (
                        <p className="text-xs text-amber-700 mt-1 font-medium">Paused — cannot sign in</p>
                      )}
                    </div>
                    {(canEdit || isAdmin) && (
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}
                        {isAdmin && t.active && (
                          <button
                            type="button"
                            onClick={() => handlePause(t)}
                            disabled={lifecycleLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-200 text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                            Pause
                          </button>
                        )}
                        {isAdmin && !t.active && (
                          <button
                            type="button"
                            onClick={() => handleResume(t)}
                            disabled={lifecycleLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-green-200 text-green-800 hover:bg-green-50 disabled:opacity-60"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Resume
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openDelete(t)}
                            disabled={lifecycleLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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

      {showEdit && editTarget && editForm && (
        <Modal title={`Edit ${editTarget.fullName}`} onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEditSave} className="space-y-4">
            {isAdmin && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full name *</label>
                <input
                  required
                  className={inputCls}
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Trades they teach *</p>
              <div className="flex flex-wrap gap-2">
                {TRADE_OPTIONS.map((trade) => (
                  <button
                    key={trade}
                    type="button"
                    onClick={() => toggleEditTrade(trade)}
                    className={cn(
                      'text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors',
                      editForm.trades.includes(trade)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    )}
                  >
                    {trade}
                  </button>
                ))}
              </div>
            </div>
            {editError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDelete && deleteTarget && (
        <Modal title={`Delete ${deleteTarget.fullName}`} onClose={() => setShowDelete(false)}>
          <div className="space-y-4">
            {deleteLoading && !deleteCounts && (
              <p className="text-sm text-gray-500">Checking linked records…</p>
            )}
            {deleteCounts && deleteBlocked && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {formatDependencyBlock(deleteTarget.fullName, deleteCounts)}
              </p>
            )}
            {deleteCounts && !deleteBlocked && (
              <p className="text-sm text-gray-600">
                This permanently deletes <strong>{deleteTarget.fullName}</strong> and their account.
                This cannot be undone.
              </p>
            )}
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading || deleteBlocked || !deleteCounts}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLoading ? 'Deleting…' : 'Delete trainer'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
