ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS about_settings jsonb,
  ADD COLUMN IF NOT EXISTS affirmations_settings jsonb,
  ADD COLUMN IF NOT EXISTS new_arrivals_settings jsonb;
