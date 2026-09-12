ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS affirmations_settings jsonb;

NOTIFY pgrst, 'reload schema';
