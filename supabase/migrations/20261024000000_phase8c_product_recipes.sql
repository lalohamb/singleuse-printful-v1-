-- Phase 8C: Product Recipe System
--
-- product_recipes: reusable merchandising/manufacturing templates.
-- A recipe is NOT a product. It resolves INTO a ProductSpecification
-- which the Product Creation Engine uses to create a catalog_builder product.
--
-- Recipes do NOT store:
--   - Stripe information
--   - Order information
--   - fulfillment_snapshot
--   - store variant UUIDs (those are created by the engine at generation time)

CREATE TABLE IF NOT EXISTS product_recipes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  slug                text NOT NULL,
  description         text,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','active','archived')),
  provider            text NOT NULL DEFAULT 'printful',

  -- Provider manufacturing configuration
  printful_catalog_id integer NOT NULL,
  technique           text NOT NULL,
  placement           text NOT NULL,
  printfile_id        integer,

  -- Variant selection rules (colors, sizes, exclusions)
  -- Does NOT store store variant UUIDs — those are created at generation time
  variant_rules       jsonb NOT NULL DEFAULT '{}',

  -- Pricing strategy: FIXED_PRICE or COST_PLUS
  pricing_rules       jsonb NOT NULL DEFAULT '{}',

  -- Mockup generation preferences
  mockup_rules        jsonb NOT NULL DEFAULT '{}',

  -- Default commercial fields (overridable at generation time)
  commercial_defaults jsonb NOT NULL DEFAULT '{}',

  -- Default publication state for generated products
  publication_default text NOT NULL DEFAULT 'draft'
                        CHECK (publication_default IN ('draft','active')),

  -- Arbitrary metadata (tags, notes, etc.)
  metadata            jsonb NOT NULL DEFAULT '{}',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_recipes_slug_unique ON product_recipes (slug);
CREATE INDEX IF NOT EXISTS idx_product_recipes_status ON product_recipes (status);
CREATE INDEX IF NOT EXISTS idx_product_recipes_catalog_id ON product_recipes (printful_catalog_id);

-- Add recipe traceability to products
-- recipe_id: which recipe generated this product (nullable — not all products come from recipes)
-- recipe_version: snapshot of recipe slug+updated_at at generation time (for audit trail)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES product_recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipe_version text;

CREATE INDEX IF NOT EXISTS idx_products_recipe_id ON products (recipe_id)
  WHERE recipe_id IS NOT NULL;

-- Comment: recipe_id is informational only.
-- Fulfillment NEVER reads recipe at runtime — it reads the frozen fulfillment_snapshot.
-- Changing a recipe does NOT affect existing products or their snapshots.
