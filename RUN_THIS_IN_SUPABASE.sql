-- ============================================================
-- COPY EVERYTHING BELOW INTO SUPABASE SQL EDITOR AND CLICK RUN
-- File name must end in .sql — never open design.md or plan.md
-- ============================================================

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.batches'::regclass
      AND con.contype = 'c'
      AND att.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.batches DROP CONSTRAINT %I', cname);
  END LOOP;

  ALTER TABLE public.batches
    ADD CONSTRAINT batches_status_check
    CHECK (status IN ('planned', 'active', 'paused', 'completed', 'archived'));
END $$;

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.trainees'::regclass
      AND con.contype = 'c'
      AND att.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.trainees DROP CONSTRAINT %I', cname);
  END LOOP;

  ALTER TABLE public.trainees
    ADD CONSTRAINT trainees_status_check
    CHECK (status IN ('prospect', 'enrolled', 'paused', 'graduated', 'dropped', 'alumni'));
END $$;

ALTER POLICY batches_delete ON public.batches
  USING (
    current_role_is(
      ARRAY[
        'trainer',
        'case_worker',
        'project_coordinator',
        'director',
        'admin'
      ]::user_role[]
    )
  );

ALTER POLICY trainees_delete ON public.trainees
  USING (
    current_role_is(
      ARRAY[
        'trainer',
        'case_worker',
        'project_coordinator',
        'director',
        'admin'
      ]::user_role[]
    )
  );

SELECT 'batches.status values' AS check_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.batches'::regclass
  AND conname = 'batches_status_check'
UNION ALL
SELECT 'trainees.status values',
       pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.trainees'::regclass
  AND conname = 'trainees_status_check';
