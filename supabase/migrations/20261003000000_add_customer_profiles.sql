-- Customer account profiles mirror Supabase Auth users with storefront metadata.
CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  username text,
  full_name text,
  phone text,
  newsletter_opt_in boolean NOT NULL DEFAULT false,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_profiles_read_own" ON customer_profiles;
CREATE POLICY "customer_profiles_read_own" ON customer_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "customer_profiles_insert_own" ON customer_profiles;
CREATE POLICY "customer_profiles_insert_own" ON customer_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "customer_profiles_update_own" ON customer_profiles;
CREATE POLICY "customer_profiles_update_own" ON customer_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_read_customer_profiles" ON customer_profiles;
CREATE POLICY "admin_read_customer_profiles" ON customer_profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles(email);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_created_at ON customer_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_newsletter ON customer_profiles(newsletter_opt_in) WHERE newsletter_opt_in;
