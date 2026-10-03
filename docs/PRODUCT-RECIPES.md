# Product Recipes

## What a Product Recipe Is

A Product Recipe is a reusable merchandising/manufacturing template. It describes HOW a design should become a sellable product — which blank, which technique, which variants, how to price them, and what commercial defaults to apply.

A recipe is NOT a product. It resolves INTO a ProductSpecification which the Product Creation Engine uses to create a catalog_builder product.

## What a Product Recipe Is NOT

- Not a product
- Not an order
- Not a Printful Sync Product
- Not a live inheritance relationship (changing a recipe does not change existing products)

## Recipe Lifecycle

```
draft → active → archived
         ↑           ↓
         └── restore ┘
```

- **draft** — being configured, cannot be used for batch generation
- **active** — ready for product generation
- **archived** — prevents new generation, existing products unaffected

## Recipe Editor

Navigate to **Admin → Product Recipes → New Recipe** (or click Edit on an existing recipe).

The editor has 9 sections:

1. **Identity** — name, slug, description, status
2. **Blank Product** — Printful catalog product ID
3. **Production** — technique, placement, printfile ID
4. **Variants** — allowed colors and sizes (empty = all)
5. **Pricing** — Fixed Price or Cost + Margin
6. **Mockups** — max mockups, preferred views
7. **Commercial Defaults** — brand, product type, description template
8. **Publication** — default status for generated products (strongly recommend Draft)
9. **Review** — summary before saving

## Variant Rules

Recipes filter Printful catalog variants by color and size names. Leave empty to include all available variants.

```json
{
  "colors": ["Black", "Navy", "White"],
  "sizes": ["S", "M", "L", "XL", "2XL"],
  "exclude_variant_ids": []
}
```

Store variant UUIDs are created by the Product Creation Engine at generation time — never stored in recipes.

## Pricing Rules

### Fixed Price
```json
{ "strategy": "FIXED_PRICE", "fixed_price": 29.99 }
```

### Cost + Margin
```json
{ "strategy": "COST_PLUS", "cost_plus_margin": 12.00, "rounding": "nearest_99", "min_price": 25.00 }
```

Rounding options: `none`, `ceil`, `nearest_99`

The engine never produces a price ≤ 0. A `min_price` floor prevents pricing below cost.

## Mockup Rules

```json
{ "views": ["front", "model"], "max_mockups": 5 }
```

Recipes describe intent. Actual mockups are generated and persisted at product creation time.

## Commercial Defaults

```json
{
  "brand": "CountyBuys",
  "product_type": "T-Shirt",
  "description_template": "Classic unisex tee with custom graphic print. Made to order."
}
```

All defaults are overridable at generation time.

## Design Compatibility

Before a recipe generates a product, the selected design is validated against the recipe's manufacturing configuration:

- **PASS** — artwork meets recommended 300 DPI
- **PASS_WARNING** — artwork meets minimum 150 DPI (allowed with warning)
- **FAIL** — artwork below minimum DPI — recipe cannot generate specification

## Recipe Resolution

```
resolveProductRecipe({
  recipe,
  design,
  availableVariants,  // from Printful catalog
  commercialInputs,   // title, slug, description, etc.
  idempotency_key
})
→ ProductSpecification | { valid: false, errors }
```

The resolver is a pure function — no database writes, no Printful calls.

## ProductSpecification Relationship

A recipe resolves INTO a ProductSpecification. The spec is then validated and passed to the Product Creation Engine. The recipe is not stored in the spec — it is recorded as `recipe_id` on the resulting product row.

## Dry Run

Before generating a product from a recipe, use the dry-run workflow:

1. Select a recipe
2. Select a design
3. Provide commercial inputs (title, slug, etc.)
4. Click Dry Run

The system resolves the recipe, validates the spec, and shows the full plan — variant count, price range, expected DB operations — **without creating anything**.

## Version / Traceability

Products generated from recipes record:
- `recipe_id` — which recipe was used
- `recipe_version` — snapshot of recipe slug + updated_at at generation time

This is informational only. Fulfillment reads from the frozen `fulfillment_snapshot`, never from the recipe.

## Archive Behavior

Archiving a recipe:
- Prevents new product generation from that recipe
- Does NOT affect existing products
- Does NOT affect historical orders
- Does NOT change fulfillment snapshots

## Recipe Change Safety

Changing a recipe (pricing, variants, technique) affects FUTURE product generation only. Existing products are independent snapshots of what the recipe produced at creation time.

## Future Batch Generator Integration (Phase 9)

Phase 9 will use recipes to batch-generate products:

```
Recipe + Design Library
        ↓
  resolveProductRecipe() × N
        ↓
  validateProductSpecification() × N
        ↓
  dryRunProductSpecification() × N  ← review before committing
        ↓
  Product Creation Engine × N
```

The batch generator will never bypass the ProductSpecification validation layer.
