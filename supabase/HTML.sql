UPDATE products
SET description = regexp_replace(
  regexp_replace(description, '<[^>]*>', ' ', 'g'),
  '\s+', ' ', 'g'
)
WHERE description ~ '<[^>]';
