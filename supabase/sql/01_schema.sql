-- =============================================================================
-- Gender Apparel — Full Install Script
-- Run this in Supabase SQL Editor on a fresh project.
-- =============================================================================


-- ============================================================================
-- ADMINS
-- Must be created first — all other table policies reference it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS admins (
  id         uuid PRIMARY KEY DEFAULT auth.uid(),
  email      text NOT NULL,
  role       text NOT NULL DEFAULT 'admin', -- 'admin' | 'super_admin'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Non-recursive: each user can only read their own row
DROP POLICY IF EXISTS "auth_read_admins" ON admins;
CREATE POLICY "auth_read_admins" ON admins FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "super_admin_insert_admins" ON admins;
CREATE POLICY "super_admin_insert_admins" ON admins FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins a WHERE a.id = auth.uid() AND a.role = 'super_admin')
  );

DROP POLICY IF EXISTS "super_admin_delete_admins" ON admins;
CREATE POLICY "super_admin_delete_admins" ON admins FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins a WHERE a.id = auth.uid() AND a.role = 'super_admin')
  );


-- ============================================================================
-- CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_categories" ON categories;
CREATE POLICY "admin_insert_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_categories" ON categories;
CREATE POLICY "admin_update_categories" ON categories FOR UPDATE
  TO authenticated
  USING     (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_categories" ON categories;
CREATE POLICY "admin_delete_categories" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );


-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  printify_id       text        UNIQUE,
  title             text        NOT NULL,
  description       text,
  category_id       uuid        REFERENCES categories(id) ON DELETE SET NULL,
  price             numeric(10,2) NOT NULL,
  cost              numeric(10,2) DEFAULT 0,
  image_url         text,
  images            jsonb       DEFAULT '[]'::jsonb,
  status            text        NOT NULL DEFAULT 'active', -- 'active' | 'draft' | 'archived'
  featured          boolean     NOT NULL DEFAULT false,
  is_new_arrival    boolean     NOT NULL DEFAULT false,
  is_trending       boolean     NOT NULL DEFAULT false,
  is_bestseller     boolean     NOT NULL DEFAULT false,
  is_on_sale        boolean     NOT NULL DEFAULT false,
  content_locked    boolean     NOT NULL DEFAULT false,
  print_provider_id text,
  blueprint_id      text,
  variants          jsonb       DEFAULT '[]'::jsonb,
  shipping_info     jsonb       DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_products" ON products;
CREATE POLICY "admin_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_products" ON products;
CREATE POLICY "admin_update_products" ON products FOR UPDATE
  TO authenticated
  USING     (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_products" ON products;
CREATE POLICY "admin_delete_products" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status      ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured    ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_new_arrival ON products(is_new_arrival) WHERE is_new_arrival;
CREATE INDEX IF NOT EXISTS idx_products_trending    ON products(is_trending)    WHERE is_trending;
CREATE INDEX IF NOT EXISTS idx_products_bestseller  ON products(is_bestseller)  WHERE is_bestseller;
CREATE INDEX IF NOT EXISTS idx_products_on_sale     ON products(is_on_sale)     WHERE is_on_sale;


-- ============================================================================
-- ORDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  printify_order_id         text,
  stripe_session_id         text,
  stripe_payment_intent_id  text,
  email                     text          NOT NULL,
  shipping_name             text          NOT NULL,
  shipping_address          jsonb         NOT NULL,
  shipping_method           text,
  shipping_cost             numeric(10,2) DEFAULT 0,
  subtotal                  numeric(10,2) NOT NULL,
  total                     numeric(10,2) NOT NULL,
  currency                  text          DEFAULT 'USD',
  status                    text          NOT NULL DEFAULT 'pending',
  fulfillment_status        text,
  tracking_number           text,
  tracking_url              text,
  items                     jsonb         NOT NULL,
  livemode                  boolean       NOT NULL DEFAULT true,
  created_at                timestamptz   DEFAULT now(),
  updated_at                timestamptz   DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_orders" ON orders;
CREATE POLICY "public_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_orders" ON orders;
CREATE POLICY "admin_read_orders" ON orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_orders" ON orders;
CREATE POLICY "admin_update_orders" ON orders FOR UPDATE
  TO authenticated
  USING     (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_orders" ON orders;
CREATE POLICY "admin_delete_orders" ON orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email      ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_livemode   ON orders(livemode);


-- ============================================================================
-- SETTINGS  (single row)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name              text        NOT NULL DEFAULT 'Gender Apparel',
  tagline                 text        DEFAULT 'Made for Every Body.',
  hero_image_url          text,
  hero_object_position    text        DEFAULT '0px 0px',
  hero_title              text,
  hero_subtitle           text,
  hero_height_vh          numeric     DEFAULT 80,
  hero_image_flip         boolean     DEFAULT false,
  hero_image_scale        numeric     DEFAULT 1,
  hero_gradient_opacity   numeric     DEFAULT 0.4,
  hero_gradient_dir       text        DEFAULT 'to right',
  hero_image_fit          text        DEFAULT 'cover',
  story_image_url         text,
  story_object_position   text        DEFAULT '0px 0px',
  story_image_scale       numeric     DEFAULT 100,
  story_image_flip        boolean     DEFAULT false,
  story_image_fit         text        DEFAULT 'cover',
  story_gradient_opacity  numeric     DEFAULT 40,
  story_gradient_dir      text        DEFAULT 'full',
  logo_url                text,
  logo_size               numeric     DEFAULT 40,
  footer_text             text        DEFAULT 'Made-to-order apparel designed for every body, every style, and every day. Wear what feels like you.',
  footer_bottom_message   text        DEFAULT 'Made to order. Made with love.',
  footer_logo_url         text,
  footer_logo_size        numeric     DEFAULT 40,
  about_settings          jsonb,
  affirmations_settings   jsonb,
  new_arrivals_settings   jsonb,
  brand_values_settings   jsonb,
  testimonials            jsonb       DEFAULT '[{"quote":"I wore my shirt to a family reunion and got so many compliments. This brand truly gets us.","name":"Jasmine T.","location":"Atlanta, GA","product":"Culture First Tee"},{"quote":"The quality is unmatched. Soft, true to size, and the design is everything. Will be ordering again.","name":"Marcus W.","location":"Houston, TX","product":"Faith Over Fear Hoodie"},{"quote":"Finally a brand that celebrates who we are. Every piece feels intentional and powerful.","name":"Aaliyah R.","location":"Chicago, IL","product":"Heritage Collection"}]'::jsonb,
  promo_banner_active     boolean     DEFAULT false,
  promo_banner_title      text,
  promo_banner_body       text,
  promo_banner_cta_label  text,
  promo_banner_cta_url    text,
  promo_banner_bg_color   text        DEFAULT '#1a1a1a',
  our_why_image_url       text,
  our_why_object_position text        DEFAULT '0px 0px',
  our_why_height_vh       numeric     DEFAULT 60,
  our_why_label           text,
  our_why_quote           text,
  our_why_body            text,
  our_why_image_scale     numeric     DEFAULT 1,
  our_why_image_flip      boolean     DEFAULT false,
  our_why_image_fit       text        DEFAULT 'cover',
  our_why_gradient_opacity numeric    DEFAULT 0.4,
  our_why_gradient_dir    text        DEFAULT 'to right',
  announcement            text,
  announcement_active     boolean     DEFAULT true,
  orders_paused           boolean     NOT NULL DEFAULT false,
  shipping_free_threshold numeric     DEFAULT 75,
  default_shipping_cost   numeric     DEFAULT 6.99,
  printify_connected      boolean     DEFAULT false,
  printify_shop_id        text,
  stripe_connected        boolean     DEFAULT false,
  social_links            jsonb       NOT NULL DEFAULT '{
    "instagram": {"url": "https://instagram.com/body_and_sleeves", "enabled": true},
    "tiktok":    {"url": "https://tiktok.com/@genderapparel", "enabled": true},
    "facebook":  {"url": "https://facebook.com/genderapparel", "enabled": true},
    "youtube":   {"url": "https://youtube.com/@genderapparel", "enabled": true},
    "pinterest": {"url": "https://pinterest.com/genderapparel", "enabled": true},
    "snapchat":  {"url": "https://snapchat.com/add/genderapparel", "enabled": true},
    "threads":   {"url": "https://threads.net/@genderapparel", "enabled": true},
    "email":     {"url": "mailto:hello@genderapparel.example", "enabled": true}
  }'::jsonb,
  favicon_url             text,
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_settings" ON settings;
CREATE POLICY "public_read_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_settings" ON settings;
CREATE POLICY "admin_update_settings" ON settings FOR UPDATE
  TO authenticated
  USING     (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));


-- ============================================================================
-- SEO SETTINGS  (single row)
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url                text        NOT NULL DEFAULT 'https://genderapparel.example',
  default_og_image        text,
  sitemap_enabled         boolean     NOT NULL DEFAULT true,
  robots_noindex_admin    boolean     NOT NULL DEFAULT true,
  jsonld_enabled          boolean     NOT NULL DEFAULT true,
  canonical_enabled       boolean     NOT NULL DEFAULT true,
  meta_title_suffix       text        NOT NULL DEFAULT '| Gender Apparel',
  twitter_handle          text        DEFAULT '@body_and_sleeves',
  google_site_verification text,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seo_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all" ON seo_settings;
DROP POLICY IF EXISTS "public_read_seo_settings" ON seo_settings;
DROP POLICY IF EXISTS "admin_update_seo_settings" ON seo_settings;
CREATE POLICY "public_read_seo_settings" ON seo_settings FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "admin_update_seo_settings" ON seo_settings FOR UPDATE
  TO authenticated
  USING     (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));


-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO categories (name, slug, description) VALUES
  ('T-Shirts',    't-shirts',    'Premium tees with culturally inspired designs'),
  ('Hoodies',     'hoodies',     'Comfortable hoodies for every season'),
  ('Hats',        'hats',        'Caps and headwear to complete your look'),
  ('Sweatpants',  'sweatpants',  'Matching bottoms for your streetwear sets'),
  ('Accessories', 'accessories', 'Tote bags, stickers, and more')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO settings (
  store_name, tagline, hero_title, hero_subtitle, hero_image_url,
  announcement, announcement_active
) VALUES (
  'Gender Apparel',
  'Made for Every Body.',
  'Empower Yourself. Empower the Culture.',
  'Apparel celebrating Black culture, faith, and family. Every design made with intention, printed on demand, shipped to your door.',
  'https://images.pexels.com/photos/858117/pexels-photo-858117.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'Made to order. Made with love. — Free shipping on orders over $75',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO seo_settings (id)
  VALUES ('00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- POLICIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS policies (
  id         text        PRIMARY KEY, -- 'terms' | 'privacy' | 'refund'
  title      text        NOT NULL,
  content    text        NOT NULL DEFAULT '',
  locked     boolean     NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_policies" ON policies;
CREATE POLICY "public_read_policies" ON policies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_policies" ON policies;
CREATE POLICY "admin_update_policies" ON policies FOR UPDATE
  TO authenticated
  USING     (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

DROP POLICY IF EXISTS "admin_insert_policies" ON policies;
CREATE POLICY "admin_insert_policies" ON policies FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

INSERT INTO policies (id, title, content) VALUES
  ('terms',   'Terms of Service',          ''),
  ('privacy', 'Privacy Policy',            ''),
  ('refund',  'Refund and Returns Policy', '')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- EMAIL EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id  text        NOT NULL,
  to_email   text        NOT NULL,
  subject    text,
  event_type text        NOT NULL, -- sent, delivered, opened, clicked, bounced, complained
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_email_events" ON email_events;
CREATE POLICY "admin_all_email_events" ON email_events FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_events_to_email  ON email_events(to_email);
CREATE INDEX IF NOT EXISTS idx_email_events_type      ON email_events(event_type);
