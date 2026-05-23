import React, { useState, useMemo } from 'react';
import {
  Package, AlertTriangle, ChevronDown, Plus, ShoppingCart,
  CheckCircle2, TrendingDown, DollarSign, Clock, X,
  Layers, ClipboardList,
} from 'lucide-react';
import { useStore } from '../store';
import { cn, formatCurrency, formatDate, generateId, today } from '../lib/utils';
import type { ProcurementRequest } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  Tool: 'bg-blue-100 text-blue-700',
  Material: 'bg-amber-100 text-amber-700',
  Equipment: 'bg-purple-100 text-purple-700',
  Safety: 'bg-green-100 text-green-700',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700' },
  purchased: { label: 'Purchased', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

interface UsageForm {
  itemId: string;
  quantityUsed: string;
  batchId: string;
  purpose: string;
}

interface ProcurementForm {
  itemId: string;
  quantityRequested: string;
  estimatedCost: string;
}

const EMPTY_USAGE: UsageForm = { itemId: '', quantityUsed: '', batchId: '', purpose: '' };
const EMPTY_PROCUREMENT: ProcurementForm = { itemId: '', quantityRequested: '', estimatedCost: '' };

export default function Inventory() {
  const {
    inventoryItems,
    inventoryUsage,
    procurementRequests,
    batches,
    updateInventoryItem,
    addProcurementRequest,
    updateProcurementRequest,
  } = useStore();

  const [usageForm, setUsageForm] = useState<UsageForm>(EMPTY_USAGE);
  const [usageErrors, setUsageErrors] = useState<Partial<UsageForm>>({});
  const [usageSuccess, setUsageSuccess] = useState(false);

  const [procForm, setProcForm] = useState<ProcurementForm>(EMPTY_PROCUREMENT);
  const [procErrors, setProcErrors] = useState<Partial<ProcurementForm>>({});
  const [procSuccess, setProcSuccess] = useState(false);

  // Derived
  const lowStockItems = useMemo(
    () => inventoryItems.filter((i) => i.quantityOnHand < i.reorderLevel),
    [inventoryItems]
  );

  const totalInventoryValue = useMemo(
    () => inventoryItems.reduce((sum, i) => sum + i.quantityOnHand * i.unitCost, 0),
    [inventoryItems]
  );

  const pendingRequestsCount = useMemo(
    () => procurementRequests.filter((r) => r.status === 'pending').length,
    [procurementRequests]
  );

  // Selected item for auto cost
  const selectedUsageItem = inventoryItems.find((i) => i.id === usageForm.itemId);
  const selectedProcItem = inventoryItems.find((i) => i.id === procForm.itemId);

  // Estimated cost auto-fill when quantity changes
  const autoEstimatedCost = useMemo(() => {
    if (!selectedProcItem || !procForm.quantityRequested) return '';
    const qty = parseFloat(procForm.quantityRequested);
    if (isNaN(qty)) return '';
    return String(Math.round(qty * selectedProcItem.unitCost));
  }, [selectedProcItem, procForm.quantityRequested]);

  // Validate usage form
  const validateUsage = (): boolean => {
    const errors: Partial<UsageForm> = {};
    if (!usageForm.itemId) errors.itemId = 'Select an inventory item';
    if (!usageForm.quantityUsed || isNaN(Number(usageForm.quantityUsed)) || Number(usageForm.quantityUsed) <= 0)
      errors.quantityUsed = 'Enter a valid quantity';
    if (!usageForm.batchId) errors.batchId = 'Select a batch';
    if (!usageForm.purpose.trim()) errors.purpose = 'Describe the purpose';

    const item = inventoryItems.find((i) => i.id === usageForm.itemId);
    if (item && Number(usageForm.quantityUsed) > item.quantityOnHand) {
      errors.quantityUsed = `Only ${item.quantityOnHand} ${item.unit} available`;
    }

    setUsageErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogUsage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUsage()) return;

    const item = inventoryItems.find((i) => i.id === usageForm.itemId)!;
    const qty = Number(usageForm.quantityUsed);

    updateInventoryItem(item.id, { quantityOnHand: item.quantityOnHand - qty });

    setUsageForm(EMPTY_USAGE);
    setUsageErrors({});
    setUsageSuccess(true);
    setTimeout(() => setUsageSuccess(false), 3000);
  };

  // Validate procurement form
  const validateProcurement = (): boolean => {
    const errors: Partial<ProcurementForm> = {};
    if (!procForm.itemId) errors.itemId = 'Select an item';
    if (!procForm.quantityRequested || isNaN(Number(procForm.quantityRequested)) || Number(procForm.quantityRequested) <= 0)
      errors.quantityRequested = 'Enter a valid quantity';
    if (!procForm.estimatedCost || isNaN(Number(procForm.estimatedCost)) || Number(procForm.estimatedCost) < 0)
      errors.estimatedCost = 'Enter a valid estimated cost';
    setProcErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddProcurement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProcurement()) return;

    const item = inventoryItems.find((i) => i.id === procForm.itemId)!;
    const newRequest: ProcurementRequest = {
      id: generateId(),
      itemId: procForm.itemId,
      itemName: item.name,
      quantityRequested: Number(procForm.quantityRequested),
      estimatedCost: Number(procForm.estimatedCost),
      status: 'pending',
      requestedBy: 'James Nkurunziza',
      createdAt: today(),
    };

    addProcurementRequest(newRequest);
    setProcForm(EMPTY_PROCUREMENT);
    setProcErrors({});
    setProcSuccess(true);
    setTimeout(() => setProcSuccess(false), 3000);
  };

  const handleMarkPurchased = (id: string) => {
    updateProcurementRequest(id, { status: 'purchased' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory & Procurement</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tools, materials, and equipment management for Agape Skills Centre
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Inventory Value</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalInventoryValue)}</p>
          </div>
        </div>

        <div className={cn(
          'rounded-xl border p-5 flex items-center gap-4',
          lowStockItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
        )}>
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            lowStockItems.length > 0 ? 'bg-red-100' : 'bg-gray-100'
          )}>
            <TrendingDown className={cn('w-5 h-5', lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-500')} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Low Stock Items</p>
            <p className={cn('text-lg font-bold', lowStockItems.length > 0 ? 'text-red-700' : 'text-gray-900')}>
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Pending Requests</p>
            <p className="text-lg font-bold text-gray-900">{pendingRequestsCount}</p>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-800">
              Low Stock Alert — {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need restocking
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 bg-white border border-red-200 rounded-lg px-3 py-1.5"
              >
                <span className="text-xs font-semibold text-red-700">{item.name}</span>
                <span className="text-xs text-red-500">
                  {item.quantityOnHand} / {item.reorderLevel} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
          <Package className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-gray-800">Inventory Items</h2>
          <span className="ml-auto text-xs text-gray-400">{inventoryItems.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">On Hand</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Reorder At</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Cost</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">UGX Value</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventoryItems.map((item) => {
                const isLow = item.quantityOnHand < item.reorderLevel;
                const value = item.quantityOnHand * item.unitCost;
                return (
                  <tr key={item.id} className={cn('hover:bg-gray-50 transition-colors', isLow && 'bg-red-50/40')}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.unit}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', CATEGORY_COLORS[item.category])}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn('text-sm font-semibold', isLow ? 'text-red-600' : 'text-gray-800')}>
                        {item.quantityOnHand}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm text-gray-500">
                      {item.reorderLevel} {item.unit}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm text-gray-600">
                      {formatCurrency(item.unitCost)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(value)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3" />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Usage Form */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200 bg-amber-50">
          <Layers className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-800">Log Inventory Usage</h2>
        </div>

        <form onSubmit={handleLogUsage} className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Item */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Item *</label>
              <div className="relative">
                <select
                  value={usageForm.itemId}
                  onChange={(e) => setUsageForm((f) => ({ ...f, itemId: e.target.value }))}
                  className={cn(
                    'w-full appearance-none bg-gray-50 border rounded-lg px-3 py-2.5 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                    usageErrors.itemId ? 'border-red-400' : 'border-gray-200'
                  )}
                >
                  <option value="">— Select item —</option>
                  {inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.quantityOnHand} {i.unit})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {usageErrors.itemId && <p className="text-xs text-red-500 mt-1">{usageErrors.itemId}</p>}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity Used *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={usageForm.quantityUsed}
                onChange={(e) => setUsageForm((f) => ({ ...f, quantityUsed: e.target.value }))}
                placeholder="e.g. 5"
                className={cn(
                  'w-full bg-gray-50 border rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                  usageErrors.quantityUsed ? 'border-red-400' : 'border-gray-200'
                )}
              />
              {usageErrors.quantityUsed && <p className="text-xs text-red-500 mt-1">{usageErrors.quantityUsed}</p>}
            </div>

            {/* Batch */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Batch *</label>
              <div className="relative">
                <select
                  value={usageForm.batchId}
                  onChange={(e) => setUsageForm((f) => ({ ...f, batchId: e.target.value }))}
                  className={cn(
                    'w-full appearance-none bg-gray-50 border rounded-lg px-3 py-2.5 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                    usageErrors.batchId ? 'border-red-400' : 'border-gray-200'
                  )}
                >
                  <option value="">— Select batch —</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {usageErrors.batchId && <p className="text-xs text-red-500 mt-1">{usageErrors.batchId}</p>}
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Purpose *</label>
              <input
                type="text"
                value={usageForm.purpose}
                onChange={(e) => setUsageForm((f) => ({ ...f, purpose: e.target.value }))}
                placeholder="e.g. Module 3 practicals"
                className={cn(
                  'w-full bg-gray-50 border rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                  usageErrors.purpose ? 'border-red-400' : 'border-gray-200'
                )}
              />
              {usageErrors.purpose && <p className="text-xs text-red-500 mt-1">{usageErrors.purpose}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Log Usage
            </button>
            {usageSuccess && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Usage logged and inventory updated
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Procurement Requests */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
          <ShoppingCart className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-gray-800">Procurement Requests</h2>
          <span className="ml-auto text-xs text-gray-400">{procurementRequests.length} total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty Requested</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. Cost</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Requested By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {procurementRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No procurement requests yet.
                  </td>
                </tr>
              ) : (
                procurementRequests.map((req) => {
                  const statusCfg = STATUS_CONFIG[req.status];
                  const canMarkPurchased = req.status === 'pending' || req.status === 'approved';
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{req.itemName}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-700">{req.quantityRequested}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(req.estimatedCost)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-600">{req.requestedBy}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{formatDate(req.createdAt)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {canMarkPurchased ? (
                          <button
                            onClick={() => handleMarkPurchased(req.id)}
                            className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Mark Purchased
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Procurement Request Form */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200 bg-sky-50">
          <ClipboardList className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-gray-800">New Procurement Request</h2>
        </div>

        <form onSubmit={handleAddProcurement} className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Item */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Item *</label>
              <div className="relative">
                <select
                  value={procForm.itemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const item = inventoryItems.find((i) => i.id === id);
                    setProcForm((f) => ({
                      ...f,
                      itemId: id,
                      estimatedCost: item && f.quantityRequested
                        ? String(Math.round(Number(f.quantityRequested) * item.unitCost))
                        : f.estimatedCost,
                    }));
                  }}
                  className={cn(
                    'w-full appearance-none bg-gray-50 border rounded-lg px-3 py-2.5 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                    procErrors.itemId ? 'border-red-400' : 'border-gray-200'
                  )}
                >
                  <option value="">— Select item —</option>
                  {inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {formatCurrency(i.unitCost)}/{i.unit}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {procErrors.itemId && <p className="text-xs text-red-500 mt-1">{procErrors.itemId}</p>}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={procForm.quantityRequested}
                onChange={(e) => {
                  const qty = e.target.value;
                  const item = inventoryItems.find((i) => i.id === procForm.itemId);
                  setProcForm((f) => ({
                    ...f,
                    quantityRequested: qty,
                    estimatedCost: item && qty
                      ? String(Math.round(Number(qty) * item.unitCost))
                      : f.estimatedCost,
                  }));
                }}
                placeholder="e.g. 20"
                className={cn(
                  'w-full bg-gray-50 border rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                  procErrors.quantityRequested ? 'border-red-400' : 'border-gray-200'
                )}
              />
              {procErrors.quantityRequested && (
                <p className="text-xs text-red-500 mt-1">{procErrors.quantityRequested}</p>
              )}
            </div>

            {/* Estimated Cost */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Estimated Cost (UGX) *
                {selectedProcItem && procForm.quantityRequested && (
                  <span className="text-gray-400 font-normal ml-1">auto-calculated</span>
                )}
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={procForm.estimatedCost}
                onChange={(e) => setProcForm((f) => ({ ...f, estimatedCost: e.target.value }))}
                placeholder="e.g. 360000"
                className={cn(
                  'w-full bg-gray-50 border rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500',
                  procErrors.estimatedCost ? 'border-red-400' : 'border-gray-200'
                )}
              />
              {procErrors.estimatedCost && (
                <p className="text-xs text-red-500 mt-1">{procErrors.estimatedCost}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Submit Request
            </button>
            {procSuccess && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Procurement request submitted
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
