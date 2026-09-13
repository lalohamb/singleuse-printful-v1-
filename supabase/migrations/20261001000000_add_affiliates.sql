-- =============================================================================
-- Affiliate Program — Phase 1
-- =============================================================================

-- Affiliates
CREATE TABLE IF NOT EXISTS affiliates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        UNIQUE NOT NULL,
  name            text        NOT NULL,
  code            text        UNIQUE NOT NULL,
  status          text        NOT NULL DEFAULT 'pending', -- pending | active | suspended | rejected
  commission_rate numeric     NOT NULL DEFAULT 0.10,
  payout_method   text,       -- cashapp | paypal | venmo | zelle
  payout_handle   text,       -- $tag, email, @handle, or phone
  platform_url    text,       -- link to their channel/profile for verification
  follower_count  int,        -- self-reported
  total_views     int,        -- self-reported
  notes           text,       -- admin notes
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_affiliates" ON affiliates;
CREATE POLICY "admin_all_affiliates" ON affiliates FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- Public can insert (signup)
DROP POLICY IF EXISTS "public_insert_affiliates" ON affiliates;
CREATE POLICY "public_insert_affiliates" ON affiliates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Affiliate clicks (analytics)
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        NOT NULL,
  referrer   text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_clicks" ON affiliate_clicks;
CREATE POLICY "public_insert_clicks" ON affiliate_clicks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_clicks" ON affiliate_clicks;
CREATE POLICY "admin_read_clicks" ON affiliate_clicks FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- Per-order commissions
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     uuid        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  order_id         uuid        REFERENCES orders(id) ON DELETE SET NULL,
  order_subtotal   numeric     NOT NULL,
  commission_amount numeric    NOT NULL,
  status           text        NOT NULL DEFAULT 'pending', -- pending | approved | paid | voided
  approved_at      timestamptz,
  paid_at          timestamptz,
  payout_id        uuid,       -- FK to affiliate_payouts added below
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_conversions" ON affiliate_conversions;
CREATE POLICY "admin_all_conversions" ON affiliate_conversions FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- Monthly payout batches
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    uuid        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  period          text        NOT NULL, -- e.g. "2025-01"
  total_amount    numeric     NOT NULL,
  payout_method   text        NOT NULL,
  payout_handle   text        NOT NULL,
  stripe_memo     text,       -- Stripe transfer note / reference ID
  status          text        NOT NULL DEFAULT 'pending', -- pending | paid
  paid_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_payouts" ON affiliate_payouts;
CREATE POLICY "admin_all_payouts" ON affiliate_payouts FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- Add payout_id FK now that affiliate_payouts exists
ALTER TABLE affiliate_conversions
  ADD CONSTRAINT fk_conversion_payout
  FOREIGN KEY (payout_id) REFERENCES affiliate_payouts(id) ON DELETE SET NULL;

-- Add affiliate_code to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_code text;

CREATE INDEX IF NOT EXISTS idx_affiliates_code       ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_code ON affiliate_clicks(code);
CREATE INDEX IF NOT EXISTS idx_conversions_affiliate ON affiliate_conversions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_conversions_status    ON affiliate_conversions(status);
CREATE INDEX IF NOT EXISTS idx_payouts_affiliate     ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_orders_affiliate_code ON orders(affiliate_code);
