import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Layers, Calendar, User, DollarSign, Users,
  GraduationCap, ChevronRight, CheckCircle, Clock, Archive,
} from 'lucide-react';
import { useStore } from '../store';
import { cn, formatCurrency, formatDate, generateId } from '../lib/utils';
import type { TradeType, Batch } from '../types';

const TRADE_OPTIONS: TradeType[] = ['Carpentry', 'Tailoring', 'Masonry', 'Electricity', 'Entrepreneurship'];

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
  Entrepreneurship: 'bg-purple-100 text-purple-700',
};

interface NewBatchForm {
  name: string;
  trade: TradeType;
  startDate: string;
  trainerName: string;
  budgetAllocated: string;
  targetEnrollment: string;
  description: string;
}

const EMPTY_FORM: NewBatchForm = {
  name: '',
  trade: 'Carpentry',
  startDate: '',
  trainerName: '',
  budgetAllocated: '',
  targetEnrollment: '',
  description: '',
};

export default function Batches() {
  const navigate = useNavigate();
  const { batches, trainees, addBatch } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewBatchForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<NewBatchForm>>({});

  const validate = (): boolean => {
    const newErrors: Partial<NewBatchForm> = {};
    if (!form.name.trim()) newErrors.name = 'Batch name is required';
    if (!form.startDate) newErrors.startDate = 'Start date is required';
    if (!form.trainerName.trim()) newErrors.trainerName = 'Trainer name is required';
    if (!form.budgetAllocated || isNaN(Number(form.budgetAllocated)))
      newErrors.budgetAllocated = 'Valid budget is required';
    if (!form.targetEnrollment || isNaN(Number(form.targetEnrollment)))
      newErrors.targetEnrollment = 'Valid target enrollment is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const newBatch: Batch = {
      id: generateId(),
      name: form.name.trim(),
      trade: form.trade,
      startDate: form.startDate,
      endDate: null,
      status: 'planned',
      budgetAllocated: Number(form.budgetAllocated),
      targetEnrollment: Number(form.targetEnrollment),
      trainerName: form.trainerName.trim(),
      description: form.description.trim(),
    };

    addBatch(newBatch);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(false);
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
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
    </div>
  );

  const inputCls = (hasError?: string) =>
    cn(
      'w-full border rounded-lg px-3 py-2 text-sm text-gray-800 outline-none transition-colors',
      hasError
        ? 'border-red-300 focus:border-red-400'
        : 'border-gray-200 focus:border-primary-400'
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Batches</h2>
          <p className="text-sm text-gray-500 mt-0.5">{batches.length} batches total</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            showForm
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          )}
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> New Batch
            </>
          )}
        </button>
      </div>

      {/* New batch form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-primary-100 p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary-600" />
            Create New Batch
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Batch Name *" error={errors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Batch 6 — Tailoring 2026"
                  className={inputCls(errors.name)}
                />
              </Field>

              <Field label="Trade *">
                <select
                  value={form.trade}
                  onChange={(e) => setForm({ ...form, trade: e.target.value as TradeType })}
                  className={inputCls()}
                >
                  {TRADE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>

              <Field label="Start Date *" error={errors.startDate}>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={inputCls(errors.startDate)}
                />
              </Field>

              <Field label="Trainer Name *" error={errors.trainerName}>
                <input
                  type="text"
                  value={form.trainerName}
                  onChange={(e) => setForm({ ...form, trainerName: e.target.value })}
                  placeholder="e.g. Ms. Kyomuhangi Grace"
                  className={inputCls(errors.trainerName)}
                />
              </Field>

              <Field label="Budget Allocated (UGX) *" error={errors.budgetAllocated}>
                <input
                  type="number"
                  min="0"
                  value={form.budgetAllocated}
                  onChange={(e) => setForm({ ...form, budgetAllocated: e.target.value })}
                  placeholder="e.g. 5500000"
                  className={inputCls(errors.budgetAllocated)}
                />
              </Field>

              <Field label="Target Enrollment *" error={errors.targetEnrollment}>
                <input
                  type="number"
                  min="1"
                  value={form.targetEnrollment}
                  onChange={(e) => setForm({ ...form, targetEnrollment: e.target.value })}
                  placeholder="e.g. 15"
                  className={inputCls(errors.targetEnrollment)}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the batch focus and target group..."
                rows={2}
                className={inputCls()}
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setErrors({}); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                Create Batch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Batch grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {batches.map((batch) => {
          const stats = getBatchStats(batch.id);
          const statusCfg = STATUS_CONFIG[batch.status];
          const StatusIcon = statusCfg.icon;

          return (
            <button
              key={batch.id}
              onClick={() => navigate(`/batches/${batch.id}`)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-left hover:border-primary-200 hover:shadow-md transition-all group"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate pr-2">{batch.name}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', TRADE_COLORS[batch.trade])}>
                      {batch.trade}
                    </span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', statusCfg.color)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400 shrink-0 mt-1 transition-colors" />
              </div>

              {/* Meta info */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <User className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">{batch.trainerName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>
                    {formatDate(batch.startDate)}
                    {batch.endDate ? ` – ${formatDate(batch.endDate)}` : ' – Ongoing'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <DollarSign className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>{formatCurrency(batch.budgetAllocated)}</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-primary-600">{stats.total}</p>
                  <p className="text-[10px] text-gray-400">Trainees</p>
                </div>
                <div className="w-px h-8 bg-gray-100" />
                {batch.status === 'active' ? (
                  <div className="flex-1 text-center">
                    <p className="text-lg font-bold text-green-600">{stats.enrolled}</p>
                    <p className="text-[10px] text-gray-400">Enrolled</p>
                  </div>
                ) : (
                  <div className="flex-1 text-center">
                    <p className="text-lg font-bold text-green-600">{stats.gradRate}%</p>
                    <p className="text-[10px] text-gray-400">Grad Rate</p>
                  </div>
                )}
                <div className="w-px h-8 bg-gray-100" />
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-gray-700">{batch.targetEnrollment}</p>
                  <p className="text-[10px] text-gray-400">Target</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
