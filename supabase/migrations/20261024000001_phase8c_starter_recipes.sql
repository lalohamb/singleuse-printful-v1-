-- Phase 8C: Starter CountyBuys Product Recipes
-- Only verified catalog products are included.
-- All recipes start as DRAFT — operator must review and activate.
--
-- Verified catalog products (from Phase 7C and prior testing):
--   1580 — BC4851GD Garment Dye Long Sleeve Tee (DTFILM, front_dtf)
--   71   — BC3001 Unisex Jersey Short Sleeve Tee (DTG, front)
--   638  — Yupoong 6606 Dad Hat (EMBROIDERY, embroidery_front)
--
-- DO NOT add recipes for unverified catalog products.

INSERT INTO product_recipes (
  name, slug, description, status, provider,
  printful_catalog_id, technique, placement,
  variant_rules, pricing_rules, mockup_rules,
  commercial_defaults, publication_default, metadata
) VALUES

-- Recipe 1: Premium Long Sleeve Graphic Tee (verified Phase 7C)
(
  'Premium Long Sleeve Graphic Tee',
  'premium-long-sleeve-graphic-tee',
  'Bella+Canvas 4851GD Garment Dye Heavyweight Long Sleeve Tee with DTF front print. Verified catalog product.',
  'draft',
  'printful',
  1580,
  'DTFILM',
  'front_dtf',
  '{"colors": ["Black", "Brick", "Faded Eucalyptus", "Faded Khaki", "Faded Navy", "Faded Orchid", "Faded Pepper", "Faded Teal", "Faded True Royal", "Faded Watermelon", "Ivory", "Mustard", "Washed Denim"], "sizes": ["S", "M", "L", "XL", "2XL", "3XL"]}',
  '{"strategy": "COST_PLUS", "cost_plus_margin": 36.28, "rounding": "nearest_99", "min_price": 55.00}',
  '{"views": ["front", "model"], "max_mockups": 5}',
  '{"brand": "CountyBuys", "product_type": "Long Sleeve Tee", "description_template": "Premium garment-dyed long sleeve tee with a custom graphic print. Made to order."}',
  'draft',
  '{"verified_phase": "7C", "blank": "BC4851GD"}'
),

-- Recipe 2: Everyday Graphic Tee (verified Phase 7A)
(
  'Everyday Graphic Tee',
  'everyday-graphic-tee',
  'Bella+Canvas 3001 Unisex Jersey Short Sleeve Tee with DTG front print. Verified catalog product.',
  'draft',
  'printful',
  71,
  'DTG',
  'front',
  '{"colors": ["Black", "White", "Navy", "Dark Grey Heather", "Heather Columbia Blue", "Heather Red", "Soft Cream"], "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL"]}',
  '{"strategy": "COST_PLUS", "cost_plus_margin": 18.00, "rounding": "nearest_99", "min_price": 28.00}',
  '{"views": ["front", "model"], "max_mockups": 5}',
  '{"brand": "CountyBuys", "product_type": "T-Shirt", "description_template": "Classic unisex jersey tee with a custom graphic print. Made to order."}',
  'draft',
  '{"verified_phase": "7A", "blank": "BC3001"}'
),

-- Recipe 3: Embroidered Dad Hat (verified Phase 5)
(
  'Embroidered Dad Hat',
  'embroidered-dad-hat',
  'Yupoong 6606 Unstructured Dad Hat with embroidered front. Verified catalog product.',
  'draft',
  'printful',
  638,
  'EMBROIDERY',
  'embroidery_front',
  '{"colors": ["Black", "White", "Navy", "Khaki", "Dark Grey"], "sizes": ["One Size"]}',
  '{"strategy": "COST_PLUS", "cost_plus_margin": 16.00, "rounding": "nearest_99", "min_price": 28.00}',
  '{"views": ["front", "side"], "max_mockups": 4}',
  '{"brand": "CountyBuys", "product_type": "Hat", "description_template": "Classic unstructured dad hat with custom embroidery. Made to order."}',
  'draft',
  '{"verified_phase": "5", "blank": "Yupoong 6606"}'
)

ON CONFLICT (slug) DO NOTHING;
