-- Custom auth: passwords stored on profiles; Supabase Auth no longer required.
-- Run once in Supabase SQL Editor (also included in RUN_THIS_IN_SUPABASE.sql).

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_token_idx
  ON public.profiles(invite_token) WHERE invite_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_password_reset_token_idx
  ON public.profiles(password_reset_token) WHERE password_reset_token IS NOT NULL;
