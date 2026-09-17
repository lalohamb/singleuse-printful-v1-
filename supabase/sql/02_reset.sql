-- =============================================================================
-- Printify POD Storefront — New Store Reset
-- Clears all transactional + content data, restores application defaults.
-- Admins are NOT deleted — you stay logged in.
-- Run in Supabase SQL Editor.
-- =============================================================================

-- ── 1. ORDERS (all of them) ───────────────────────────────────────────────────
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;

-- ── 2. CUSTOMER PROFILES ─────────────────────────────────────────────────────
-- Auth users remain in Supabase Auth; this clears the local account metadata mirror.
DO $$
BEGIN
  IF to_regclass('public.customer_profiles') IS NOT NULL THEN
    TRUNCATE TABLE public.customer_profiles RESTART IDENTITY CASCADE;
  END IF;
END $$;

-- ── 3. EMAIL EVENTS ───────────────────────────────────────────────────────────
TRUNCATE TABLE email_events RESTART IDENTITY CASCADE;

-- ── 4. PRODUCTS ───────────────────────────────────────────────────────────────
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

-- ── 5. CATEGORIES — clear and re-seed defaults ────────────────────────────────
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;

INSERT INTO categories (name, slug, description) VALUES
  ('T-Shirts',    't-shirts',    'Premium tees with culturally inspired designs'),
  ('Hoodies',     'hoodies',     'Comfortable hoodies for every season'),
  ('Hats',        'hats',        'Caps and headwear to complete your look'),
  ('Sweatpants',  'sweatpants',  'Matching bottoms for your streetwear sets'),
  ('Accessories', 'accessories', 'Tote bags, stickers, and more')
ON CONFLICT (slug) DO NOTHING;

-- ── 6. POLICIES — reset to professional defaults ────────────────────────────
UPDATE policies SET content = '<h2>Privacy Policy</h2><p>We are committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information.</p><p>We collect information you provide when placing an order, including your name, email address, shipping address, and payment details. Payment information is processed securely through Stripe and is never stored on our servers.</p><p>Your information is used solely to fulfill your order, communicate with you about it, and improve your shopping experience. We do not sell, rent, or share your personal information with third parties except as necessary to fulfill your order (e.g., shipping carriers, print providers).</p><p>We may send you order updates and, if you opt in, promotional emails. You may unsubscribe at any time.</p><p>By using this site, you consent to this privacy policy. We reserve the right to update this policy at any time. Continued use of the site constitutes acceptance of any changes.</p>', updated_at = now() WHERE id = 'privacy';
UPDATE policies SET content = '<h2>Refund and Returns Policy</h2><p>Because every item is made to order, we do not accept returns or exchanges for buyer''s remorse or incorrect size selection. Please review our size guide carefully before placing your order.</p><p>If your item arrives damaged, defective, or incorrect, we will make it right. Contact us within 30 days of delivery with your order number and a clear photo of the issue. We will offer a replacement or full refund at our discretion.</p><p>Refunds are processed to the original payment method within 5–10 business days of approval. Shipping costs are non-refundable unless the return is due to our error.</p><p>To initiate a return or report an issue, please contact us at the email listed in the footer of this site.</p>', updated_at = now() WHERE id = 'refund';
UPDATE policies SET content = '<h2>Terms of Service</h2><p>These Terms of Service govern your use of this website and any purchases made through it. By placing an order, you agree to these terms in full.</p><p>All products are made to order and may require 3–7 business days for production before shipping. Delivery times vary by location and carrier. We are not responsible for delays caused by shipping carriers or customs.</p><p>Prices are listed in USD and are subject to change without notice. We reserve the right to cancel or refuse any order at our discretion. In the event of a cancellation, you will be notified and refunded in full.</p><p>All content on this site — including images, text, and designs — is the property of this store and may not be reproduced without written permission.</p><p>By using this site, you agree that your use is at your own risk. We are not liable for any indirect, incidental, or consequential damages arising from your use of this website or its products.</p>', updated_at = now() WHERE id = 'terms';

-- ── 7. SETTINGS — reset to application defaults ───────────────────────────────
UPDATE settings SET
  store_name              = 'Your Store',
  tagline                 = 'Your tagline here.',
  hero_title              = 'Empower Yourself. Empower the Culture.',
  hero_subtitle           = 'Apparel celebrating Black culture, faith, and family. Every design made with intention, printed on demand, shipped to your door.',
  hero_image_url          = 'https://images.pexels.com/photos/5693889/pexels-photo-5693889.jpeg?auto=compress&cs=tinysrgb&w=1920',
  hero_object_position    = '0px 0px',
  hero_height_vh          = 80,
  hero_image_flip         = false,
  hero_image_scale        = 100,
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
  logo_url                = null,
  logo_size               = 40,
  footer_text             = 'Made-to-order apparel designed for every body, every style, and every day. Wear what feels like you.',
  footer_bottom_message   = 'Made to order. Made with love.',
  footer_logo_url        = null,
  footer_logo_size       = 40,
  our_why_image_url       = null,
  our_why_object_position = '0px 0px',
  our_why_height_vh       = 60,
  our_why_label           = null,
  our_why_quote           = null,
  our_why_body            = null,
  our_why_image_scale     = 100,
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
    "instagram": {"url": "https://instagram.com/your_store", "enabled": true},
    "tiktok":    {"url": "https://tiktok.com/@yourstore", "enabled": true},
    "facebook":  {"url": "https://facebook.com/yourstore", "enabled": true},
    "youtube":   {"url": "https://youtube.com/@yourstore", "enabled": true},
    "pinterest": {"url": "https://pinterest.com/yourstore", "enabled": true},
    "snapchat":  {"url": "https://snapchat.com/add/yourstore", "enabled": true},
    "threads":   {"url": "https://threads.net/@yourstore", "enabled": true},
    "email":     {"url": "mailto:hello@your-store.example", "enabled": true}
  }'::jsonb,
  favicon_url             = null,
  about_settings          = '{
    "heroEyebrow": "Made for Every Body · Made to Order",
    "heroTitle": "Our Story",
    "heroSubtitle": "Empower yourself. Empower the Culture.",
    "heroQuote": "Some things are meant to find you.",
    "heroCredit": "Your Store Team",
    "heroImageUrl": "/hero-placeholder.svg",
    "heroObjectPosition": "50% 20%",
    "heroImageScale": 100,
    "heroImageFlip": false,
    "heroImageFit": "cover",
    "heroGradientOpacity": 40,
    "heroGradientDir": "right",
    "heroBackground": "#171717",
    "heroTextColor": "#ffffff",
    "storyParagraph1": "Your store began with a simple idea: clothing should help you feel more like yourself.",
    "storyParagraph2": "What drives us is simple. What you wear can speak before you ever open your mouth. A statement piece can reflect who you are, what you stand for, and how you want to move through the world. Clothing is not just fabric. It is voice.",
    "storyParagraph3": "At your store, you will find products designed with intention and printed to order.",
    "storyQuote": "Welcome to your store.",
    "storyQuoteCredit": "Your Store Team",
    "storyImageUrl": "/hero-placeholder.svg",
    "storyImageAlt": "Your Store",
    "storyImageCaption": "Dee & Lalo",
    "storyImageSubcaption": "Your Store",
    "storyObjectPosition": "50% 20%",
    "storyImageScale": 100,
    "storyImageFlip": false,
    "storyImageFit": "cover",
    "missionEyebrow": "Why We Exist",
    "missionTitle": "Our Mission",
    "missionBody": "To create made-to-order apparel that celebrates identity and helps every person who wears it feel seen, comfortable, and confident.",
    "missionBackground": "#f7f7f5",
    "missionTextColor": "#171717",
    "missionCards": [
      {"icon": "Heart", "title": "Self-Expression", "desc": "Clothing that gives your point of view room to speak."},
      {"icon": "Sparkles", "title": "Thoughtful Design", "desc": "Details created with intention, not noise."},
      {"icon": "Users", "title": "Every Body", "desc": "A more welcoming approach to fit and personal style."},
      {"icon": "Globe", "title": "Less Waste", "desc": "Made to order so every piece has a purpose."},
      {"icon": "Sparkles", "title": "Everyday Quality", "desc": "Comfort and character in every drop."}
    ],
    "cultureEyebrow": "More Than a Brand",
    "cultureTitle": "The Culture",
    "cultureBody": "Your store is for people who want quality products that feel personal and ready for real life.",
    "cultureBackground": "#171717",
    "cultureTextColor": "#ffffff",
    "cultureCreed": "Wear what feels like you.",
    "cultureCards": [
      {"emoji": "✊🏾", "title": "Black Excellence", "desc": "Every design is a declaration. We wear our heritage with pride, not apology."},
      {"emoji": "🙏🏾", "title": "Faith-Driven", "desc": "Rooted in scripture and spiritual conviction — because what you believe shapes what you wear."},
      {"emoji": "🌍", "title": "Community First", "desc": "From the aunties to the block — we design for the people who show up for each other."}
    ]
  }'::jsonb,
  updated_at              = now()
WHERE id = (SELECT id FROM settings LIMIT 1);

-- ── 8. SEO SETTINGS — reset to defaults ──────────────────────────────────────
UPDATE seo_settings SET
  site_url                 = 'https://your-store.example',
  default_og_image         = null,
  sitemap_enabled          = true,
  robots_noindex_admin     = true,
  jsonld_enabled           = true,
  canonical_enabled        = true,
  meta_title_suffix        = '| Your Store',
  twitter_handle           = '@yourstore',
  google_site_verification = null,
  updated_at               = now()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- Tables cleared : orders, customer_profiles, products, categories (re-seeded), policies (blanked)
-- Tables reset   : settings, seo_settings
-- Tables kept    : admins (you stay logged in)
-- =============================================================================
