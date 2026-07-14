import React, { useState, useMemo } from 'react';
import {
  GraduationCap, Award, Package, CheckCircle, AlertCircle,
  Plus, Users, TrendingUp,
} from 'lucide-react';
import { useStore } from '../store';
import { formatCurrency, formatDate, generateId, today, cn, formatBatchTrades, formatBatchTrainers } from '../lib/utils';
import type { StarterKitStatus } from '../types';

const KIT_STATUS_STYLES: Record<StarterKitStatus, string> = {
  in_use:    'bg-green-100 text-green-700',
  sold:      'bg-blue-100 text-blue-700',
  lost:      'bg-red-100 text-red-700',
  damaged:   'bg-orange-100 text-orange-700',
  not_issued:'bg-gray-100 text-gray-500',
};

const KIT_STATUS_LABELS: Record<StarterKitStatus, string> = {
  in_use:    'In Use',
  sold:      'Sold',
  lost:      'Lost',
  damaged:   'Damaged',
  not_issued:'Not Issued',
};

const defaultGradForm = { traineeId: '', graduationDate: today() };
const defaultKitForm  = { traineeId: '', description: '', totalValue: '' };

export default function Graduation() {
  const { batches, trainees, starterKits, updateTrainee, addStarterKit } = useStore();

  const [showGradForm, setShowGradForm] = useState(false);
  const [showKitForm,  setShowKitForm]  = useState(false);
  const [gradForm, setGradForm] = useState(defaultGradForm);
  const [kitForm,  setKitForm]  = useState(defaultKitForm);
  const [gradError, setGradError] = useState('');
  const [kitError,  setKitError]  = useState('');
  const [gradSuccess, setGradSuccess] = useState('');
  const [kitSuccess,  setKitSuccess]  = useState('');

  // All graduated / alumni trainees
  const graduatedTrainees = useMemo(
    () => trainees.filter((t) => t.status === 'graduated' || t.status === 'alumni'),
    [trainees]
  );

  // Enrolled trainees eligible for graduation
  const enrolledTrainees = useMemo(
    () => trainees.filter((t) => t.status === 'enrolled'),
    [trainees]
  );

  // Graduated trainees who don't yet have a starter kit
  const traineesWithoutKit = useMemo(
    () => graduatedTrainees.filter((t) => !starterKits.find((k) => k.traineeId === t.id)),
    [graduatedTrainees, starterKits]
  );

  // Kit status counts
  const kitStatusCounts = useMemo(() => {
    const counts: Record<StarterKitStatus, number> = {
      in_use: 0, sold: 0, lost: 0, damaged: 0, not_issued: 0,
    };
    starterKits.forEach((k) => { counts[k.status]++; });
    // Add trainees with no kit
    counts.not_issued += traineesWithoutKit.length;
    return counts;
  }, [starterKits, traineesWithoutKit]);

  const kitsIssued   = starterKits.length;
  const kitsInUse    = kitStatusCounts.in_use;
  const totalGraduated = graduatedTrainees.length;

  // Total enrolled+graduated+alumni+dropped per batch to calc graduation rate
  const graduationRateAll = useMemo(() => {
    const eligible = trainees.filter((t) => t.status !== 'prospect').length;
    if (eligible === 0) return 0;
    return Math.round((totalGraduated / eligible) * 100);
  }, [trainees, totalGraduated]);

  // Group graduated trainees by batch
  const groupedByBatch = useMemo(() => {
    const map: Record<string, typeof graduatedTrainees> = {};
    graduatedTrainees.forEach((t) => {
      if (!map[t.batchId]) map[t.batchId] = [];
      map[t.batchId].push(t);
    });
    return map;
  }, [graduatedTrainees]);

  function getBatch(id: string) {
    return batches.find((b) => b.id === id);
  }

  function getKit(traineeId: string) {
    return starterKits.find((k) => k.traineeId === traineeId);
  }

  // Mark Graduation
  async function handleGradSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGradError('');
    setGradSuccess('');
    if (!gradForm.traineeId) return setGradError('Please select a trainee.');
    if (!gradForm.graduationDate) return setGradError('Please enter a graduation date.');
    try {
      await updateTrainee(gradForm.traineeId, { status: 'graduated', graduationDate: gradForm.graduationDate });
      const t = trainees.find((t) => t.id === gradForm.traineeId);
      setGradSuccess(`${t?.firstName} ${t?.lastName} has been marked as graduated.`);
      setGradForm(defaultGradForm);
    } catch (err) {
      setGradError(err instanceof Error ? err.message : 'Failed to update trainee. Check your permissions.');
    }
  }

  // Issue Starter Kit
  function handleKitSubmit(e: React.FormEvent) {
    e.preventDefault();
    setKitError('');
    setKitSuccess('');
    const val = parseFloat(kitForm.totalValue);
    if (!kitForm.traineeId)  return setKitError('Please select a trainee.');
    if (!kitForm.description.trim()) return setKitError('Please enter a kit description.');
    if (!val || val <= 0)    return setKitError('Enter a valid kit value.');
    addStarterKit({
      id: generateId(),
      traineeId: kitForm.traineeId,
      description: kitForm.description.trim(),
      issuedDate: today(),
      totalValue: val,
      status: 'in_use',
    });
    const t = trainees.find((t) => t.id === kitForm.traineeId);
    setKitSuccess(`Starter kit issued to ${t?.firstName} ${t?.lastName}.`);
    setKitForm(defaultKitForm);
  }

  const totalKitValue = starterKits.reduce((sum, k) => sum + k.totalValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Graduation & Starter Kits</h2>
          <p className="text-xs text-gray-500 mt-0.5">Track graduates, kit issuance, and employment readiness</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowGradForm(!showGradForm); setShowKitForm(false); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <GraduationCap className="w-4 h-4" />
            Mark Graduation
          </button>
          <button
            onClick={() => { setShowKitForm(!showKitForm); setShowGradForm(false); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-sm"
          >
            <Package className="w-4 h-4" />
            Issue Kit
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
            <GraduationCap className="w-5 h-5 text-primary-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalGraduated}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Total Graduated</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-700">{graduationRateAll}%</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Graduation Rate</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center mb-3">
            <Package className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-3xl font-bold text-sky-700">{kitsIssued}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Kits Issued</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-700">{kitsInUse}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Kits In Use</p>
        </div>
      </div>

      {/* Mark Graduation Form */}
      {showGradForm && (
        <div className="bg-white rounded-xl border border-primary-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Mark Trainee as Graduated</h3>
          {enrolledTrainees.length === 0 ? (
            <p className="text-sm text-gray-400">No enrolled trainees available for graduation.</p>
          ) : (
            <form onSubmit={handleGradSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Select Trainee (Enrolled)</label>
                  <select
                    value={gradForm.traineeId}
                    onChange={(e) => setGradForm({ ...gradForm, traineeId: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  >
                    <option value="">Choose trainee...</option>
                    {enrolledTrainees.map((t) => {
                      const b = getBatch(t.batchId);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName} — {b?.name ?? t.batchId}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Graduation Date</label>
                  <input
                    type="date"
                    value={gradForm.graduationDate}
                    onChange={(e) => setGradForm({ ...gradForm, graduationDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              </div>
              {gradError   && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{gradError}</p>}
              {gradSuccess && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{gradSuccess}</p>}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors">
                  Mark as Graduated
                </button>
                <button type="button" onClick={() => { setShowGradForm(false); setGradError(''); setGradSuccess(''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Issue Starter Kit Form */}
      {showKitForm && (
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Issue Starter Kit</h3>
          {traineesWithoutKit.length === 0 ? (
            <p className="text-sm text-gray-400">All graduated trainees already have starter kits.</p>
          ) : (
            <form onSubmit={handleKitSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Select Trainee (No Kit Yet)</label>
                  <select
                    value={kitForm.traineeId}
                    onChange={(e) => setKitForm({ ...kitForm, traineeId: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="">Choose trainee...</option>
                    {traineesWithoutKit.map((t) => {
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Total Value (USD)</label>
                  <input
                    type="number"
                    min="1"
                    value={kitForm.totalValue}
                    onChange={(e) => setKitForm({ ...kitForm, totalValue: e.target.value })}
                    placeholder="e.g. 175000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Kit Description</label>
                  <textarea
                    rows={2}
                    value={kitForm.description}
                    onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })}
                    placeholder="List tools and materials included in the kit..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
                  />
                </div>
              </div>
              {kitError   && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{kitError}</p>}
              {kitSuccess && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{kitSuccess}</p>}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 transition-colors">
                  Issue Starter Kit
                </button>
                <button type="button" onClick={() => { setShowKitForm(false); setKitError(''); setKitSuccess(''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Kit Status Overview */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Kit Status Overview</h3>
          <span className="text-xs text-gray-400 font-medium">
            Total Kit Value: <span className="text-sky-700 font-bold">{formatCurrency(totalKitValue)}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['in_use', 'damaged', 'sold', 'lost'] as StarterKitStatus[]).map((status) => {
            const count = kitStatusCounts[status];
            const total = kitsIssued || 1;
            const pct   = Math.round((count / total) * 100);
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', KIT_STATUS_STYLES[status])}>
                    {KIT_STATUS_LABELS[status]}
                  </span>
                  <span className="text-sm font-bold text-gray-700">{count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      status === 'in_use'  ? 'bg-green-500' :
                      status === 'sold'    ? 'bg-blue-500'  :
                      status === 'lost'    ? 'bg-red-500'   : 'bg-orange-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 text-right">{pct}% of issued</p>
              </div>
            );
          })}
        </div>
        {kitStatusCounts.not_issued > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{kitStatusCounts.not_issued} graduated trainee{kitStatusCounts.not_issued !== 1 ? 's' : ''} have not yet received a starter kit.</span>
          </div>
        )}
      </div>

      {/* Graduated Trainees by Batch */}
      {Object.entries(groupedByBatch).map(([batchId, batchTrainees]) => {
        const batch = getBatch(batchId);
        if (!batch) return null;
        return (
          <div key={batchId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">{batch.name}</h3>
                <p className="text-xs text-gray-400">{formatBatchTrades(batch.trades)} · Trainers: {formatBatchTrainers(batch.trades)}</p>
              </div>
              <span className="ml-auto text-xs font-bold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">
                {batchTrainees.length} graduate{batchTrainees.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Name</th>
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Trade</th>
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Graduation Date</th>
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Kit Status</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Kit Value</th>
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Kit Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batchTrainees.map((t) => {
                    const kit = getKit(t.id);
                    const kitStatus: StarterKitStatus = kit?.status ?? 'not_issued';
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                              {t.firstName[0]}{t.lastName[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{t.firstName} {t.lastName}</p>
                              <p className="text-[10px] text-gray-400">{t.gender === 'male' ? 'M' : 'F'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-gray-600 text-xs">{formatBatchTrades(batch.trades)}</td>
                        <td className="py-3 text-gray-600 text-xs">
                          {t.graduationDate ? formatDate(t.graduationDate) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3">
                          <span className={cn('inline-block px-2 py-0.5 text-xs font-semibold rounded-full', KIT_STATUS_STYLES[kitStatus])}>
                            {KIT_STATUS_LABELS[kitStatus]}
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold text-sky-700">
                          {kit ? formatCurrency(kit.totalValue) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 text-xs text-gray-500 max-w-[200px] truncate">
                          {kit ? kit.description : <span className="text-gray-300 italic">No kit issued</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Kit detail rows */}
            {batchTrainees.filter((t) => getKit(t.id)).length > 0 && (
              <div className="mt-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Kit Details</h4>
                {batchTrainees.map((t) => {
                  const kit = getKit(t.id);
                  if (!kit) return null;
                  return (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <div className="sm:w-36 font-semibold text-sm text-gray-800 shrink-0">
                        {t.firstName} {t.lastName}
                      </div>
                      <div className="flex-1 text-xs text-gray-500">{kit.description}</div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400">Issued: {formatDate(kit.issuedDate)}</span>
                        <span className="text-xs font-bold text-sky-700">{formatCurrency(kit.totalValue)}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', KIT_STATUS_STYLES[kit.status])}>
                          {KIT_STATUS_LABELS[kit.status]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {graduatedTrainees.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <GraduationCap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No graduates yet</p>
          <p className="text-xs text-gray-300 mt-1">Use "Mark Graduation" to record graduated trainees.</p>
        </div>
      )}
    </div>
  );
}
