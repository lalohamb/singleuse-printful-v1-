-- =============================================================================
-- Remove duplicate settings rows, keep only the oldest (first inserted).
-- Then enforce a single-row constraint via a unique index on a constant.
-- =============================================================================

-- Delete all but the oldest settings row
DELETE FROM settings
WHERE id NOT IN (
  SELECT id FROM settings ORDER BY updated_at ASC LIMIT 1
);

-- Prevent future duplicates: add a constant column locked to a single value
ALTER TABLE settings ADD COLUMN IF NOT EXISTS singleton boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS settings_singleton ON settings (singleton);
