import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Scale, Plus, ChevronDown,
  Users, ShoppingBag, FileText, AlertTriangle,
} from 'lucide-react';
import { useStore } from '../store';
import { formatCurrency, formatDate, generateId, today, cn } from '../lib/utils';
import type { FinancialTransaction, TransactionType } from '../types';

const EXPENSE_COLORS = [
  '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4',
  '#0f766e', '#115e59', '#134e4a', '#0891b2', '#22d3ee',
];

const INCOME_CATEGORIES = ['Donor Grant', 'Application Form Fees', 'Production Sales', 'Church Contribution', 'Government Grant', 'Other'];
const EXPENSE_CATEGORIES = ['Training Materials', 'Trainee Stipends', 'Trainer Fees', 'Administration', 'Utilities', 'Outreach & Mobilization', 'Equipment', 'Other'];

const defaultForm = {
  type: 'income' as TransactionType,
  category: '',
  amount: '',
  description: '',
  date: today(),
  donorName: '',
};

export default function Financials() {
  const { batches, financialTransactions, productionLogs, sales, addFinancialTransaction } = useStore();
  const [selectedBatchId, setSelectedBatchId] = useState(useStore.getState().activeBatchId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState('');

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const batchTransactions = useMemo(
    () => financialTransactions.filter((t) => t.batchId === selectedBatchId),
    [financialTransactions, selectedBatchId]
  );

  const incomeTransactions = useMemo(
    () => batchTransactions.filter((t) => t.type === 'income'),
    [batchTransactions]
  );

  const expenseTransactions = useMemo(
    () => batchTransactions.filter((t) => t.type === 'expense'),
    [batchTransactions]
  );

  const totalIncome = useMemo(
    () => incomeTransactions.reduce((sum, t) => sum + t.amount, 0),
    [incomeTransactions]
  );

  const totalExpense = useMemo(
    () => expenseTransactions.reduce((sum, t) => sum + t.amount, 0),
    [expenseTransactions]
  );

  const balance = totalIncome - totalExpense;
  const budgetAllocated = selectedBatch?.budgetAllocated ?? 0;
  const utilizationPct = budgetAllocated > 0 ? Math.min((totalExpense / budgetAllocated) * 100, 100) : 0;

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenseTransactions.forEach((t) => {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions]);

  // Donor report
  const donorReport = useMemo(() => {
    const map: Record<string, number> = {};
    incomeTransactions.forEach((t) => {
      if (t.donorName) {
        map[t.donorName] = (map[t.donorName] ?? 0) + t.amount;
      }
    });
    return Object.entries(map)
      .map(([donor, total]) => ({ donor, total }))
      .sort((a, b) => b.total - a.total);
  }, [incomeTransactions]);

  // Production logs & sales for selected batch
  const batchProductionLogs = useMemo(
    () => productionLogs.filter((l) => l.batchId === selectedBatchId),
    [productionLogs, selectedBatchId]
  );
  const batchSales = useMemo(
    () => sales.filter((s) => s.batchId === selectedBatchId),
    [sales, selectedBatchId]
  );
  const totalSalesAmount = batchSales.reduce((sum, s) => sum + s.amount, 0);
  const totalProductionValue = batchProductionLogs.reduce((sum, l) => sum + l.estimatedValue, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const amount = parseFloat(form.amount);
    if (!form.category) return setFormError('Please select a category.');
    if (!amount || amount <= 0) return setFormError('Enter a valid amount greater than 0.');
    if (!form.date) return setFormError('Please select a date.');

    const transaction: FinancialTransaction = {
      id: generateId(),
      batchId: selectedBatchId,
      type: form.type,
      category: form.category,
      amount,
      description: form.description,
      date: form.date,
      donorName: form.type === 'income' ? form.donorName : '',
    };
    addFinancialTransaction(transaction);
    setForm(defaultForm);
    setShowForm(false);
  }

  const categoryOptions = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
      {/* Batch Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Financial Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">Budget, income, expenses, and donor reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch:</label>
          <div className="relative">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="appearance-none pr-8 pl-3 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Budget Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(budgetAllocated)}</p>
          <p className="text-xs text-gray-400 mt-1">Allocated for batch</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Income</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-gray-400 mt-1">{incomeTransactions.length} transactions</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Expenses</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
          <p className="text-xs text-gray-400 mt-1">{expenseTransactions.length} transactions</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <Scale className="w-4 h-4 text-sky-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</span>
          </div>
          <p className={cn('text-2xl font-bold', balance >= 0 ? 'text-green-700' : 'text-red-600')}>
            {formatCurrency(Math.abs(balance))}
          </p>
          <p className={cn('text-xs font-semibold mt-1', balance >= 0 ? 'text-green-500' : 'text-red-400')}>
            {balance >= 0 ? 'Surplus' : 'Deficit'}
          </p>
        </div>
      </div>

      {/* Budget Utilization */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Budget Utilization</h3>
          <span className={cn(
            'text-sm font-bold px-2 py-0.5 rounded-full',
            utilizationPct < 70 ? 'bg-green-100 text-green-700' :
            utilizationPct < 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
          )}>
            {utilizationPct.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={cn(
              'h-3 rounded-full transition-all duration-500',
              utilizationPct < 70 ? 'bg-green-500' :
              utilizationPct < 90 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: `${utilizationPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>$0</span>
          <span>{formatCurrency(budgetAllocated)} allocated</span>
        </div>
        {utilizationPct >= 90 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Expenses are at or near budget limit. Review spending.</span>
          </div>
        )}
      </div>

      {/* Add Transaction Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-primary-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Add Transaction</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType, category: '' })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">Select category...</option>
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (USD)</label>
                <input
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="e.g. 500"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              {form.type === 'income' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Donor Name</label>
                  <input
                    type="text"
                    value={form.donorName}
                    onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                    placeholder="e.g. Word and Deed"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              )}
              <div className={form.type === 'income' ? '' : 'sm:col-span-2'}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors"
              >
                Save Transaction
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(defaultForm); setFormError(''); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Income + Expenses */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Income Transactions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Income Transactions</h3>
          {incomeTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No income recorded for this batch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Category</th>
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Donor</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Amount</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {incomeTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="py-2.5">
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                          {t.category}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-600 text-xs max-w-[140px] truncate">
                        {t.donorName || <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-green-700">{formatCurrency(t.amount)}</td>
                      <td className="py-2.5 text-right text-gray-400 text-xs">{formatDate(t.date)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={2} className="py-2.5 font-bold text-xs text-gray-600">Total Income</td>
                    <td className="py-2.5 text-right font-bold text-green-700">{formatCurrency(totalIncome)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Expense Breakdown by Category */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Expense Breakdown</h3>
          {expenseByCategory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No expenses recorded for this batch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Category</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Amount</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenseByCategory.map((cat, i) => (
                    <tr key={cat.name} className="hover:bg-gray-50">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }}
                          />
                          <span className="text-gray-700">{cat.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-red-600">{formatCurrency(cat.value)}</td>
                      <td className="py-2.5 text-right text-gray-400 text-xs">
                        {totalExpense > 0 ? ((cat.value / totalExpense) * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-2.5 font-bold text-xs text-gray-600">Total Expenses</td>
                    <td className="py-2.5 text-right font-bold text-red-600">{formatCurrency(totalExpense)}</td>
                    <td className="py-2.5 text-right font-bold text-gray-400 text-xs">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Expense Chart */}
      {expenseByCategory.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Expense Distribution Chart</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="h-56 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: unknown) => formatCurrency(val as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {expenseByCategory.map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }}
                  />
                  <span className="text-xs text-gray-600 flex-1 truncate">{cat.name}</span>
                  <span className="text-xs font-bold text-gray-800">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expense Transactions Detail */}
      {expenseTransactions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">All Expense Transactions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Category</th>
                  <th className="text-left py-2 font-semibold text-gray-500 text-xs">Description</th>
                  <th className="text-right py-2 font-semibold text-gray-500 text-xs">Amount</th>
                  <th className="text-right py-2 font-semibold text-gray-500 text-xs">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenseTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="py-2.5">
                      <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-50 text-red-600 rounded-full">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-600 text-xs max-w-[200px]">{t.description}</td>
                    <td className="py-2.5 text-right font-semibold text-red-600">{formatCurrency(t.amount)}</td>
                    <td className="py-2.5 text-right text-gray-400 text-xs">{formatDate(t.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Donor Report */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-primary-600" />
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Donor Report</h3>
        </div>
        {donorReport.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No donor contributions recorded for this batch.</p>
        ) : (
          <div className="space-y-3">
            {donorReport.map((d, i) => (
              <div key={d.donor} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{d.donor}</p>
                  <div className="mt-1 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-primary-500 h-1.5 rounded-full"
                      style={{ width: `${totalIncome > 0 ? (d.total / totalIncome) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-primary-700 shrink-0">{formatCurrency(d.total)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-xs font-bold text-gray-600">
              <span>{donorReport.length} donor{donorReport.length !== 1 ? 's' : ''}</span>
              <span>{formatCurrency(donorReport.reduce((s, d) => s + d.total, 0))} total</span>
            </div>
          </div>
        )}
      </div>

      {/* Production Sales Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Production Logs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Production Logs</h3>
          </div>
          {batchProductionLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No production logs for this batch.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Item Produced</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Qty</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Est. Value</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batchProductionLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="py-2.5 text-gray-700">{l.itemProduced}</td>
                      <td className="py-2.5 text-right text-gray-600">{l.quantity}</td>
                      <td className="py-2.5 text-right font-semibold text-sky-700">{formatCurrency(l.estimatedValue)}</td>
                      <td className="py-2.5 text-right text-gray-400 text-xs">{formatDate(l.dateProduced)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={2} className="py-2 text-xs font-bold text-gray-600">Total Est. Value</td>
                    <td className="py-2 text-right font-bold text-sky-700">{formatCurrency(totalProductionValue)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>

        {/* Sales */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-green-600" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sales</h3>
          </div>
          {batchSales.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No sales recorded for this batch.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-semibold text-gray-500 text-xs">Description</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Amount</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Status</th>
                    <th className="text-right py-2 font-semibold text-gray-500 text-xs">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batchSales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-2.5 text-gray-700 text-xs max-w-[160px]">{s.description}</td>
                      <td className="py-2.5 text-right font-semibold text-green-700">{formatCurrency(s.amount)}</td>
                      <td className="py-2.5 text-right">
                        <span className={cn(
                          'inline-block px-2 py-0.5 text-xs font-semibold rounded-full',
                          s.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          s.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-500'
                        )}>
                          {s.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-gray-400 text-xs">{formatDate(s.saleDate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-2 text-xs font-bold text-gray-600">Total Sales</td>
                    <td className="py-2 text-right font-bold text-green-700">{formatCurrency(totalSalesAmount)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
