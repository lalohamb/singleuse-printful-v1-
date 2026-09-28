-- Migration: Add Printful support alongside Printify
-- Safe to run on a live database — only adds nullable columns with defaults.
-- No existing rows, queries, or RLS policies are affected.

-- ── products table ────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fulfillment_provider text NOT NULL DEFAULT 'printify',
  ADD COLUMN IF NOT EXISTS printful_id          text UNIQUE;

-- Backfill existing rows
UPDATE products SET fulfillment_provider = 'printify' WHERE printify_id IS NOT NULL;
UPDATE products SET fulfillment_provider = 'manual'   WHERE printify_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_printful_id ON products (printful_id)
  WHERE printful_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_fulfillment_provider ON products (fulfillment_provider);

-- ── orders table ──────────────────────────────────────────────────────────────
-- Stores the Printful order ID after fulfillment (mirrors printify_order_id).
-- Also adds printful_tracking_* so mixed-cart orders can show two shipments.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS printful_order_id       text,
  ADD COLUMN IF NOT EXISTS printful_tracking_number text,
  ADD COLUMN IF NOT EXISTS printful_tracking_url    text,
  ADD COLUMN IF NOT EXISTS printful_fulfillment_status text;

-- ── settings table ────────────────────────────────────────────────────────────

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS printful_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printful_store_id  text;
