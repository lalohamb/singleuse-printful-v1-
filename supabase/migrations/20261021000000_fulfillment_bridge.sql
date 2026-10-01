-- Phase 5.1: Catalog Builder Fulfillment Bridge
--
-- Adds fulfillment tracking columns to orders table.
--
-- fulfillment_snapshot: JSONB column on orders that stores the immutable
--   per-item manufacturing configuration frozen at checkout time.
--   Keyed by store_variant_id. Webhook retries use this snapshot — never
--   re-resolve from the current product state.
--
-- printful_fulfillment_status: separate from orders.status (payment state).
--   Tracks Printful-side fulfillment independently of Stripe payment state.
--
-- fulfillment_provider: records which provider handled fulfillment.
--
-- These columns are nullable for backward compatibility with existing orders
-- created before Phase 5.1.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_snapshot    jsonb,
  ADD COLUMN IF NOT EXISTS printful_fulfillment_status text,
  ADD COLUMN IF NOT EXISTS fulfillment_provider    text;

-- Index for admin fulfillment status queries
CREATE INDEX IF NOT EXISTS idx_orders_printful_fulfillment_status
  ON orders (printful_fulfillment_status)
  WHERE printful_fulfillment_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_provider
  ON orders (fulfillment_provider)
  WHERE fulfillment_provider IS NOT NULL;
