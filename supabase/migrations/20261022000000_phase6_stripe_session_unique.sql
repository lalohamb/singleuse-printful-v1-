-- Phase 6: Production Readiness — stripe_session_id uniqueness
--
-- Enforces ONE local order per Stripe Checkout Session at the DB layer.
-- This is the strongest practical guard against duplicate order creation
-- from concurrent webhook deliveries or Stripe retries.
--
-- Safety check: scan for existing duplicates before adding constraint.
-- If duplicates exist, the constraint will fail and must be resolved manually.
--
-- stripe_session_id is nullable (orders created before Stripe session existed
-- in the schema, or manually inserted test rows). NULL values are excluded
-- from uniqueness enforcement by standard SQL semantics.

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT stripe_session_id
    FROM orders
    WHERE stripe_session_id IS NOT NULL
    GROUP BY stripe_session_id
    HAVING COUNT(*) > 1
  ) dupes;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE constraint on orders.stripe_session_id: % duplicate session ID(s) found. '
      'Resolve duplicates manually before re-running this migration.',
      dup_count;
  END IF;
END $$;

-- Add unique constraint (NULLs are not considered duplicates in PostgreSQL)
ALTER TABLE orders
  ADD CONSTRAINT orders_stripe_session_id_unique UNIQUE (stripe_session_id);

-- Index already implied by the constraint, but add explicit partial index
-- for fast lookup of non-null session IDs used in webhook recovery.
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id
  ON orders (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- Index for fast admin queries on needs_admin_review and failed fulfillment
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status
  ON orders (fulfillment_status)
  WHERE fulfillment_status IS NOT NULL;

-- Index for paid orders missing printful_order_id (admin attention queue)
CREATE INDEX IF NOT EXISTS idx_orders_paid_no_printful
  ON orders (status, printful_order_id)
  WHERE status = 'paid' AND printful_order_id IS NULL;
