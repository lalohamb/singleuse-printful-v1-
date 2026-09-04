-- Curation flags + content lock for products.
--
-- These columns are all local (storefront curation) concerns. Printify has no
-- categories/collections concept, so categorization and badges live here.
--
-- Safe across Printify re-sync: the printify-proxy /sync upsert payload does
-- NOT include any of these columns, so Postgres upsert leaves them untouched.
-- content_locked additionally tells the sync to preserve admin-edited
-- title/description/image for that product.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_new_arrival boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trending    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bestseller  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_on_sale     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_locked boolean NOT NULL DEFAULT false;

-- Partial indexes: the storefront only queries WHERE <flag> = true, so partial
-- indexes stay tiny and match the query predicate. content_locked gets no index
-- (it is only read via a full-table prefetch inside the sync).
CREATE INDEX IF NOT EXISTS idx_products_new_arrival ON products(is_new_arrival) WHERE is_new_arrival;
CREATE INDEX IF NOT EXISTS idx_products_trending    ON products(is_trending)    WHERE is_trending;
CREATE INDEX IF NOT EXISTS idx_products_bestseller  ON products(is_bestseller)  WHERE is_bestseller;
CREATE INDEX IF NOT EXISTS idx_products_on_sale     ON products(is_on_sale)     WHERE is_on_sale;
