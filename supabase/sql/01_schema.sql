/*
# Printify POD Storefront E-Commerce Schema

## Overview
Creates the full database schema for an apparel e-commerce site celebrating Black culture.
Products are synced from Printify but stored locally for fast storefront browsing.
Orders are stored locally and optionally forwarded to Printify for fulfillment.
Admin access is controlled via an `admins` table checked against auth.users.

## New Tables

### admins (created first — other policies depend on it)
- `id` (uuid, PK, DEFAULT auth.uid())
- `email` (text, not null)
- `role` (text, default 'admin') — 'admin' | 'super_admin'
- `created_at` (timestamptz)

### customer_profiles
- `id` (uuid, PK, FK → auth.users)
- `email`, `username`, `full_name`, `phone`
- `newsletter_opt_in`
- `address`, `preferences` (jsonb)
- `last_seen_at`, `created_at`, `updated_at`

### categories
- `id` (uuid, PK)
- `name` (text, unique)
- `slug` (text, unique)
- `description` (text)
- `created_at` (timestamptz)

### products
- `id` (uuid, PK)
- `printify_id` (text, unique, nullable)
- `title` (text, not null)
- `description` (text)
- `category_id` (uuid, FK → categories)
- `price` (numeric(10,2))
- `cost` (numeric(10,2))
- `image_url` (text)
- `images` (jsonb)
- `status` (text) — 'active' | 'draft' | 'archived'
- `featured` (boolean, default false)
- `print_provider_id` (text, nullable)
- `blueprint_id` (text, nullable)
- `variants` (jsonb) — Printify variant data
- `shipping_info` (jsonb)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### orders
- `id` (uuid, PK)
- `printify_order_id` (text, nullable)
- `stripe_session_id` (text, nullable)
- `stripe_payment_intent_id` (text, nullable)
- `email` (text, not null)
- `shipping_name` (text, not null)
- `shipping_address` (jsonb, not null)
- `shipping_method` (text, nullable)
- `shipping_cost` (numeric(10,2), default 0)
- `subtotal` (numeric(10,2), not null)
- `total` (numeric(10,2), not null)
- `currency` (text, default 'USD')
- `status` (text)
- `fulfillment_status` (text, nullable)
- `tracking_number` (text, nullable)
- `tracking_url` (text, nullable)
- `items` (jsonb, not null)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### settings
- `id` (uuid, PK, single row)
- `store_name`, `tagline`, `hero_image_url`, `hero_title`, `hero_subtitle`
- `announcement`, `announcement_active`
- `shipping_free_threshold`, `default_shipping_cost`
- `printify_connected`, `stripe_connected`
- `updated_at` (timestamptz)

## Security
- All tables have RLS enabled.
- Public tables (categories, products, settings): anon+authenticated can SELECT; only authenticated admins can INSERT/UPDATE/DELETE.
- Orders: anyone can INSERT (checkout); only admins can SELECT/UPDATE/DELETE.
- Admins: authenticated users can SELECT their own row; super_admins can INSERT/DELETE.

## Important Notes
1. Settings table is seeded with a single default row.
2. Sample categories and products are seeded for initial storefront display.
3. The admins table is created first because other table policies reference it.
*/

-- ============ ADMINS (must be first — policies on other tables reference it) ============
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_admins" ON admins;
CREATE POLICY "auth_read_admins" ON admins FOR SELECT
  TO authenticated USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM admins a WHERE a.id = auth.uid() AND a.role = 'super_admin'
  ));

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

-- ============ CUSTOMER PROFILES ============
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

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
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
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_delete_categories" ON categories;
CREATE POLICY "admin_delete_categories" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  printify_id text UNIQUE,
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  price numeric(10,2) NOT NULL,
  cost numeric(10,2) DEFAULT 0,
  image_url text,
  images jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  featured boolean NOT NULL DEFAULT false,
  is_personalizable boolean NOT NULL DEFAULT false,
  is_new_arrival boolean NOT NULL DEFAULT false,
  is_trending boolean NOT NULL DEFAULT false,
  is_bestseller boolean NOT NULL DEFAULT false,
  is_on_sale boolean NOT NULL DEFAULT false,
  content_locked boolean NOT NULL DEFAULT false,
  personalization_label text,
  print_provider_id text,
  blueprint_id text,
  variants jsonb DEFAULT '[]'::jsonb,
  shipping_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
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
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_delete_products" ON products;
CREATE POLICY "admin_delete_products" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  printify_order_id text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  email text NOT NULL,
  shipping_name text NOT NULL,
  shipping_address jsonb NOT NULL,
  shipping_method text,
  shipping_cost numeric(10,2) DEFAULT 0,
  subtotal numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  fulfillment_status text,
  tracking_number text,
  tracking_url text,
  items jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
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
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_delete_orders" ON orders;
CREATE POLICY "admin_delete_orders" ON orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- ============ SETTINGS ============
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'Your Store',
  tagline text DEFAULT 'Wear Your Heritage',
  footer_text text DEFAULT 'Made-to-order apparel designed for every body, every style, and every day. Wear what feels like you.',
  footer_bottom_message text DEFAULT 'Made to order. Made with love.',
  footer_logo_url text,
  footer_logo_size numeric DEFAULT 40,
  about_settings jsonb,
  affirmations_settings jsonb,
  new_arrivals_settings jsonb,
  brand_values_settings jsonb,
  hero_image_url text,
  hero_title text,
  hero_subtitle text,
  hero_object_position text DEFAULT 'center',
  hero_height_vh integer DEFAULT 80,
  hero_image_flip boolean DEFAULT false,
  hero_image_scale integer DEFAULT 100,
  hero_gradient_opacity integer DEFAULT 70,
  hero_gradient_dir text DEFAULT 'left',
  hero_image_fit text DEFAULT 'cover',
  our_why_image_url text,
  our_why_object_position text DEFAULT 'center',
  our_why_height_vh integer DEFAULT 60,
  story_image_url text,
  story_object_position text DEFAULT 'center',
  announcement text,
  announcement_active boolean DEFAULT true,
  promo_banner_active boolean DEFAULT false,
  promo_banner_title text,
  promo_banner_body text,
  promo_banner_cta_label text,
  promo_banner_cta_url text,
  promo_banner_bg_color text DEFAULT '#1a1a1a',
  promo_banner_max_shows integer DEFAULT 2,
  shipping_free_threshold numeric DEFAULT 75,
  default_shipping_cost numeric DEFAULT 6.99,
  printify_connected boolean DEFAULT false,
  printify_shop_id text,
  stripe_connected boolean DEFAULT false,
  stripe_mode text NOT NULL DEFAULT 'test',
  stripe_live_secret_key text,
  stripe_live_webhook_secret text,
  stripe_test_secret_key text,
  stripe_test_webhook_secret text,
  newsletter_group_id text,
  popup_settings jsonb,
  orders_paused boolean DEFAULT false,
  site_menu_settings jsonb,
  social_links jsonb,
  logo_url text,
  logo_size numeric DEFAULT 40,
  singleton boolean UNIQUE DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_settings" ON settings;
CREATE POLICY "public_read_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_settings" ON settings;
CREATE POLICY "admin_update_settings" ON settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- ============ SEED DATA ============

INSERT INTO categories (name, slug, description) VALUES
  ('T-Shirts', 't-shirts', 'Premium tees with culturally inspired designs'),
  ('Hoodies', 'hoodies', 'Comfortable hoodies for every season'),
  ('Hats', 'hats', 'Caps and headwear to complete your look'),
  ('Sweatpants', 'sweatpants', 'Matching bottoms for your streetwear sets'),
  ('Accessories', 'accessories', 'Tote bags, stickers, and more')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO settings (store_name, tagline, hero_title, hero_subtitle, hero_image_url, announcement, announcement_active)
VALUES (
  'Your Store',
  'Wear Your Heritage',
  'Culture. Style. Heritage.',
  'Premium apparel celebrating Black culture, designed by us, printed on demand, shipped to your door.',
  'https://images.pexels.com/photos/858117/pexels-photo-858117.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'Free shipping on orders over $75 — Celebrate Black excellence every day',
  true
)
ON CONFLICT DO NOTHING;

INSERT INTO products (title, description, category_id, price, cost, image_url, images, status, featured, variants) VALUES
  (
    'Heritage Crown Tee',
    'A statement piece celebrating the richness of Black heritage. Crafted from premium cotton for all-day comfort.',
    (SELECT id FROM categories WHERE slug = 't-shirts'),
    29.99, 12.50,
    'https://images.pexels.com/photos/33258841/pexels-photo-33258841.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/33258841/pexels-photo-33258841.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/35625406/pexels-photo-35625406.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', true,
    '[{"id":"S","label":"Small","color":"Black","price":29.99},{"id":"M","label":"Medium","color":"Black","price":29.99},{"id":"L","label":"Large","color":"Black","price":29.99},{"id":"XL","label":"X-Large","color":"Black","price":29.99},{"id":"2XL","label":"2X-Large","color":"Black","price":29.99}]'::jsonb
  ),
  (
    'Urban Pride Hoodie',
    'Stay warm and stylish with this premium hoodie featuring bold cultural designs. Perfect for year-round wear.',
    (SELECT id FROM categories WHERE slug = 'hoodies'),
    29.99, 22.00,
    'https://images.pexels.com/photos/18016399/pexels-photo-18016399.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/18016399/pexels-photo-18016399.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/6311644/pexels-photo-6311644.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', true,
    '[{"id":"S","label":"Small","color":"Black","price":29.99},{"id":"M","label":"Medium","color":"Black","price":29.99},{"id":"L","label":"Large","color":"Black","price":29.99},{"id":"XL","label":"X-Large","color":"Black","price":29.99},{"id":"2XL","label":"2X-Large","color":"Black","price":29.99}]'::jsonb
  ),
  (
    'Street Culture Cap',
    'A classic cap with a modern twist. Adjustable fit, premium embroidery, designed for the culture.',
    (SELECT id FROM categories WHERE slug = 'hats'),
    28.00, 8.50,
    'https://images.pexels.com/photos/13447017/pexels-photo-13447017.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/13447017/pexels-photo-13447017.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/16234507/pexels-photo-16234507.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', true,
    '[{"id":"OS","label":"One Size","color":"Black","price":28.00},{"id":"OS","label":"One Size","color":"White","price":28.00}]'::jsonb
  ),
  (
    'Movement Sweatpants',
    'Premium joggers designed for comfort and style. Features a tapered fit with cultural accent detailing.',
    (SELECT id FROM categories WHERE slug = 'sweatpants'),
    29.99, 18.00,
    'https://images.pexels.com/photos/6311619/pexels-photo-6311619.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/6311619/pexels-photo-6311619.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/25457430/pexels-photo-25457430.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', true,
    '[{"id":"S","label":"Small","color":"Black","price":29.99},{"id":"M","label":"Medium","color":"Black","price":29.99},{"id":"L","label":"Large","color":"Black","price":29.99},{"id":"XL","label":"X-Large","color":"Black","price":29.99}]'::jsonb
  ),
  (
    'Roots & Culture Tee',
    'A tribute to the roots that ground us. Lightweight, breathable, and perfect for making a statement.',
    (SELECT id FROM categories WHERE slug = 't-shirts'),
    29.99, 12.50,
    'https://images.pexels.com/photos/8794470/pexels-photo-8794470.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/8794470/pexels-photo-8794470.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', true,
    '[{"id":"S","label":"Small","color":"White","price":29.99},{"id":"M","label":"Medium","color":"White","price":29.99},{"id":"L","label":"Large","color":"White","price":29.99},{"id":"XL","label":"X-Large","color":"White","price":29.99}]'::jsonb
  ),
  (
    'Night City Hoodie',
    'Effortless style meets cultural pride. This hoodie features a relaxed fit and premium fleece interior.',
    (SELECT id FROM categories WHERE slug = 'hoodies'),
    29.99, 22.00,
    'https://images.pexels.com/photos/7061864/pexels-photo-7061864.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/7061864/pexels-photo-7061864.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","https://images.pexels.com/photos/7061927/pexels-photo-7061927.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', false,
    '[{"id":"S","label":"Small","color":"Gray","price":29.99},{"id":"M","label":"Medium","color":"Gray","price":29.99},{"id":"L","label":"Large","color":"Gray","price":29.99},{"id":"XL","label":"X-Large","color":"Gray","price":29.99}]'::jsonb
  ),
  (
    'Pineapple Vibes Hoodie',
    'Fun, fresh, and full of personality. A standout hoodie for those who lead with joy.',
    (SELECT id FROM categories WHERE slug = 'hoodies'),
    29.99, 22.00,
    'https://images.pexels.com/photos/859058/pexels-photo-859058.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/859058/pexels-photo-859058.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', false,
    '[{"id":"S","label":"Small","color":"Green","price":29.99},{"id":"M","label":"Medium","color":"Green","price":29.99},{"id":"L","label":"Large","color":"Green","price":29.99}]'::jsonb
  ),
  (
    'Classic Black Tee',
    'The essential black tee. Clean, versatile, and always in style.',
    (SELECT id FROM categories WHERE slug = 't-shirts'),
    25.00, 12.50,
    'https://images.pexels.com/photos/35625406/pexels-photo-35625406.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/35625406/pexels-photo-35625406.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', false,
    '[{"id":"S","label":"Small","color":"Black","price":25.00},{"id":"M","label":"Medium","color":"Black","price":25.00},{"id":"L","label":"Large","color":"Black","price":25.00},{"id":"XL","label":"X-Large","color":"Black","price":25.00}]'::jsonb
  ),
  (
    'Statement Royal Tee',
    'Bold design meets premium quality. This tee makes a statement without saying a word.',
    (SELECT id FROM categories WHERE slug = 't-shirts'),
    29.99, 12.50,
    'https://images.pexels.com/photos/34433423/pexels-photo-34433423.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/34433423/pexels-photo-34433423.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', false,
    '[{"id":"S","label":"Small","color":"White","price":29.99},{"id":"M","label":"Medium","color":"White","price":29.99},{"id":"L","label":"Large","color":"White","price":29.99}]'::jsonb
  ),
  (
    'Streetwear Set Hat',
    'Complete your look with this premium adjustable cap. Minimal design, maximum impact.',
    (SELECT id FROM categories WHERE slug = 'hats'),
    26.00, 8.50,
    'https://images.pexels.com/photos/33882157/pexels-photo-33882157.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    '["https://images.pexels.com/photos/33882157/pexels-photo-33882157.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"]'::jsonb,
    'active', false,
    '[{"id":"OS","label":"One Size","color":"Black","price":26.00}]'::jsonb
  )
ON CONFLICT (printify_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-images',
  'store-images',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_store_images" ON storage.objects;
CREATE POLICY "public_read_store_images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-images');

DROP POLICY IF EXISTS "admin_upload_store_images" ON storage.objects;
CREATE POLICY "admin_upload_store_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-images' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

DROP POLICY IF EXISTS "admin_update_store_images" ON storage.objects;
CREATE POLICY "admin_update_store_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store-images' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_store_images" ON storage.objects;
CREATE POLICY "admin_delete_store_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store-images' AND EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));
