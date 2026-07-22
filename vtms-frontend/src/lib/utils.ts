import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Money is stored in USD. Other codes are view-only conversions via admin rates. */
export type CurrencyCode = 'USD' | 'SSP' | 'UGX' | 'KES' | 'EUR' | 'GBP';

export const STORAGE_CURRENCY: CurrencyCode = 'USD';

export const CURRENCY_OPTIONS: { code: CurrencyCode; label: string }[] = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'SSP', label: 'South Sudanese Pound (SSP)' },
  { code: 'UGX', label: 'Ugandan Shilling (UGX)' },
  { code: 'KES', label: 'Kenyan Shilling (KES)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
];

const CURRENCY_FORMAT: Record<CurrencyCode, { locale: string; currency: string; maxFrac: number }> = {
  USD: { locale: 'en-US', currency: 'USD', maxFrac: 2 },
  SSP: { locale: 'en-SS', currency: 'SSP', maxFrac: 0 },
  UGX: { locale: 'en-UG', currency: 'UGX', maxFrac: 0 },
  KES: { locale: 'en-KE', currency: 'KES', maxFrac: 0 },
  EUR: { locale: 'en-EU', currency: 'EUR', maxFrac: 2 },
  GBP: { locale: 'en-GB', currency: 'GBP', maxFrac: 2 },
};

const VIEW_CURRENCY_KEY = 'vtms-view-currency';

/** units_per_usd: how many units of that currency equal 1 USD */
let ratesByCode: Record<string, number> = { USD: 1 };

let viewCurrency: CurrencyCode = (() => {
  try {
    const stored = localStorage.getItem(VIEW_CURRENCY_KEY);
    if (stored && CURRENCY_OPTIONS.some((c) => c.code === stored)) {
      return stored as CurrencyCode;
    }
  } catch {
    /* ignore */
  }
  return 'USD';
})();

export function setCurrencyRates(rates: Record<string, number>) {
  ratesByCode = { USD: 1, ...rates };
  if (!ratesByCode.USD) ratesByCode.USD = 1;
}

export function getCurrencyRates(): Record<string, number> {
  return { ...ratesByCode };
}

export function setViewCurrency(code: string) {
  if (!CURRENCY_OPTIONS.some((c) => c.code === code)) return;
  viewCurrency = code as CurrencyCode;
  try {
    localStorage.setItem(VIEW_CURRENCY_KEY, code);
  } catch {
    /* ignore */
  }
}

/** @deprecated use setViewCurrency — kept for store bootstrap compatibility */
export function setDisplayCurrency(code: string) {
  // Org setting no longer forces everyone's view; only seeds if user has no preference.
  try {
    if (!localStorage.getItem(VIEW_CURRENCY_KEY) && CURRENCY_OPTIONS.some((c) => c.code === code)) {
      setViewCurrency(code);
    }
  } catch {
    if (CURRENCY_OPTIONS.some((c) => c.code === code)) {
      viewCurrency = code as CurrencyCode;
    }
  }
}

export function getDisplayCurrency(): CurrencyCode {
  return viewCurrency;
}

export function getViewCurrency(): CurrencyCode {
  return viewCurrency;
}

/** Convert a USD-stored amount into the target (or current view) currency. */
export function convertFromUsd(amountUsd: number, to: CurrencyCode = viewCurrency): number {
  const rate = ratesByCode[to] ?? (to === 'USD' ? 1 : undefined);
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return amountUsd;
  return amountUsd * rate;
}

export function formatCurrency(
  amountUsd: number,
  currencyCode: CurrencyCode = viewCurrency,
): string {
  const converted = convertFromUsd(amountUsd, currencyCode);
  const meta = CURRENCY_FORMAT[currencyCode] ?? CURRENCY_FORMAT.USD;
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.currency,
      maximumFractionDigits: meta.maxFrac,
    }).format(converted);
  } catch {
    return `${currencyCode} ${converted.toLocaleString('en-US', { maximumFractionDigits: meta.maxFrac })}`;
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function getVulnerabilityLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Critical', color: 'bg-red-100 text-red-700' };
  if (score >= 70) return { label: 'High', color: 'bg-orange-100 text-orange-700' };
  if (score >= 55) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Low', color: 'bg-green-100 text-green-700' };
}

export function getAttendanceRate(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Comma-separated trade labels for a multi-trade batch. */
export function formatBatchTrades(trades: { trade: string }[]): string {
  if (!trades.length) return '—';
  return trades.map((t) => t.trade).join(', ');
}

/** Trainer names on a batch (unique, non-empty). */
export function formatBatchTrainers(trades: { trainerName: string }[]): string {
  const names = [...new Set(trades.map((t) => t.trainerName.trim()).filter(Boolean))];
  return names.length ? names.join(', ') : '—';
}

export function friendlyError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  if (typeof err === 'string') return err;
  return fallback;
}
