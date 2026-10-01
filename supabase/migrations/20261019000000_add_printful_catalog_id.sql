-- Phase 4.1: Provider Identity Hardening
-- Adds products.printful_catalog_id — the Printful CATALOG product ID.
--
-- Identity model after this migration:
--   products.printful_id          = Printful STORE/SYNC product ID  (e.g. 476330305)
--   products.printful_catalog_id  = Printful CATALOG product ID     (e.g. 903)
--   product_variants.printful_variant_id = Printful CATALOG variant ID (e.g. 23178)
--
-- Nullable: manual products, future non-Printful products, and legacy products
-- that have not yet been re-synced may not have a catalog mapping.
--
-- NOT UNIQUE globally: multiple storefront products may use the same Printful
-- blank (e.g. two designs on the same shirt style). A non-unique index is used
-- for lookup performance only.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS printful_catalog_id bigint;

-- Non-unique index: catalog ID lookup for mockup generation and Catalog Builder.
CREATE INDEX IF NOT EXISTS idx_products_printful_catalog_id
  ON products (printful_catalog_id)
  WHERE printful_catalog_id IS NOT NULL;

-- Backfill the verified quarter-zip product.
-- Verified live: products.id = aed80c7d-5f07-495a-8e1a-8ff1ec74726b
--                products.printful_id = 476330305 (store/sync ID)
--                Printful catalog product ID = 903 (from sync_variant.product.product_id)
UPDATE products
SET printful_catalog_id = 903
WHERE printful_id = '476330305'
  AND printful_catalog_id IS NULL;
