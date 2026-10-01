-- Migration: Printify → Printful
ALTER TABLE products
  DROP COLUMN IF EXISTS printify_id,
  DROP COLUMN IF EXISTS blueprint_id,
  DROP COLUMN IF EXISTS print_provider_id,
  ADD COLUMN IF NOT EXISTS printful_id text UNIQUE;

ALTER TABLE orders
  DROP COLUMN IF EXISTS printify_order_id,
  ADD COLUMN IF NOT EXISTS printful_order_id text;

ALTER TABLE settings
  DROP COLUMN IF EXISTS printify_connected,
  DROP COLUMN IF EXISTS printify_shop_id,
  ADD COLUMN IF NOT EXISTS printful_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printful_store_id text;
