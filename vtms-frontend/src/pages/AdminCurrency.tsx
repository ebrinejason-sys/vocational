import { useEffect, useState, type FormEvent } from 'react';
import { Coins } from 'lucide-react';
import { useStore } from '../store';
import { CURRENCY_OPTIONS, type CurrencyCode, friendlyError } from '../lib/utils';

export default function AdminCurrency() {
  const { currencyCode, updateCurrencyCode } = useStore();
  const [code, setCode] = useState<CurrencyCode>(currencyCode);
  useEffect(() => { setCode(currencyCode); }, [currencyCode]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!reason.trim()) {
      setMessage({ type: 'error', text: 'A reason is required — admin and director will be notified.' });
      return;
    }
    setSaving(true);
    try {
      const result = await updateCurrencyCode(code, reason);
      setReason('');
      setMessage({
        type: result.emailWarning ? 'warn' : 'success',
        text: result.emailWarning
          ? `Currency updated to ${code}. ${result.emailWarning}`
          : `Currency updated to ${code}. Admin and director were notified.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: friendlyError(err, 'Could not update currency.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary-600" />
          Organisation Currency
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Current display currency: <span className="font-semibold text-gray-800">{currencyCode}</span>.
          Changing this updates labels and formatting only — historical amounts are not converted.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value as CurrencyCode)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Reason for change * <span className="font-normal text-gray-400">(notifies admin &amp; director)</span>
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is the organisation currency being changed?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        {message && (
          <p
            className={
              message.type === 'success'
                ? 'text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2'
                : message.type === 'warn'
                  ? 'text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2'
                  : 'text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2'
            }
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={saving || code === currencyCode}
          className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Update Currency'}
        </button>
      </form>
    </div>
  );
}
