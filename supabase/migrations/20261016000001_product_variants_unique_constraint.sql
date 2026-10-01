-- Replace the partial unique index with a proper unique constraint.
-- PostgREST upsert onConflict requires a named constraint, not just an index.
-- NULLs in printful_variant_id are safe: PostgreSQL treats each NULL as distinct
-- so multiple manually-created variants (null provider ID) never conflict.

-- Drop the partial index first (same name will be reused by the constraint).
DROP INDEX IF EXISTS uq_product_variants_provider_mapping;

-- Add the proper unique constraint targetable by PostgREST.
ALTER TABLE product_variants
  ADD CONSTRAINT uq_product_variants_provider_mapping
  UNIQUE (product_id, provider, printful_variant_id);
