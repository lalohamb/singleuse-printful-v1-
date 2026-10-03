# Batch Operations Runbook

Operator procedures for the CountyBuys Batch Catalog Generator.

---

## 1. Recipe Activation

Before a recipe can be used for batch generation it must be activated.

### Procedure

1. Go to `/admin/product-recipes`
2. Find the recipe (status: draft)
3. Click the ⚡ Activate button
4. Review the validation result:
   - Catalog product ID confirmed
   - Technique confirmed
   - Placement confirmed
   - Available variant count shown
   - Pricing validation shown
5. If validation passes → recipe status becomes `active`
6. If validation fails → recipe remains `draft`, errors shown

### Starter Recipes

| Recipe | Catalog | Technique | Placement | Status |
|---|---|---|---|---|
| Premium Long Sleeve Graphic Tee | 1580 | DTFILM | front_dtf | draft |
| Everyday Graphic Tee | 71 | DTG | front | draft |
| Embroidered Dad Hat | 638 | EMBROIDERY | embroidery_front | draft |

Activate each individually after reviewing validation results.

---

## 2. Batch Planning

### Procedure

1. Go to `/admin/catalog-batches`
2. Click **New Batch**
3. Enter batch name
4. Select active designs (archived designs are excluded)
5. Select active recipes (draft recipes are excluded)
6. Review the product matrix (designs × recipes)
7. Click **Resolve & Validate**
   - Server fetches Printful variants authoritatively
   - Server applies recipe variant rules
   - Server resolves ProductSpecification per item
   - Server runs dry-run per item
8. Review preview:
   - PASS / WARNING / FAIL counts
   - Per-item titles, prices, variant counts, warnings
9. Acknowledge any warnings
10. Click **Review & Approve →**

### Hard Stop #1

**STOP at the Approve stage.**

Review the exact matrix before approving. The wizard does not auto-generate.

---

## 3. Batch Approval

On the Approve stage:

1. Review PASS / WARNING / FAIL summary
2. Confirm: products are DRAFT, no Stripe charges, no Printful orders
3. Click **Approve N Products for Draft Generation**
4. Wizard redirects to batch detail page

---

## 4. Draft Generation

On the batch detail page (`/admin/catalog-batches/[id]`):

1. Review approved items
2. Click **Generate N Draft Products**
3. Monitor progress (generated / pending / failed counts)
4. If failures occur: click **Retry Failed**

### What generation creates

- `status = draft` products
- `catalog_source = catalog_builder`
- `printful_id = NULL`
- `recipe_id`, `recipe_version`, `batch_id` on each product

---

## 5. Mockup Processing

After products are generated:

1. Click **Process Mockups (N)**
2. Server submits Printful mockup tasks
3. Server polls for completion (max 90s per item)
4. Server persists mockups to Supabase Storage
5. `product_images` records created
6. `products.image_url` updated

### If mockup fails

- Item marked `needs_mockup_retry`
- Product is NOT deleted
- Click **Retry Failed** to retry

### Missing position

If a product shows `MOCKUP_CONFIGURATION_INCOMPLETE`:
- The product's design_configuration lacks valid positioning
- Go to `/admin/products/[id]` → Design tab
- Regenerate mockups via the Product Management workspace
- This sets the correct position in design_configuration

---

## 6. Bulk Review

After generation + mockups:

1. Select products using checkboxes
2. Available actions:
   - **Set Category** — enter category UUID, click Apply
   - **Process Mockups** — submit mockup tasks
   - **Retry Failed** — retry failed items
3. Use **Select all generated** to select all generated products

---

## 7. Publication Dry Run

Before publishing:

1. Select products
2. Click **Publish N Products** (shows dry-run first)
3. Review: publishable vs blocked
4. Blocked reasons: no price, no catalog ID, no design, no variants, no images

---

## 8. Bulk Publication

1. Select publishable products
2. Click **Publish N Products**
3. Blocked products remain draft
4. Published products become `status = active`

### Hard Stop #2

**STOP before publishing.**

Review all generated products and mockups before making them visible to customers.

---

## 9. Idempotency

Replaying generation is safe:
- Items with `generated_product_id` are skipped
- No duplicate products created
- No duplicate product_images (upsert with dedup constraint)

---

## 10. Cancel

To stop remaining items:

1. Click **Cancel Remaining**
2. Pending/approved items are cancelled
3. Already-generated products are NOT deleted

---

## 11. Safety Checklist

Before any batch operation confirm:

- [ ] `PRINTFUL_AUTO_CONFIRM` is absent/false
- [ ] No Stripe Checkout Sessions will be created
- [ ] No Printful fulfillment orders will be submitted
- [ ] Products will be created as DRAFT
- [ ] `printful_id = NULL` on all batch products
- [ ] `catalog_source = catalog_builder` on all batch products
