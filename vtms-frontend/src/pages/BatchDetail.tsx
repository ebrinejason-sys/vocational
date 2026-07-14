import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ArrowLeft, Users, GraduationCap, UserMinus,
  DollarSign, ClipboardList, Pencil, UserPlus, Wrench,
  PauseCircle, PlayCircle, Trash2,
} from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import {
  cn, formatCurrency, formatDate, getVulnerabilityLabel, getAttendanceRate,
  friendlyError,
} from '../lib/utils';
import { COMPETENCY_LEVEL_LABELS, TRADE_OPTIONS } from '../types';
import type { BatchStatus, CompetencyLevel, TradeType } from '../types';
import { supabase } from '../lib/supabase';
import { countBatchDependencies } from '../lib/deleteGuards';
import { formatDependencyBlock } from '../lib/lifecycle';
import Modal from '../components/Modal';
import { RegistrationForm } from './Trainees';

const TRADE_COLORS: Record<string, string> = {
  Carpentry: 'bg-amber-100 text-amber-700',
  Tailoring: 'bg-pink-100 text-pink-700',
  Masonry: 'bg-stone-100 text-stone-700',
  Electricity: 'bg-yellow-100 text-yellow-700',
};

const STATUS_COLORS: Record<string, string> = {
  enrolled: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  alumni: 'bg-blue-100 text-blue-700',
  graduated: 'bg-blue-100 text-blue-700',
  dropped: 'bg-red-100 text-red-700',
  prospect: 'bg-yellow-100 text-yellow-700',
};

const BATCH_STATUS_COLORS: Record<BatchStatus, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  planned: 'bg-yellow-100 text-yellow-700',
  paused: 'bg-amber-100 text-amber-800',
  archived: 'bg-gray-100 text-gray-500',
};

interface TrainerOption {
  id: string;
  fullName: string;
  trades: TradeType[];
  active: boolean;
}

interface EditForm {
  name: string;
  startDate: string;
  endDate: string;
  status: BatchStatus;
  budgetAllocated: string;
  targetEnrollment: string;
  description: string;
  selectedTrades: TradeType[];
  trainersByTrade: Partial<Record<TradeType, string>>;
}

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    batches,
    trainees,
    attendanceRecords,
    competencyAssessments,
    financialTransactions,
    updateBatch,
    pauseBatch,
    resumeBatch,
    deleteBatch,
  } = useStore();

  const mayEditBatch = profile ? canEdit(profile.role, 'batches') : false;
  const mayEditTrainees = profile ? canEdit(profile.role, 'trainees') : false;

  const batch = batches.find((b) => b.id === id);
  const batchTrainees = useMemo(
    () => trainees.filter((t) => t.batchId === id),
    [trainees, id]
  );

  const [showEdit, setShowEdit] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteCounts, setDeleteCounts] = useState<Record<string, number> | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

  useEffect(() => {
    if (!showEdit) return;
    let cancelled = false;
    (async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, active, profile_trades(trade)')
        .eq('role', 'trainer')
        .order('full_name');
      if (cancelled || !profiles) return;
      setTrainers(
        profiles.map((p) => ({
          id: p.id as string,
          fullName: p.full_name as string,
          active: p.active as boolean,
          trades: ((p.profile_trades as { trade: string }[] | null) ?? []).map((t) => t.trade as TradeType),
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [showEdit]);

  const batchFinancials = useMemo(
    () => financialTransactions.filter((ft) => ft.batchId === id),
    [financialTransactions, id]
  );

  const expenseByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    batchFinancials
      .filter((ft) => ft.type === 'expense')
      .forEach((ft) => {
        grouped[ft.category] = (grouped[ft.category] || 0) + ft.amount;
      });
    return Object.entries(grouped).map(([category, amount]) => ({
      category: category.length > 14 ? `${category.substring(0, 14)}…` : category,
      amount,
    }));
  }, [batchFinancials]);

  if (!batch) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-semibold text-gray-700">Batch not found</p>
        <p className="text-sm text-gray-400 mt-1">The batch you are looking for does not exist.</p>
        <button
          type="button"
          onClick={() => navigate('/batches')}
          className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          Back to Batches
        </button>
      </div>
    );
  }

  const enrolledCount = batchTrainees.filter(
    (t) => t.status === 'enrolled' || t.status === 'prospect'
  ).length;
  const graduatedCount = batchTrainees.filter(
    (t) => t.status === 'alumni' || t.status === 'graduated'
  ).length;
  const droppedCount = batchTrainees.filter((t) => t.status === 'dropped').length;
  const avgVulnerability =
    batchTrainees.length > 0
      ? Math.round(batchTrainees.reduce((s, t) => s + t.vulnerabilityScore, 0) / batchTrainees.length)
      : 0;

  const totalIncome = batchFinancials
    .filter((ft) => ft.type === 'income')
    .reduce((s, ft) => s + ft.amount, 0);
  const totalExpenses = batchFinancials
    .filter((ft) => ft.type === 'expense')
    .reduce((s, ft) => s + ft.amount, 0);
  const remaining = batch.budgetAllocated - totalExpenses;

  const budgetChartData = [
    { name: 'Budget', amount: batch.budgetAllocated },
    { name: 'Spent', amount: totalExpenses },
    { name: 'Remaining', amount: Math.max(0, remaining) },
  ];

  const traineeIds = batchTrainees.map((t) => t.id);

  const getTraineeAttendance = (traineeId: string) => {
    const records = attendanceRecords.filter((r) => r.traineeId === traineeId);
    const present = records.filter(
      (r) => r.status === 'present' || r.status === 'late'
    ).length;
    return getAttendanceRate(present, records.length);
  };

  const getTraineeCompetencyLevel = (traineeId: string): CompetencyLevel | null => {
    const assessments = competencyAssessments.filter((ca) => ca.traineeId === traineeId);
    if (assessments.length === 0) return null;
    const latest = [...assessments].sort(
      (a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
    )[0];
    return latest.level;
  };

  const batchAttendanceRecords = attendanceRecords.filter((r) => traineeIds.includes(r.traineeId));
  const batchPresentCount = batchAttendanceRecords.filter(
    (r) => r.status === 'present' || r.status === 'late'
  ).length;
  const overallAttendanceRate = getAttendanceRate(batchPresentCount, batchAttendanceRecords.length);
  const missingTrainers = batch.trades.some((t) => !t.trainerId);
  const vulnLabel = getVulnerabilityLabel(avgVulnerability);

  function openEdit() {
    setEditError(null);
    setEditForm({
      name: batch!.name,
      startDate: batch!.startDate,
      endDate: batch!.endDate ?? '',
      status: batch!.status,
      budgetAllocated: String(batch!.budgetAllocated),
      targetEnrollment: String(batch!.targetEnrollment),
      description: batch!.description,
      selectedTrades: batch!.trades.map((t) => t.trade),
      trainersByTrade: Object.fromEntries(
        batch!.trades.map((t) => [t.trade, t.trainerId ?? ''])
      ) as Partial<Record<TradeType, string>>,
    });
    setShowEdit(true);
  }

  function toggleTrade(trade: TradeType) {
    setEditForm((prev) => {
      if (!prev) return prev;
      const selected = prev.selectedTrades.includes(trade)
        ? prev.selectedTrades.filter((t) => t !== trade)
        : [...prev.selectedTrades, trade];
      const trainersByTrade = { ...prev.trainersByTrade };
      if (!selected.includes(trade)) delete trainersByTrade[trade];
      return { ...prev, selectedTrades: selected, trainersByTrade };
    });
  }

  async function handlePause() {
    if (!batch) return;
    setLifecycleError(null);
    setLifecycleLoading(true);
    try {
      await pauseBatch(batch.id);
    } catch (err) {
      setLifecycleError(friendlyError(err, 'Failed to pause batch.'));
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function handleResume() {
    if (!batch) return;
    setLifecycleError(null);
    setLifecycleLoading(true);
    try {
      await resumeBatch(batch.id);
    } catch (err) {
      setLifecycleError(friendlyError(err, 'Failed to resume batch.'));
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function openDelete() {
    if (!batch) return;
    setDeleteError(null);
    setDeleteCounts(null);
    setDeleteBlocked(false);
    setShowDelete(true);
    setDeleteLoading(true);
    try {
      const counts = await countBatchDependencies(batch.id);
      setDeleteCounts(counts);
      setDeleteBlocked(Object.values(counts).some((n) => n > 0));
    } catch (err) {
      setDeleteError(friendlyError(err, 'Failed to check dependencies.'));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function confirmDelete() {
    if (!batch || deleteBlocked) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      await deleteBatch(batch.id);
      navigate('/batches');
    } catch (err) {
      setDeleteError(friendlyError(err, 'Failed to delete batch.'));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm || !batch) return;
    setEditError(null);
    if (!editForm.name.trim()) {
      setEditError('Batch name is required.');
      return;
    }
    if (!editForm.selectedTrades.length) {
      setEditError('Select at least one trade.');
      return;
    }
    for (const trade of editForm.selectedTrades) {
      if (!editForm.trainersByTrade[trade]) {
        setEditError(`Pick a trainer for ${trade}.`);
        return;
      }
    }
    setSaving(true);
    try {
      await updateBatch(batch.id, {
        name: editForm.name.trim(),
        startDate: editForm.startDate,
        endDate: editForm.endDate.trim() || null,
        status: editForm.status,
        budgetAllocated: Number(editForm.budgetAllocated) || 0,
        targetEnrollment: Number(editForm.targetEnrollment) || 0,
        description: editForm.description.trim(),
        trades: editForm.selectedTrades.map((trade) => {
          const trainerId = editForm.trainersByTrade[trade]!;
          const trainer = trainers.find((t) => t.id === trainerId);
          return {
            trade,
            trainerId,
            trainerName: trainer?.fullName ?? batch.trades.find((x) => x.trade === trade)?.trainerName ?? '',
          };
        }),
      });
      setShowEdit(false);
    } catch (err) {
      setEditError(friendlyError(err, 'Failed to update batch.'));
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white';

  const trainerOptions = editForm
    ? trainers.filter(
        (t) => t.active || Object.values(editForm.trainersByTrade).includes(t.id)
      )
    : trainers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/batches')}
          className="mt-0.5 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="Back to batches"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl font-bold text-gray-900">{batch.name}</h2>
            {batch.trades.map((t) => (
              <span key={t.trade} className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', TRADE_COLORS[t.trade])}>
                {t.trade}
              </span>
            ))}
            <span className={cn(
              'text-[11px] font-bold px-2 py-0.5 rounded-full capitalize',
              BATCH_STATUS_COLORS[batch.status]
            )}>
              {batch.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {formatDate(batch.startDate)} – {batch.endDate ? formatDate(batch.endDate) : 'Ongoing'}
            {' · '}
            Target {batch.targetEnrollment} · Budget {formatCurrency(batch.budgetAllocated)}
          </p>
          {batch.trades.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
              {batch.trades.map((t) => (
                <li key={t.trade}>
                  <span className="font-semibold">{t.trade}:</span>{' '}
                  {t.trainerName || (
                    <span className="text-amber-700">No trainer — edit batch to assign</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {batch.description && (
            <p className="text-xs text-gray-400 mt-1">{batch.description}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          {mayEditBatch && (
            <>
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              {(batch.status === 'active' || batch.status === 'planned') && (
                <button
                  type="button"
                  onClick={handlePause}
                  disabled={lifecycleLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-amber-200 text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                >
                  <PauseCircle className="w-4 h-4" />
                  Pause
                </button>
              )}
              {batch.status === 'paused' && (
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={lifecycleLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-green-200 text-green-800 hover:bg-green-50 disabled:opacity-60"
                >
                  <PlayCircle className="w-4 h-4" />
                  Resume
                </button>
              )}
              <button
                type="button"
                onClick={openDelete}
                disabled={lifecycleLoading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
          {mayEditTrainees && (
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
            >
              <UserPlus className="w-4 h-4" />
              Add trainee
            </button>
          )}
        </div>
      </div>

      {lifecycleError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {lifecycleError}
        </div>
      )}

      {missingTrainers && mayEditBatch && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
          <p>Some trades have no trainer yet. Assign them so registration shows who teaches each trade.</p>
          <button type="button" onClick={openEdit} className="text-xs font-semibold underline">
            Assign trainers
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Enrolled', value: enrolledCount, sub: `of ${batch.targetEnrollment} target` },
          {
            icon: GraduationCap,
            label: 'Graduated',
            value: graduatedCount,
            sub: batchTrainees.length > 0
              ? `${Math.round((graduatedCount / batchTrainees.length) * 100)}% grad rate`
              : '—',
          },
          {
            icon: UserMinus,
            label: 'Dropped',
            value: droppedCount,
            sub: batchTrainees.length > 0
              ? `${Math.round((droppedCount / batchTrainees.length) * 100)}% of intake`
              : '—',
          },
          {
            icon: DollarSign,
            label: 'Avg Vulnerability',
            value: avgVulnerability,
            sub: vulnLabel.label,
          },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Icon className="w-3.5 h-3.5 text-primary-500" />
              {label}
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Budget / attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary-500" />
            Budget vs Actual Spend
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(batch.budgetAllocated)}</p>
              <p className="text-[10px] text-gray-400">Budget</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-700">{formatCurrency(totalIncome)}</p>
              <p className="text-[10px] text-gray-400">Total Income</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
              <p className="text-[10px] text-gray-400">Spent</p>
            </div>
          </div>
          <div className="h-40 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={budgetChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                <Bar dataKey="amount" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Budget utilisation {batch.budgetAllocated > 0
              ? Math.round((totalExpenses / batch.budgetAllocated) * 100)
              : 0}% · {formatCurrency(Math.max(0, remaining))} remaining
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary-500" />
            Attendance Overview
          </h3>
          <p className="text-3xl font-bold text-primary-700">{overallAttendanceRate}%</p>
          <p className="text-xs text-gray-400 mb-4">Overall attendance rate</p>
          <p className="text-sm text-gray-600">
            {batchPresentCount} of {batchAttendanceRecords.length} records marked present/late
          </p>
          {expenseByCategory.length > 0 && (
            <div className="h-36 mt-4 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={expenseByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                  <Legend />
                  <Bar dataKey="amount" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Trainees */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-gray-700">
              Trainees ({batchTrainees.length})
            </h3>
          </div>
          {mayEditTrainees && (
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add trainee
            </button>
          )}
        </div>

        {batchTrainees.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-gray-600">No trainees in this batch yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Register someone into {batch.name} and choose their trade
              {batch.trades.length ? ` (${batch.trades.map((t) => t.trade).join(', ')})` : ''}.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {mayEditTrainees && (
                <button
                  type="button"
                  onClick={() => setShowRegister(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
                >
                  <UserPlus className="w-4 h-4" />
                  Register first trainee
                </button>
              )}
              {mayEditBatch && (
                <Link
                  to="/trainers"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Wrench className="w-4 h-4" />
                  Manage trainers
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {batchTrainees.map((trainee) => {
              const vuln = getVulnerabilityLabel(trainee.vulnerabilityScore);
              const attRate = getTraineeAttendance(trainee.id);
              const compLevel = getTraineeCompetencyLevel(trainee.id);

              return (
                <button
                  key={trainee.id}
                  type="button"
                  onClick={() => navigate(`/trainees/${trainee.id}`)}
                  className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-sky-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                    {trainee.firstName[0]}{trainee.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {trainee.firstName} {trainee.lastName}
                      </p>
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize',
                        STATUS_COLORS[trainee.status] ?? 'bg-gray-100 text-gray-500'
                      )}>
                        {trainee.status}
                      </span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', TRADE_COLORS[trainee.trade] ?? 'bg-gray-100')}>
                        {trainee.trade}
                      </span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', vuln.color)}>
                        Vuln: {trainee.vulnerabilityScore}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {trainee.gender === 'male' ? 'M' : 'F'}
                      {trainee.mobilizationSource ? ` · ${trainee.mobilizationSource}` : ''}
                      {trainee.graduationDate ? ` · Graduated ${formatDate(trainee.graduationDate)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center hidden sm:block">
                      <span className={cn(
                        'text-xs font-semibold',
                        attRate >= 80 ? 'text-green-600' : attRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {attRate}%
                      </span>
                      <p className="text-[10px] text-gray-400">Attend.</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      {compLevel ? (
                        <span className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                          COMPETENCY_LEVEL_LABELS[compLevel].color
                        )}>
                          L{compLevel}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300 font-medium">No data</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showEdit && editForm && (
        <Modal title={`Edit ${batch.name}`} onClose={() => setShowEdit(false)} size="lg">
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input className={inputCls} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status *</label>
                <select
                  className={inputCls}
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as BatchStatus })}
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Start date *</label>
                <input type="date" required className={inputCls} value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">End date</label>
                <input type="date" className={inputCls} value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Budget (USD)</label>
                <input className={inputCls} value={editForm.budgetAllocated} onChange={(e) => setEditForm({ ...editForm, budgetAllocated: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Target enrollment</label>
                <input className={inputCls} value={editForm.targetEnrollment} onChange={(e) => setEditForm({ ...editForm, targetEnrollment: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea className={inputCls} rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Trades & trainers *</p>
              <div className="space-y-2">
                {TRADE_OPTIONS.map((trade) => {
                  const checked = editForm.selectedTrades.includes(trade);
                  const options = trainerOptions.filter((t) => t.trades.includes(trade));
                  return (
                    <div key={trade} className="rounded-lg border border-gray-100 p-3 space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTrade(trade)}
                          className="rounded border-gray-300 text-primary-600"
                        />
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', TRADE_COLORS[trade])}>{trade}</span>
                      </label>
                      {checked && (
                        <select
                          className={inputCls}
                          value={editForm.trainersByTrade[trade] ?? ''}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              trainersByTrade: { ...editForm.trainersByTrade, [trade]: e.target.value },
                            })
                          }
                        >
                          <option value="">Select trainer…</option>
                          {options.map((t) => (
                            <option key={t.id} value={t.id}>{t.fullName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                Need more trainers? <Link to="/trainers" className="text-primary-600 font-medium">Open Trainers</Link>
              </p>
            </div>

            {editError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showRegister && (
        <Modal title={`Add trainee · ${batch.name}`} onClose={() => setShowRegister(false)} size="lg">
          <RegistrationForm
            fixedBatchId={batch.id}
            onClose={() => setShowRegister(false)}
          />
        </Modal>
      )}

      {showDelete && (
        <Modal title={`Delete ${batch.name}`} onClose={() => setShowDelete(false)}>
          <div className="space-y-4">
            {deleteLoading && !deleteCounts && (
              <p className="text-sm text-gray-500">Checking linked records…</p>
            )}
            {deleteCounts && deleteBlocked && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {formatDependencyBlock(batch.name, deleteCounts)}
              </p>
            )}
            {deleteCounts && !deleteBlocked && (
              <p className="text-sm text-gray-600">
                This permanently deletes <strong>{batch.name}</strong> and its trade assignments.
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
                {deleteLoading ? 'Deleting…' : 'Delete batch'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
