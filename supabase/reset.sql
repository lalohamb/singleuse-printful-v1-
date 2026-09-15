-- =============================================================================
-- Gender Apparel — Reset Script
-- Clears all transactional/product data for a fresh install.
-- Preserves: settings row, categories, seo_settings, admins.
-- Run in Supabase SQL Editor.
-- =============================================================================

-- Orders
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;

-- Customer profiles (Auth users remain in Supabase Auth)
TRUNCATE TABLE customer_profiles RESTART IDENTITY CASCADE;

-- Products (all of them — Printify sync will repopulate)
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

-- Reset Printify connection flags on settings (keep all other settings intact)
UPDATE settings SET
  printify_connected = false,
  printify_shop_id   = null,
  stripe_connected   = false,
  updated_at         = now();

-- Confirm what remains
SELECT 'orders'      AS "table", COUNT(*) AS rows FROM orders
UNION ALL
SELECT 'customer_profiles',       COUNT(*)         FROM customer_profiles
UNION ALL
SELECT 'products',                COUNT(*)         FROM products
UNION ALL
SELECT 'categories',              COUNT(*)         FROM categories
UNION ALL
SELECT 'settings',                COUNT(*)         FROM settings
UNION ALL
SELECT 'seo_settings',            COUNT(*)         FROM seo_settings
UNION ALL
SELECT 'email_events',            COUNT(*)         FROM email_events
UNION ALL
SELECT 'admins',                  COUNT(*)         FROM admins;
