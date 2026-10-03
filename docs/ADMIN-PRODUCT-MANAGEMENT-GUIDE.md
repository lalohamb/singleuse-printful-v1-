# Admin Product Management Guide

## Finding Products

Go to **Admin → Products**. Products are listed in two tabs:

- **Active** — published products visible on the storefront
- **Inactive & Unsynced** — draft and archived products

Click the **Edit** (pencil) icon on any product to open the Product Workspace.

---

## Product Workspace

The workspace has six tabs:

| Tab | Purpose |
|---|---|
| Overview | Product identity, provider mapping, design summary, pricing |
| Design & Production | Artwork, validation, replacement, mockup regeneration |
| Images | Upload, reorder, set primary, delete, alt text |
| Variants | Retail prices, availability, provider mappings |
| Content & SEO | Title, description, slug, meta, category |
| Publication | Status controls, publication checklist |

---

## Product Types

Two product types exist:

**Store-Owned (Catalog Builder)** — shown with a blue badge. These products are fully managed by the store. Artwork, pricing, and publication are all store-controlled.

**Legacy Printful Sync** — shown with an amber badge. These products were imported from Printful. Artwork is managed in the Printful Dashboard.

---

## Editing Product Information

Use the **Content & SEO** tab to edit:

- Title, description, short description
- URL slug (changing this breaks existing links)
- Brand, product type, category
- SEO title and meta description
- Compare-at price
- Personalization settings

Click **Save Changes** to apply. Changes affect the storefront immediately.

---

## Changing Artwork

> **Important:** Changing artwork affects future orders only. Existing order fulfillment snapshots remain permanently unchanged.

1. Open the **Design & Production** tab
2. Click **Select New Artwork**
3. Upload a PNG or JPEG file
4. The system validates the artwork against the actual Printful printfile specification
5. Review the validation result:
   - **PASS** — meets recommended 300 DPI
   - **PASS_WARNING** — meets minimum 150 DPI but below recommended
   - **FAIL** — below minimum DPI, cannot be used
6. If validation passes, click **Save New Artwork**

FAIL artwork is blocked from replacing active production artwork.

---

## Artwork Validation

Validation checks effective DPI against the actual Printful printfile specification for the product's catalog product ID and placement.

| Result | Effective DPI | Meaning |
|---|---|---|
| PASS | ≥ 300 | Recommended quality |
| PASS_WARNING | ≥ 150 | Minimum quality — consider higher resolution |
| FAIL | < 150 | Below minimum — cannot be used |

---

## Managing Images

Use the **Images** tab to:

- **Upload** — add a new image (PNG or JPEG)
- **Set Primary** — click the star button to make an image the primary storefront image
- **Reorder** — use the up/down arrows to change display order
- **Delete** — remove an image (cannot delete the last image)
- **Alt text** — click the alt text area to edit

---

## Regenerating Mockups

In the **Design & Production** tab, click **Regenerate Mockups** to generate new Printful mockups using the current artwork. Existing images are preserved until new mockups are successfully generated and saved.

---

## Managing Variants

Use the **Variants** tab to:

- Edit retail price per variant — enter a new price and click **Save**
- Toggle availability — click the checkmark/X icon

Provider mappings (Printful variant IDs) are read-only — they are set at product creation and cannot be changed without recreating the product.

---

## Changing Pricing

Variant retail prices are edited in the **Variants** tab. The base product price shown in the Overview is the lowest variant price and updates automatically.

Provider cost is shown for reference only and never overwrites retail price.

---

## SEO

Edit SEO fields in the **Content & SEO** tab:

- **Meta Title** — defaults to product title if blank
- **Meta Description** — shown in search results
- **Slug** — the URL path (`/product/your-slug`)

---

## Publication

Use the **Publication** tab to change product status:

| Status | Meaning |
|---|---|
| Active | Visible on storefront, purchasable |
| Draft | Hidden from storefront |
| Archived | Hidden, preserved for historical orders |

### Publication Checklist (Catalog Builder products)

Before a catalog_builder product can be published, the system checks:

- At least one active variant
- Valid retail price
- Primary design attached
- Design artwork present
- Printful catalog mapping set
- Product images (warning only — not a hard block)

---

## Archiving Products

Products with historical orders should be archived rather than deleted. Archiving hides the product from the storefront but preserves all order history.

Use **Archive** in the Publication tab.

---

## Legacy Printful Sync Products

Legacy sync products open in the workspace but show a **Legacy Printful Sync** badge. The Design & Production tab shows a link to the Printful Dashboard for artwork management.

Do not use catalog_builder-specific controls on legacy sync products.

---

## Key Safety Rules

1. **Editing a product never changes existing order fulfillment snapshots.** Snapshots are frozen at checkout time and are immutable.

2. **FAIL artwork cannot replace active production artwork.** The system blocks the save.

3. **Provider variant IDs are read-only.** Retail prices can be changed; Printful mappings cannot.

4. **The last product image cannot be deleted.** At least one image must remain.

5. **Archiving is preferred over deleting** for products with order history.
