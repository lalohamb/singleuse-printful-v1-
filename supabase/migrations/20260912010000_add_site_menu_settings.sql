ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS site_menu_settings jsonb;

NOTIFY pgrst, 'reload schema';
