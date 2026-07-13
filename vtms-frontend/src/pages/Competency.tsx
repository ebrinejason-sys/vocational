import React, { useState, useMemo } from 'react';
import {
  BookOpen, ChevronDown, Award, CheckCircle2, ClipboardList,
  BarChart2, AlertCircle,
} from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatDate, generateId, today } from '../lib/utils';
import { COMPETENCY_LEVEL_LABELS } from '../types';
import type { CompetencyLevel, CompetencyAssessment } from '../types';

const LEVEL_OPTIONS: CompetencyLevel[] = [1, 2, 3, 4];

const TRADE_COLORS: Record<string, string> = {
  Carpentry: 'bg-amber-100 text-amber-700',
  Tailoring: 'bg-pink-100 text-pink-700',
  Masonry: 'bg-stone-100 text-stone-700',
  Electricity: 'bg-yellow-100 text-yellow-700',
};

const LEVEL_BAR_COLORS: Record<CompetencyLevel, string> = {
  1: 'bg-red-400',
  2: 'bg-yellow-400',
  3: 'bg-blue-400',
  4: 'bg-green-500',
};

interface AssessmentForm {
  traineeId: string;
  moduleId: string;
  level: CompetencyLevel | '';
  feedback: string;
}

const EMPTY_FORM: AssessmentForm = {
  traineeId: '',
  moduleId: '',
  level: '',
  feedback: '',
};

export default function Competency() {
  const { profile } = useAuth();
  const {
    batches,
    trainees,
    modules,
    competencyAssessments,
    activeBatchId,
    setActiveBatch,
    addCompetencyAssessment,
  } = useStore();

  const [selectedBatchId, setSelectedBatchId] = useState<string>(activeBatchId);
  const [form, setForm] = useState<AssessmentForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Derived data
  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId),
    [batches, selectedBatchId]
  );

  const batchTrainees = useMemo(
    () => trainees.filter((t) => t.batchId === selectedBatchId && t.status === 'enrolled'),
    [trainees, selectedBatchId]
  );

  const batchModules = useMemo(
    () => selectedBatch ? modules.filter((m) => m.trade === selectedBatch.trade) : [],
    [modules, selectedBatch]
  );

  // Latest assessment per trainee × module
  const latestAssessmentMap = useMemo(() => {
    const map = new Map<string, CompetencyAssessment>();
    const batchTraineeIds = new Set(batchTrainees.map((t) => t.id));
    const batchModuleIds = new Set(batchModules.map((m) => m.id));

    const relevant = competencyAssessments
      .filter((a) => batchTraineeIds.has(a.traineeId) && batchModuleIds.has(a.moduleId))
      .sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate));

    for (const a of relevant) {
      map.set(`${a.traineeId}__${a.moduleId}`, a);
    }
    return map;
  }, [competencyAssessments, batchTrainees, batchModules]);

  // Progress summary: count trainees at each level across all assessments
  const levelCounts = useMemo<Record<CompetencyLevel, number>>(() => {
    const counts: Record<CompetencyLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const assessment of latestAssessmentMap.values()) {
      counts[assessment.level] = (counts[assessment.level] || 0) + 1;
    }
    return counts;
  }, [latestAssessmentMap]);

  const totalAssessments = Object.values(levelCounts).reduce((a, b) => a + b, 0);

  // Module completion: all trainees assessed at level 3+
  const moduleCompletionMap = useMemo(() => {
    const result = new Map<string, boolean>();
    if (batchTrainees.length === 0) return result;
    for (const mod of batchModules) {
      const allAssessed = batchTrainees.every((t) => {
        const a = latestAssessmentMap.get(`${t.id}__${mod.id}`);
        return a && a.level >= 3;
      });
      result.set(mod.id, allAssessed);
    }
    return result;
  }, [batchModules, batchTrainees, latestAssessmentMap]);

  // Validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.traineeId) errors.traineeId = 'Select a trainee';
    if (!form.moduleId) errors.moduleId = 'Select a module';
    if (!form.level) errors.level = 'Select a level';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const newAssessment: CompetencyAssessment = {
      id: generateId(),
      traineeId: form.traineeId,
      moduleId: form.moduleId,
      level: form.level as CompetencyLevel,
      score: 0,
      assessmentDate: today(),
      assessorName: profile?.fullName ?? 'Staff',
      feedback: form.feedback.trim(),
    };

    addCompetencyAssessment(newAssessment);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 3000);
  };

  const handleBatchChange = (id: string) => {
    setSelectedBatchId(id);
    setActiveBatch(id);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CBET Competency Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Competency-Based Education and Training assessments by module
          </p>
        </div>
        <div className="flex items-center gap-2 text-sky-600">
          <Award className="w-5 h-5" />
          <span className="text-sm font-medium">{totalAssessments} assessments recorded</span>
        </div>
      </div>

      {/* Batch Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Select Batch
        </label>
        <div className="relative max-w-sm">
          <select
            value={selectedBatchId}
            onChange={(e) => handleBatchChange(e.target.value)}
            className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {selectedBatch && (
          <div className="flex items-center gap-3 mt-3">
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', TRADE_COLORS[selectedBatch.trade])}>
              {selectedBatch.trade}
            </span>
            <span className="text-xs text-gray-500">
              Trainer: {selectedBatch.trainerName}
            </span>
            <span className="text-xs text-gray-500">
              {batchTrainees.length} enrolled trainees
            </span>
            <span className="text-xs text-gray-500">
              {batchModules.length} modules
            </span>
          </div>
        )}
      </div>

      {/* Progress Summary */}
      {totalAssessments > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-gray-800">Progress Summary — All Modules</h2>
          </div>
          <div className="space-y-3">
            {LEVEL_OPTIONS.map((level) => {
              const count = levelCounts[level];
              const pct = totalAssessments > 0 ? Math.round((count / totalAssessments) * 100) : 0;
              const meta = COMPETENCY_LEVEL_LABELS[level];
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full w-24 text-center flex-shrink-0', meta.color)}>
                    L{level} {meta.label}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', LEVEL_BAR_COLORS[level])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Based on latest assessment per trainee per module ({totalAssessments} data points)
          </p>
        </div>
      )}

      {/* Module Matrix */}
      {batchModules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No modules found for this batch's trade.</p>
        </div>
      ) : batchTrainees.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No enrolled trainees in this batch.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {batchModules.map((mod) => {
            const isCompetent = moduleCompletionMap.get(mod.id) ?? false;
            return (
              <div key={mod.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Module header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                      {mod.code}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      Week {mod.weekNumber} · {mod.creditHours} credit hours
                    </span>
                  </div>
                  {isCompetent && (
                    <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Competent</span>
                    </div>
                  )}
                </div>

                {/* Trainee × Level matrix */}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-40">Trainee</th>
                        {LEVEL_OPTIONS.map((lvl) => (
                          <th key={lvl} className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                            L{lvl} — {COMPETENCY_LEVEL_LABELS[lvl].label}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Feedback</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {batchTrainees.map((trainee) => {
                        const key = `${trainee.id}__${mod.id}`;
                        const assessment = latestAssessmentMap.get(key);
                        const currentLevel = assessment?.level;
                        return (
                          <tr key={trainee.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">
                                {trainee.firstName} {trainee.lastName}
                              </div>
                            </td>
                            {LEVEL_OPTIONS.map((lvl) => {
                              const meta = COMPETENCY_LEVEL_LABELS[lvl];
                              const isActive = currentLevel === lvl;
                              return (
                                <td key={lvl} className="px-3 py-3 text-center">
                                  {isActive ? (
                                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', meta.color)}>
                                      L{lvl}
                                    </span>
                                  ) : (
                                    <span className="text-gray-200">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                              {assessment?.feedback
                                ? <span className="line-clamp-2">{assessment.feedback}</span>
                                : <span className="italic text-gray-300">Not yet assessed</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {assessment ? formatDate(assessment.assessmentDate) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Assessment Panel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200 bg-sky-50">
          <ClipboardList className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-gray-800">Record Assessment</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Trainee */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Trainee *</label>
              <div className="relative">
                <select
                  value={form.traineeId}
                  onChange={(e) => setForm((f) => ({ ...f, traineeId: e.target.value }))}
                  className={cn(
                    'w-full appearance-none bg-gray-50 border rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                    formErrors.traineeId ? 'border-red-400' : 'border-gray-200'
                  )}
                >
                  <option value="">— Select trainee —</option>
                  {batchTrainees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {formErrors.traineeId && (
                <p className="text-xs text-red-500 mt-1">{formErrors.traineeId}</p>
              )}
            </div>

            {/* Module */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Module *</label>
              <div className="relative">
                <select
                  value={form.moduleId}
                  onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value }))}
                  className={cn(
                    'w-full appearance-none bg-gray-50 border rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                    formErrors.moduleId ? 'border-red-400' : 'border-gray-200'
                  )}
                >
                  <option value="">— Select module —</option>
                  {batchModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.code}] {m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {formErrors.moduleId && (
                <p className="text-xs text-red-500 mt-1">{formErrors.moduleId}</p>
              )}
            </div>
          </div>

          {/* Level Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Competency Level *</label>
            {formErrors.level && (
              <p className="text-xs text-red-500 mb-2">{formErrors.level}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {LEVEL_OPTIONS.map((lvl) => {
                const meta = COMPETENCY_LEVEL_LABELS[lvl];
                const isSelected = form.level === lvl;
                return (
                  <label
                    key={lvl}
                    className={cn(
                      'flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition-all',
                      isSelected
                        ? 'border-sky-500 bg-sky-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="competencyLevel"
                      value={lvl}
                      checked={isSelected}
                      onChange={() => setForm((f) => ({ ...f, level: lvl }))}
                      className="mt-0.5 accent-sky-600"
                    />
                    <div>
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', meta.color)}>
                        Level {lvl}
                      </span>
                      <p className="text-sm font-medium text-gray-800 mt-1.5">{meta.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Assessor Feedback <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.feedback}
              onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))}
              rows={3}
              placeholder="Describe the trainee's performance, strengths and areas for improvement..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Submit Assessment
            </button>
            {submitSuccess && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Assessment recorded successfully
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
