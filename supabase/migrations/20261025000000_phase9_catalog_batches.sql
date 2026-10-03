-- Phase 9: Batch Catalog Generator
-- Creates catalog_batches and catalog_batch_items tables.
-- Adds batch_id to products for traceability.

-- ── catalog_batches ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_batches (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  status                   text NOT NULL DEFAULT 'draft'
                             CHECK (status IN (
                               'draft','planning','validated','ready',
                               'generating','processing','review',
                               'completed','failed','cancelled'
                             )),
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  approved_at              timestamptz,
  generation_started_at    timestamptz,
  generation_completed_at  timestamptz,
  metadata                 jsonb NOT NULL DEFAULT '{}'
);

-- ── catalog_batch_items ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_batch_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                uuid NOT NULL REFERENCES catalog_batches(id) ON DELETE CASCADE,
  design_id               uuid NOT NULL,
  recipe_id               uuid NOT NULL,
  recipe_version          text,
  design_file_hash        text,
  design_artwork_url      text,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending','resolving','resolved',
                              'validated','approved',
                              'generating','generated',
                              'mockup_queued','mockup_processing','mockup_complete',
                              'needs_mockup_retry',
                              'review','published',
                              'fail','stale_recipe','stale_design',
                              'cancelled'
                            )),
  validation_class        text CHECK (validation_class IN ('PASS','WARNING','FAIL')),
  commercial_inputs       jsonb NOT NULL DEFAULT '{}',
  resolved_specification  jsonb,
  validation_result       jsonb,
  dry_run_result          jsonb,
  generated_product_id    uuid,
  idempotency_key         text UNIQUE,
  error_message           text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON catalog_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_status   ON catalog_batch_items(status);
CREATE INDEX IF NOT EXISTS idx_batch_items_design   ON catalog_batch_items(design_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_recipe   ON catalog_batch_items(recipe_id);

-- ── products.batch_id ─────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES catalog_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_batch_id ON products(batch_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE catalog_batches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_batch_items  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; admin API routes use service role key.
-- No public access.
CREATE POLICY "admin_only_batches"
  ON catalog_batches FOR ALL
  USING (false);

CREATE POLICY "admin_only_batch_items"
  ON catalog_batch_items FOR ALL
  USING (false);
