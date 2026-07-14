-- docs/migrations/2026-07-14-entity-lifecycle.sql
-- Run once in Supabase SQL Editor AFTER deploying client that sends status=paused.

ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE batches
  ADD CONSTRAINT batches_status_check
  CHECK (status IN ('planned','active','paused','completed','archived'));

ALTER TABLE trainees DROP CONSTRAINT IF EXISTS trainees_status_check;
ALTER TABLE trainees
  ADD CONSTRAINT trainees_status_check
  CHECK (status IN ('prospect','enrolled','paused','graduated','dropped','alumni'));

-- profiles.active already exists — no column add.

ALTER POLICY batches_delete ON batches
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

ALTER POLICY trainees_delete ON trainees
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
