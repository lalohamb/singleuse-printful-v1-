-- Phase 4 Live Verification Fix: prevent duplicate product_images rows
-- for the same mockup task + storage path combination.
-- Discovered during live idempotency test: the persist route's application-level
-- deduplication check is insufficient without a DB constraint.

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_mockup_storage
  ON product_images (product_id, mockup_task_key, storage_path)
  WHERE mockup_task_key IS NOT NULL AND storage_path IS NOT NULL;
