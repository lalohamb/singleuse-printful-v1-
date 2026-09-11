-- Platform DB Migration: 001_platform_schema.sql

-- Merchant accounts
CREATE TABLE IF NOT EXISTS merchants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        uuid REFERENCES auth.users(id),
  email               text NOT NULL UNIQUE,
  full_name           text,
  company_name        text,
  plan                text NOT NULL DEFAULT 'trial',
  plan_status         text NOT NULL DEFAULT 'active',
  trial_ends_at       timestamptz DEFAULT (now() + interval '14 days'),
  stripe_customer_id  text UNIQUE,
  stripe_sub_id       text UNIQUE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Platform admins (super admin access)
CREATE TABLE IF NOT EXISTS platform_admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid REFERENCES auth.users(id) UNIQUE,
  email         text NOT NULL UNIQUE,
  created_at    timestamptz DEFAULT now()
);

-- Provisioned store instances
CREATE TABLE IF NOT EXISTS store_instances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           uuid REFERENCES merchants(id) ON DELETE CASCADE,
  store_name            text NOT NULL,
  subdomain             text NOT NULL UNIQUE,
  custom_domain         text UNIQUE,
  status                text NOT NULL DEFAULT 'provisioning',
  supabase_project_ref  text UNIQUE,
  supabase_project_url  text,
  supabase_anon_key     text,
  droplet_id            text,
  droplet_ip            text,
  vercel_project_id     text,
  printify_shop_id      text,
  printify_connected    boolean DEFAULT false,
  stripe_connected      boolean DEFAULT false,
  white_label           boolean DEFAULT false,
  provisioned_at        timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Provisioning job log
CREATE TABLE IF NOT EXISTS provisioning_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid REFERENCES store_instances(id) ON DELETE CASCADE,
  merchant_id   uuid REFERENCES merchants(id),
  status        text NOT NULL DEFAULT 'queued',
  steps         jsonb DEFAULT '[]',
  error         text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- Download purchases
CREATE TABLE IF NOT EXISTS download_purchases (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id              uuid REFERENCES merchants(id),
  email                    text NOT NULL,
  stripe_session_id        text UNIQUE,
  stripe_payment_intent_id text,
  license_key              text NOT NULL UNIQUE,
  license_type             text NOT NULL DEFAULT 'single',
  download_url             text,
  download_count           int DEFAULT 0,
  max_downloads            int DEFAULT 5,
  expires_at               timestamptz,
  activated_at             timestamptz,
  created_at               timestamptz DEFAULT now()
);

-- License key activations
CREATE TABLE IF NOT EXISTS license_activations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key   text NOT NULL,
  domain        text,
  activated_at  timestamptz DEFAULT now(),
  ip_address    text,
  UNIQUE (license_key, domain)
);

-- Platform audit log
CREATE TABLE IF NOT EXISTS platform_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   uuid REFERENCES merchants(id),
  event_type    text NOT NULL,
  payload       jsonb,
  created_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_merchants_auth_user ON merchants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_stripe_customer ON merchants(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_store_instances_merchant ON store_instances(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_instances_subdomain ON store_instances(subdomain);
CREATE INDEX IF NOT EXISTS idx_store_instances_custom_domain ON store_instances(custom_domain);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_instance ON provisioning_jobs(instance_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_status ON provisioning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_download_purchases_email ON download_purchases(email);
CREATE INDEX IF NOT EXISTS idx_license_activations_key ON license_activations(license_key);
CREATE INDEX IF NOT EXISTS idx_platform_events_merchant ON platform_events(merchant_id);

-- RLS: Enable on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisioning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

-- Merchants: can only see/edit their own row
CREATE POLICY "merchants_self" ON merchants
  USING (auth_user_id = auth.uid());

-- Store instances: merchant sees only their own
CREATE POLICY "instances_own_merchant" ON store_instances
  USING (merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid()));

-- Provisioning jobs: merchant sees only their own
CREATE POLICY "jobs_own_merchant" ON provisioning_jobs
  USING (merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid()));

-- Download purchases: merchant sees only their own
CREATE POLICY "downloads_own_merchant" ON download_purchases
  USING (merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Platform events: merchant sees only their own
CREATE POLICY "events_own_merchant" ON platform_events
  USING (merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid()));

-- Auto-create merchant row on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO merchants (auth_user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER instances_updated_at BEFORE UPDATE ON store_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
