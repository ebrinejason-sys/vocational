import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  UserCheck, Briefcase, TrendingUp, Star, Plus, ChevronDown,
  ChevronRight, Phone, MapPin, Calendar, DollarSign, X,
} from 'lucide-react';
import { useStore } from '../store';
import { formatCurrency, formatDate, generateId, today, cn } from '../lib/utils';
import type { EmploymentStatus, StarterKitStatus, AlumniFollowUp, JobPlacement } from '../types';

const EMPLOYMENT_STYLES: Record<EmploymentStatus, string> = {
  employed:       'bg-green-100 text-green-700',
  self_employed:  'bg-blue-100 text-blue-700',
  unemployed:     'bg-red-100 text-red-700',
  further_studies:'bg-purple-100 text-purple-700',
};
const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  employed:       'Employed',
  self_employed:  'Self-Employed',
  unemployed:     'Unemployed',
  further_studies:'Further Studies',
};

const KIT_STATUS_OPTIONS: StarterKitStatus[] = ['in_use', 'sold', 'lost', 'damaged', 'not_issued'];
const KIT_STATUS_LABELS: Record<StarterKitStatus, string> = {
  in_use:    'In Use',
  sold:      'Sold',
  lost:      'Lost',
  damaged:   'Damaged',
  not_issued:'Not Issued',
};

const CHART_COLORS: Record<EmploymentStatus, string> = {
  employed:       '#16a34a',
  self_employed:  '#0d9488',
  unemployed:     '#dc2626',
  further_studies:'#9333ea',
};

const defaultFollowUpForm = {
  traineeId:        '',
  employmentStatus: 'unemployed' as EmploymentStatus,
  currentEmployer:  '',
  monthlyIncome:    '',
  starterKitStatus: 'not_issued' as StarterKitStatus,
  notes:            '',
};

const defaultPlacementForm = {
  traineeId:     '',
  employerName:  '',
  position:      '',
  startDate:     today(),
  contactPerson: '',
  contactPhone:  '',
};

export default function Alumni() {
  const { batches, trainees, alumniFollowUps, jobPlacements, addAlumniFollowUp, addJobPlacement } = useStore();

  const [selectedAlumniId, setSelectedAlumniId] = useState<string | null>(null);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showPlacementForm, setShowPlacementForm] = useState(false);
  const [followUpForm, setFollowUpForm] = useState(defaultFollowUpForm);
  const [placementForm, setPlacementForm] = useState(defaultPlacementForm);
  const [followUpError, setFollowUpError] = useState('');
  const [placementError, setPlacementError] = useState('');
  const [followUpSuccess, setFollowUpSuccess] = useState('');
  const [placementSuccess, setPlacementSuccess] = useState('');

  // All alumni / graduated trainees
  const alumniTrainees = useMemo(
    () => trainees.filter((t) => t.status === 'alumni' || t.status === 'graduated'),
    [trainees]
  );

  // Latest follow-up per trainee
  function getLatestFollowUp(traineeId: string): AlumniFollowUp | undefined {
    return alumniFollowUps
      .filter((f) => f.traineeId === traineeId)
      .sort((a, b) => b.followUpDate.localeCompare(a.followUpDate))[0];
  }

  // Stats
  const stats = useMemo(() => {
    const total = alumniTrainees.length;
    let employed = 0;
    let totalIncome = 0;
    let withIncome = 0;

    alumniTrainees.forEach((t) => {
      const lf = getLatestFollowUp(t.id);
      if (lf) {
        if (lf.employmentStatus === 'employed' || lf.employmentStatus === 'self_employed') {
          employed++;
        }
        if (lf.monthlyIncome > 0) {
          totalIncome += lf.monthlyIncome;
          withIncome++;
        }
      }
    });

    const unemploymentRate = total > 0
      ? Math.round(((total - employed) / total) * 100)
      : 0;
    const avgIncome = withIncome > 0 ? Math.round(totalIncome / withIncome) : 0;

    return { total, employed, unemploymentRate, avgIncome };
  }, [alumniTrainees, alumniFollowUps]);

  // Employment outcome chart data
  const employmentChartData = useMemo(() => {
    const counts: Record<EmploymentStatus, number> = {
      employed: 0, self_employed: 0, unemployed: 0, further_studies: 0,
    };
    alumniTrainees.forEach((t) => {
      const lf = getLatestFollowUp(t.id);
      if (lf) counts[lf.employmentStatus]++;
      else counts.unemployed++; // no follow-up = unknown → show as unemployed baseline
    });
    return (Object.keys(counts) as EmploymentStatus[]).map((k) => ({
      name: EMPLOYMENT_LABELS[k],
      value: counts[k],
      key: k,
    }));
  }, [alumniTrainees, alumniFollowUps]);

  // Success stories: alumni with latest income > 300,000
  const successStories = useMemo(
    () => alumniTrainees.filter((t) => {
      const lf = getLatestFollowUp(t.id);
      return lf && lf.monthlyIncome > 300000;
    }),
    [alumniTrainees, alumniFollowUps]
  );

  function getBatch(id: string) {
    return batches.find((b) => b.id === id);
  }

  function getAllFollowUps(traineeId: string): AlumniFollowUp[] {
    return alumniFollowUps
      .filter((f) => f.traineeId === traineeId)
      .sort((a, b) => b.followUpDate.localeCompare(a.followUpDate));
  }

  // Record Follow-Up
  function handleFollowUpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFollowUpError('');
    setFollowUpSuccess('');
    if (!followUpForm.traineeId) return setFollowUpError('Please select a trainee.');
    const income = parseFloat(followUpForm.monthlyIncome);
    const entry: AlumniFollowUp = {
      id: generateId(),
      traineeId:        followUpForm.traineeId,
      followUpDate:     today(),
      employmentStatus: followUpForm.employmentStatus,
      currentEmployer:  followUpForm.currentEmployer.trim(),
      monthlyIncome:    isNaN(income) ? 0 : income,
      starterKitStatus: followUpForm.starterKitStatus,
      notes:            followUpForm.notes.trim(),
    };
    addAlumniFollowUp(entry);
    const t = trainees.find((t) => t.id === followUpForm.traineeId);
    setFollowUpSuccess(`Follow-up recorded for ${t?.firstName} ${t?.lastName}.`);
    setFollowUpForm(defaultFollowUpForm);
  }

  // Add Job Placement
  function handlePlacementSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPlacementError('');
    setPlacementSuccess('');
    if (!placementForm.traineeId)    return setPlacementError('Please select a trainee.');
    if (!placementForm.employerName) return setPlacementError('Enter employer name.');
    if (!placementForm.position)     return setPlacementError('Enter position/role.');
    if (!placementForm.startDate)    return setPlacementError('Enter a start date.');
    const placement: JobPlacement = {
      id:            generateId(),
      traineeId:     placementForm.traineeId,
      employerName:  placementForm.employerName.trim(),
      position:      placementForm.position.trim(),
      startDate:     placementForm.startDate,
      contactPerson: placementForm.contactPerson.trim(),
      contactPhone:  placementForm.contactPhone.trim(),
    };
    addJobPlacement(placement);
    const t = trainees.find((t) => t.id === placementForm.traineeId);
    setPlacementSuccess(`Job placement added for ${t?.firstName} ${t?.lastName}.`);
    setPlacementForm(defaultPlacementForm);
  }

  const selectedAlumni = selectedAlumniId ? trainees.find((t) => t.id === selectedAlumniId) : null;
  const selectedAlumniFollowUps = selectedAlumniId ? getAllFollowUps(selectedAlumniId) : [];
  const selectedAlumniBatch = selectedAlumni ? getBatch(selectedAlumni.batchId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Alumni Follow-Up</h2>
          <p className="text-xs text-gray-500 mt-0.5">Employment tracking, placement records, and success stories</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowFollowUpForm(!showFollowUpForm); setShowPlacementForm(false); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Record Follow-Up
          </button>
          <button
            onClick={() => { setShowPlacementForm(!showPlacementForm); setShowFollowUpForm(false); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <Briefcase className="w-4 h-4" />
            Add Placement
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
            <UserCheck className="w-5 h-5 text-primary-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Total Alumni</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center mb-3">
            <Briefcase className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-700">{stats.employed}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Employed / Self-Employed</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.unemploymentRate}%</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Unemployment Rate</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-sky-700">{formatCurrency(stats.avgIncome)}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Avg Monthly Income</p>
        </div>
      </div>

      {/* Record Follow-Up Form */}
      {showFollowUpForm && (
        <div className="bg-white rounded-xl border border-primary-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Record Follow-Up</h3>
          <form onSubmit={handleFollowUpSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alumni Trainee</label>
                <select
                  value={followUpForm.traineeId}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, traineeId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">Choose alumni...</option>
                  {alumniTrainees.map((t) => {
                    const b = getBatch(t.batchId);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} — {t.trade} {b?.name ? `(${b.name})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Employment Status</label>
                <select
                  value={followUpForm.employmentStatus}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, employmentStatus: e.target.value as EmploymentStatus })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {(Object.keys(EMPLOYMENT_LABELS) as EmploymentStatus[]).map((s) => (
                    <option key={s} value={s}>{EMPLOYMENT_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Current Employer / Business</label>
                <input
                  type="text"
                  value={followUpForm.currentEmployer}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, currentEmployer: e.target.value })}
                  placeholder="Employer or business name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Income (USD)</label>
                <input
                  type="number"
                  min="0"
                  value={followUpForm.monthlyIncome}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, monthlyIncome: e.target.value })}
                  placeholder="e.g. 350000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Starter Kit Status</label>
                <select
                  value={followUpForm.starterKitStatus}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, starterKitStatus: e.target.value as StarterKitStatus })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {KIT_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{KIT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  placeholder="Any additional observations..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
            {followUpError   && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{followUpError}</p>}
            {followUpSuccess && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{followUpSuccess}</p>}
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors">
                Save Follow-Up
              </button>
              <button type="button" onClick={() => { setShowFollowUpForm(false); setFollowUpError(''); setFollowUpSuccess(''); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Job Placement Form */}
      {showPlacementForm && (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Add Job Placement</h3>
          <form onSubmit={handlePlacementSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alumni Trainee</label>
                <select
                  value={placementForm.traineeId}
                  onChange={(e) => setPlacementForm({ ...placementForm, traineeId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">Choose alumni...</option>
                  {alumniTrainees.map((t) => {
                    const b = getBatch(t.batchId);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} — {t.trade}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Employer Name</label>
                <input
                  type="text"
                  value={placementForm.employerName}
                  onChange={(e) => setPlacementForm({ ...placementForm, employerName: e.target.value })}
                  placeholder="e.g. Bushenyi Electrical Services Ltd"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Position / Role</label>
                <input
                  type="text"
                  value={placementForm.position}
                  onChange={(e) => setPlacementForm({ ...placementForm, position: e.target.value })}
                  placeholder="e.g. Junior Carpenter"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={placementForm.startDate}
                  onChange={(e) => setPlacementForm({ ...placementForm, startDate: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={placementForm.contactPerson}
                  onChange={(e) => setPlacementForm({ ...placementForm, contactPerson: e.target.value })}
                  placeholder="e.g. Mr. Owomugisha"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={placementForm.contactPhone}
                  onChange={(e) => setPlacementForm({ ...placementForm, contactPhone: e.target.value })}
                  placeholder="+256 7xx xxx xxx"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>
            {placementError   && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{placementError}</p>}
            {placementSuccess && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{placementSuccess}</p>}
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">
                Save Placement
              </button>
              <button type="button" onClick={() => { setShowPlacementForm(false); setPlacementError(''); setPlacementSuccess(''); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alumni List Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Alumni Directory</h3>
        {alumniTrainees.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No alumni records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Name</th>
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Trade / Batch</th>
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Status</th>
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs hidden lg:table-cell">Employer</th>
                  <th className="text-right py-2 font-semibold text-gray-500 text-xs hidden lg:table-cell">Monthly Income</th>
                  <th className="text-right py-2 font-semibold text-gray-500 text-xs hidden md:table-cell">Last Follow-Up</th>
                  <th className="text-right py-2 font-semibold text-gray-500 text-xs">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {alumniTrainees.map((t) => {
                  const lf = getLatestFollowUp(t.id);
                  const batch = getBatch(t.batchId);
                  const isExpanded = selectedAlumniId === t.id;
                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        className={cn('hover:bg-gray-50 cursor-pointer transition-colors', isExpanded && 'bg-primary-50')}
                        onClick={() => setSelectedAlumniId(isExpanded ? null : t.id)}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                              {t.firstName[0]}{t.lastName[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{t.firstName} {t.lastName}</p>
                              <p className="text-[10px] text-gray-400">{t.gender === 'male' ? 'Male' : 'Female'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-gray-600 text-xs">
                          <span className="font-medium">{t.trade}</span>
                          <br />
                          <span className="text-gray-400">{batch?.name}</span>
                        </td>
                        <td className="py-3">
                          {lf ? (
                            <span className={cn('inline-block px-2 py-0.5 text-xs font-semibold rounded-full', EMPLOYMENT_STYLES[lf.employmentStatus])}>
                              {EMPLOYMENT_LABELS[lf.employmentStatus]}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-400">
                              No follow-up
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-gray-600 text-xs hidden lg:table-cell max-w-[160px] truncate">
                          {lf?.currentEmployer || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 text-right font-semibold hidden lg:table-cell">
                          {lf && lf.monthlyIncome > 0
                            ? <span className="text-green-700">{formatCurrency(lf.monthlyIncome)}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="py-3 text-right text-gray-400 text-xs hidden md:table-cell">
                          {lf ? formatDate(lf.followUpDate) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-primary-500 hover:text-primary-700">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 ml-auto" />
                              : <ChevronRight className="w-4 h-4 ml-auto" />
                            }
                          </span>
                        </td>
                      </tr>
                      {/* Expanded detail panel */}
                      {isExpanded && selectedAlumni && (
                        <tr>
                          <td colSpan={7} className="bg-primary-50 pb-4 px-4">
                            <div className="border border-primary-100 rounded-xl bg-white mt-1 p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-gray-800 text-sm">
                                  {selectedAlumni.firstName} {selectedAlumni.lastName} — Follow-Up History
                                </h4>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedAlumniId(null); }}
                                  className="p-1 hover:bg-gray-100 rounded-full"
                                >
                                  <X className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                              {/* Trainee meta */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  {selectedAlumni.phone}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <MapPin className="w-3 h-3 text-gray-400" />
                                  {selectedAlumni.address}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  Graduated: {selectedAlumni.graduationDate ? formatDate(selectedAlumni.graduationDate) : 'N/A'}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  Batch: {selectedAlumniBatch?.name}
                                </div>
                              </div>
                              {/* Follow-up records */}
                              {selectedAlumniFollowUps.length === 0 ? (
                                <p className="text-xs text-gray-400 italic py-2">No follow-up records for this alumnus.</p>
                              ) : (
                                <div className="space-y-3">
                                  {selectedAlumniFollowUps.map((fu, idx) => (
                                    <div key={fu.id} className={cn('rounded-lg p-3 border', idx === 0 ? 'border-primary-200 bg-primary-50' : 'border-gray-100 bg-white')}>
                                      <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-gray-600">{formatDate(fu.followUpDate)}</span>
                                        {idx === 0 && <span className="text-[10px] font-bold bg-primary-600 text-white px-1.5 py-0.5 rounded">Latest</span>}
                                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', EMPLOYMENT_STYLES[fu.employmentStatus])}>
                                          {EMPLOYMENT_LABELS[fu.employmentStatus]}
                                        </span>
                                        {fu.monthlyIncome > 0 && (
                                          <span className="text-xs font-bold text-green-700">{formatCurrency(fu.monthlyIncome)}/mo</span>
                                        )}
                                      </div>
                                      {fu.currentEmployer && (
                                        <p className="text-xs text-gray-600 mb-1">
                                          <span className="font-medium">Employer:</span> {fu.currentEmployer}
                                        </p>
                                      )}
                                      {fu.notes && (
                                        <p className="text-xs text-gray-500 italic">{fu.notes}</p>
                                      )}
                                      <p className="text-[10px] text-gray-400 mt-1">Kit: {KIT_STATUS_LABELS[fu.starterKitStatus]}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Employment Outcome Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Employment Outcome Breakdown</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={employmentChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                formatter={(val: unknown) => [String(val) + ' alumni', 'Count']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {employmentChartData.map((entry) => (
                  <Cell key={entry.key} fill={CHART_COLORS[entry.key as EmploymentStatus]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Job Placements Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-green-600" />
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Formal Job Placements</h3>
        </div>
        {jobPlacements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No formal placements recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Trainee</th>
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Employer</th>
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Position</th>
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Start Date</th>
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {jobPlacements.map((p) => {
                  const t = trainees.find((t) => t.id === p.traineeId);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-3 font-semibold text-gray-800">
                        {t ? `${t.firstName} ${t.lastName}` : p.traineeId}
                      </td>
                      <td className="py-3 text-gray-600">{p.employerName}</td>
                      <td className="py-3">
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                          {p.position}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500 text-xs">{formatDate(p.startDate)}</td>
                      <td className="py-3 text-xs text-gray-500">
                        <p className="font-medium">{p.contactPerson}</p>
                        {p.contactPhone && <p className="text-gray-400">{p.contactPhone}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Success Stories */}
      {successStories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Success Stories</h3>
            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
              Monthly income &gt; USD 80
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {successStories.map((t) => {
              const lf = getLatestFollowUp(t.id)!;
              const batch = getBatch(t.batchId);
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 shrink-0">
                      {t.firstName[0]}{t.lastName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{t.firstName} {t.lastName}</p>
                      <p className="text-[10px] text-gray-500">{t.trade} · {batch?.name}</p>
                    </div>
                    <Star className="w-4 h-4 text-amber-500 ml-auto shrink-0" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Status</span>
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', EMPLOYMENT_STYLES[lf.employmentStatus])}>
                        {EMPLOYMENT_LABELS[lf.employmentStatus]}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Monthly Income</span>
                      <span className="text-sm font-bold text-green-700">{formatCurrency(lf.monthlyIncome)}</span>
                    </div>
                    {lf.currentEmployer && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs text-gray-500 shrink-0">Employer</span>
                        <span className="text-xs font-medium text-gray-700 text-right">{lf.currentEmployer}</span>
                      </div>
                    )}
                    {lf.notes && (
                      <p className="text-xs text-gray-500 italic border-t border-amber-100 pt-2 mt-2">
                        "{lf.notes}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
