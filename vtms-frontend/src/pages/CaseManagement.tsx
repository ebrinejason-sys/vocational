import React, { useState, useMemo } from 'react';
import {
  Shield, ChevronDown, AlertTriangle, CalendarClock, User,
  Filter, CheckCircle2, Clock, Plus, X,
} from 'lucide-react';
import { useStore } from '../store';
import { cn, formatDate, generateId, today } from '../lib/utils';
import { CASE_CATEGORY_LABELS } from '../types';
import type { CaseCategory, CaseNote } from '../types';

const AUTHOR_NAME = 'James Nkurunziza';

const CATEGORY_OPTIONS: CaseCategory[] = [
  'trauma_healing',
  'mentorship',
  'safeguarding',
  'home_visit',
  'medical',
];

const CATEGORY_COLORS: Record<CaseCategory, string> = {
  trauma_healing: 'bg-purple-100 text-purple-700',
  mentorship: 'bg-sky-100 text-sky-700',
  safeguarding: 'bg-red-100 text-red-700',
  home_visit: 'bg-green-100 text-green-700',
  medical: 'bg-orange-100 text-orange-700',
};

interface NoteForm {
  category: CaseCategory;
  content: string;
  isCritical: boolean;
  followUpRequired: boolean;
  followUpDate: string;
}

const EMPTY_FORM: NoteForm = {
  category: 'mentorship',
  content: '',
  isCritical: false,
  followUpRequired: false,
  followUpDate: '',
};

export default function CaseManagement() {
  const {
    batches,
    trainees,
    caseNotes,
    activeBatchId,
    addCaseNote,
  } = useStore();

  const [selectedTraineeId, setSelectedTraineeId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<CaseCategory | 'all'>('all');
  const [form, setForm] = useState<NoteForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NoteForm, string>>>({});
  const [showForm, setShowForm] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Active batch trainees
  const activeBatch = useMemo(() => batches.find((b) => b.id === activeBatchId), [batches, activeBatchId]);
  const activeBatchTrainees = useMemo(
    () => trainees.filter((t) => t.batchId === activeBatchId && t.status === 'enrolled'),
    [trainees, activeBatchId]
  );

  const selectedTrainee = useMemo(
    () => activeBatchTrainees.find((t) => t.id === selectedTraineeId),
    [activeBatchTrainees, selectedTraineeId]
  );

  // Case notes for selected trainee
  const traineeCaseNotes = useMemo(() => {
    if (!selectedTraineeId) return [];

    let notes = caseNotes.filter((n) => n.traineeId === selectedTraineeId);

    if (categoryFilter !== 'all') {
      notes = notes.filter((n) => n.category === categoryFilter);
    }

    // Critical first, then descending date
    return notes.sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [caseNotes, selectedTraineeId, categoryFilter]);

  const criticalCount = useMemo(
    () => caseNotes.filter((n) => n.traineeId === selectedTraineeId && n.isCritical).length,
    [caseNotes, selectedTraineeId]
  );

  // Validation
  const validate = (): boolean => {
    const errors: Partial<Record<keyof NoteForm, string>> = {};
    if (!form.content.trim()) errors.content = 'Please enter a case note.';
    if (form.followUpRequired && !form.followUpDate) {
      errors.followUpDate = 'Follow-up date is required when follow-up is requested.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraineeId) return;
    if (!validate()) return;

    const newNote: CaseNote = {
      id: generateId(),
      traineeId: selectedTraineeId,
      category: form.category,
      content: form.content.trim(),
      isCritical: form.isCritical,
      followUpRequired: form.followUpRequired,
      followUpDate: form.followUpRequired && form.followUpDate ? form.followUpDate : null,
      authorName: AUTHOR_NAME,
      createdAt: today(),
    };

    addCaseNote(newNote);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowForm(false);
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Confidential trainee support notes — pastoral care and safeguarding
          </p>
        </div>
      </div>

      {/* Confidentiality Banner */}
      <div className="flex items-start gap-4 bg-sky-50 border border-sky-200 rounded-xl p-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-sky-800">Confidentiality Notice</h3>
          <p className="text-xs text-sky-700 mt-1">
            All case notes are strictly confidential and intended solely for authorised Agape Skills Centre
            staff. Information must not be shared outside the support team without consent. Safeguarding
            incidents must be escalated to the Welfare Officer immediately. Handle all records with care
            in accordance with our data protection policy.
          </p>
        </div>
      </div>

      {/* Trainee Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Select Trainee
              {activeBatch && (
                <span className="text-gray-400 font-normal ml-1">
                  — {activeBatch.name}
                </span>
              )}
            </label>
            <div className="relative max-w-sm">
              <select
                value={selectedTraineeId}
                onChange={(e) => {
                  setSelectedTraineeId(e.target.value);
                  setCategoryFilter('all');
                  setShowForm(false);
                  setSubmitSuccess(false);
                }}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">— Choose a trainee —</option>
                {activeBatchTrainees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {selectedTraineeId && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'New Case Note'}
            </button>
          )}
        </div>

        {selectedTrainee && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
                <User className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedTrainee.firstName} {selectedTrainee.lastName}
                </p>
                <p className="text-xs text-gray-500">{selectedTrainee.phone}</p>
              </div>
            </div>
            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">{criticalCount} critical note{criticalCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Case Note Form */}
      {showForm && selectedTraineeId && (
        <div className="bg-white rounded-xl border-2 border-sky-200 overflow-hidden">
          <div className="px-5 py-4 bg-sky-50 border-b border-sky-200 flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-gray-800">New Case Note</h2>
            <span className="text-xs text-gray-500">
              for {selectedTrainee?.firstName} {selectedTrainee?.lastName}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category *</label>
              <div className="relative max-w-xs">
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as CaseCategory }))}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>{CASE_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note Content *</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={5}
                placeholder="Document the case note in detail. Include context, observations, actions taken, and referrals made..."
                className={cn(
                  'w-full bg-gray-50 border rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none',
                  formErrors.content ? 'border-red-400' : 'border-gray-200'
                )}
              />
              {formErrors.content && (
                <p className="text-xs text-red-500 mt-1">{formErrors.content}</p>
              )}
            </div>

            {/* Flags */}
            <div className="flex flex-col sm:flex-row gap-4">
              <label className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                form.isCritical ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              )}>
                <input
                  type="checkbox"
                  checked={form.isCritical}
                  onChange={(e) => setForm((f) => ({ ...f, isCritical: e.target.checked }))}
                  className="accent-red-600 w-4 h-4"
                />
                <div>
                  <p className={cn('text-sm font-semibold', form.isCritical ? 'text-red-700' : 'text-gray-800')}>
                    Mark as Critical
                  </p>
                  <p className="text-xs text-gray-500">Requires immediate management attention</p>
                </div>
              </label>

              <label className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                form.followUpRequired ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              )}>
                <input
                  type="checkbox"
                  checked={form.followUpRequired}
                  onChange={(e) => setForm((f) => ({ ...f, followUpRequired: e.target.checked, followUpDate: '' }))}
                  className="accent-amber-600 w-4 h-4"
                />
                <div>
                  <p className={cn('text-sm font-semibold', form.followUpRequired ? 'text-amber-700' : 'text-gray-800')}>
                    Follow-up Required
                  </p>
                  <p className="text-xs text-gray-500">Schedule a follow-up action</p>
                </div>
              </label>
            </div>

            {/* Follow-up date */}
            {form.followUpRequired && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Follow-up Date *</label>
                <input
                  type="date"
                  value={form.followUpDate}
                  min={today()}
                  onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))}
                  className={cn(
                    'bg-gray-50 border rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                    formErrors.followUpDate ? 'border-red-400' : 'border-gray-200'
                  )}
                />
                {formErrors.followUpDate && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.followUpDate}</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 pt-1">
              <button
                type="submit"
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Save Case Note
              </button>
              <p className="text-xs text-gray-400">
                Author: <span className="font-medium text-gray-600">{AUTHOR_NAME}</span> · {today()}
              </p>
            </div>
          </form>
        </div>
      )}

      {/* Success */}
      {submitSuccess && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">Case note saved successfully.</span>
        </div>
      )}

      {/* Case Notes History */}
      {selectedTraineeId && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-800">
              Case Notes History
              {selectedTrainee && (
                <span className="text-gray-400 font-normal ml-1">
                  — {selectedTrainee.firstName} {selectedTrainee.lastName}
                </span>
              )}
            </h2>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CaseCategory | 'all')}
                  className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">All Categories</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>{CASE_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {traineeCaseNotes.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No case notes found for this trainee.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {traineeCaseNotes.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    'px-5 py-4 transition-colors',
                    note.isCritical ? 'border-l-4 border-red-500 bg-red-50/30' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={cn(
                      'text-xs font-semibold px-2.5 py-0.5 rounded-full',
                      CATEGORY_COLORS[note.category]
                    )}>
                      {CASE_CATEGORY_LABELS[note.category]}
                    </span>

                    {note.isCritical && (
                      <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                        <AlertTriangle className="w-3 h-3" />
                        CRITICAL
                      </span>
                    )}

                    {note.followUpRequired && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3" />
                        Follow-up{note.followUpDate ? `: ${formatDate(note.followUpDate)}` : ''}
                      </span>
                    )}

                    <span className="ml-auto text-xs text-gray-400">
                      {formatDate(note.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">{note.authorName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state — no trainee selected */}
      {!selectedTraineeId && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Shield className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 font-medium">Select a trainee to view or add case notes.</p>
          <p className="text-xs text-gray-400 mt-1">
            Case notes are confidential — handle with care.
          </p>
        </div>
      )}
    </div>
  );
}
