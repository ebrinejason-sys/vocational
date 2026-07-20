import React, { useMemo, useState, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Clock, Info, Save,
  ClipboardList, Users, ChevronDown,
} from 'lucide-react';
import { useStore } from '../store';
import { cn, generateId, today, formatDate, getAttendanceRate } from '../lib/utils';
import type { AttendanceRecord, AttendanceStatus } from '../types';
import ExportToolbar from '../components/ExportToolbar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLast7SessionDates(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// ── Attendance toggle button ──────────────────────────────────────────────────

type AttendanceOption = {
  status: AttendanceStatus;
  icon: React.ElementType;
  label: string;
  active: string;
  inactive: string;
};

const ATTENDANCE_OPTIONS: AttendanceOption[] = [
  {
    status: 'present',
    icon: CheckCircle2,
    label: 'Present',
    active: 'bg-green-500 text-white border-green-500',
    inactive: 'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-600',
  },
  {
    status: 'absent',
    icon: XCircle,
    label: 'Absent',
    active: 'bg-red-500 text-white border-red-500',
    inactive: 'bg-white text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-600',
  },
  {
    status: 'late',
    icon: Clock,
    label: 'Late',
    active: 'bg-yellow-400 text-white border-yellow-400',
    inactive: 'bg-white text-gray-500 border-gray-200 hover:border-yellow-300 hover:text-yellow-600',
  },
  {
    status: 'excused',
    icon: Info,
    label: 'Excused',
    active: 'bg-blue-400 text-white border-blue-400',
    inactive: 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600',
  },
];

// ── History rate colour coding ────────────────────────────────────────────────

function rateColor(rate: number): string {
  if (rate >= 85) return 'text-green-600 font-bold';
  if (rate >= 70) return 'text-yellow-600 font-semibold';
  return 'text-red-500 font-semibold';
}

function rateBgCell(rate: number): string {
  if (rate >= 85) return 'bg-green-50';
  if (rate >= 70) return 'bg-yellow-50';
  return 'bg-red-50';
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Attendance() {
  const { batches, trainees, attendanceRecords, logAttendance } = useStore();

  const activeBatch = batches.find((b) => b.status === 'active') ?? batches[0];
  const [selectedBatchId, setSelectedBatchId] = useState(activeBatch?.id ?? '');
  const [selectedDate, setSelectedDate] = useState(today());

  const batchTrainees = useMemo(
    () => trainees.filter((t) => t.batchId === selectedBatchId),
    [trainees, selectedBatchId]
  );

  const markable = useMemo(
    () => batchTrainees.filter(
      (t) => t.status === 'enrolled' || t.status === 'prospect'
    ),
    [batchTrainees]
  );

  // Initialise selections from existing attendance records
  const existingForDay = useMemo(
    () => attendanceRecords.filter(
      (r) => r.date === selectedDate && markable.some((t) => t.id === r.traineeId)
    ),
    [attendanceRecords, selectedDate, markable]
  );

  const defaultSelections = useCallback(() => {
    const map: Record<string, AttendanceStatus> = {};
    markable.forEach((t) => {
      const existing = existingForDay.find((r) => r.traineeId === t.id);
      map[t.id] = existing ? existing.status : 'present';
    });
    return map;
  }, [markable, existingForDay]);

  const [selections, setSelections] = useState<Record<string, AttendanceStatus>>(defaultSelections);
  const [saved, setSaved] = useState(false);

  // Reset selections when batch or date changes
  const batchKey = `${selectedBatchId}_${selectedDate}`;
  const prevKey = React.useRef(batchKey);
  if (prevKey.current !== batchKey) {
    prevKey.current = batchKey;
    const next = defaultSelections();
    // Only update if different to avoid render loops
    setSelections(next);
    setSaved(false);
  }

  function setStatus(traineeId: string, status: AttendanceStatus) {
    setSelections((prev) => ({ ...prev, [traineeId]: status }));
    setSaved(false);
  }

  function handleSubmit() {
    const records: AttendanceRecord[] = markable.map((t) => ({
      id: generateId(),
      traineeId: t.id,
      date: selectedDate,
      status: selections[t.id] ?? 'present',
      notes: '',
    }));
    logAttendance(records);
    setSaved(true);
  }

  // ── Summary counts ────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    markable.forEach((t) => {
      const s = selections[t.id] ?? 'present';
      c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [selections, markable]);

  // ── Attendance history: last 7 session dates (unique dates with records in this batch) ──

  const last7Dates = useMemo(() => getLast7SessionDates(), []);

  const batchTraineeIds = markable.map((t) => t.id);

  const historyData = useMemo(() => {
    return last7Dates.map((date) => {
      const dayRecords = attendanceRecords.filter(
        (r) => r.date === date && batchTraineeIds.includes(r.traineeId)
      );
      const total = markable.length;
      const present = dayRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
      const absent = dayRecords.filter((r) => r.status === 'absent').length;
      const late = dayRecords.filter((r) => r.status === 'late').length;
      const excused = dayRecords.filter((r) => r.status === 'excused').length;
      const rate = dayRecords.length > 0 ? getAttendanceRate(present, total) : null;
      return { date, present, absent, late, excused, total, rate, hasRecords: dayRecords.length > 0 };
    });
  }, [attendanceRecords, batchTraineeIds, markable.length, last7Dates]);

  const selectCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300';

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const attendanceExportColumns = [
    { key: 'name', label: 'Trainee' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status' },
  ];

  const attendanceExportRows = markable.map((t) => ({
    name: `${t.firstName} ${t.lastName}`,
    date: formatDate(selectedDate),
    status: selections[t.id] ?? 'present',
  }));

  return (
    <div className="space-y-5" id="app-print-area">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Log and review daily attendance</p>
        </div>
      </div>

      <ExportToolbar
        title={`Attendance — ${selectedBatch?.name ?? 'Batch'}`}
        filename={`attendance-${selectedDate}`}
        columns={attendanceExportColumns}
        rows={attendanceExportRows}
        subtitle={`${formatDate(selectedDate)} · ${counts.present} present · ${counts.absent} absent`}
        printTargetId="app-print-area"
      />

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Batch</label>
          <div className="relative">
            <select
              className={cn(selectCls, 'pr-8 appearance-none')}
              value={selectedBatchId}
              onChange={(e) => { setSelectedBatchId(e.target.value); setSaved(false); }}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
          <input
            type="date"
            className={selectCls}
            value={selectedDate}
            max={today()}
            onChange={(e) => { setSelectedDate(e.target.value); setSaved(false); }}
          />
        </div>
        <div className="flex-1 flex justify-end">
          {saved ? (
            <div className="flex items-center gap-2 text-green-600 font-medium text-sm px-4 py-2 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-4 h-4" />
              Attendance saved!
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={markable.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              Submit Attendance
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Present', count: counts.present, dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-100' },
          { label: 'Absent', count: counts.absent, dot: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'Late', count: counts.late, dot: 'bg-yellow-400', text: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-100' },
          { label: 'Excused', count: counts.excused, dot: 'bg-blue-400', text: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
        ].map(({ label, count, dot, text, bg }) => (
          <div key={label} className={cn('rounded-xl border p-4 flex items-center gap-3', bg)}>
            <span className={cn('w-3 h-3 rounded-full shrink-0', dot)} />
            <div>
              <p className={cn('text-2xl font-bold', text)}>{count}</p>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Trainee attendance table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">
              {markable.length} Trainees — {formatDate(selectedDate)}
            </span>
          </div>
        </div>

        {markable.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No markable trainees in this batch.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {markable.map((trainee) => {
              const current = selections[trainee.id] ?? 'present';
              return (
                <li key={trainee.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <Avatar firstName={trainee.firstName} lastName={trainee.lastName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {trainee.firstName} {trainee.lastName}
                    </p>
                    <p className="text-[11px] text-gray-400">{trainee.phone}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {ATTENDANCE_OPTIONS.map(({ status, icon: Icon, label, active, inactive }) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatus(trainee.id, status)}
                        title={label}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                          current === status ? active : inactive
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {markable.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
            {saved ? (
              <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Attendance saved for {formatDate(selectedDate)}
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Submit Attendance
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Attendance history: last 7 sessions ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Attendance History — Last 7 Days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 uppercase tracking-wide text-[10px] bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-semibold">Date</th>
                <th className="text-center px-3 py-3 font-semibold">Present</th>
                <th className="text-center px-3 py-3 font-semibold">Late</th>
                <th className="text-center px-3 py-3 font-semibold">Absent</th>
                <th className="text-center px-3 py-3 font-semibold">Excused</th>
                <th className="text-center px-3 py-3 font-semibold">% Present</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historyData.map(({ date, present, late, absent, excused, rate, hasRecords }) => (
                <tr key={date} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-700 font-medium whitespace-nowrap">
                    {formatDate(date)}
                    {date === today() && (
                      <span className="ml-2 px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded text-[9px] font-bold uppercase">Today</span>
                    )}
                  </td>
                  <td className="text-center px-3 py-3 text-green-600 font-semibold">
                    {hasRecords ? present : '—'}
                  </td>
                  <td className="text-center px-3 py-3 text-yellow-600 font-semibold">
                    {hasRecords ? late : '—'}
                  </td>
                  <td className="text-center px-3 py-3 text-red-500 font-semibold">
                    {hasRecords ? absent : '—'}
                  </td>
                  <td className="text-center px-3 py-3 text-blue-500 font-semibold">
                    {hasRecords ? excused : '—'}
                  </td>
                  <td className={cn('text-center px-3 py-3', hasRecords && rate !== null ? rateBgCell(rate) : '')}>
                    {hasRecords && rate !== null ? (
                      <span className={rateColor(rate)}>{rate}%</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-50 border border-green-200 inline-block" /> ≥85% Good</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-50 border border-yellow-200 inline-block" /> 70–84% Fair</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-50 border border-red-200 inline-block" /> &lt;70% Poor</span>
        </div>
      </div>
    </div>
  );
}
