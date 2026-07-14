import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ArrowLeft, Users, GraduationCap, UserMinus, TrendingUp,
  DollarSign, ClipboardList, BookOpen, Shield,
} from 'lucide-react';
import { useStore } from '../store';
import { cn, formatCurrency, formatDate, getVulnerabilityLabel, getAttendanceRate, formatBatchTrainers } from '../lib/utils';
import { COMPETENCY_LEVEL_LABELS } from '../types';
import type { CompetencyLevel } from '../types';

const TRADE_COLORS: Record<string, string> = {
  Carpentry: 'bg-amber-100 text-amber-700',
  Tailoring: 'bg-pink-100 text-pink-700',
  Masonry: 'bg-stone-100 text-stone-700',
  Electricity: 'bg-yellow-100 text-yellow-700',
};

const STATUS_COLORS: Record<string, string> = {
  enrolled: 'bg-green-100 text-green-700',
  alumni: 'bg-blue-100 text-blue-700',
  graduated: 'bg-blue-100 text-blue-700',
  dropped: 'bg-red-100 text-red-700',
  prospect: 'bg-yellow-100 text-yellow-700',
};

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    batches,
    trainees,
    attendanceRecords,
    competencyAssessments,
    financialTransactions,
  } = useStore();

  const batch = batches.find((b) => b.id === id);
  const batchTrainees = trainees.filter((t) => t.batchId === id);

  if (!batch) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-semibold text-gray-700">Batch not found</p>
        <p className="text-sm text-gray-400 mt-1">The batch you are looking for does not exist.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ── Batch-level stats ──────────────────────────────────────────────────────

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

  // ── Financial summary ──────────────────────────────────────────────────────

  const batchFinancials = financialTransactions.filter((ft) => ft.batchId === id);
  const totalIncome = batchFinancials
    .filter((ft) => ft.type === 'income')
    .reduce((s, ft) => s + ft.amount, 0);
  const totalExpenses = batchFinancials
    .filter((ft) => ft.type === 'expense')
    .reduce((s, ft) => s + ft.amount, 0);
  const remaining = batch.budgetAllocated - totalExpenses;

  // Group expenses by category for chart
  const expenseByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    batchFinancials
      .filter((ft) => ft.type === 'expense')
      .forEach((ft) => {
        grouped[ft.category] = (grouped[ft.category] || 0) + ft.amount;
      });
    return Object.entries(grouped).map(([category, amount]) => ({
      category: category.length > 14 ? category.substring(0, 14) + '…' : category,
      amount,
    }));
  }, [batchFinancials]);

  // Budget overview chart data
  const budgetChartData = [
    { name: 'Budget', amount: batch.budgetAllocated },
    { name: 'Spent', amount: totalExpenses },
    { name: 'Remaining', amount: Math.max(0, remaining) },
  ];

  // ── Per-trainee computed data ──────────────────────────────────────────────

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

  // ── Overall attendance for the batch ─────────────────────────────────────

  const batchAttendanceRecords = attendanceRecords.filter((r) => traineeIds.includes(r.traineeId));
  const batchPresentCount = batchAttendanceRecords.filter(
    (r) => r.status === 'present' || r.status === 'late'
  ).length;
  const overallAttendanceRate = getAttendanceRate(batchPresentCount, batchAttendanceRecords.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="mt-0.5 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="Go back"
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
              batch.status === 'active' ? 'bg-green-100 text-green-700' :
              batch.status === 'completed' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-500'
            )}>
              {batch.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Trainers: <strong className="text-gray-700">{formatBatchTrainers(batch.trades)}</strong>
            {' · '}
            {formatDate(batch.startDate)} – {batch.endDate ? formatDate(batch.endDate) : 'Ongoing'}
          </p>
          {batch.description && (
            <p className="text-xs text-gray-400 mt-1">{batch.description}</p>
          )}
        </div>
      </div>

      {/* ── Top stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: Users,
            label: 'Enrolled',
            value: enrolledCount,
            sub: `of ${batch.targetEnrollment} target`,
            accent: true,
          },
          {
            icon: GraduationCap,
            label: 'Graduated',
            value: graduatedCount,
            sub: batchTrainees.length > 0
              ? `${Math.round((graduatedCount / batchTrainees.length) * 100)}% grad rate`
              : '—',
            accent: false,
          },
          {
            icon: UserMinus,
            label: 'Dropped',
            value: droppedCount,
            sub: batchTrainees.length > 0
              ? `${Math.round((droppedCount / batchTrainees.length) * 100)}% of intake`
              : '—',
            accent: false,
          },
          {
            icon: Shield,
            label: 'Avg Vulnerability',
            value: avgVulnerability,
            sub: getVulnerabilityLabel(avgVulnerability).label,
            accent: false,
          },
        ].map(({ icon: Icon, label, value, sub, accent }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                accent ? 'bg-primary-100' : 'bg-gray-100'
              )}>
                <Icon className={cn('w-4 h-4', accent ? 'text-primary-600' : 'text-gray-500')} />
              </div>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
            <p className={cn('text-2xl font-bold', accent ? 'text-primary-600' : 'text-gray-900')}>
              {value}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Budget + Attendance row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget vs Actual */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-primary-500" />
            <p className="text-sm font-semibold text-gray-700">Budget vs Actual Spend</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Budget', amount: batch.budgetAllocated, color: 'text-gray-900' },
              { label: 'Total Income', amount: totalIncome, color: 'text-green-600' },
              { label: 'Spent', amount: totalExpenses, color: 'text-primary-600' },
            ].map(({ label, amount, color }) => (
              <div key={label} className="text-center">
                <p className={cn('text-base font-bold', color)}>{formatCurrency(amount)}</p>
                <p className="text-[10px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">Budget utilisation</span>
              <span className="font-semibold text-primary-600">
                {batch.budgetAllocated > 0
                  ? `${Math.min(100, Math.round((totalExpenses / batch.budgetAllocated) * 100))}%`
                  : '—'}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  totalExpenses > batch.budgetAllocated ? 'bg-red-500' : 'bg-primary-500'
                )}
                style={{
                  width: `${Math.min(100, batch.budgetAllocated > 0
                    ? Math.round((totalExpenses / batch.budgetAllocated) * 100)
                    : 0)}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {remaining >= 0 ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(Math.abs(remaining))} over budget`}
            </p>
          </div>

          {expenseByCategory.length > 0 && (
            <ResponsiveContainer width="100%" height={160} minWidth={0}>
              <BarChart data={expenseByCategory} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatCurrency(value as number), 'Spent']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }}
                />
                <Bar dataKey="amount" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Attendance summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-primary-500" />
            <p className="text-sm font-semibold text-gray-700">Attendance Overview</p>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div>
              <p className="text-3xl font-bold text-primary-600">{overallAttendanceRate}%</p>
              <p className="text-xs text-gray-400">Overall attendance rate</p>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${overallAttendanceRate}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {batchPresentCount} of {batchAttendanceRecords.length} records marked present/late
              </p>
            </div>
          </div>

          {/* Per-trainee attendance breakdown */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {batchTrainees.map((trainee) => {
              const rate = getTraineeAttendance(trainee.id);
              return (
                <div key={trainee.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-700 shrink-0">
                    {trainee.firstName[0]}{trainee.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">
                      {trainee.firstName} {trainee.lastName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          )}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500 w-8 text-right shrink-0">
                        {rate}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Trainee list ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-gray-700">
            Trainees ({batchTrainees.length})
          </h3>
        </div>

        {batchTrainees.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No trainees enrolled in this batch yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {batchTrainees.map((trainee) => {
              const vuln = getVulnerabilityLabel(trainee.vulnerabilityScore);
              const attRate = getTraineeAttendance(trainee.id);
              const compLevel = getTraineeCompetencyLevel(trainee.id);

              return (
                <div key={trainee.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                    {trainee.firstName[0]}{trainee.lastName[0]}
                  </div>

                  {/* Main info */}
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
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', vuln.color)}>
                        Vuln: {trainee.vulnerabilityScore}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {trainee.gender === 'male' ? 'M' : 'F'} · {trainee.mobilizationSource}
                      {trainee.graduationDate ? ` · Graduated ${formatDate(trainee.graduationDate)}` : ''}
                    </p>
                  </div>

                  {/* Right stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    {/* Attendance */}
                    <div className="text-center hidden sm:block">
                      <div className="flex items-center gap-1 text-xs">
                        <ClipboardList className="w-3 h-3 text-gray-400" />
                        <span className={cn(
                          'font-semibold',
                          attRate >= 80 ? 'text-green-600' : attRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                        )}>
                          {attRate}%
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">Attend.</p>
                    </div>

                    {/* Competency level */}
                    <div className="text-center hidden sm:block">
                      {compLevel ? (
                        <>
                          <span className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                            COMPETENCY_LEVEL_LABELS[compLevel].color
                          )}>
                            L{compLevel}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {COMPETENCY_LEVEL_LABELS[compLevel].label}
                          </p>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-300 font-medium">No data</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
