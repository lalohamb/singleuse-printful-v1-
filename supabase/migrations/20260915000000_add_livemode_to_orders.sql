ALTER TABLE orders ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_orders_livemode ON orders(livemode);
