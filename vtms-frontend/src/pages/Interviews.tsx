import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, Plus, X, Save, Trash2, User, Filter, AlertCircle,
} from 'lucide-react';
import { useStore, emptyInterviewResponses, emptyInterviewScores, computeInterviewTotal } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import { cn, formatDate, friendlyError, today } from '../lib/utils';
import type {
  InterviewDecision,
  InterviewResponses,
  InterviewScores,
  InterviewStartAvailability,
  TraineeInterview,
} from '../types';

const VULN_FLAGS = [
  'Orphan',
  'School Dropout',
  'Street Child',
  'Disabled',
  'Single Mother',
  'Widowed',
  'Unemployed',
] as const;

const DECISION_LABELS: Record<InterviewDecision, string> = {
  pending: 'Pending',
  selected: 'Selected',
  waitlist: 'Waitlist',
  rejected: 'Rejected',
};

const DECISION_COLORS: Record<InterviewDecision, string> = {
  pending: 'bg-amber-100 text-amber-800',
  selected: 'bg-green-100 text-green-800',
  waitlist: 'bg-sky-100 text-sky-800',
  rejected: 'bg-red-100 text-red-800',
};

const SCORE_FIELDS: {
  key: keyof InterviewScores;
  label: string;
  description: string;
  min: number;
  max: number;
}[] = [
  { key: 'vulnerability', label: 'Vulnerability', description: 'More vulnerabilities = higher score', min: 0, max: 10 },
  { key: 'motivation', label: 'Motivation', description: 'Clear, strong motivation for training', min: 0, max: 6 },
  { key: 'availability', label: 'Availability', description: 'Willing to attend, flexible routine', min: 0, max: 6 },
  { key: 'ageSuitability', label: 'Age Suitability', description: 'Ideal age 15–30', min: 0, max: 4 },
  { key: 'opennessToFaith', label: 'Openness to Faith', description: 'Comfortable with spiritual growth', min: 0, max: 4 },
  { key: 'conductAttitude', label: 'Conduct & Attitude', description: 'Dress, manners, respectfulness', min: 0, max: 5 },
  { key: 'riskFlags', label: 'Risk Flags', description: 'Deduct for alcohol use, dishonesty, etc.', min: -5, max: 0 },
];

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';
const sectionCls = 'space-y-4 bg-white border border-gray-100 rounded-xl p-4 sm:p-5';

type FormState = {
  id?: string;
  traineeId: string;
  batchId: string;
  interviewDate: string;
  responses: InterviewResponses;
  scores: InterviewScores;
  panelNotes: string;
  panelistNames: string;
  decision: InterviewDecision;
};

function blankForm(batchId = ''): FormState {
  return {
    traineeId: '',
    batchId,
    interviewDate: today(),
    responses: emptyInterviewResponses(),
    scores: emptyInterviewScores(),
    panelNotes: '',
    panelistNames: '',
    decision: 'pending',
  };
}

function fromInterview(i: TraineeInterview): FormState {
  return {
    id: i.id,
    traineeId: i.traineeId,
    batchId: i.batchId,
    interviewDate: i.interviewDate,
    responses: { ...emptyInterviewResponses(), ...i.responses },
    scores: { ...emptyInterviewScores(), ...i.scores },
    panelNotes: i.panelNotes,
    panelistNames: i.panelistNames,
    decision: i.decision,
  };
}

export default function Interviews() {
  const { profile } = useAuth();
  const mayEdit = profile ? canEdit(profile.role, 'trainees') : false;
  const {
    batches,
    trainees,
    traineeInterviews,
    activeBatchId,
    addTraineeInterview,
    updateTraineeInterview,
    deleteTraineeInterview,
    updateTrainee,
  } = useStore();

  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [filterDecision, setFilterDecision] = useState<InterviewDecision | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(() => blankForm(activeBatchId));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showForm && filterBatch === 'all' && activeBatchId) {
      setFilterBatch(activeBatchId);
    }
  }, [activeBatchId, filterBatch, showForm]);

  const traineeMap = useMemo(() => {
    const m: Record<string, (typeof trainees)[0]> = {};
    trainees.forEach((t) => {
      m[t.id] = t;
    });
    return m;
  }, [trainees]);

  const batchMap = useMemo(() => {
    const m: Record<string, (typeof batches)[0]> = {};
    batches.forEach((b) => {
      m[b.id] = b;
    });
    return m;
  }, [batches]);

  const filtered = useMemo(() => {
    return traineeInterviews.filter((i) => {
      if (filterBatch !== 'all' && i.batchId !== filterBatch) return false;
      if (filterDecision !== 'all' && i.decision !== filterDecision) return false;
      return true;
    });
  }, [traineeInterviews, filterBatch, filterDecision]);

  const selectableTrainees = useMemo(() => {
    const batchId = form.batchId || activeBatchId;
    return trainees
      .filter((t) => (!batchId || t.batchId === batchId) && t.status !== 'dropped')
      .sort((a, b) => {
        const rank = (s: string) => (s === 'prospect' ? 0 : 1);
        const byStatus = rank(a.status) - rank(b.status);
        if (byStatus !== 0) return byStatus;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
  }, [trainees, form.batchId, activeBatchId]);

  const selectedTrainee = traineeMap[form.traineeId];
  const totalScore = computeInterviewTotal(form.scores);

  function openNew() {
    setSubmitError(null);
    const batchId = filterBatch !== 'all' ? filterBatch : activeBatchId;
    setForm(blankForm(batchId));
    setShowForm(true);
  }

  function openEdit(interview: TraineeInterview) {
    setSubmitError(null);
    setForm(fromInterview(interview));
    setShowForm(true);
  }

  function setResponse<K extends keyof InterviewResponses>(key: K, value: InterviewResponses[K]) {
    setForm((prev) => ({ ...prev, responses: { ...prev.responses, [key]: value } }));
  }

  function setScore(key: keyof InterviewScores, value: number) {
    setForm((prev) => ({ ...prev, scores: { ...prev.scores, [key]: value } }));
  }

  function toggleFlag(flag: string) {
    setForm((prev) => {
      const has = prev.responses.vulnerabilityFlags.includes(flag);
      return {
        ...prev,
        responses: {
          ...prev.responses,
          vulnerabilityFlags: has
            ? prev.responses.vulnerabilityFlags.filter((f) => f !== flag)
            : [...prev.responses.vulnerabilityFlags, flag],
        },
      };
    });
  }

  function onTraineeChange(traineeId: string) {
    const t = traineeMap[traineeId];
    const va = t?.vulnerabilityAssessment;
    setForm((prev) => ({
      ...prev,
      traineeId,
      batchId: t?.batchId || prev.batchId,
      responses: {
        ...prev.responses,
        whyAttend: va?.whyNeedTraining || prev.responses.whyAttend,
        whyThisTrade: va?.reasonForTrade || prev.responses.whyThisTrade,
        canTravelDaily:
          va?.canAttendDailySixMonths === true || va?.canAttendDailySixMonths === false
            ? va.canAttendDailySixMonths
            : prev.responses.canTravelDaily,
      },
    }));
  }

  async function persistInterview(decisionOverride?: InterviewDecision) {
    if (!mayEdit) return;
    setSubmitError(null);
    if (!form.traineeId) {
      setSubmitError('Select an applicant.');
      return;
    }
    const trainee = traineeMap[form.traineeId];
    if (!trainee) {
      setSubmitError('Selected trainee not found.');
      return;
    }
    const decision = decisionOverride ?? form.decision;
    setSaving(true);
    try {
      const payload = {
        traineeId: form.traineeId,
        batchId: form.batchId || trainee.batchId,
        interviewDate: form.interviewDate,
        responses: form.responses,
        scores: form.scores,
        panelNotes: form.panelNotes.trim(),
        panelistNames: form.panelistNames.trim(),
        decision,
        createdBy: profile?.id ?? null,
        totalScore,
      };
      if (form.id) {
        await updateTraineeInterview(form.id, payload);
      } else {
        await addTraineeInterview(payload);
      }
      if (decision === 'selected' && trainee.status === 'prospect') {
        await updateTrainee(trainee.id, { status: 'enrolled' });
      }
      setShowForm(false);
      setForm(blankForm(activeBatchId));
    } catch (err) {
      setSubmitError(friendlyError(err, 'Could not save interview.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await persistInterview();
  }

  async function handleDelete(id: string) {
    if (!mayEdit) return;
    if (!window.confirm('Delete this interview scoresheet?')) return;
    try {
      await deleteTraineeInterview(id);
      if (form.id === id) {
        setShowForm(false);
        setForm(blankForm(activeBatchId));
      }
    } catch (err) {
      setSubmitError(friendlyError(err, 'Could not delete interview.'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-600" />
            Trainee Interviews
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            VST Screening &amp; Assessment Tool — Khor Wolliang
          </p>
        </div>
        {mayEdit && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            New Interview
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          Filters
        </div>
        <select
          className={cn(inputCls, 'w-auto min-w-[10rem]')}
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
        >
          <option value="all">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          className={cn(inputCls, 'w-auto min-w-[9rem]')}
          value={filterDecision}
          onChange={(e) => setFilterDecision(e.target.value as InterviewDecision | 'all')}
        >
          <option value="all">All decisions</option>
          {(Object.keys(DECISION_LABELS) as InterviewDecision[]).map((d) => (
            <option key={d} value={d}>{DECISION_LABELS[d]}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="space-y-4 border border-primary-100 rounded-2xl bg-primary-50/30 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {form.id ? 'Edit Interview Scoresheet' : 'New Interview Scoresheet'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Sections A–G match the printed VST Trainee Screening &amp; Assessment Tool.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Header */}
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Interview Header</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Batch *</label>
                <select
                  required
                  className={inputCls}
                  value={form.batchId}
                  onChange={(e) => setForm((p) => ({ ...p, batchId: e.target.value, traineeId: '' }))}
                >
                  <option value="">Select batch</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Applicant *</label>
                <select
                  required
                  className={inputCls}
                  value={form.traineeId}
                  onChange={(e) => onTraineeChange(e.target.value)}
                >
                  <option value="">Select trainee</option>
                  {selectableTrainees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} — {t.trade}
                      {t.status === 'prospect' ? ' (prospect)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Interview Date *</label>
                <input
                  required
                  type="date"
                  className={inputCls}
                  value={form.interviewDate}
                  onChange={(e) => setForm((p) => ({ ...p, interviewDate: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Program Location</label>
                <input className={inputCls} value="Khor Wolliang" readOnly />
              </div>
            </div>
            {selectedTrainee && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-gray-400 font-semibold uppercase">Trade</p>
                  <p className="font-medium text-gray-800">{selectedTrainee.trade}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold uppercase">Gender</p>
                  <p className="font-medium text-gray-800 capitalize">{selectedTrainee.gender}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold uppercase">Date of Birth</p>
                  <p className="font-medium text-gray-800">{formatDate(selectedTrainee.dateOfBirth)}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold uppercase">Phone</p>
                  <p className="font-medium text-gray-800">{selectedTrainee.phone || '—'}</p>
                </div>
              </div>
            )}
          </div>

          {/* A */}
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
              Section A — Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Marital Status</label>
                <input
                  className={inputCls}
                  value={form.responses.maritalStatus}
                  onChange={(e) => setResponse('maritalStatus', e.target.value)}
                  placeholder="e.g. Single, Married"
                />
              </div>
              <div>
                <label className={labelCls}>Residential Address</label>
                <input
                  className={inputCls}
                  value={selectedTrainee?.address ?? ''}
                  readOnly
                  placeholder="From trainee profile"
                />
              </div>
            </div>
          </div>

          {/* B */}
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
              Section B — Livelihood &amp; Daily Routine
            </h3>
            <div>
              <label className={labelCls}>Main source of livelihood</label>
              <input
                className={inputCls}
                value={form.responses.livelihoodSource}
                onChange={(e) => setResponse('livelihoodSource', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>How do you usually spend your day?</label>
              <textarea
                rows={2}
                className={inputCls}
                value={form.responses.dailyRoutine}
                onChange={(e) => setResponse('dailyRoutine', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Is spouse aware / okay with applying?</label>
              <input
                className={inputCls}
                value={form.responses.spouseAware}
                onChange={(e) => setResponse('spouseAware', e.target.value)}
                placeholder="N/A if not married"
              />
            </div>
            <div>
              <label className={labelCls}>Will training interfere with daily responsibilities?</label>
              <div className="flex gap-4 mt-1">
                {[true, false].map((v) => (
                  <label key={String(v)} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="trainingInterfere"
                      checked={form.responses.trainingInterfere === v}
                      onChange={() => setResponse('trainingInterfere', v)}
                      className="accent-primary-600"
                    />
                    {v ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </div>
            {form.responses.trainingInterfere && (
              <div>
                <label className={labelCls}>If yes, how will you manage that?</label>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={form.responses.interferePlan}
                  onChange={(e) => setResponse('interferePlan', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* C */}
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
              Section C — Motivation &amp; Availability
            </h3>
            <div>
              <label className={labelCls}>Why do you want to attend this training?</label>
              <textarea
                rows={2}
                className={inputCls}
                value={form.responses.whyAttend}
                onChange={(e) => setResponse('whyAttend', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Why did you choose this specific trade?</label>
              <textarea
                rows={2}
                className={inputCls}
                value={form.responses.whyThisTrade}
                onChange={(e) => setResponse('whyThisTrade', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>When can you start if selected?</label>
              <div className="flex flex-wrap gap-3 mt-1">
                {(
                  [
                    ['immediately', 'Immediately'],
                    ['after_month', 'After a month'],
                    ['not_sure', 'Not sure'],
                    ['other', 'Other'],
                  ] as [InterviewStartAvailability, string][]
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="startAvailability"
                      checked={form.responses.startAvailability === value}
                      onChange={() => setResponse('startAvailability', value)}
                      className="accent-primary-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {form.responses.startAvailability === 'other' && (
                <input
                  className={cn(inputCls, 'mt-2')}
                  value={form.responses.startAvailabilityOther}
                  onChange={(e) => setResponse('startAvailabilityOther', e.target.value)}
                  placeholder="Specify..."
                />
              )}
            </div>
            <div>
              <label className={labelCls}>Able to travel to Khor Wolliang every day?</label>
              <div className="flex gap-4 mt-1">
                {[true, false].map((v) => (
                  <label key={String(v)} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="canTravelDaily"
                      checked={form.responses.canTravelDaily === v}
                      onChange={() => setResponse('canTravelDaily', v)}
                      className="accent-primary-600"
                    />
                    {v ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* D */}
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
              Section D — Vulnerability Checklist
            </h3>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Tick from conversation cues — do not ask these labels directly.
            </p>
            <div className="flex flex-wrap gap-2">
              {VULN_FLAGS.map((flag) => {
                const on = form.responses.vulnerabilityFlags.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleFlag(flag)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      on
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    )}
                  >
                    {flag}
                  </button>
                );
              })}
            </div>
            <div>
              <label className={labelCls}>Other</label>
              <input
                className={inputCls}
                value={form.responses.vulnerabilityOther}
                onChange={(e) => setResponse('vulnerabilityOther', e.target.value)}
              />
            </div>
          </div>

          {/* E */}
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
              Section E — Faith &amp; Discipleship
            </h3>
            <div>
              <label className={labelCls}>Comfortable with devotions / prayer / Bible study?</label>
              <div className="flex flex-wrap gap-3 mt-1">
                {(['yes', 'no', 'not_sure'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                    <input
                      type="radio"
                      name="faithDevotions"
                      checked={form.responses.faithDevotions === v}
                      onChange={() => setResponse('faithDevotions', v)}
                      className="accent-primary-600"
                    />
                    {v === 'not_sure' ? 'Not sure' : v}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Open to mentorship (integrity, discipline, faith)?</label>
              <div className="flex flex-wrap gap-3 mt-1">
                {(['yes', 'no', 'somewhat'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                    <input
                      type="radio"
                      name="openToMentorship"
                      checked={form.responses.openToMentorship === v}
                      onChange={() => setResponse('openToMentorship', v)}
                      className="accent-primary-600"
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* F */}
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
              Section F — Panel Observations
            </h3>
            {(
              [
                ['appearanceNotes', 'Appearance & Dress'],
                ['politenessNotes', 'Politeness / Respect'],
                ['substanceAbuseNotes', 'Signs of substance abuse'],
                ['communicationNotes', 'Communication skills & composure'],
                ['overallImpressionNotes', 'Overall first impression'],
              ] as [keyof InterviewResponses, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={String(form.responses[key] ?? '')}
                  onChange={(e) => setResponse(key, e.target.value as never)}
                />
              </div>
            ))}
          </div>

          {/* G */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gray-800">Section G — Scoring Matrix</h3>
              <span className="text-sm font-bold text-primary-700">
                {totalScore} / 40
              </span>
            </div>
            <div className="space-y-3">
              {SCORE_FIELDS.map((field) => (
                <div key={field.key} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{field.label}</p>
                    <p className="text-xs text-gray-500">{field.description} ({field.min}–{field.max})</p>
                  </div>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    className={cn(inputCls, 'sm:w-24')}
                    value={form.scores[field.key]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const clamped = Math.min(field.max, Math.max(field.min, Number.isFinite(n) ? n : 0));
                      setScore(field.key, clamped);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Panel notes */}
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
              Panel Notes &amp; Decision
            </h3>
            <div>
              <label className={labelCls}>Notes / Concerns</label>
              <textarea
                rows={3}
                className={inputCls}
                value={form.panelNotes}
                onChange={(e) => setForm((p) => ({ ...p, panelNotes: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Panelist Name(s)</label>
                <input
                  className={inputCls}
                  value={form.panelistNames}
                  onChange={(e) => setForm((p) => ({ ...p, panelistNames: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Decision</label>
                <select
                  className={inputCls}
                  value={form.decision}
                  onChange={(e) => setForm((p) => ({ ...p, decision: e.target.value as InterviewDecision }))}
                >
                  {(Object.keys(DECISION_LABELS) as InterviewDecision[]).map((d) => (
                    <option key={d} value={d}>{DECISION_LABELS[d]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {submitError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
            >
              Cancel
            </button>
            {mayEdit && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => persistInterview('rejected')}
                  className="px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => persistInterview('selected')}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
                >
                  Enroll
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : form.id ? 'Update Scoresheet' : 'Save Scoresheet'}
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {/* List */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">
            Scoresheets ({filtered.length})
          </h2>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No interviews recorded yet. Start a new scoresheet to screen applicants.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map((interview) => {
              const t = traineeMap[interview.traineeId];
              const batch = batchMap[interview.batchId];
              return (
                <li
                  key={interview.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50/80"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {t ? `${t.firstName} ${t.lastName}` : 'Unknown trainee'}
                        {t && <span className="font-normal text-gray-500"> · {t.trade}</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {batch?.name ?? 'Batch'} · {formatDate(interview.interviewDate)} · Score{' '}
                        <span className="font-semibold text-gray-700">{interview.totalScore}/40</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold', DECISION_COLORS[interview.decision])}>
                      {DECISION_LABELS[interview.decision]}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(interview)}
                      className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100"
                    >
                      Open
                    </button>
                    {mayEdit && (
                      <button
                        type="button"
                        onClick={() => handleDelete(interview.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
