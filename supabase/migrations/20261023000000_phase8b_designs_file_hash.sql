-- Phase 8B: Add file_hash to designs for duplicate artwork detection.
-- SHA-256 hex digest of the raw file bytes.
-- NOT UNIQUE — existing duplicate records would violate a unique constraint.
-- Duplicate detection is enforced at the application layer (warn + offer existing).

-- Preflight: document existing potential duplicates by file_size+dimensions
-- (3 groups found during Phase 8B audit — see PHASE-8B report)

ALTER TABLE designs ADD COLUMN IF NOT EXISTS file_hash text;

-- Index for fast hash lookup during upload
CREATE INDEX IF NOT EXISTS idx_designs_file_hash ON designs (file_hash)
  WHERE file_hash IS NOT NULL AND status = 'active';
