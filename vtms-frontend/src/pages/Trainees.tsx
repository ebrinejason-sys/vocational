import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, UserPlus, X, ChevronRight, User,
  Phone, MapPin, AlertCircle, CheckCircle,
} from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import { cn, getVulnerabilityLabel, formatDate, friendlyError } from '../lib/utils';
import type { Trainee, VulnerabilityAssessment, TraineeStatus } from '../types';

// ── Vulnerability score computation ──────────────────────────────────────────

function computeVulnerabilityScore(a: VulnerabilityAssessment): number {
  let score = 0;

  // Housing (max 30)
  if (a.housingStatus === 'street') score += 30;
  else if (a.housingStatus === 'shelter') score += 20;
  else if (a.housingStatus === 'rented') score += 10;
  // owned = 0

  // Food security (max 25)
  if (a.foodSecurity === 'none') score += 25;
  else if (a.foodSecurity === 'inadequate') score += 15;
  // adequate = 0

  // Education (max 20)
  if (a.previousEducation === 'none') score += 20;
  else if (a.previousEducation === 'primary') score += 12;
  else if (a.previousEducation === 'secondary') score += 5;
  // vocational = 0

  // Family status (max 20)
  if (a.familyStatus === 'orphan') score += 20;
  else if (a.familyStatus === 'street_connected') score += 20;
  else if (a.familyStatus === 'single_parent') score += 10;
  // both_parents = 0

  // Disability (max 5)
  if (a.hasDisability) score += 5;

  return Math.min(100, score);
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TraineeStatus, string> = {
  prospect: 'bg-gray-100 text-gray-600',
  enrolled: 'bg-sky-100 text-sky-700',
  graduated: 'bg-green-100 text-green-700',
  dropped: 'bg-red-100 text-red-600',
  alumni: 'bg-purple-100 text-purple-700',
};

function StatusBadge({ status }: { status: TraineeStatus }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide', STATUS_COLORS[status])}>
      {status}
    </span>
  );
}

// ── Avatar initials ───────────────────────────────────────────────────────────

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  );
}

// ── Default form values ───────────────────────────────────────────────────────

type FormData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  mobilizationSource: string;
  batchId: string;
  // Vulnerability assessment
  housingStatus: VulnerabilityAssessment['housingStatus'];
  foodSecurity: VulnerabilityAssessment['foodSecurity'];
  previousEducation: VulnerabilityAssessment['previousEducation'];
  familyStatus: VulnerabilityAssessment['familyStatus'];
  hasDisability: boolean;
  disabilityDetails: string;
};

function defaultForm(activeBatchId: string): FormData {
  return {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    mobilizationSource: '',
    batchId: activeBatchId,
    housingStatus: 'rented',
    foodSecurity: 'inadequate',
    previousEducation: 'primary',
    familyStatus: 'both_parents',
    hasDisability: false,
    disabilityDetails: '',
  };
}

// ── Registration form ─────────────────────────────────────────────────────────

function RegistrationForm({ onClose }: { onClose: () => void }) {
  const { batches, activeBatchId, addTrainee } = useStore();
  const [form, setForm] = useState<FormData>(defaultForm(activeBatchId));
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const assessment: VulnerabilityAssessment = {
    housingStatus: form.housingStatus,
    foodSecurity: form.foodSecurity,
    previousEducation: form.previousEducation,
    familyStatus: form.familyStatus,
    hasDisability: form.hasDisability,
    disabilityDetails: form.disabilityDetails,
  };

  const previewScore = computeVulnerabilityScore(assessment);
  const { label: vulnLabel, color: vulnColor } = getVulnerabilityLabel(previewScore);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await addTrainee({
        batchId: form.batchId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone.trim(),
        address: form.address.trim(),
        emergencyContact: form.emergencyContact.trim(),
        emergencyPhone: form.emergencyPhone.trim(),
        mobilizationSource: form.mobilizationSource.trim(),
        vulnerabilityScore: previewScore,
        vulnerabilityAssessment: assessment,
        status: 'enrolled',
        graduationDate: null,
        photo: null,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(friendlyError(err, 'Failed to register trainee.'));
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">Trainee Registered</p>
          <p className="text-sm text-gray-500 mt-1">
            {form.firstName} {form.lastName} has been added to the system.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setForm(defaultForm(activeBatchId)); setSubmitted(false); }}
            className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Register Another
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white';
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';
  const sectionCls = 'bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Personal Information */}
      <div className={sectionCls}>
        <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name *</label>
            <input required className={inputCls} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="e.g. Emmanuel" />
          </div>
          <div>
            <label className={labelCls}>Last Name *</label>
            <input required className={inputCls} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="e.g. Deng" />
          </div>
          <div>
            <label className={labelCls}>Date of Birth *</label>
            <input required type="date" className={inputCls} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Gender *</label>
            <select required className={inputCls} value={form.gender} onChange={(e) => set('gender', e.target.value as 'male' | 'female')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Phone *</label>
            <input required className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+256 7XX XXX XXX" />
          </div>
          <div>
            <label className={labelCls}>Batch *</label>
            <select required className={inputCls} value={form.batchId} onChange={(e) => set('batchId', e.target.value)}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Address *</label>
            <input required className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="e.g. Bwindi Cell, Ishaka" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Mobilization Source</label>
            <input className={inputCls} value={form.mobilizationSource} onChange={(e) => set('mobilizationSource', e.target.value)} placeholder="e.g. Church Outreach, Probation Office, Social Worker" />
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className={sectionCls}>
        <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Emergency Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contact Name *</label>
            <input required className={inputCls} value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className={labelCls}>Contact Phone *</label>
            <input required className={inputCls} value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} placeholder="+256 7XX XXX XXX" />
          </div>
        </div>
      </div>

      {/* Vulnerability Assessment */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-bold text-gray-800">Vulnerability Assessment</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Score preview:</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold', vulnColor)}>
              {previewScore} — {vulnLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Housing Status *</label>
            <select required className={inputCls} value={form.housingStatus} onChange={(e) => set('housingStatus', e.target.value as VulnerabilityAssessment['housingStatus'])}>
              <option value="owned">Owned (stable housing)</option>
              <option value="rented">Rented</option>
              <option value="shelter">Shelter / Hostel</option>
              <option value="street">Street / No fixed abode</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Food Security *</label>
            <select required className={inputCls} value={form.foodSecurity} onChange={(e) => set('foodSecurity', e.target.value as VulnerabilityAssessment['foodSecurity'])}>
              <option value="adequate">Adequate</option>
              <option value="inadequate">Inadequate (skips meals)</option>
              <option value="none">None (food insecure)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Previous Education *</label>
            <select required className={inputCls} value={form.previousEducation} onChange={(e) => set('previousEducation', e.target.value as VulnerabilityAssessment['previousEducation'])}>
              <option value="vocational">Vocational / Post-secondary</option>
              <option value="secondary">Secondary (S1–S6)</option>
              <option value="primary">Primary only</option>
              <option value="none">No formal education</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Family Status *</label>
            <select required className={inputCls} value={form.familyStatus} onChange={(e) => set('familyStatus', e.target.value as VulnerabilityAssessment['familyStatus'])}>
              <option value="both_parents">Both parents present</option>
              <option value="single_parent">Single parent</option>
              <option value="orphan">Orphan</option>
              <option value="street_connected">Street-connected family</option>
            </select>
          </div>
        </div>

        <div className="flex items-start gap-3 mt-2">
          <input
            type="checkbox"
            id="hasDisability"
            checked={form.hasDisability}
            onChange={(e) => set('hasDisability', e.target.checked)}
            className="mt-0.5 accent-primary-600"
          />
          <div className="flex-1">
            <label htmlFor="hasDisability" className="text-sm font-medium text-gray-700 cursor-pointer">
              Has a disability or special need
            </label>
            {form.hasDisability && (
              <input
                className={cn(inputCls, 'mt-2')}
                value={form.disabilityDetails}
                onChange={(e) => set('disabilityDetails', e.target.value)}
                placeholder="Describe the disability or special need..."
              />
            )}
          </div>
        </div>
      </div>

      {submitError && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Register Trainee
        </button>
      </div>
    </form>
  );
}

// ── Main Trainees page ────────────────────────────────────────────────────────

export default function Trainees() {
  const navigate = useNavigate();
  const { trainees, batches } = useStore();
  const { profile } = useAuth();
  const mayEdit = profile ? canEdit(profile.role, 'trainees') : false;

  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enrolled' | 'graduated' | 'alumni' | 'dropped'>('all');
  const [showForm, setShowForm] = useState(false);

  const batchMap = useMemo(() => {
    const m: Record<string, typeof batches[0]> = {};
    batches.forEach((b) => { m[b.id] = b; });
    return m;
  }, [batches]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return trainees.filter((t) => {
      if (q && !`${t.firstName} ${t.lastName}`.toLowerCase().includes(q)) return false;
      if (filterBatch !== 'all' && t.batchId !== filterBatch) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      return true;
    });
  }, [trainees, search, filterBatch, filterStatus]);

  const selectCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trainees</h1>
          <p className="text-sm text-gray-500 mt-0.5">{trainees.length} total across {batches.length} batches</p>
        </div>
        {mayEdit && (
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            showForm
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          )}
        >
          {showForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Register New Trainee'}
        </button>
        )}
      </div>

      {/* Inline registration form */}
      {showForm && <RegistrationForm onClose={() => setShowForm(false)} />}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearch('')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select className={selectCls} value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
          <option value="all">All Batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select className={selectCls} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}>
          <option value="all">All Statuses</option>
          <option value="enrolled">Enrolled</option>
          <option value="graduated">Graduated</option>
          <option value="alumni">Alumni</option>
          <option value="dropped">Dropped</option>
        </select>
      </div>

      {/* Trainee list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <User className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No trainees found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map((t) => {
              const batch = batchMap[t.batchId];
              const { label: vLabel, color: vColor } = getVulnerabilityLabel(t.vulnerabilityScore);
              return (
                <li
                  key={t.id}
                  onClick={() => navigate(`/trainees/${t.id}`)}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-sky-50 cursor-pointer transition-colors group"
                >
                  <Avatar firstName={t.firstName} lastName={t.lastName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {t.firstName} {t.lastName}
                      </span>
                      <StatusBadge status={t.status} />
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold', vColor)}>
                        {vLabel} ({t.vulnerabilityScore})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                      {batch && (
                        <span className="font-medium text-gray-600">{batch.name} · {batch.trade}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {t.phone}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400 shrink-0 transition-colors" />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-right">Showing {filtered.length} of {trainees.length} trainees</p>
      )}
    </div>
  );
}
