-- View SEO settings
SELECT * FROM seo_settings LIMIT 1;

-- Update site URL
UPDATE seo_settings SET site_url = 'https://your-store.example' WHERE id = '00000000-0000-0000-0000-000000000001';
