-- Reset all Printify-synced products to draft.
-- Products were marked active during manual sync but were never published
-- via the Printify publish handshake. Status should reflect Printify's
-- actual published state. Re-publish from Printify to make them active.
UPDATE products
SET status = 'draft', updated_at = now()
WHERE printify_id IS NOT NULL
  AND status = 'active';
