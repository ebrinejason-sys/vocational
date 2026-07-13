import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, GraduationCap, TrendingUp, ClipboardList, AlertTriangle,
  Package, BookOpen, UserPlus, ChevronRight, Activity,
} from 'lucide-react';
import { useStore } from '../store';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { COMPETENCY_LEVEL_LABELS, CASE_CATEGORY_LABELS } from '../types';
import type { CompetencyLevel } from '../types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getLast7Days(): { date: string; label: string }[] {
  const days: { date: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = DAY_LABELS[d.getDay()];
    days.push({ date: dateStr, label });
  }
  return days;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    batches,
    trainees,
    attendanceRecords,
    caseNotes,
    inventoryItems,
    competencyAssessments,
    alumniFollowUps,
    activeBatchId,
  } = useStore();

  // ── Top stats ──────────────────────────────────────────────────────────────

  const totalTrainees = trainees.length;

  // The active batch is whichever one is selected in the sidebar (see
  // Layout.tsx) -- there is no fixed "batch 5" now that batches are real,
  // per-organization Supabase data instead of a fixed local seed set.
  const batch5 = batches.find((b) => b.id === activeBatchId);
  const batch5Trainees = trainees.filter((t) => t.batchId === activeBatchId);
  const activeTrainees = batch5Trainees.filter((t) => t.status === 'enrolled').length;

  // Graduation rate across all completed batches
  const completedBatchIds = batches
    .filter((b) => b.status === 'completed')
    .map((b) => b.id);
  const completedBatchTrainees = trainees.filter((t) =>
    completedBatchIds.includes(t.batchId)
  );
  const graduatedCount = completedBatchTrainees.filter(
    (t) => t.status === 'alumni' || t.status === 'graduated'
  ).length;
  const graduationRate =
    completedBatchTrainees.length > 0
      ? Math.round((graduatedCount / completedBatchTrainees.length) * 100)
      : 0;

  // Employment rate: alumni with follow-ups who are employed/self-employed
  const alumniWithFollowUp = alumniFollowUps.length;
  const employedCount = alumniFollowUps.filter(
    (f) => f.employmentStatus === 'employed' || f.employmentStatus === 'self_employed'
  ).length;
  const employmentRate =
    alumniWithFollowUp > 0 ? Math.round((employedCount / alumniWithFollowUp) * 100) : 0;

  // ── Weekly attendance chart ────────────────────────────────────────────────

  const batch5TraineeIds = batch5Trainees.map((t) => t.id);
  const last7Days = useMemo(() => getLast7Days(), []);

  const weeklyAttendanceData = useMemo(() => {
    return last7Days.map(({ date, label }) => {
      const dayRecords = attendanceRecords.filter(
        (r) => r.date === date && batch5TraineeIds.includes(r.traineeId)
      );
      const totalExpected = batch5TraineeIds.length;
      const presentCount = dayRecords.filter(
        (r) => r.status === 'present' || r.status === 'late'
      ).length;
      const pct = totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100) : 0;
      return { day: label, attendance: pct, present: presentCount, total: totalExpected };
    });
  }, [attendanceRecords, batch5TraineeIds, last7Days]);

  // Attendance rate this week (average across the 7 days with records)
  const daysWithRecords = weeklyAttendanceData.filter((d) => d.total > 0);
  const weeklyAttendanceRate =
    daysWithRecords.length > 0
      ? Math.round(
          daysWithRecords.reduce((sum, d) => sum + d.attendance, 0) / daysWithRecords.length
        )
      : 0;

  // ── Batch comparison chart (Batches 1–4) ──────────────────────────────────

  const batchComparisonData = useMemo(() => {
    return batches
      .filter((b) => b.status === 'completed')
      .map((b) => {
        const bTrainees = trainees.filter((t) => t.batchId === b.id);
        const grad = bTrainees.filter(
          (t) => t.status === 'alumni' || t.status === 'graduated'
        ).length;
        const gradRate =
          bTrainees.length > 0 ? Math.round((grad / bTrainees.length) * 100) : 0;
        // Use targetEnrollment as the batch size for the bar (more accurate representation)
        return {
          batch: b.name.replace(/ — .*$/, '').replace('Batch ', 'B'),
          enrolled: b.targetEnrollment,
          graduated: grad,
          gradRate,
        };
      });
  }, [batches, trainees]);

  // ── Active batch progress ─────────────────────────────────────────────────

  const batch5Progress = useMemo(() => {
    if (!batch5) return 0;
    const startDate = new Date(batch5.startDate);
    const today = new Date();
    // Estimate 6-month duration
    const totalDays = 180;
    const elapsed = Math.max(0, Math.round((today.getTime() - startDate.getTime()) / 86400000));
    return Math.min(100, Math.round((elapsed / totalDays) * 100));
  }, [batch5]);

  // ── Competency progress (Batch 5) ─────────────────────────────────────────

  const competencyDistribution = useMemo(() => {
    const b5Assessments = competencyAssessments.filter((ca) =>
      batch5TraineeIds.includes(ca.traineeId)
    );
    const counts: Record<CompetencyLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    b5Assessments.forEach((ca) => {
      counts[ca.level] = (counts[ca.level] || 0) + 1;
    });
    const total = b5Assessments.length;
    return ([1, 2, 3, 4] as CompetencyLevel[]).map((level) => ({
      level,
      label: COMPETENCY_LEVEL_LABELS[level].label,
      color: COMPETENCY_LEVEL_LABELS[level].color,
      count: counts[level],
      pct: total > 0 ? Math.round((counts[level] / total) * 100) : 0,
    }));
  }, [competencyAssessments, batch5TraineeIds]);

  // ── Critical case notes ───────────────────────────────────────────────────

  const alertCaseNotes = useMemo(() => {
    const sorted = [...caseNotes].sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, 3);
  }, [caseNotes]);

  // ── Low inventory ─────────────────────────────────────────────────────────

  const lowInventory = inventoryItems.filter(
    (item) => item.quantityOnHand < item.reorderLevel
  );

  // ── Stat card component ───────────────────────────────────────────────────

  const StatCard = ({
    icon: Icon,
    label,
    value,
    sub,
    accent = false,
  }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    accent?: boolean;
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          accent ? 'bg-primary-100' : 'bg-gray-100'
        )}
      >
        <Icon className={cn('w-5 h-5', accent ? 'text-primary-600' : 'text-gray-500')} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={cn('text-2xl font-bold leading-tight', accent ? 'text-primary-600' : 'text-gray-900')}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Row 1: Top stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Trainees All-Time"
          value={totalTrainees}
          sub={`Across ${batches.length} batches`}
          accent
        />
        <StatCard
          icon={Activity}
          label="Active Trainees"
          value={activeTrainees}
          sub={batch5 ? `${batch5.name} — Enrolled` : 'No active batch — Enrolled'}
          accent
        />
        <StatCard
          icon={GraduationCap}
          label="Graduation Rate"
          value={`${graduationRate}%`}
          sub={`${graduatedCount} of ${completedBatchTrainees.length} completed`}
        />
        <StatCard
          icon={TrendingUp}
          label="Employment Rate"
          value={`${employmentRate}%`}
          sub={`${employedCount} of ${alumniWithFollowUp} tracked alumni`}
        />
      </div>

      {/* ── Row 2: Attendance rate + Batch progress + Quick actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attendance rate */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">This Week's Attendance</p>
            <ClipboardList className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-primary-600">{weeklyAttendanceRate}%</p>
          <p className="text-xs text-gray-400 mt-1">{batch5 ? batch5.name : 'No active batch'} · Last 7 days</p>
          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${weeklyAttendanceRate}%` }}
            />
          </div>
        </div>

        {/* Active batch progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Active Batch Progress</p>
            <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase">
              Active
            </span>
          </div>
          {batch5 ? (
            <>
              <p className="text-base font-bold text-gray-900">{batch5.name}</p>
              <p className="text-xs text-gray-400 mb-3">
                {batch5.trainerName} · Started {formatDate(batch5.startDate)}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Programme Progress</span>
                <span className="font-semibold text-primary-600">{batch5Progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${batch5Progress}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                {activeTrainees} of {batch5.targetEnrollment} trainees enrolled
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">No batch selected yet.</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</p>
          <div className="space-y-2">
            {[
              { label: 'Log Attendance', icon: ClipboardList, to: '/attendance' },
              { label: 'Add Trainee', icon: UserPlus, to: '/trainees' },
              { label: 'Record Assessment', icon: BookOpen, to: '/competency' },
            ].map(({ label, icon: Icon, to }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-primary-50 hover:text-primary-700 text-gray-700 text-sm font-medium transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
                  {label}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Charts side-by-side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly attendance bar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">{batch5 ? batch5.name : 'Active Batch'} — Daily Attendance (Last 7 Days)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyAttendanceData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: unknown) => [`${value}%`, 'Attendance']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="attendance" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Batch comparison chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Batch Comparison — Enrollment vs Graduation Rate</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={batchComparisonData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="batch" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'Trainees', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94a3b8' } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="enrolled" name="Target Enrolled" fill="#99f6e4" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="graduated" name="Graduated" fill="#0d9488" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="gradRate"
                name="Grad Rate %"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 4, fill: '#16a34a' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 4: Alerts + Competency ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Case notes alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Recent Case Alerts</p>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="space-y-3">
            {alertCaseNotes.map((note) => {
              const trainee = trainees.find((t) => t.id === note.traineeId);
              return (
                <div
                  key={note.id}
                  className={cn(
                    'p-3 rounded-lg border text-xs',
                    note.isCritical
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-100'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-800">
                      {trainee ? `${trainee.firstName} ${trainee.lastName}` : 'Unknown'}
                    </span>
                    {note.isCritical && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase">
                        Critical
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 mb-1">{CASE_CATEGORY_LABELS[note.category]}</p>
                  <p className="text-gray-600 line-clamp-2">{note.content}</p>
                  <p className="text-gray-400 mt-1">{formatDate(note.createdAt)} · {note.authorName}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low inventory alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Low Inventory Alerts</p>
            <Package className="w-4 h-4 text-orange-500" />
          </div>
          {lowInventory.length === 0 ? (
            <p className="text-xs text-gray-400">All inventory levels are adequate.</p>
          ) : (
            <div className="space-y-3">
              {lowInventory.map((item) => {
                const pct = Math.round((item.quantityOnHand / item.reorderLevel) * 100);
                return (
                  <div key={item.id} className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-800">{item.name}</p>
                      <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded uppercase">
                        Low Stock
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {item.quantityOnHand} {item.unit} on hand · Reorder at {item.reorderLevel}
                    </p>
                    <div className="mt-2 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 rounded-full"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Competency progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">{batch5 ? batch5.name : 'Active Batch'} Competency Levels</p>
            <BookOpen className="w-4 h-4 text-primary-500" />
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Distribution across {competencyAssessments.filter((ca) => batch5TraineeIds.includes(ca.traineeId)).length} assessments
          </p>
          <div className="space-y-3">
            {competencyDistribution.map(({ level, label, color, count, pct }) => (
              <div key={level}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', color)}>
                    L{level} · {label}
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      level === 1 ? 'bg-red-400' :
                      level === 2 ? 'bg-yellow-400' :
                      level === 3 ? 'bg-blue-400' : 'bg-green-400'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
