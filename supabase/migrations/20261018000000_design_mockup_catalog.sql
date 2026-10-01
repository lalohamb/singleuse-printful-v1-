-- Phase 4: Design & Mockup Catalog Foundation
-- Creates: designs, product_designs, product_images, mockup_tasks
-- Creates: store-images storage bucket with policies
-- Does NOT modify: products, product_variants, orders, categories

-- ── designs ──────────────────────────────────────────────────────────────────
-- Reusable creative artwork. One design can be used on many products.
-- Identity is the UUID — artwork file can be replaced without changing identity.

CREATE TABLE IF NOT EXISTS designs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text,
  description   text,
  artwork_url   text NOT NULL,
  storage_path  text NOT NULL,
  file_name     text,
  file_type     text,
  file_size     bigint,
  width         integer,
  height        integer,
  status        text NOT NULL DEFAULT 'active',
  tags          text[] DEFAULT '{}',
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_designs_slug
  ON designs (slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_designs_status ON designs (status);
CREATE INDEX IF NOT EXISTS idx_designs_created_at ON designs (created_at DESC);

ALTER TABLE designs ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "admin_all_designs" ON designs;
CREATE POLICY "admin_all_designs" ON designs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Public: no direct access to designs table needed
-- (artwork URLs are public via Storage; design metadata is admin-only)

-- ── product_designs ───────────────────────────────────────────────────────────
-- Relationship: store product + design + print configuration.
-- One product can have multiple designs (front, back, sleeve, etc.).
-- One design can be used on multiple products.

CREATE TABLE IF NOT EXISTS product_designs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  design_id         uuid NOT NULL REFERENCES designs(id) ON DELETE RESTRICT,
  provider          text NOT NULL DEFAULT 'printful',
  placement         text NOT NULL,
  technique         text,
  printfile_id      text,
  is_primary        boolean NOT NULL DEFAULT false,
  needs_regeneration boolean NOT NULL DEFAULT false,
  configuration     jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_designs_product_id ON product_designs (product_id);
CREATE INDEX IF NOT EXISTS idx_product_designs_design_id ON product_designs (design_id);

ALTER TABLE product_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_product_designs" ON product_designs;
CREATE POLICY "admin_all_product_designs" ON product_designs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- ── mockup_tasks ──────────────────────────────────────────────────────────────
-- Persistent async task tracking for Printful mockup generation.
-- Allows recovery if browser closes during polling.

CREATE TABLE IF NOT EXISTS mockup_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_design_id uuid REFERENCES product_designs(id) ON DELETE SET NULL,
  provider          text NOT NULL DEFAULT 'printful',
  provider_task_key text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  error_message     text,
  created_at        timestamptz DEFAULT now(),
  completed_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mockup_tasks_provider_key
  ON mockup_tasks (provider, provider_task_key);

CREATE INDEX IF NOT EXISTS idx_mockup_tasks_product_id ON mockup_tasks (product_id);
CREATE INDEX IF NOT EXISTS idx_mockup_tasks_status ON mockup_tasks (status);

ALTER TABLE mockup_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_mockup_tasks" ON mockup_tasks;
CREATE POLICY "admin_all_mockup_tasks" ON mockup_tasks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- ── product_images ────────────────────────────────────────────────────────────
-- Normalized persistent storefront product imagery.
-- Preferred over products.images JSONB for new images.
-- products.images JSONB retained as fallback.

CREATE TABLE IF NOT EXISTS product_images (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id  uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  source              text NOT NULL DEFAULT 'manual',
  storage_path        text,
  image_url           text NOT NULL,
  alt_text            text,
  is_primary          boolean NOT NULL DEFAULT false,
  display_order       integer NOT NULL DEFAULT 0,
  mockup_task_key     text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images (product_id, display_order);
CREATE INDEX IF NOT EXISTS idx_product_images_primary
  ON product_images (product_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_product_images_variant
  ON product_images (product_variant_id) WHERE product_variant_id IS NOT NULL;

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Public can read product images (needed for storefront display)
DROP POLICY IF EXISTS "public_read_product_images" ON product_images;
CREATE POLICY "public_read_product_images" ON product_images
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id AND p.status = 'active'
    )
  );

-- Admins can manage all product images
DROP POLICY IF EXISTS "admin_all_product_images" ON product_images;
CREATE POLICY "admin_all_product_images" ON product_images
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- Create the store-images bucket (public reads, admin writes).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-images',
  'store-images',
  true,
  52428800,  -- 50 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read (bucket is public, but explicit policy for clarity)
DROP POLICY IF EXISTS "store_images_public_read" ON storage.objects;
CREATE POLICY "store_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-images');

-- Storage RLS: admin upload
DROP POLICY IF EXISTS "store_images_admin_insert" ON storage.objects;
CREATE POLICY "store_images_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-images'
    AND EXISTS (SELECT 1 FROM public.admins WHERE admins.id = auth.uid())
  );

-- Storage RLS: admin update
DROP POLICY IF EXISTS "store_images_admin_update" ON storage.objects;
CREATE POLICY "store_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-images'
    AND EXISTS (SELECT 1 FROM public.admins WHERE admins.id = auth.uid())
  );

-- Storage RLS: admin delete
DROP POLICY IF EXISTS "store_images_admin_delete" ON storage.objects;
CREATE POLICY "store_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-images'
    AND EXISTS (SELECT 1 FROM public.admins WHERE admins.id = auth.uid())
  );
