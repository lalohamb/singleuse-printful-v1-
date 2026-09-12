ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS new_arrivals_settings jsonb;

NOTIFY pgrst, 'reload schema';
