-- View all products
SELECT id, title, status, featured, printify_id, created_at FROM products ORDER BY created_at DESC;

-- View only active products
SELECT id, title, price, status FROM products WHERE status = 'active';

-- View seed/manual products (no Printify source)
SELECT id, title, created_at FROM products WHERE printify_id IS NULL;

-- View Printify-synced products
SELECT id, title, printify_id FROM products WHERE printify_id IS NOT NULL;

-- Delete a product by ID
DELETE FROM products WHERE id = '<uuid>';

-- Delete all seed/manual products
DELETE FROM products WHERE printify_id IS NULL;

-- Set a product to draft
UPDATE products SET status = 'draft' WHERE id = '<uuid>';

-- Set all products to active
UPDATE products SET status = 'active' WHERE status = 'draft';

-- Toggle featured
UPDATE products SET featured = true WHERE id = '<uuid>';

-- Set curation flags
UPDATE products SET is_new_arrival = true WHERE id = '<uuid>';
UPDATE products SET is_trending    = true WHERE id = '<uuid>';
UPDATE products SET is_bestseller  = true WHERE id = '<uuid>';
UPDATE products SET is_on_sale     = true WHERE id = '<uuid>';
UPDATE products SET content_locked = true WHERE id = '<uuid>';
