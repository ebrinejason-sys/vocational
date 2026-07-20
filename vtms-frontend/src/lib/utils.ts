import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Org display currency (set from app_settings on load). Amounts are not auto-converted. */
export type CurrencyCode = 'USD' | 'SSP';

export const CURRENCY_OPTIONS: { code: CurrencyCode; label: string }[] = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'SSP', label: 'South Sudanese Pound (SSP)' },
];

const CURRENCY_FORMAT: Record<CurrencyCode, { locale: string; currency: string }> = {
  USD: { locale: 'en-US', currency: 'USD' },
  SSP: { locale: 'en-SS', currency: 'SSP' },
};

let displayCurrency: CurrencyCode = 'USD';

export function setDisplayCurrency(code: string) {
  if (CURRENCY_OPTIONS.some((c) => c.code === code)) {
    displayCurrency = code as CurrencyCode;
  }
}

export function getDisplayCurrency(): CurrencyCode {
  return displayCurrency;
}

export function formatCurrency(amount: number, currencyCode: CurrencyCode = displayCurrency): string {
  const meta = CURRENCY_FORMAT[currencyCode] ?? CURRENCY_FORMAT.USD;
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.currency,
      maximumFractionDigits: currencyCode === 'SSP' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
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

/**
 * Turn raw Supabase/Postgres errors into copy a field officer can act on,
 * instead of leaking internals like "new row violates row-level security
 * policy for table trainees".
 */
export function friendlyError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : '';
  if (/row-level security|permission denied|policy/i.test(message)) {
    return 'Your role doesn’t have permission for this action.';
  }
  if (/Failed to fetch|NetworkError|network/i.test(message)) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  if (/duplicate key|already exists/i.test(message)) {
    return 'This record already exists.';
  }
  return message || fallback;
}
