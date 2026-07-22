-- Mid-market approximate units per 1 USD (as of ~2026-07-21).
-- Sources: Xe / Wise / Trading Economics / market converters.
-- SSP is volatile (official vs parallel); this uses recent market mid ~4,851.

UPDATE public.currency_rates AS c
SET
  units_per_usd = v.units_per_usd,
  label = v.label,
  updated_at = NOW()
FROM (VALUES
  ('USD', 'US Dollar', 1::numeric),
  ('SSP', 'South Sudanese Pound', 4851::numeric),
  ('UGX', 'Ugandan Shilling', 3703::numeric),
  ('KES', 'Kenyan Shilling', 129.3::numeric),
  ('EUR', 'Euro', 0.8742::numeric),
  ('GBP', 'British Pound', 0.7433::numeric)
) AS v(code, label, units_per_usd)
WHERE c.code = v.code;
