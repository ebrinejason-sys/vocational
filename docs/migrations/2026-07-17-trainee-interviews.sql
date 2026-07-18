-- ============================================================
-- Trainee interviews (VST Screening & Assessment Tool)
-- Run once in Supabase SQL Editor.
-- Motivation/availability fields live inside vulnerability_assessment JSONB
-- (no column change needed for registration fields).
-- ============================================================

CREATE TABLE IF NOT EXISTS trainee_interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  interview_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responses JSONB NOT NULL DEFAULT '{}',
  scores JSONB NOT NULL DEFAULT '{}',
  total_score INTEGER NOT NULL DEFAULT 0,
  panel_notes TEXT DEFAULT '',
  panelist_names TEXT DEFAULT '',
  decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'selected', 'waitlist', 'rejected')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trainee_interviews_trainee_id_idx ON trainee_interviews(trainee_id);
CREATE INDEX IF NOT EXISTS trainee_interviews_batch_id_idx ON trainee_interviews(batch_id);

GRANT ALL ON TABLE trainee_interviews TO anon, authenticated, service_role;

ALTER TABLE trainee_interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainee_interviews_select ON trainee_interviews;
CREATE POLICY trainee_interviews_select ON trainee_interviews FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

DROP POLICY IF EXISTS trainee_interviews_insert ON trainee_interviews;
CREATE POLICY trainee_interviews_insert ON trainee_interviews FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

DROP POLICY IF EXISTS trainee_interviews_update ON trainee_interviews;
CREATE POLICY trainee_interviews_update ON trainee_interviews FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

DROP POLICY IF EXISTS trainee_interviews_delete ON trainee_interviews;
CREATE POLICY trainee_interviews_delete ON trainee_interviews FOR DELETE
  USING (current_role_is(ARRAY['project_coordinator','director','admin']::user_role[]));
