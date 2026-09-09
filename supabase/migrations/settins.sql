-- View settings
SELECT * FROM settings LIMIT 1;

-- Update store name / tagline
UPDATE settings SET store_name = 'Body & Sleeves', tagline = 'Black-Owned. Made to Order.' WHERE id = (SELECT id FROM settings LIMIT 1);

-- Toggle announcement bar
UPDATE settings SET announcement_active = true  WHERE id = (SELECT id FROM settings LIMIT 1);
UPDATE settings SET announcement_active = false WHERE id = (SELECT id FROM settings LIMIT 1);

-- Update free shipping threshold
UPDATE settings SET shipping_free_threshold = 75 WHERE id = (SELECT id FROM settings LIMIT 1);

-- Pause orders
UPDATE settings SET orders_paused = true  WHERE id = (SELECT id FROM settings LIMIT 1);
UPDATE settings SET orders_paused = false WHERE id = (SELECT id FROM settings LIMIT 1);
