ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS brand_values_settings jsonb;

NOTIFY pgrst, 'reload schema';
