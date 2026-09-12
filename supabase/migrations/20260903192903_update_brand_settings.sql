/*
# Update store settings with real brand voice

Updates the settings table with Gender Apparel's template tagline, hero text,
and announcement bar content.
*/

UPDATE settings
SET
  tagline = 'Made for Every Body.',
  hero_title = 'Wear What Feels Like You.',
  hero_subtitle = 'Thoughtful apparel designed for every body, every style, and every day. Made to order and shipped to your door.',
  announcement = 'Made to order. Made with intention. — Free shipping on orders over $75',
  announcement_active = true,
  updated_at = now()
WHERE id = (SELECT id FROM settings LIMIT 1);