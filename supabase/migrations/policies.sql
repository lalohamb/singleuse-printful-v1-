-- View all policies
SELECT id, title, length(content) as content_length, updated_at FROM policies;

-- View a specific policy
SELECT content FROM policies WHERE id = 'terms';   -- or 'privacy' or 'refund'
