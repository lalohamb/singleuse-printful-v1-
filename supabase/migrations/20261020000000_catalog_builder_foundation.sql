-- Phase 5: Storefront Catalog Builder
-- Adds products.catalog_source to distinguish product origin.
--
-- catalog_source values:
--   'printful_sync'     — created/managed by Printful store sync (existing behavior)
--   'catalog_builder'   — created by the Storefront Catalog Builder (Phase 5)
--   'manual'            — created manually by admin (existing behavior)
--
-- This field is used by the sync to avoid archiving non-sync products.
-- It is also used by the admin UI to show product origin.
--
-- Nullable for backward compatibility — existing products without a value
-- are treated as 'printful_sync' if they have printful_id, else 'manual'.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS catalog_source text;

-- Backfill existing products:
--   Has printful_id → printful_sync
--   No printful_id  → manual
UPDATE products
SET catalog_source = CASE
  WHEN printful_id IS NOT NULL THEN 'printful_sync'
  ELSE 'manual'
END
WHERE catalog_source IS NULL;

-- Index for sync isolation query (only archive printful_sync products)
CREATE INDEX IF NOT EXISTS idx_products_catalog_source
  ON products (catalog_source)
  WHERE catalog_source IS NOT NULL;
