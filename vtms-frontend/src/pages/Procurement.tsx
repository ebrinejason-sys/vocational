import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Plus, CheckCircle2, Clock, Package, XCircle,
} from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import { cn, formatCurrency, formatDate, generateId, today } from '../lib/utils';
import type { ProcurementRequest } from '../types';
import Modal from '../components/Modal';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700' },
  purchased: { label: 'Purchased', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

interface ProcForm {
  itemId: string;
  quantityRequested: string;
  estimatedCost: string;
}

const EMPTY: ProcForm = { itemId: '', quantityRequested: '', estimatedCost: '' };

export default function Procurement() {
  const { profile } = useAuth();
  const mayEdit = profile ? canEdit(profile.role, 'inventory') : false;
  const {
    inventoryItems,
    procurementRequests,
    addProcurementRequest,
    updateProcurementRequest,
    fulfillProcurementRequest,
  } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProcForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<ProcForm>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const selectedItem = inventoryItems.find((i) => i.id === form.itemId);
  const pending = useMemo(
    () => procurementRequests.filter((r) => r.status === 'pending' || r.status === 'approved'),
    [procurementRequests]
  );

  const autoCost = useMemo(() => {
    if (!selectedItem || !form.quantityRequested) return '';
    const qty = parseFloat(form.quantityRequested);
    if (isNaN(qty)) return '';
    return String(Math.round(qty * selectedItem.unitCost * 100) / 100);
  }, [selectedItem, form.quantityRequested]);

  function validate(): boolean {
    const next: Partial<ProcForm> = {};
    if (!form.itemId) next.itemId = 'Select an inventory item';
    if (!form.quantityRequested || isNaN(Number(form.quantityRequested)) || Number(form.quantityRequested) <= 0)
      next.quantityRequested = 'Enter a valid quantity';
    const cost = form.estimatedCost || autoCost;
    if (!cost || isNaN(Number(cost)) || Number(cost) < 0) next.estimatedCost = 'Enter estimated cost';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const item = inventoryItems.find((i) => i.id === form.itemId)!;
    const request: ProcurementRequest = {
      id: generateId(),
      itemId: form.itemId,
      itemName: item.name,
      quantityRequested: Number(form.quantityRequested),
      estimatedCost: Number(form.estimatedCost || autoCost),
      status: 'pending',
      requestedBy: profile?.fullName ?? 'Staff',
      createdAt: today(),
    };
    addProcurementRequest(request);
    setForm(EMPTY);
    setShowForm(false);
    setBanner('Procurement request submitted.');
    setTimeout(() => setBanner(null), 3000);
  }

  function markApproved(id: string) {
    updateProcurementRequest(id, { status: 'approved' });
  }

  function markCancelled(id: string) {
    updateProcurementRequest(id, { status: 'cancelled' });
  }

  function markPurchased(id: string) {
    fulfillProcurementRequest(id);
    setBanner('Marked purchased — stock received into inventory.');
    setTimeout(() => setBanner(null), 3500);
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement</h1>
          <p className="text-sm text-gray-500 mt-1">
            Request purchases, approve them, then receive stock into Inventory when bought.
          </p>
        </div>
        {mayEdit && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={!inventoryItems.length}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
              inventoryItems.length
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            )}
          >
            <Plus className="w-4 h-4" />
            New request
          </button>
        )}
      </div>

      {!inventoryItems.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add catalog items on{' '}
          <Link to="/inventory" className="font-semibold underline">Inventory</Link>
          {' '}before creating procurement requests.
        </div>
      )}

      {banner && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {banner}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Open requests</p>
            <p className="text-lg font-bold text-gray-900">{pending.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Purchased</p>
            <p className="text-lg font-bold text-gray-900">
              {procurementRequests.filter((r) => r.status === 'purchased').length}
            </p>
          </div>
        </div>
        <Link
          to="/inventory"
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:border-primary-200"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Back to inventory</p>
            <p className="text-sm font-semibold text-primary-700">View stock →</p>
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-800">Requests</h2>
          <span className="ml-auto text-xs text-gray-400">{procurementRequests.length} total</span>
        </div>

        {procurementRequests.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            No procurement requests yet.
            {mayEdit && inventoryItems.length > 0 && (
              <button type="button" onClick={() => setShowForm(true)} className="block mx-auto mt-3 text-primary-600 font-semibold">
                Create the first request
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-50">
                  <th className="px-5 py-3 font-semibold">Item</th>
                  <th className="px-3 py-3 font-semibold">Qty</th>
                  <th className="px-3 py-3 font-semibold">Est. cost</th>
                  <th className="px-3 py-3 font-semibold">Requested</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...procurementRequests].reverse().map((req) => {
                  const status = STATUS_CONFIG[req.status];
                  return (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{req.itemName}</td>
                      <td className="px-3 py-3 text-gray-700">{req.quantityRequested}</td>
                      <td className="px-3 py-3 text-gray-700">{formatCurrency(req.estimatedCost)}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">
                        {req.requestedBy}<br />{formatDate(req.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', status.color)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {mayEdit && (
                          <div className="flex flex-wrap gap-1.5">
                            {req.status === 'pending' && (
                              <>
                                <button type="button" onClick={() => markApproved(req.id)} className="text-[11px] font-semibold text-blue-700 hover:underline">
                                  Approve
                                </button>
                                <button type="button" onClick={() => markCancelled(req.id)} className="text-[11px] font-semibold text-gray-500 hover:underline inline-flex items-center gap-0.5">
                                  <XCircle className="w-3 h-3" /> Cancel
                                </button>
                              </>
                            )}
                            {(req.status === 'pending' || req.status === 'approved') && (
                              <button type="button" onClick={() => markPurchased(req.id)} className="text-[11px] font-semibold text-green-700 hover:underline">
                                Mark purchased (+stock)
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title="New procurement request" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Item *</label>
              <select
                className={inputCls}
                value={form.itemId}
                onChange={(e) => {
                  const itemId = e.target.value;
                  const item = inventoryItems.find((i) => i.id === itemId);
                  setForm({
                    ...form,
                    itemId,
                    estimatedCost: item && form.quantityRequested
                      ? String(Math.round(Number(form.quantityRequested) * item.unitCost * 100) / 100)
                      : form.estimatedCost,
                  });
                }}
              >
                <option value="">Select catalog item…</option>
                {inventoryItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({formatCurrency(i.unitCost)}/{i.unit})</option>
                ))}
              </select>
              {errors.itemId && <p className="text-xs text-red-600 mt-1">{errors.itemId}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
              <input
                className={inputCls}
                value={form.quantityRequested}
                onChange={(e) => setForm({ ...form, quantityRequested: e.target.value })}
              />
              {errors.quantityRequested && <p className="text-xs text-red-600 mt-1">{errors.quantityRequested}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated cost (USD) *</label>
              <input
                className={inputCls}
                value={form.estimatedCost || autoCost}
                onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                placeholder={autoCost || '0'}
              />
              {autoCost && (
                <p className="text-[11px] text-gray-400 mt-1">Suggested from unit cost: {formatCurrency(Number(autoCost))}</p>
              )}
              {errors.estimatedCost && <p className="text-xs text-red-600 mt-1">{errors.estimatedCost}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg">Submit request</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
