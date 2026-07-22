-- Admin-only receipts, issued against recorded income (financial_transactions).
-- Run once in Supabase SQL Editor (also included in RUN_THIS_IN_SUPABASE.sql).

CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq;

CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT UNIQUE NOT NULL
      DEFAULT ('RCT-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0')),
    financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
    payer_name TEXT NOT NULL,
    payer_email TEXT,
    amount DECIMAL(12,2) NOT NULL,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    category TEXT,
    description TEXT,
    notes TEXT,
    issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    emailed_at TIMESTAMPTZ
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipts_select ON public.receipts;
CREATE POLICY receipts_select ON public.receipts FOR SELECT
  USING (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS receipts_insert ON public.receipts;
CREATE POLICY receipts_insert ON public.receipts FOR INSERT
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS receipts_update ON public.receipts;
CREATE POLICY receipts_update ON public.receipts FOR UPDATE
  USING (current_role_is(ARRAY['admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS receipts_delete ON public.receipts;
CREATE POLICY receipts_delete ON public.receipts FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));
