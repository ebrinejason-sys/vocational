import { CURRENCY_OPTIONS, getViewCurrency, setViewCurrency, type CurrencyCode } from '../lib/utils';
import { useStore } from '../store';

/** Header control: any signed-in user can change how money is displayed. */
export default function ViewCurrencySelect() {
  const tick = useStore((s) => s.currencyRates);
  const code = getViewCurrency();
  return (
    <select
      aria-label="View currency"
      title="View money in this currency"
      value={code}
      onChange={(e) => {
        setViewCurrency(e.target.value as CurrencyCode);
        // Nudge store subscribers so formatCurrency() re-renders across pages
        useStore.setState({ currencyRates: { ...tick } });
      }}
      className="text-[11px] font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 max-w-[7.5rem]"
    >
      {CURRENCY_OPTIONS.map((c) => (
        <option key={c.code} value={c.code}>{c.code}</option>
      ))}
    </select>
  );
}
