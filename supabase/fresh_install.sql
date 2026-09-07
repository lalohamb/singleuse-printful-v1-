-- =============================================================================
-- Body & Sleeves — Full Install Script
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


-- ============================================================================
-- SETTINGS  (single row)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name              text        NOT NULL DEFAULT 'Body & Sleeves',
  tagline                 text        DEFAULT 'Black-Owned. Made to Order.',
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
  our_why_image_url       text,
  our_why_object_position text        DEFAULT '0px 0px',
  our_why_height_vh       numeric     DEFAULT 60,
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
    "tiktok":    {"url": "https://tiktok.com/@bodyandsleeves",      "enabled": true},
    "facebook":  {"url": "https://facebook.com/bodyandsleeves",     "enabled": true},
    "youtube":   {"url": "https://youtube.com/@bodyandsleeves",     "enabled": true},
    "pinterest": {"url": "https://pinterest.com/bodyandsleeves",    "enabled": true},
    "snapchat":  {"url": "https://snapchat.com/add/bodyandsleeves", "enabled": true},
    "threads":   {"url": "https://threads.net/@bodyandsleeves",     "enabled": true},
    "email":     {"url": "mailto:Hello.BodyandSleeves@gmail.com",   "enabled": true}
  }'::jsonb,
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
  site_url                text        NOT NULL DEFAULT 'https://bodyandsleeves.com',
  default_og_image        text,
  sitemap_enabled         boolean     NOT NULL DEFAULT true,
  robots_noindex_admin    boolean     NOT NULL DEFAULT true,
  jsonld_enabled          boolean     NOT NULL DEFAULT true,
  canonical_enabled       boolean     NOT NULL DEFAULT true,
  meta_title_suffix       text        NOT NULL DEFAULT '| Body & Sleeves',
  twitter_handle          text        DEFAULT '@body_and_sleeves',
  google_site_verification text,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seo_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all" ON seo_settings;
CREATE POLICY "admins_all" ON seo_settings FOR ALL USING (true) WITH CHECK (true);


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
  'Body & Sleeves',
  'Black-Owned. Made to Order.',
  'Empower Yourself. Empower the Culture.',
  'Apparel celebrating Black culture, faith, and family. Every design made with intention, printed on demand, shipped to your door.',
  'https://images.pexels.com/photos/858117/pexels-photo-858117.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'Made to order. Made with love. — Free shipping on orders over $75',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO seo_settings (id)
  VALUES ('00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;
