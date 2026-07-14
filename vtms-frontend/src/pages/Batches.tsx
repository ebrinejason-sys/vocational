import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Layers, Calendar, DollarSign, Users,
  GraduationCap, ChevronRight, CheckCircle, Clock, Archive,
} from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import { cn, formatCurrency, formatDate, friendlyError, formatBatchTrades, formatBatchTrainers } from '../lib/utils';
import { TRADE_OPTIONS, type TradeType } from '../types';
import { supabase } from '../lib/supabase';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700', icon: GraduationCap },
  planned: { label: 'Planned', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-500', icon: Archive },
};

const TRADE_COLORS: Record<TradeType, string> = {
  Carpentry: 'bg-amber-100 text-amber-700',
  Tailoring: 'bg-pink-100 text-pink-700',
  Masonry: 'bg-stone-100 text-stone-700',
  Electricity: 'bg-yellow-100 text-yellow-700',
};

interface TrainerOption {
  id: string;
  fullName: string;
  trades: TradeType[];
}

interface NewBatchForm {
  name: string;
  startDate: string;
  budgetAllocated: string;
  targetEnrollment: string;
  description: string;
  selectedTrades: TradeType[];
  trainersByTrade: Partial<Record<TradeType, string>>;
}

const EMPTY_FORM: NewBatchForm = {
  name: '',
  startDate: '',
  budgetAllocated: '',
  targetEnrollment: '',
  description: '',
  selectedTrades: [],
  trainersByTrade: {},
};

export default function Batches() {
  const navigate = useNavigate();
  const { batches, trainees, addBatch } = useStore();
  const { profile } = useAuth();
  const mayEdit = profile ? canEdit(profile.role, 'batches') : false;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewBatchForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);

  useEffect(() => {
    if (!showForm) return;
    let cancelled = false;
    (async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, profile_trades(trade)')
        .eq('role', 'trainer')
        .eq('active', true)
        .order('full_name');
      if (cancelled || !profiles) return;
      setTrainers(
        profiles.map((p) => ({
          id: p.id as string,
          fullName: p.full_name as string,
          trades: ((p.profile_trades as { trade: string }[] | null) ?? []).map((t) => t.trade as TradeType),
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [showForm]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Batch name is required';
    if (!form.startDate) newErrors.startDate = 'Start date is required';
    if (!form.selectedTrades.length) newErrors.trades = 'Select at least one trade';
    for (const trade of form.selectedTrades) {
      if (!form.trainersByTrade[trade]) {
        newErrors[`trainer_${trade}`] = `Pick a trainer for ${trade}`;
      }
    }
    if (!form.budgetAllocated || isNaN(Number(form.budgetAllocated)))
      newErrors.budgetAllocated = 'Valid budget is required';
    if (!form.targetEnrollment || isNaN(Number(form.targetEnrollment)))
      newErrors.targetEnrollment = 'Valid target enrollment is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await addBatch({
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: null,
        status: 'planned',
        budgetAllocated: Number(form.budgetAllocated),
        targetEnrollment: Number(form.targetEnrollment),
        description: form.description.trim(),
        trades: form.selectedTrades.map((trade) => {
          const trainerId = form.trainersByTrade[trade]!;
          const trainer = trainers.find((t) => t.id === trainerId);
          return {
            trade,
            trainerId,
            trainerName: trainer?.fullName ?? '',
          };
        }),
      });
      setForm(EMPTY_FORM);
      setErrors({});
      setShowForm(false);
    } catch (err) {
      setErrors({ name: friendlyError(err, 'Failed to create batch.') });
    }
  };

  const toggleTrade = (trade: TradeType) => {
    setForm((prev) => {
      const selected = prev.selectedTrades.includes(trade)
        ? prev.selectedTrades.filter((t) => t !== trade)
        : [...prev.selectedTrades, trade];
      const trainersByTrade = { ...prev.trainersByTrade };
      if (!selected.includes(trade)) delete trainersByTrade[trade];
      return { ...prev, selectedTrades: selected, trainersByTrade };
    });
  };

  const getBatchStats = (batchId: string) => {
    const batchTrainees = trainees.filter((t) => t.batchId === batchId);
    const graduated = batchTrainees.filter(
      (t) => t.status === 'alumni' || t.status === 'graduated'
    ).length;
    const dropped = batchTrainees.filter((t) => t.status === 'dropped').length;
    const enrolled = batchTrainees.filter(
      (t) => t.status === 'enrolled' || t.status === 'prospect'
    ).length;
    const gradRate =
      batchTrainees.length > 0 ? Math.round((graduated / batchTrainees.length) * 100) : 0;
    return { total: batchTrainees.length, graduated, dropped, enrolled, gradRate };
  };

  const Field = ({
    label,
    error,
    children,
  }: {
    label: string;
    error?: string;
    children: React.ReactNode;
  }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );

  const inputCls = (error?: string) =>
    cn(
      'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white',
      error ? 'border-red-300' : 'border-gray-200'
    );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Batches</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cohorts can include multiple trades, each with an assigned trainer.
          </p>
        </div>
        {mayEdit && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              showForm
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            )}
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Batch'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-800">Create Batch</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Batch Name *" error={errors.name}>
              <input
                className={inputCls(errors.name)}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Batch 6 — 2026"
              />
            </Field>
            <Field label="Start Date *" error={errors.startDate}>
              <input
                type="date"
                className={inputCls(errors.startDate)}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="Budget (USD) *" error={errors.budgetAllocated}>
              <input
                className={inputCls(errors.budgetAllocated)}
                value={form.budgetAllocated}
                onChange={(e) => setForm({ ...form, budgetAllocated: e.target.value })}
                placeholder="3000"
              />
            </Field>
            <Field label="Target Enrollment *" error={errors.targetEnrollment}>
              <input
                className={inputCls(errors.targetEnrollment)}
                value={form.targetEnrollment}
                onChange={(e) => setForm({ ...form, targetEnrollment: e.target.value })}
                placeholder="40"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  className={inputCls()}
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Trades & trainers *</p>
            {errors.trades && <p className="text-xs text-red-600 mb-2">{errors.trades}</p>}
            <div className="space-y-3">
              {TRADE_OPTIONS.map((trade) => {
                const checked = form.selectedTrades.includes(trade);
                const options = trainers.filter((t) => t.trades.includes(trade));
                return (
                  <div key={trade} className="rounded-lg border border-gray-100 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTrade(trade)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-400"
                      />
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', TRADE_COLORS[trade])}>
                        {trade}
                      </span>
                    </label>
                    {checked && (
                      <div>
                        <select
                          className={inputCls(errors[`trainer_${trade}`])}
                          value={form.trainersByTrade[trade] ?? ''}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              trainersByTrade: { ...form.trainersByTrade, [trade]: e.target.value },
                            })
                          }
                        >
                          <option value="">Select trainer…</option>
                          {options.map((t) => (
                            <option key={t.id} value={t.id}>{t.fullName}</option>
                          ))}
                        </select>
                        {errors[`trainer_${trade}`] && (
                          <p className="text-xs text-red-600 mt-1">{errors[`trainer_${trade}`]}</p>
                        )}
                        {options.length === 0 && (
                          <p className="text-xs text-amber-700 mt-1">
                            No trainers tagged for {trade}. Add trade tags on the Trainers page first.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create Batch
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {batches.map((batch) => {
          const stats = getBatchStats(batch.id);
          const status = STATUS_CONFIG[batch.status];
          const StatusIcon = status.icon;
          return (
            <button
              key={batch.id}
              type="button"
              onClick={() => navigate(`/batches/${batch.id}`)}
              className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-primary-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-primary-600 shrink-0" />
                    <h3 className="font-bold text-gray-900 truncate">{batch.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {batch.trades.map((t) => (
                      <span key={t.trade} className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', TRADE_COLORS[t.trade])}>
                        {t.trade}
                      </span>
                    ))}
                    {!batch.trades.length && (
                      <span className="text-[10px] text-gray-400">No trades assigned</span>
                    )}
                  </div>
                </div>
                <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', status.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDate(batch.startDate)}</p>
                <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{stats.enrolled} enrolled · target {batch.targetEnrollment}</p>
                <p className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />{formatCurrency(batch.budgetAllocated)}</p>
                <p className="truncate">Trainers: {formatBatchTrainers(batch.trades)}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-primary-600 font-medium">
                <span>{formatBatchTrades(batch.trades)}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          );
        })}
      </div>

      {batches.length === 0 && (
        <div className="text-center py-16 text-gray-500 text-sm">
          No batches yet. {mayEdit ? 'Create one to start enrolling trainees.' : 'Ask an admin to create a batch.'}
        </div>
      )}
    </div>
  );
}
