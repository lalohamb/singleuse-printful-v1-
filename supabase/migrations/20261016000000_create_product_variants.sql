-- Phase 2 Foundation: Store-owned product variants
-- Creates product_variants table with stable store UUIDs.
-- Migrates existing products.variants JSONB into normalized rows.
-- products.variants JSONB is preserved (LEGACY — DO NOT USE FOR NEW CODE).

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_variants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  provider            text NOT NULL DEFAULT 'printful',
  printful_variant_id text,
  label               text NOT NULL DEFAULT '',
  color               text,
  size                text,
  retail_price        numeric(10,2) NOT NULL DEFAULT 0,
  provider_cost       numeric(10,2),
  image_url           text,
  available           boolean NOT NULL DEFAULT true,
  provider_metadata   jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ── Uniqueness ───────────────────────────────────────────────────────────────
-- Prevents duplicate provider mappings for the same product.
-- Allows NULL printful_variant_id for manually created variants.

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_provider_mapping
  ON product_variants (product_id, provider, printful_variant_id)
  WHERE printful_variant_id IS NOT NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- product_id: primary join path from products
-- printful_variant_id: fulfillment lookup
-- provider: future multi-provider queries

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON product_variants (product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_printful_variant_id
  ON product_variants (printful_variant_id)
  WHERE printful_variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_provider
  ON product_variants (provider);

CREATE INDEX IF NOT EXISTS idx_product_variants_available
  ON product_variants (product_id, available);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Public can read available variants (storefront product pages)
DROP POLICY IF EXISTS "public_read_product_variants" ON product_variants;
CREATE POLICY "public_read_product_variants" ON product_variants
  FOR SELECT TO anon, authenticated
  USING (available = true);

-- Admins can read all variants (including unavailable)
DROP POLICY IF EXISTS "admin_read_all_product_variants" ON product_variants;
CREATE POLICY "admin_read_all_product_variants" ON product_variants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Admins can insert
DROP POLICY IF EXISTS "admin_insert_product_variants" ON product_variants;
CREATE POLICY "admin_insert_product_variants" ON product_variants
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Admins can update
DROP POLICY IF EXISTS "admin_update_product_variants" ON product_variants;
CREATE POLICY "admin_update_product_variants" ON product_variants
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Admins can delete
DROP POLICY IF EXISTS "admin_delete_product_variants" ON product_variants;
CREATE POLICY "admin_delete_product_variants" ON product_variants
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- ── Migrate existing JSONB variants ──────────────────────────────────────────
-- For each product with a non-empty variants JSONB array, insert a row into
-- product_variants for each element. Generates a new stable store UUID per
-- variant. Uses ON CONFLICT DO NOTHING so re-running is safe.
-- products.variants JSONB is NOT removed — it remains as LEGACY data.

INSERT INTO product_variants (
  product_id,
  provider,
  printful_variant_id,
  label,
  color,
  size,
  retail_price,
  image_url,
  available
)
SELECT
  p.id                                          AS product_id,
  'printful'                                    AS provider,
  NULLIF(TRIM(v->>'id'), '')                    AS printful_variant_id,
  COALESCE(NULLIF(TRIM(v->>'label'), ''), '')   AS label,
  NULLIF(TRIM(v->>'color'), '')                 AS color,
  NULLIF(TRIM(v->>'size'), '')                  AS size,
  COALESCE((v->>'price')::numeric, p.price, 0) AS retail_price,
  NULLIF(TRIM(v->>'image_url'), '')             AS image_url,
  true                                          AS available
FROM products p,
     jsonb_array_elements(
       CASE
         WHEN jsonb_typeof(p.variants) = 'array' THEN p.variants
         ELSE '[]'::jsonb
       END
     ) AS v
WHERE jsonb_typeof(p.variants) = 'array'
  AND jsonb_array_length(p.variants) > 0
ON CONFLICT DO NOTHING;
