-- View all categories
SELECT id, name, slug FROM categories ORDER BY name;

-- Add a category
INSERT INTO categories (name, slug, description) VALUES ('Jackets', 'jackets', 'Outerwear collection');

-- Delete a category
DELETE FROM categories WHERE slug = 'jackets';
