ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS email_from    text,
  ADD COLUMN IF NOT EXISTS email_support text;
