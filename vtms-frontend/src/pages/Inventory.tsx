import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, AlertTriangle, Plus, ShoppingCart, CheckCircle2,
  TrendingDown, DollarSign, ClipboardList, Trash2,
} from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import { cn, formatCurrency, friendlyError, today, getDisplayCurrency } from '../lib/utils';
import { TRADE_OPTIONS, type InventoryItem, type TradeType } from '../types';
import { confirmAdminDelete, promptDeleteReason, submitDeleteRequest } from '../lib/deleteRequests';
import Modal from '../components/Modal';
import ExportToolbar from '../components/ExportToolbar';

const CATEGORY_COLORS: Record<string, string> = {
  Tool: 'bg-blue-100 text-blue-700',
  Material: 'bg-amber-100 text-amber-700',
  Equipment: 'bg-purple-100 text-purple-700',
  Safety: 'bg-green-100 text-green-700',
};

const CATEGORIES: InventoryItem['category'][] = ['Tool', 'Material', 'Equipment', 'Safety'];

interface ItemForm {
  name: string;
  category: InventoryItem['category'];
  unit: string;
  quantityOnHand: string;
  reorderLevel: string;
  unitCost: string;
  tradeRelevance: TradeType[];
}

interface ReceiveForm {
  itemId: string;
  quantity: string;
  note: string;
}

interface UsageForm {
  itemId: string;
  quantityUsed: string;
  batchId: string;
  purpose: string;
}

const EMPTY_ITEM: ItemForm = {
  name: '',
  category: 'Material',
  unit: 'pcs',
  quantityOnHand: '0',
  reorderLevel: '0',
  unitCost: '',
  tradeRelevance: [],
};

function reorderFromOpening(qtyRaw: string): string {
  const n = Number(qtyRaw);
  if (!Number.isFinite(n) || n < 0) return '0';
  return String(Math.round(n * 0.5 * 100) / 100);
}

const EMPTY_USAGE: UsageForm = { itemId: '', quantityUsed: '', batchId: '', purpose: '' };
const EMPTY_RECEIVE: ReceiveForm = { itemId: '', quantity: '', note: '' };

export default function Inventory() {
  const { profile } = useAuth();
  const mayEdit = profile ? canEdit(profile.role, 'inventory') : false;
  const mayDelete = profile?.role === 'admin';
  const {
    inventoryItems,
    inventoryUsage,
    procurementRequests,
    batches,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    logInventoryUsage,
  } = useStore();

  const [showAddItem, setShowAddItem] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({ quantityOnHand: '', reorderLevel: '', unitCost: '' });
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM);
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>(EMPTY_RECEIVE);
  const [usageForm, setUsageForm] = useState<UsageForm>(EMPTY_USAGE);
  const [usageErrors, setUsageErrors] = useState<Partial<UsageForm>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const lowStockItems = useMemo(
    () => inventoryItems.filter((i) => i.quantityOnHand <= i.reorderLevel),
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

  const recentUsage = useMemo(
    () => [...inventoryUsage].slice(-5).reverse(),
    [inventoryUsage]
  );

  const selectedUsageItem = inventoryItems.find((i) => i.id === usageForm.itemId);

  function toggleTrade(trade: TradeType) {
    setItemForm((prev) => ({
      ...prev,
      tradeRelevance: prev.tradeRelevance.includes(trade)
        ? prev.tradeRelevance.filter((t) => t !== trade)
        : [...prev.tradeRelevance, trade],
    }));
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!itemForm.name.trim()) {
      setFormError('Item name is required.');
      return;
    }
    const qty = Number(itemForm.quantityOnHand);
    const reorder = Number(reorderFromOpening(itemForm.quantityOnHand));
    const cost = Number(itemForm.unitCost);
    if (isNaN(qty) || qty < 0 || isNaN(cost) || cost < 0) {
      setFormError('Enter valid numbers for quantity and unit cost.');
      return;
    }
    try {
      await addInventoryItem({
        name: itemForm.name.trim(),
        category: itemForm.category,
        unit: itemForm.unit.trim() || 'pcs',
        quantityOnHand: qty,
        reorderLevel: reorder,
        unitCost: cost,
        tradeRelevance: itemForm.tradeRelevance,
      });
      setItemForm(EMPTY_ITEM);
      setShowAddItem(false);
      setBanner('Item added to inventory.');
      setTimeout(() => setBanner(null), 3000);
    } catch (err) {
      setFormError(friendlyError(err, 'Failed to add inventory item.'));
    }
  }

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const item = inventoryItems.find((i) => i.id === receiveForm.itemId);
    const qty = Number(receiveForm.quantity);
    if (!item) {
      setFormError('Select an item.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setFormError('Enter a valid quantity to receive.');
      return;
    }
    try {
      await updateInventoryItem(item.id, { quantityOnHand: item.quantityOnHand + qty });
      setReceiveForm(EMPTY_RECEIVE);
      setShowReceive(false);
      setBanner(`Received ${qty} ${item.unit} of ${item.name}.`);
      setTimeout(() => setBanner(null), 3000);
    } catch (err) {
      setFormError(friendlyError(err, 'Failed to receive stock.'));
    }
  }

  async function handleLogUsage(e: React.FormEvent) {
    e.preventDefault();
    const errors: Partial<UsageForm> = {};
    if (!usageForm.itemId) errors.itemId = 'Select an item';
    if (!usageForm.quantityUsed || isNaN(Number(usageForm.quantityUsed)) || Number(usageForm.quantityUsed) <= 0)
      errors.quantityUsed = 'Enter a valid quantity';
    if (!usageForm.batchId) errors.batchId = 'Select a batch';
    if (!usageForm.purpose.trim()) errors.purpose = 'Describe the purpose';
    const item = inventoryItems.find((i) => i.id === usageForm.itemId);
    if (item && Number(usageForm.quantityUsed) > item.quantityOnHand) {
      errors.quantityUsed = `Only ${item.quantityOnHand} ${item.unit} available`;
    }
    setUsageErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      await logInventoryUsage({
        itemId: usageForm.itemId,
        batchId: usageForm.batchId,
        traineeId: null,
        quantityUsed: Number(usageForm.quantityUsed),
        usageDate: today(),
        purpose: usageForm.purpose.trim(),
      });
      setUsageForm(EMPTY_USAGE);
      setUsageErrors({});
      setBanner('Usage logged and stock updated.');
      setTimeout(() => setBanner(null), 3000);
    } catch (err) {
      setUsageErrors({ quantityUsed: friendlyError(err, 'Could not log usage.') });
    }
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white';

  async function handleSaveStock(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setFormError(null);
    const qty = Number(editForm.quantityOnHand);
    const reorder = Number(editForm.reorderLevel);
    const cost = Number(editForm.unitCost);
    if ([qty, reorder, cost].some((n) => isNaN(n) || n < 0)) {
      setFormError('Enter valid non-negative numbers.');
      return;
    }
    try {
      await updateInventoryItem(editingItem.id, {
        quantityOnHand: qty,
        reorderLevel: reorder,
        unitCost: cost,
      });
      setEditingItem(null);
      setBanner('Stock updated.');
      setTimeout(() => setBanner(null), 3000);
    } catch (err) {
      setFormError(friendlyError(err, 'Failed to update stock.'));
    }
  }

  function openEditItem(item: InventoryItem) {
    setFormError(null);
    setEditingItem(item);
    setEditForm({
      quantityOnHand: String(item.quantityOnHand),
      reorderLevel: String(item.reorderLevel),
      unitCost: String(item.unitCost),
    });
  }

  async function handleDeleteItem(item: InventoryItem) {
    if (profile?.role !== 'admin') {
      const reason = promptDeleteReason(item.name);
      if (!reason) return;
      setFormError(null);
      try {
        await submitDeleteRequest({
          entityType: 'inventory_item',
          entityId: item.id,
          entityLabel: item.name,
          reason,
        });
        setBanner('Delete request sent to admin for approval.');
        setTimeout(() => setBanner(null), 4000);
      } catch (err) {
        setFormError(friendlyError(err, 'Could not submit delete request.'));
      }
      return;
    }
    if (!confirmAdminDelete(item.name)) return;
    setFormError(null);
    try {
      await deleteInventoryItem(item.id);
      if (editingItem?.id === item.id) setEditingItem(null);
      setBanner(`Deleted ${item.name}.`);
      setTimeout(() => setBanner(null), 3000);
    } catch (err) {
      setFormError(friendlyError(err, 'Failed to delete inventory item.'));
    }
  }

  const inventoryExportRows = inventoryItems.map((item) => ({
    name: item.name,
    category: item.category,
    onHand: `${item.quantityOnHand} ${item.unit}`,
    reorder: item.reorderLevel,
    unitCost: formatCurrency(item.unitCost),
    value: formatCurrency(item.quantityOnHand * item.unitCost),
    status: item.quantityOnHand <= item.reorderLevel ? 'Low' : 'OK',
  }));

  return (
    <div className="space-y-6" id="app-print-area">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter stock, receive deliveries, and log what workshops use.
          </p>
        </div>
        {mayEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setFormError(null); setShowReceive(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Receive stock
            </button>
            <button
              type="button"
              onClick={() => { setFormError(null); setShowAddItem(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              Add item
            </button>
          </div>
        )}
      </div>

      {banner && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {banner}
        </p>
      )}

      <ExportToolbar
        title="Inventory Stock Report"
        filename="inventory"
        columns={[
          { key: 'name', label: 'Item' },
          { key: 'category', label: 'Category' },
          { key: 'onHand', label: 'On Hand' },
          { key: 'reorder', label: 'Reorder Level' },
          { key: 'unitCost', label: 'Unit Cost' },
          { key: 'value', label: 'Value' },
          { key: 'status', label: 'Status' },
        ]}
        rows={inventoryExportRows}
        subtitle={`${inventoryItems.length} items · ${formatCurrency(totalInventoryValue)} total value`}
        printTargetId="app-print-area"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Stock value</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalInventoryValue)}</p>
          </div>
        </div>
        <div className={cn(
          'rounded-xl border shadow-sm p-5 flex items-center gap-4',
          lowStockItems.length ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
        )}>
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', lowStockItems.length ? 'bg-red-100' : 'bg-gray-100')}>
            <TrendingDown className={cn('w-5 h-5', lowStockItems.length ? 'text-red-600' : 'text-gray-500')} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Low stock</p>
            <p className={cn('text-lg font-bold', lowStockItems.length ? 'text-red-700' : 'text-gray-900')}>
              {lowStockItems.length} item{lowStockItems.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Link
          to="/procurement"
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:border-primary-200 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Open procurement</p>
            <p className="text-lg font-bold text-gray-900">{pendingRequestsCount} pending</p>
          </div>
        </Link>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-800">Below reorder level</p>
          </div>
          <ul className="text-xs text-red-700 space-y-1">
            {lowStockItems.map((i) => (
              <li key={i.id}>
                {i.name}: {i.quantityOnHand} {i.unit} (reorder at {i.reorderLevel})
              </li>
            ))}
          </ul>
          <Link to="/procurement" className="inline-block mt-3 text-xs font-semibold text-red-800 underline">
            Request restock on Procurement →
          </Link>
        </div>
      )}

      {/* Catalog */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-800">Stock catalog</h2>
          <span className="ml-auto text-xs text-gray-400">{inventoryItems.length} items</span>
        </div>
        {inventoryItems.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-gray-600">No inventory items yet</p>
            <p className="text-xs text-gray-400 mt-1">Add hammers, timber, fabric, PPE — whatever SCM stocks.</p>
            {mayEdit && (
              <button
                type="button"
                onClick={() => setShowAddItem(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white"
              >
                <Plus className="w-4 h-4" />
                Add first item
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-50">
                  <th className="px-5 py-3 font-semibold">Item</th>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 font-semibold">On hand</th>
                  <th className="px-3 py-3 font-semibold">Reorder</th>
                  <th className="px-3 py-3 font-semibold">Unit cost</th>
                  <th className="px-3 py-3 font-semibold">Value</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  {(mayEdit || mayDelete) && <th className="px-5 py-3 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inventoryItems.map((item) => {
                  const low = item.quantityOnHand <= item.reorderLevel;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                      <td className="px-3 py-3">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', CATEGORY_COLORS[item.category])}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{item.quantityOnHand} {item.unit}</td>
                      <td className="px-3 py-3 text-gray-500">{item.reorderLevel}</td>
                      <td className="px-3 py-3 text-gray-700">{formatCurrency(item.unitCost)}</td>
                      <td className="px-3 py-3 text-gray-700">{formatCurrency(item.quantityOnHand * item.unitCost)}</td>
                      <td className="px-5 py-3">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                          {low ? 'Low' : 'OK'}
                        </span>
                      </td>
                      {(mayEdit || mayDelete) && (
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {mayEdit && (
                              <button
                                type="button"
                                onClick={() => openEditItem(item)}
                                className="text-xs font-semibold text-primary-700 hover:underline"
                              >
                                Edit stock
                              </button>
                            )}
                            {(mayDelete || mayEdit) && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteItem(item)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                                title={mayDelete ? 'Delete item' : 'Request admin delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {mayDelete ? 'Delete' : 'Request delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log usage */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-semibold text-gray-800">Log usage</h2>
        </div>
        <form onSubmit={handleLogUsage} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Item *</label>
            <select
              className={inputCls}
              value={usageForm.itemId}
              onChange={(e) => setUsageForm({ ...usageForm, itemId: e.target.value })}
              disabled={!inventoryItems.length}
            >
              <option value="">{inventoryItems.length ? 'Select item…' : 'Add items first'}</option>
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.quantityOnHand} {i.unit})</option>
              ))}
            </select>
            {usageErrors.itemId && <p className="text-xs text-red-600 mt-1">{usageErrors.itemId}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity used *</label>
            <input
              className={inputCls}
              value={usageForm.quantityUsed}
              onChange={(e) => setUsageForm({ ...usageForm, quantityUsed: e.target.value })}
              placeholder={selectedUsageItem ? `Max ${selectedUsageItem.quantityOnHand}` : '0'}
            />
            {usageErrors.quantityUsed && <p className="text-xs text-red-600 mt-1">{usageErrors.quantityUsed}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Batch *</label>
            <select
              className={inputCls}
              value={usageForm.batchId}
              onChange={(e) => setUsageForm({ ...usageForm, batchId: e.target.value })}
            >
              <option value="">Select batch…</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {usageErrors.batchId && <p className="text-xs text-red-600 mt-1">{usageErrors.batchId}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Purpose *</label>
            <input
              className={inputCls}
              value={usageForm.purpose}
              onChange={(e) => setUsageForm({ ...usageForm, purpose: e.target.value })}
              placeholder="e.g. Carpentry practical — week 3"
            />
            {usageErrors.purpose && <p className="text-xs text-red-600 mt-1">{usageErrors.purpose}</p>}
          </div>
          {mayEdit && (
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700">
                Log usage
              </button>
            </div>
          )}
        </form>
        {recentUsage.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Recent usage</p>
            <ul className="text-xs text-gray-600 space-y-1">
              {recentUsage.map((u) => {
                const item = inventoryItems.find((i) => i.id === u.itemId);
                const batch = batches.find((b) => b.id === u.batchId);
                return (
                  <li key={u.id}>
                    {u.usageDate}: {u.quantityUsed} {item?.unit ?? ''} {item?.name ?? 'item'}
                    {batch ? ` · ${batch.name}` : ''} — {u.purpose}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {editingItem && (
        <Modal title={`Edit stock — ${editingItem.name}`} onClose={() => setEditingItem(null)}>
          <form onSubmit={handleSaveStock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity on hand</label>
              <input className={inputCls} value={editForm.quantityOnHand} onChange={(e) => setEditForm({ ...editForm, quantityOnHand: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reorder level</label>
              <input className={inputCls} value={editForm.reorderLevel} onChange={(e) => setEditForm({ ...editForm, reorderLevel: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Unit cost ({getDisplayCurrency()})</label>
              <input className={inputCls} value={editForm.unitCost} onChange={(e) => setEditForm({ ...editForm, unitCost: e.target.value })} />
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {showAddItem && (
        <Modal title="Add inventory item" onClose={() => setShowAddItem(false)} size="lg">
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input className={inputCls} value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Carpentry hammers" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
                <select className={inputCls} value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value as InventoryItem['category'] })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Unit *</label>
                <input className={inputCls} value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="pcs, m, kg, liters" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Opening qty *</label>
                <input
                  className={inputCls}
                  value={itemForm.quantityOnHand}
                  onChange={(e) => {
                    const quantityOnHand = e.target.value;
                    setItemForm({
                      ...itemForm,
                      quantityOnHand,
                      reorderLevel: reorderFromOpening(quantityOnHand),
                    });
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Reorder level
                  <span className="ml-1 font-normal text-gray-400">(auto 50% of opening)</span>
                </label>
                <input
                  className={cn(inputCls, 'bg-gray-50 text-gray-600')}
                  value={itemForm.reorderLevel}
                  readOnly
                  title="Always 50% of opening quantity"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Unit cost ({getDisplayCurrency()}) *</label>
                <input className={inputCls} value={itemForm.unitCost} onChange={(e) => setItemForm({ ...itemForm, unitCost: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-gray-600 mb-2">Relevant trades (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {TRADE_OPTIONS.map((trade) => (
                    <button
                      key={trade}
                      type="button"
                      onClick={() => toggleTrade(trade)}
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full border',
                        itemForm.tradeRelevance.includes(trade)
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-600 border-gray-200'
                      )}
                    >
                      {trade}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddItem(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg">Save item</button>
            </div>
          </form>
        </Modal>
      )}

      {showReceive && (
        <Modal title="Receive stock" onClose={() => setShowReceive(false)}>
          <form onSubmit={handleReceive} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Item *</label>
              <select className={inputCls} value={receiveForm.itemId} onChange={(e) => setReceiveForm({ ...receiveForm, itemId: e.target.value })}>
                <option value="">Select item…</option>
                {inventoryItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} (now {i.quantityOnHand} {i.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity received *</label>
              <input className={inputCls} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Note</label>
              <input className={inputCls} value={receiveForm.note} onChange={(e) => setReceiveForm({ ...receiveForm, note: e.target.value })} placeholder="e.g. Delivery from supplier" />
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowReceive(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg">Receive</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
