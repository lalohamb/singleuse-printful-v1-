-- Phase 3: Storefront Catalog Foundation
-- Adds store-owned catalog fields to products.
-- Fixes public RLS to exclude non-active products.
-- Does NOT drop any existing columns.

-- ── New catalog columns ───────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug               text,
  ADD COLUMN IF NOT EXISTS short_description  text,
  ADD COLUMN IF NOT EXISTS meta_title         text,
  ADD COLUMN IF NOT EXISTS meta_description   text,
  ADD COLUMN IF NOT EXISTS compare_at_price   numeric(10,2),
  ADD COLUMN IF NOT EXISTS brand              text,
  ADD COLUMN IF NOT EXISTS product_type       text,
  ADD COLUMN IF NOT EXISTS published_at       timestamptz,
  ADD COLUMN IF NOT EXISTS display_order      integer NOT NULL DEFAULT 0;

-- ── Slug uniqueness ───────────────────────────────────────────────────────────
-- Partial: only enforce uniqueness on non-null slugs.
-- Allows products to be created without a slug (draft state).
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_slug
  ON products (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_slug
  ON products (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_display_order
  ON products (display_order, created_at DESC);

-- ── Backfill slugs for existing products ─────────────────────────────────────
-- Generates URL-safe slugs from title.
-- Handles duplicates by appending -2, -3, etc.
DO $$
DECLARE
  r         RECORD;
  base_slug text;
  candidate text;
  counter   int;
BEGIN
  FOR r IN
    SELECT id, title FROM products WHERE slug IS NULL ORDER BY created_at
  LOOP
    -- lowercase, replace non-alphanumeric runs with hyphen, trim hyphens
    base_slug := regexp_replace(
                   regexp_replace(lower(r.title), '[^a-z0-9]+', '-', 'g'),
                   '^-+|-+$', '', 'g'
                 );
    candidate := base_slug;
    counter   := 2;
    -- find a unique candidate
    WHILE EXISTS (SELECT 1 FROM products WHERE slug = candidate) LOOP
      candidate := base_slug || '-' || counter;
      counter   := counter + 1;
    END LOOP;
    UPDATE products SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- ── Set published_at for currently active products ────────────────────────────
UPDATE products
SET published_at = COALESCE(updated_at, created_at, now())
WHERE status = 'active' AND published_at IS NULL;

-- ── Fix public RLS: only expose active products to anon/authenticated ─────────
-- The original policy exposed ALL products including drafts and archived.
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- Admins need to see all products (including draft/archived) for management.
DROP POLICY IF EXISTS "admin_read_all_products" ON products;
CREATE POLICY "admin_read_all_products" ON products
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));
