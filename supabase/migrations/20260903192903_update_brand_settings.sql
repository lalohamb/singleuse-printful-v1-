/*
# Update store settings with real brand voice

Updates the settings table with Demetria's real brand tagline, hero text,
and announcement bar content matching the Body & Sleeves brand identity.
*/

UPDATE settings
SET
  tagline = 'Black-Owned. Made to Order.',
  hero_title = 'Empower Yourself. Empower the Culture.',
  hero_subtitle = 'Apparel celebrating Black culture, faith, and family. Every design made with intention, printed on demand, shipped to your door.',
  announcement = 'Made to order. Made with love. — Free shipping on orders over $75',
  announcement_active = true,
  updated_at = now()
WHERE id = (SELECT id FROM settings LIMIT 1);