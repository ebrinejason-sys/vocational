-- Currency conversion rates (amounts in app are stored as USD).
-- units_per_usd = how many units of this currency equal 1 USD.

CREATE TABLE IF NOT EXISTS public.currency_rates (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  units_per_usd NUMERIC(18, 6) NOT NULL CHECK (units_per_usd > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

INSERT INTO public.currency_rates (code, label, units_per_usd) VALUES
  ('USD', 'US Dollar', 1),
  ('SSP', 'South Sudanese Pound', 1),
  ('UGX', 'Ugandan Shilling', 1),
  ('KES', 'Kenyan Shilling', 1),
  ('EUR', 'Euro', 1),
  ('GBP', 'British Pound', 1)
ON CONFLICT (code) DO NOTHING;

GRANT ALL ON TABLE public.currency_rates TO anon, authenticated, service_role;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS currency_rates_select ON public.currency_rates;
CREATE POLICY currency_rates_select ON public.currency_rates FOR SELECT
  USING (current_role_is(ARRAY[
    'admin','director','project_coordinator','trainer',
    'case_worker','finance_officer','logistics_officer'
  ]::user_role[]));

DROP POLICY IF EXISTS currency_rates_upsert ON public.currency_rates;
CREATE POLICY currency_rates_insert ON public.currency_rates FOR INSERT
  WITH CHECK (current_role_is(ARRAY['admin', 'director']::user_role[]));

DROP POLICY IF EXISTS currency_rates_update ON public.currency_rates;
CREATE POLICY currency_rates_update ON public.currency_rates FOR UPDATE
  USING (current_role_is(ARRAY['admin', 'director']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin', 'director']::user_role[]));
