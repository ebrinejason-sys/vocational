-- Delete permission requests + tighten destructive deletes to admin only
-- Non-admins must request deletion; admins review and execute.

CREATE TABLE IF NOT EXISTS public.delete_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_label TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  requested_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delete_requests_status_idx
  ON public.delete_requests (status, created_at DESC);

GRANT ALL ON TABLE public.delete_requests TO anon, authenticated, service_role;
ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delete_requests_select ON public.delete_requests;
CREATE POLICY delete_requests_select ON public.delete_requests FOR SELECT
  USING (
    current_role_is(ARRAY['admin', 'director']::user_role[])
    OR requested_by = auth.uid()
  );

DROP POLICY IF EXISTS delete_requests_insert ON public.delete_requests;
CREATE POLICY delete_requests_insert ON public.delete_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND current_role_is(ARRAY[
      'admin','director','project_coordinator','trainer',
      'case_worker','finance_officer','logistics_officer'
    ]::user_role[])
  );

DROP POLICY IF EXISTS delete_requests_update ON public.delete_requests;
CREATE POLICY delete_requests_update ON public.delete_requests FOR UPDATE
  USING (current_role_is(ARRAY['admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));

-- Tighten hard deletes to admin (execution happens via service-role API on approve)
DROP POLICY IF EXISTS trainees_delete ON public.trainees;
CREATE POLICY trainees_delete ON public.trainees FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS batches_delete ON public.batches;
CREATE POLICY batches_delete ON public.batches FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS trainee_interviews_delete ON public.trainee_interviews;
CREATE POLICY trainee_interviews_delete ON public.trainee_interviews FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS financial_transactions_delete ON public.financial_transactions;
CREATE POLICY financial_transactions_delete ON public.financial_transactions FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS trainee_documents_delete ON public.trainee_documents;
CREATE POLICY trainee_documents_delete ON public.trainee_documents FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));
