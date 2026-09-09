-- View all orders
SELECT id, email, shipping_name, status, livemode, total, created_at FROM orders ORDER BY created_at DESC;

-- View live orders only
SELECT id, email, status, total, created_at FROM orders WHERE livemode = true ORDER BY created_at DESC;

-- View test orders only
SELECT id, email, status, total, created_at FROM orders WHERE livemode = false ORDER BY created_at DESC;

-- View orders by status
SELECT id, email, status, total FROM orders WHERE status = 'paid';

-- Delete a single test order
DELETE FROM orders WHERE id = '<uuid>' AND livemode = false;

-- Delete all test orders
DELETE FROM orders WHERE livemode = false;

-- Update order status
UPDATE orders SET status = 'shipped', updated_at = now() WHERE id = '<uuid>';

-- Backfill livemode for test orders
UPDATE orders SET livemode = false WHERE stripe_session_id ILIKE '%cs_test%';
