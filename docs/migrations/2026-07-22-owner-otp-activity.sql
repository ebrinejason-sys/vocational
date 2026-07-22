-- ============================================================
-- Owner OTP login, hidden staff flag, activity log
-- Appended into APPLY_NOW — also safe to run alone.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hidden_from_staff BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_otp_hash TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_otp_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx
  ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_actor_id_idx
  ON public.activity_log (actor_id);

GRANT ALL ON TABLE public.activity_log TO anon, authenticated, service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_select ON public.activity_log;
CREATE POLICY activity_log_select ON public.activity_log FOR SELECT
  USING (current_role_is(ARRAY['admin', 'director']::user_role[]));

DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
CREATE POLICY activity_log_insert ON public.activity_log FOR INSERT
  WITH CHECK (current_role_is(ARRAY[
    'admin','director','project_coordinator','trainer',
    'case_worker','finance_officer','logistics_officer'
  ]::user_role[]));
