import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, User, Phone, MapPin, AlertCircle, Calendar,
  BookOpen, ClipboardList, MessageSquare, Briefcase, Home,
  Utensils, GraduationCap, Heart, Accessibility,
  Pencil, PauseCircle, PlayCircle, Trash2,
} from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import { confirmAdminDelete, promptDeleteReason, submitDeleteRequest } from '../lib/deleteRequests';
import { cn, formatDate, getVulnerabilityLabel, getAttendanceRate, friendlyError } from '../lib/utils';
import { countTraineeDependencies } from '../lib/deleteGuards';
import { formatDependencyBlock } from '../lib/lifecycle';
import Modal from '../components/Modal';
import TraineeDocuments from '../components/TraineeDocuments';
import { getTraineePhotoSignedUrl } from '../lib/traineeDocuments';
import { COMPETENCY_LEVEL_LABELS, CASE_CATEGORY_LABELS } from '../types';
import type { TraineeStatus, CompetencyLevel, TradeType } from '../types';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TraineeStatus, string> = {
  prospect: 'bg-gray-100 text-gray-600',
  enrolled: 'bg-sky-100 text-sky-700',
  paused: 'bg-amber-100 text-amber-800',
  graduated: 'bg-green-100 text-green-700',
  dropped: 'bg-red-100 text-red-600',
  alumni: 'bg-purple-100 text-purple-700',
};

function StatusBadge({ status }: { status: TraineeStatus }) {
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide', STATUS_COLORS[status])}>
      {status}
    </span>
  );
}

// ── Info card ─────────────────────────────────────────────────────────────────

function InfoCard({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary-600" />
        </div>
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5 gap-4">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right">{value ?? '—'}</span>
    </div>
  );
}

// ── Attendance color helper ───────────────────────────────────────────────────

function attendanceRateColor(rate: number) {
  if (rate >= 85) return 'text-green-600';
  if (rate >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function attendanceBgBar(rate: number) {
  if (rate >= 85) return 'bg-green-500';
  if (rate >= 70) return 'bg-yellow-400';
  return 'bg-red-400';
}

// ── Status dot for attendance ─────────────────────────────────────────────────

const ATTENDANCE_DOT: Record<string, string> = {
  present: 'bg-green-500',
  late: 'bg-yellow-400',
  absent: 'bg-red-400',
  excused: 'bg-blue-400',
};

const ATTENDANCE_LABEL: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
};

// ── Employment status label ───────────────────────────────────────────────────

const EMPLOYMENT_LABELS: Record<string, string> = {
  employed: 'Employed',
  self_employed: 'Self-Employed',
  unemployed: 'Unemployed',
  further_studies: 'Further Studies',
};

const STARTER_KIT_LABELS: Record<string, string> = {
  in_use: 'In Use',
  sold: 'Sold',
  lost: 'Lost',
  damaged: 'Damaged',
  not_issued: 'Not Issued',
};

interface EditForm {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  batchId: string;
  trade: TradeType;
  status: TraineeStatus;
  dateOfBirth: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TraineeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    trainees, batches, competencyAssessments, modules,
    attendanceRecords, caseNotes, alumniFollowUps, jobPlacements,
    traineeInterviews,
    updateTrainee, pauseTrainee, resumeTrainee, deleteTrainee,
  } = useStore();

  const mayEdit = profile ? canEdit(profile.role, 'trainees') : false;

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteCounts, setDeleteCounts] = useState<Record<string, number> | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const trainee = useMemo(() => trainees.find((t) => t.id === id), [trainees, id]);

  useEffect(() => {
    let cancelled = false;
    setPhotoUrl(null);
    if (!trainee?.id) return;
    (async () => {
      try {
        const url = await getTraineePhotoSignedUrl(trainee.id);
        if (!cancelled) setPhotoUrl(url);
      } catch {
        if (!cancelled) setPhotoUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [trainee?.id]);

  const batch = useMemo(
    () => trainee ? batches.find((b) => b.id === trainee.batchId) : null,
    [batches, trainee]
  );

  const myAssessments = useMemo(
    () => competencyAssessments.filter((a) => a.traineeId === id),
    [competencyAssessments, id]
  );

  // Last 7 attendance records for this trainee (most recent first)
  const myAttendance = useMemo(() => {
    const sorted = attendanceRecords
      .filter((r) => r.traineeId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
    return sorted;
  }, [attendanceRecords, id]);

  const recentAttendance = myAttendance.slice(0, 7);

  const attendanceRate = useMemo(() => {
    const presentCount = myAttendance.filter(
      (r) => r.status === 'present' || r.status === 'late'
    ).length;
    return getAttendanceRate(presentCount, myAttendance.length);
  }, [myAttendance]);

  const myCaseNotes = useMemo(
    () => [...caseNotes.filter((n) => n.traineeId === id)].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    ),
    [caseNotes, id]
  );

  const myAlumniFollowUps = useMemo(
    () => alumniFollowUps.filter((f) => f.traineeId === id).sort(
      (a, b) => b.followUpDate.localeCompare(a.followUpDate)
    ),
    [alumniFollowUps, id]
  );

  const latestFollowUp = myAlumniFollowUps[0] ?? null;

  const myJobPlacements = useMemo(
    () => jobPlacements.filter((p) => p.traineeId === id),
    [jobPlacements, id]
  );

  const myInterviews = useMemo(
    () =>
      traineeInterviews
        .filter((i) => i.traineeId === id)
        .sort((a, b) => b.interviewDate.localeCompare(a.interviewDate)),
    [traineeInterviews, id]
  );

  const latestJob = myJobPlacements[myJobPlacements.length - 1] ?? null;

  // Map moduleId -> module info
  const moduleMap = useMemo(() => {
    const m: Record<string, typeof modules[0]> = {};
    modules.forEach((mod) => { m[mod.id] = mod; });
    return m;
  }, [modules]);

  if (!trainee) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Trainee not found</p>
        <button
          onClick={() => navigate('/trainees')}
          className="mt-4 text-primary-600 text-sm font-medium hover:underline"
        >
          Back to Trainees
        </button>
      </div>
    );
  }

  const currentTrainee = trainee;

  const { label: vLabel, color: vColor } = getVulnerabilityLabel(currentTrainee.vulnerabilityScore);
  const va = currentTrainee.vulnerabilityAssessment;

  // Vulnerability factor rows
  const vulnFactors = [
    { icon: Home, label: 'Housing', value: va.housingStatus.replace('_', ' ') },
    { icon: Utensils, label: 'Food Security', value: va.foodSecurity },
    { icon: GraduationCap, label: 'Education', value: va.previousEducation.replace('_', ' ') },
    { icon: Heart, label: 'Family Status', value: va.familyStatus.replace('_', ' ') },
    {
      icon: Accessibility,
      label: 'Disability',
      value: va.hasDisability
        ? (va.disabilityDetails || 'Yes')
        : 'None',
    },
  ];

  // Summary counts for attendance
  const presentDays = myAttendance.filter((r) => r.status === 'present').length;
  const lateDays = myAttendance.filter((r) => r.status === 'late').length;
  const absentDays = myAttendance.filter((r) => r.status === 'absent').length;
  const excusedDays = myAttendance.filter((r) => r.status === 'excused').length;

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white';

  const editBatch = editForm ? batches.find((b) => b.id === editForm.batchId) : null;
  const editTradeOptions = editBatch?.trades ?? [];

  function openEdit() {
    setEditError(null);
    setEditForm({
      firstName: currentTrainee.firstName,
      lastName: currentTrainee.lastName,
      phone: currentTrainee.phone,
      address: currentTrainee.address,
      emergencyContact: currentTrainee.emergencyContact,
      emergencyPhone: currentTrainee.emergencyPhone,
      batchId: currentTrainee.batchId,
      trade: currentTrainee.trade,
      status: currentTrainee.status,
      dateOfBirth: currentTrainee.dateOfBirth,
    });
    setShowEdit(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setEditError(null);
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setEditError('First and last name are required.');
      return;
    }
    if (!editForm.batchId) {
      setEditError('Select a batch.');
      return;
    }
    if (!editForm.trade || !editTradeOptions.some((t) => t.trade === editForm.trade)) {
      setEditError('Select a trade offered in this batch.');
      return;
    }
    setSaving(true);
    try {
      await updateTrainee(currentTrainee.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        emergencyContact: editForm.emergencyContact.trim(),
        emergencyPhone: editForm.emergencyPhone.trim(),
        batchId: editForm.batchId,
        trade: editForm.trade,
        status: editForm.status,
        dateOfBirth: editForm.dateOfBirth,
      });
      setShowEdit(false);
    } catch (err) {
      setEditError(friendlyError(err, 'Failed to update trainee.'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePause() {
    setLifecycleError(null);
    setLifecycleLoading(true);
    try {
      await pauseTrainee(currentTrainee.id);
    } catch (err) {
      setLifecycleError(friendlyError(err, 'Failed to pause trainee.'));
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function handleResume() {
    setLifecycleError(null);
    setLifecycleLoading(true);
    try {
      await resumeTrainee(currentTrainee.id);
    } catch (err) {
      setLifecycleError(friendlyError(err, 'Failed to resume trainee.'));
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function openDelete() {
    const label = `${currentTrainee.firstName} ${currentTrainee.lastName}`;
    if (profile?.role !== 'admin') {
      const reason = promptDeleteReason(label);
      if (!reason) return;
      setLifecycleError(null);
      setLifecycleLoading(true);
      try {
        await submitDeleteRequest({
          entityType: 'trainee',
          entityId: currentTrainee.id,
          entityLabel: label,
          reason,
        });
        window.alert('Delete request sent to admin for approval.');
      } catch (err) {
        setLifecycleError(friendlyError(err, 'Could not submit delete request.'));
      } finally {
        setLifecycleLoading(false);
      }
      return;
    }

    setDeleteError(null);
    setDeleteCounts(null);
    setDeleteBlocked(false);
    setShowDelete(true);
    setDeleteLoading(true);
    try {
      const counts = await countTraineeDependencies(currentTrainee.id);
      setDeleteCounts(counts);
      setDeleteBlocked(Object.values(counts).some((n) => n > 0));
    } catch (err) {
      setDeleteError(friendlyError(err, 'Failed to check dependencies.'));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function confirmDelete() {
    if (deleteBlocked) return;
    const label = `${currentTrainee.firstName} ${currentTrainee.lastName}`;
    if (!confirmAdminDelete(label)) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      await deleteTrainee(currentTrainee.id);
      navigate('/trainees');
    } catch (err) {
      setDeleteError(friendlyError(err, 'Failed to delete trainee.'));
    } finally {
      setDeleteLoading(false);
    }
  }

  const traineeLabel = `${currentTrainee.firstName} ${currentTrainee.lastName}`;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back button */}
      <button
        onClick={() => navigate('/trainees')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Trainees
      </button>

      {/* ── Profile header ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden ring-2 ring-primary-100">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <>{trainee.firstName[0]}{trainee.lastName[0]}</>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">
                {trainee.firstName} {trainee.lastName}
              </h1>
              <StatusBadge status={trainee.status} />
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-bold', vColor)}>
                Vuln: {trainee.vulnerabilityScore} — {vLabel}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
              {batch && (
                <span className="font-medium text-gray-700">{batch.name} · {trainee.trade}</span>
              )}
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {trainee.phone}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {trainee.address}
              </span>
            </div>
            {trainee.graduationDate && (
              <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                Graduated {formatDate(trainee.graduationDate)}
              </p>
            )}
          </div>
          {mayEdit && (
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              {(trainee.status === 'enrolled' || trainee.status === 'prospect') && (
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
              {trainee.status === 'paused' && (
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
                {profile?.role === 'admin' ? 'Delete' : 'Request delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {lifecycleError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {lifecycleError}
        </div>
      )}

      {/* ── Row: Personal + Emergency + Mobilization ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard title="Personal Information" icon={User}>
          <div className="divide-y divide-gray-50">
            <InfoRow label="Full Name" value={`${trainee.firstName} ${trainee.lastName}`} />
            <InfoRow label="Date of Birth" value={formatDate(trainee.dateOfBirth)} />
            <InfoRow label="Gender" value={trainee.gender.charAt(0).toUpperCase() + trainee.gender.slice(1)} />
            <InfoRow label="Phone" value={trainee.phone} />
            <InfoRow label="Address" value={trainee.address} />
            <InfoRow label="Status" value={<StatusBadge status={trainee.status} />} />
          </div>
        </InfoCard>

        <InfoCard title="Emergency Contact" icon={Phone}>
          <div className="divide-y divide-gray-50">
            <InfoRow label="Contact Name" value={trainee.emergencyContact} />
            <InfoRow label="Contact Phone" value={trainee.emergencyPhone} />
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Batch Info</p>
            <InfoRow label="Batch" value={batch?.name} />
            <InfoRow label="Trade" value={trainee.trade} />
            <InfoRow
              label="Trainer"
              value={batch?.trades.find((x) => x.trade === trainee.trade)?.trainerName || '—'}
            />
          </div>
        </InfoCard>

        <InfoCard title="Mobilization & Background" icon={MapPin}>
          <div className="divide-y divide-gray-50">
            <InfoRow label="Mobilization Source" value={trainee.mobilizationSource || '—'} />
            {trainee.graduationDate && (
              <InfoRow label="Graduation Date" value={formatDate(trainee.graduationDate)} />
            )}
          </div>
          {batch && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <InfoRow label="Batch Start" value={formatDate(batch.startDate)} />
              {batch.endDate && <InfoRow label="Batch End" value={formatDate(batch.endDate)} />}
              <InfoRow label="Batch Status" value={
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                  batch.status === 'active' ? 'bg-green-100 text-green-700' :
                  batch.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                )}>{batch.status}</span>
              } />
            </div>
          )}
        </InfoCard>
      </div>

      {/* ── Vulnerability Assessment breakdown ── */}
      <InfoCard title="Vulnerability Assessment" icon={AlertCircle}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {vulnFactors.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
              <Icon className="w-5 h-5 text-gray-400 mx-auto mb-2" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-0.5">{label}</p>
              <p className="text-xs font-bold text-gray-800 capitalize">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                trainee.vulnerabilityScore >= 85 ? 'bg-red-400' :
                trainee.vulnerabilityScore >= 70 ? 'bg-orange-400' :
                trainee.vulnerabilityScore >= 55 ? 'bg-yellow-400' : 'bg-green-400'
              )}
              style={{ width: `${trainee.vulnerabilityScore}%` }}
            />
          </div>
          <span className={cn('text-sm font-bold px-2.5 py-0.5 rounded-full', vColor)}>
            {trainee.vulnerabilityScore}/100 — {vLabel}
          </span>
        </div>
      </InfoCard>

      <TraineeDocuments
        traineeId={trainee.id}
        traineeName={`${trainee.firstName} ${trainee.lastName}`}
        onDocumentsChanged={() => {
          void (async () => {
            try {
              setPhotoUrl(await getTraineePhotoSignedUrl(trainee.id));
            } catch {
              setPhotoUrl(null);
            }
          })();
        }}
      />

      <InfoCard title="Motivation & Availability" icon={Heart}>
        <div className="divide-y divide-gray-50">
          <InfoRow
            label="Why they need training"
            value={va.whyNeedTraining?.trim() || '—'}
          />
          <InfoRow
            label="Can attend daily (6 months)"
            value={
              va.canAttendDailySixMonths === true
                ? 'Yes'
                : va.canAttendDailySixMonths === false
                  ? 'No'
                  : '—'
            }
          />
          <InfoRow
            label="Reason for selecting trade"
            value={va.reasonForTrade?.trim() || '—'}
          />
        </div>
      </InfoCard>

      <InfoCard title="Interview Scoresheets" icon={ClipboardList}>
        {myInterviews.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-400">No interview recorded yet.</p>
            <Link
              to="/interviews"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Open Interviews →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {myInterviews.map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {formatDate(i.interviewDate)} · {i.totalScore}/40
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{i.decision}</p>
                </div>
                <Link
                  to="/interviews"
                  className="text-xs font-medium text-primary-600 hover:underline"
                >
                  View on Interviews
                </Link>
              </div>
            ))}
          </div>
        )}
      </InfoCard>

      {/* ── Competency Progress ── */}
      <InfoCard title={`Competency Progress (${myAssessments.length} modules assessed)`} icon={BookOpen}>
        {myAssessments.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No competency assessments recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {myAssessments.map((a) => {
              const mod = moduleMap[a.moduleId];
              const lvl = COMPETENCY_LEVEL_LABELS[a.level as CompetencyLevel];
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">
                        {mod ? `${mod.code} — ${mod.name}` : a.moduleId}
                      </p>
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', lvl.color)}>
                        L{a.level} {lvl.label}
                      </span>
                    </div>
                    {a.feedback && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.feedback}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatDate(a.assessmentDate)} · {a.assessorName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-800">{a.score}%</p>
                    <p className="text-[10px] text-gray-400">Score</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </InfoCard>

      {/* ── Attendance Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCard title="Attendance Summary" icon={ClipboardList}>
          {/* Overall rate */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={cn('text-3xl font-bold', attendanceRateColor(attendanceRate))}>
                {attendanceRate}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Overall attendance rate ({myAttendance.length} sessions)</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />{presentDays} Present</p>
              <p className="text-xs text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1" />{lateDays} Late</p>
              <p className="text-xs text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />{absentDays} Absent</p>
              <p className="text-xs text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />{excusedDays} Excused</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className={cn('h-full rounded-full transition-all', attendanceBgBar(attendanceRate))}
              style={{ width: `${attendanceRate}%` }}
            />
          </div>

          {/* Recent 7 sessions */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Last 7 Sessions</p>
          {recentAttendance.length === 0 ? (
            <p className="text-xs text-gray-400">No attendance records yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentAttendance.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700 font-medium">{formatDate(r.date)}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-full inline-block', ATTENDANCE_DOT[r.status])} />
                    <span className="font-medium text-gray-700">{ATTENDANCE_LABEL[r.status]}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </InfoCard>

        {/* ── Case Notes ── */}
        <InfoCard title={`Case Notes (${myCaseNotes.length})`} icon={MessageSquare}>
          {myCaseNotes.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No case notes recorded.</p>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {myCaseNotes.slice(0, 3).map((note) => (
                  <div
                    key={note.id}
                    className={cn(
                      'p-3 rounded-lg border text-xs',
                      note.isCritical ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-700">
                        {CASE_CATEGORY_LABELS[note.category]}
                      </span>
                      {note.isCritical && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase">Critical</span>
                      )}
                    </div>
                    <p className="text-gray-600 line-clamp-2">{note.content}</p>
                    <p className="text-gray-400 mt-1">{formatDate(note.createdAt)} · {note.authorName}</p>
                  </div>
                ))}
              </div>
              <Link
                to="/case-management"
                className="text-xs text-primary-600 font-medium hover:underline flex items-center gap-1"
              >
                View all in Case Management →
              </Link>
            </>
          )}
        </InfoCard>
      </div>

      {/* ── Alumni Section (only if status === 'alumni') ── */}
      {trainee.status === 'alumni' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Job Placement */}
          <InfoCard title="Job Placement" icon={Briefcase}>
            {!latestJob ? (
              <p className="text-sm text-gray-400 py-2 text-center">No job placement recorded.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                <InfoRow label="Employer" value={latestJob.employerName} />
                <InfoRow label="Position" value={latestJob.position} />
                <InfoRow label="Start Date" value={formatDate(latestJob.startDate)} />
                <InfoRow label="Contact Person" value={latestJob.contactPerson} />
                <InfoRow label="Contact Phone" value={latestJob.contactPhone} />
              </div>
            )}
          </InfoCard>

          {/* Alumni Follow-up */}
          <InfoCard title="Alumni Follow-Up" icon={Calendar}>
            {!latestFollowUp ? (
              <p className="text-sm text-gray-400 py-2 text-center">No follow-up recorded yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                <InfoRow label="Follow-up Date" value={formatDate(latestFollowUp.followUpDate)} />
                <InfoRow
                  label="Employment Status"
                  value={
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      latestFollowUp.employmentStatus === 'employed' || latestFollowUp.employmentStatus === 'self_employed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    )}>
                      {EMPLOYMENT_LABELS[latestFollowUp.employmentStatus]}
                    </span>
                  }
                />
                {latestFollowUp.currentEmployer && (
                  <InfoRow label="Current Employer" value={latestFollowUp.currentEmployer} />
                )}
                {latestFollowUp.monthlyIncome > 0 && (
                  <InfoRow label="Monthly Income" value={`$${latestFollowUp.monthlyIncome.toLocaleString()}`} />
                )}
                <InfoRow label="Starter Kit" value={STARTER_KIT_LABELS[latestFollowUp.starterKitStatus]} />
                {latestFollowUp.notes && (
                  <div className="pt-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Notes</p>
                    <p className="text-xs text-gray-600">{latestFollowUp.notes}</p>
                  </div>
                )}
              </div>
            )}
            {myAlumniFollowUps.length > 1 && (
              <p className="text-[11px] text-gray-400 mt-3">
                {myAlumniFollowUps.length} follow-up{myAlumniFollowUps.length > 1 ? 's' : ''} on record
              </p>
            )}
          </InfoCard>
        </div>
      )}

      {showEdit && editForm && (
        <Modal title={`Edit ${traineeLabel}`} onClose={() => setShowEdit(false)} size="lg">
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">First name *</label>
                <input
                  required
                  className={inputCls}
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Last name *</label>
                <input
                  required
                  className={inputCls}
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date of birth *</label>
                <input
                  type="date"
                  required
                  className={inputCls}
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status *</label>
                <select
                  className={inputCls}
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TraineeStatus })}
                >
                  <option value="prospect">Prospect</option>
                  <option value="enrolled">Enrolled</option>
                  <option value="paused">Paused</option>
                  <option value="graduated">Graduated</option>
                  <option value="dropped">Dropped</option>
                  <option value="alumni">Alumni</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone *</label>
                <input
                  required
                  className={inputCls}
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Batch *</label>
                <select
                  required
                  disabled={editForm.status === 'paused'}
                  className={cn(inputCls, editForm.status === 'paused' && 'bg-gray-50 text-gray-600')}
                  value={editForm.batchId}
                  onChange={(e) => {
                    const batchId = e.target.value;
                    const trades = batches.find((b) => b.id === batchId)?.trades ?? [];
                    const trade = trades.some((t) => t.trade === editForm.trade)
                      ? editForm.trade
                      : (trades[0]?.trade ?? editForm.trade);
                    setEditForm({ ...editForm, batchId, trade });
                  }}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.status !== 'active' ? ` (${b.status})` : ''}
                    </option>
                  ))}
                </select>
                {editForm.status === 'paused' && (
                  <p className="text-[11px] text-gray-400 mt-1">Resume trainee before changing batch.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Trade *</label>
                <select
                  required
                  className={inputCls}
                  value={editForm.trade}
                  onChange={(e) => setEditForm({ ...editForm, trade: e.target.value as TradeType })}
                  disabled={!editTradeOptions.length}
                >
                  {!editTradeOptions.length && <option value="">No trades on this batch</option>}
                  {editTradeOptions.map((t) => (
                    <option key={t.trade} value={t.trade}>
                      {t.trade}{t.trainerName ? ` — ${t.trainerName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Address *</label>
                <input
                  required
                  className={inputCls}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency contact *</label>
                <input
                  required
                  className={inputCls}
                  value={editForm.emergencyContact}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency phone *</label>
                <input
                  required
                  className={inputCls}
                  value={editForm.emergencyPhone}
                  onChange={(e) => setEditForm({ ...editForm, emergencyPhone: e.target.value })}
                />
              </div>
            </div>

            {editError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</p>
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
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDelete && (
        <Modal title={`Delete ${traineeLabel}`} onClose={() => setShowDelete(false)}>
          <div className="space-y-4">
            {deleteLoading && !deleteCounts && (
              <p className="text-sm text-gray-500">Checking linked records…</p>
            )}
            {deleteCounts && deleteBlocked && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {formatDependencyBlock(traineeLabel, deleteCounts)}
              </p>
            )}
            {deleteCounts && !deleteBlocked && (
              <p className="text-sm text-gray-600">
                This permanently deletes <strong>{traineeLabel}</strong>.
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
                {deleteLoading ? 'Deleting…' : 'Delete trainee'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
