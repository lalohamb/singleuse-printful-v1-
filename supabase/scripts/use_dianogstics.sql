-- Count by table
SELECT 'products' as tbl, count(*) FROM products
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'admins', count(*) FROM admins
UNION ALL SELECT 'categories', count(*) FROM categories;

-- Recent activity
SELECT id, email, status, livemode, total, created_at FROM orders ORDER BY created_at DESC LIMIT 10;

-- Orders with Printify fulfillment
SELECT id, printify_order_id, fulfillment_status, tracking_number FROM orders WHERE printify_order_id IS NOT NULL;
