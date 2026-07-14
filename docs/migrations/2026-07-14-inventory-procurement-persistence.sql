-- ============================================================
-- Inventory & procurement: columns needed for app persistence
-- Tables/RLS already exist; this only adds missing fields + FKs.
-- Run once in Supabase SQL Editor.
-- ============================================================

-- Trades an item is typically used for (optional tags in the UI)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS trade_relevance text[] DEFAULT '{}';

-- Link requester/approver to staff profiles (for names in the UI)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'procurement_requests_requested_by_fkey'
  ) THEN
    ALTER TABLE procurement_requests
      ADD CONSTRAINT procurement_requests_requested_by_fkey
      FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'procurement_requests_approved_by_fkey'
  ) THEN
    ALTER TABLE procurement_requests
      ADD CONSTRAINT procurement_requests_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
