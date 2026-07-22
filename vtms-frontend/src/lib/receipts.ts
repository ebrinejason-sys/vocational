import { getAccessToken } from './session';
import { supabase } from './supabase';
import type { Receipt } from '../types';

interface ReceiptRow {
  id: string;
  receipt_number: string;
  financial_transaction_id: string | null;
  batch_id: string | null;
  payer_name: string;
  payer_email: string | null;
  amount: number;
  currency_code: string;
  category: string | null;
  description: string | null;
  notes: string | null;
  issued_by: string | null;
  issued_at: string;
  emailed_at: string | null;
}

function receiptFromRow(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    financialTransactionId: row.financial_transaction_id,
    batchId: row.batch_id,
    payerName: row.payer_name,
    payerEmail: row.payer_email,
    amount: Number(row.amount),
    currencyCode: row.currency_code,
    category: row.category,
    description: row.description,
    notes: row.notes,
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    emailedAt: row.emailed_at,
  };
}

/** Admin-only: RLS restricts the underlying table to role = 'admin'. */
export async function fetchReceiptsForBatch(batchId: string): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('batch_id', batchId)
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return (data as ReceiptRow[]).map(receiptFromRow);
}

export async function createReceipt(payload: {
  financialTransactionId: string;
  payerName: string;
  payerEmail?: string;
  notes?: string;
}): Promise<{ receipt: Receipt; emailSent: boolean; emailWarning?: string }> {
  const res = await fetch('/api/receipts/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    receipt?: ReceiptRow;
    emailSent?: boolean;
    emailWarning?: string;
  };
  if (!res.ok || !json.receipt) {
    throw new Error(json.error ?? 'Could not create receipt');
  }
  return {
    receipt: receiptFromRow(json.receipt),
    emailSent: Boolean(json.emailSent),
    emailWarning: json.emailWarning,
  };
}
