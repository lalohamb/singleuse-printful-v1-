ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS stripe_live_secret_key text,
  ADD COLUMN IF NOT EXISTS stripe_live_webhook_secret text,
  ADD COLUMN IF NOT EXISTS stripe_test_secret_key text,
  ADD COLUMN IF NOT EXISTS stripe_test_webhook_secret text,
  ADD COLUMN IF NOT EXISTS stripe_mode text NOT NULL DEFAULT 'test';
