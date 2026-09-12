ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS footer_bottom_message text,
  ADD COLUMN IF NOT EXISTS footer_logo_url text,
  ADD COLUMN IF NOT EXISTS footer_logo_size numeric,
  ADD COLUMN IF NOT EXISTS about_settings jsonb;