import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// SCM's CTVET project reports in USD (donor: Word and Deed).
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
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
