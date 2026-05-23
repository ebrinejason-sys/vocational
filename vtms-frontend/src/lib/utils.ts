import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
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
