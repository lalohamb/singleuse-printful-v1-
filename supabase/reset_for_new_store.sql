-- =============================================================================
-- Gender Apparel — New Store Reset
-- Clears all transactional + content data, restores application defaults.
-- Admins are NOT deleted — you stay logged in.
-- Run in Supabase SQL Editor.
-- =============================================================================

-- ── 1. ORDERS (all of them) ───────────────────────────────────────────────────
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;

-- ── 2. EMAIL EVENTS ───────────────────────────────────────────────────────────
TRUNCATE TABLE email_events RESTART IDENTITY CASCADE;

-- ── 2. PRODUCTS ───────────────────────────────────────────────────────────────
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

-- ── 3. CATEGORIES — clear and re-seed defaults ────────────────────────────────
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;

INSERT INTO categories (name, slug, description) VALUES
  ('T-Shirts',    't-shirts',    'Premium tees with culturally inspired designs'),
  ('Hoodies',     'hoodies',     'Comfortable hoodies for every season'),
  ('Hats',        'hats',        'Caps and headwear to complete your look'),
  ('Sweatpants',  'sweatpants',  'Matching bottoms for your streetwear sets'),
  ('Accessories', 'accessories', 'Tote bags, stickers, and more')
ON CONFLICT (slug) DO NOTHING;

-- ── 4. POLICIES — reset content, keep rows ────────────────────────────────────
UPDATE policies SET content = '', updated_at = now();

-- ── 5. SETTINGS — reset to application defaults ───────────────────────────────
UPDATE settings SET
  store_name              = 'Gender Apparel',
  tagline                 = 'Made for Every Body.',
  hero_title              = 'Wear What You Love.',
  hero_subtitle           = 'Inclusive, made-to-order apparel. Every design printed fresh and shipped to your door.',
  hero_image_url          = 'https://images.pexels.com/photos/5693889/pexels-photo-5693889.jpeg?auto=compress&cs=tinysrgb&w=1920',
  hero_object_position    = '0px 0px',
  hero_height_vh          = 80,
  hero_image_flip         = false,
  hero_image_scale        = 1,
  hero_gradient_opacity   = 0.4,
  hero_gradient_dir       = 'to right',
  hero_image_fit          = 'cover',
  story_image_url         = null,
  story_object_position   = '0px 0px',
  story_image_scale       = 100,
  story_image_flip        = false,
  story_image_fit         = 'cover',
  story_gradient_opacity  = 40,
  story_gradient_dir      = 'full',
  logo_url                = '/logo.png',
  logo_size               = 40,
  footer_text             = 'Made-to-order apparel designed for every body, every style, and every day. Wear what feels like you.',
  footer_bottom_message   = 'Made to order. Made with love.',
  footer_logo_url        = null,
  footer_logo_size       = 40,
  our_why_image_url       = null,
  our_why_object_position = '0px 0px',
  our_why_height_vh       = 60,
  our_why_label           = 'Our Why',
  our_why_quote           = 'Fashion should feel like freedom.',
  our_why_body            = 'We started Gender Apparel because we believe clothing should celebrate who you are — not define it. Every piece is made to order, printed with intention, and shipped with love.',
  our_why_image_scale     = 1,
  our_why_image_flip      = false,
  our_why_image_fit       = 'cover',
  our_why_gradient_opacity = 0.4,
  our_why_gradient_dir    = 'to right',
  announcement            = 'Made to order. Made with love. — Free shipping on orders over $75',
  announcement_active     = true,
  orders_paused           = false,
  shipping_free_threshold = 75,
  default_shipping_cost   = 6.99,
  printify_connected      = false,
  printify_shop_id        = null,
  stripe_connected        = false,
  promo_banner_active     = false,
  promo_banner_title      = null,
  promo_banner_body       = null,
  promo_banner_cta_label  = null,
  promo_banner_cta_url    = null,
  promo_banner_bg_color   = '#1a1a1a',
  testimonials            = '[
    {"quote":"I wore my shirt to a family reunion and got so many compliments. This brand truly gets us.","name":"Jasmine T.","location":"Atlanta, GA","product":"Culture First Tee"},
    {"quote":"The quality is unmatched. Soft, true to size, and the design is everything. Will be ordering again.","name":"Marcus W.","location":"Houston, TX","product":"Faith Over Fear Hoodie"},
    {"quote":"Finally a brand that celebrates who we are. Every piece feels intentional and powerful.","name":"Aaliyah R.","location":"Chicago, IL","product":"Heritage Collection"}
  ]'::jsonb,
  social_links            = '{
    "instagram": {"url": "https://instagram.com/genderapparel", "enabled": true},
    "tiktok":    {"url": "https://tiktok.com/@genderapparel",    "enabled": true},
    "facebook":  {"url": "https://facebook.com/genderapparel",   "enabled": true},
    "youtube":   {"url": "https://youtube.com/@genderapparel",   "enabled": true},
    "pinterest": {"url": "https://pinterest.com/genderapparel",  "enabled": true},
    "snapchat":  {"url": "https://snapchat.com/add/genderapparel", "enabled": true},
    "threads":   {"url": "https://threads.net/@genderapparel",   "enabled": true},
    "email":     {"url": "mailto:hello@genderapparel.example",   "enabled": true}
  }'::jsonb,
  favicon_url             = null,
  updated_at              = now()
WHERE id = (SELECT id FROM settings LIMIT 1);

-- ── 6. SEO SETTINGS — reset to defaults ──────────────────────────────────────
UPDATE seo_settings SET
  site_url                 = 'https://genderapparel.example',
  default_og_image         = null,
  sitemap_enabled          = true,
  robots_noindex_admin     = true,
  jsonld_enabled           = true,
  canonical_enabled        = true,
  meta_title_suffix        = '| Gender Apparel',
  twitter_handle           = '@gender_apparel',
  google_site_verification = null,
  updated_at               = now()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- Tables cleared : orders, products, categories (re-seeded), policies (blanked)
-- Tables reset   : settings, seo_settings
-- Tables kept    : admins (you stay logged in)
-- =============================================================================
