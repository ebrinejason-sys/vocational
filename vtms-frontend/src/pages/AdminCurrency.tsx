import { useEffect, useState, type FormEvent } from 'react';
import { Coins } from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import {
  CURRENCY_OPTIONS,
  STORAGE_CURRENCY,
  formatCurrency,
  friendlyError,
  getViewCurrency,
  setViewCurrency,
  type CurrencyCode,
} from '../lib/utils';

export default function AdminCurrency() {
  const { profile } = useAuth();
  const { currencyRates, upsertCurrencyRate } = useStore();
  const canEditRates = profile?.role === 'admin' || profile?.role === 'director';

  const [viewCode, setViewCode] = useState<CurrencyCode>(getViewCurrency());
  const [editCode, setEditCode] = useState<CurrencyCode>('SSP');
  const [unitsPerUsd, setUnitsPerUsd] = useState('1');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const rate = currencyRates[editCode];
    if (rate != null) setUnitsPerUsd(String(rate));
  }, [editCode, currencyRates]);

  function applyViewCurrency(code: CurrencyCode) {
    setViewCurrency(code);
    setViewCode(code);
    useStore.setState({ currencyRates: { ...useStore.getState().currencyRates } });
  }

  async function handleSaveRate(e: FormEvent) {
    e.preventDefault();
    if (!canEditRates) return;
    setMessage(null);
    const n = Number(unitsPerUsd);
    if (!Number.isFinite(n) || n <= 0) {
      setMessage({ type: 'error', text: 'Enter a positive number (units per 1 USD).' });
      return;
    }
    setSaving(true);
    try {
      const label = CURRENCY_OPTIONS.find((c) => c.code === editCode)?.label ?? editCode;
      await upsertCurrencyRate(editCode, label, n);
      setMessage({ type: 'success', text: `Updated ${editCode}: 1 USD = ${n} ${editCode}.` });
    } catch (err) {
      setMessage({ type: 'error', text: friendlyError(err, 'Could not save rate.') });
    } finally {
      setSaving(false);
    }
  }

  const sampleUsd = 100;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary-600" />
          Currency
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Money is stored in <span className="font-semibold text-gray-800">{STORAGE_CURRENCY}</span>.
          Pick a view currency to convert amounts for display. Admin/director maintain the conversion table.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800">Your view currency</h3>
        <p className="text-xs text-gray-500">Applies to you only (saved in this browser).</p>
        <select
          value={viewCode}
          onChange={(e) => applyViewCurrency(e.target.value as CurrencyCode)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-600">
          Example: {formatCurrency(sampleUsd, 'USD')} → {formatCurrency(sampleUsd, viewCode)}
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800">Conversion table (per 1 USD)</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Currency</th>
                <th className="px-3 py-2 text-left">Units per 1 USD</th>
                <th className="px-3 py-2 text-left">100 USD shows as</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CURRENCY_OPTIONS.map((c) => (
                <tr key={c.code}>
                  <td className="px-3 py-2 font-medium text-gray-800">{c.code}</td>
                  <td className="px-3 py-2 text-gray-600">{currencyRates[c.code] ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{formatCurrency(sampleUsd, c.code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canEditRates ? (
          <form onSubmit={handleSaveRate} className="space-y-3 pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-500">
              Set how many units of a currency equal <strong>1 USD</strong> (e.g. SSP ≈ 4,850).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
                <select
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value as CurrencyCode)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {CURRENCY_OPTIONS.filter((c) => c.code !== 'USD').map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Units per 1 USD *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={unitsPerUsd}
                  onChange={(e) => setUnitsPerUsd(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            {message && (
              <p
                className={
                  message.type === 'success'
                    ? 'text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2'
                    : 'text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2'
                }
              >
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save rate'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-gray-400">Only admin or director can edit conversion rates.</p>
        )}
      </div>
    </div>
  );
}
