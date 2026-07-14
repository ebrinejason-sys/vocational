-- ============================================================
-- Multi-trade batches + trainer trade tags + trainee.trade
-- Run in Supabase SQL Editor AFTER deploying the matching app.
-- Prerequisite: roles migration (project_coordinator, logistics_officer) done.
-- ============================================================

-- 1) Trainer ↔ trade tags
CREATE TABLE IF NOT EXISTS profile_trades (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade TEXT NOT NULL CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity')),
  PRIMARY KEY (profile_id, trade)
);

GRANT ALL ON TABLE profile_trades TO anon, authenticated, service_role;

ALTER TABLE profile_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_trades_select ON profile_trades;
CREATE POLICY profile_trades_select ON profile_trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS profile_trades_insert ON profile_trades;
CREATE POLICY profile_trades_insert ON profile_trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['director','admin']::user_role[]));

DROP POLICY IF EXISTS profile_trades_update ON profile_trades;
CREATE POLICY profile_trades_update ON profile_trades FOR UPDATE
  USING (current_role_is(ARRAY['director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['director','admin']::user_role[]));

DROP POLICY IF EXISTS profile_trades_delete ON profile_trades;
CREATE POLICY profile_trades_delete ON profile_trades FOR DELETE
  USING (current_role_is(ARRAY['director','admin']::user_role[]));

-- 2) Expand profiles SELECT so batch editors can list active trainers
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR current_role_is(ARRAY['director','admin']::user_role[])
    OR (
      role = 'trainer'
      AND active
      AND current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[])
    )
  );

-- 3) Batch ↔ trade ↔ trainer
CREATE TABLE IF NOT EXISTS batch_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  trade TEXT NOT NULL CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity')),
  trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (batch_id, trade)
);

GRANT ALL ON TABLE batch_trades TO anon, authenticated, service_role;

ALTER TABLE batch_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_trades_select ON batch_trades;
CREATE POLICY batch_trades_select ON batch_trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS batch_trades_insert ON batch_trades;
CREATE POLICY batch_trades_insert ON batch_trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

DROP POLICY IF EXISTS batch_trades_update ON batch_trades;
CREATE POLICY batch_trades_update ON batch_trades FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

DROP POLICY IF EXISTS batch_trades_delete ON batch_trades;
CREATE POLICY batch_trades_delete ON batch_trades FOR DELETE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

-- 4) Backfill from legacy single-trade columns (if still present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'batches' AND column_name = 'trade'
  ) THEN
    INSERT INTO batch_trades (batch_id, trade, trainer_id)
    SELECT b.id, b.trade, NULL
    FROM batches b
    WHERE b.trade IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM batch_trades bt WHERE bt.batch_id = b.id AND bt.trade = b.trade
      );

    ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_trade_check;
    ALTER TABLE batches DROP COLUMN IF EXISTS trade;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'batches' AND column_name = 'trainer_name'
  ) THEN
    ALTER TABLE batches DROP COLUMN IF EXISTS trainer_name;
  END IF;
END $$;

-- 5) Trainee trade within a batch
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS trade TEXT
  CHECK (trade IS NULL OR trade IN ('Carpentry','Tailoring','Masonry','Electricity'));

-- Best-effort: set trainee.trade from the batch's sole trade row when missing
UPDATE trainees t
SET trade = bt.trade
FROM batch_trades bt
WHERE t.batch_id = bt.batch_id
  AND t.trade IS NULL
  AND (
    SELECT COUNT(*) FROM batch_trades x WHERE x.batch_id = t.batch_id
  ) = 1;
