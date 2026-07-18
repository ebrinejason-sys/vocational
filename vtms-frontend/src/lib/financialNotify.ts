import { supabase } from './supabase';

export type FinancialNotifyAction =
  | 'transaction_update'
  | 'transaction_delete'
  | 'currency_change';

export async function notifyFinancialChange(payload: {
  action: FinancialNotifyAction;
  reason: string;
  title: string;
  body: string;
  entityType: 'financial_transaction' | 'app_settings';
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}): Promise<{ emailSent: boolean; emailWarning?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/notify-financial-change', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    emailSent?: boolean;
    emailWarning?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to notify admin/director');
  }
  return {
    emailSent: Boolean(json.emailSent),
    emailWarning: json.emailWarning,
  };
}
