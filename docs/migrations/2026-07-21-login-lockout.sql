-- Login lockout: throttle brute-force password guessing on /api/auth/login,
-- and a resend cooldown on /api/auth/forgot-password.
-- Run once in Supabase SQL Editor (also included in RUN_THIS_IN_SUPABASE.sql).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_reset_last_sent_at TIMESTAMPTZ;
