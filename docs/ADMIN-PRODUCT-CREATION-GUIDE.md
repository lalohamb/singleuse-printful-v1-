# Admin Product Creation Guide

This guide explains how to create a new print-on-demand product using the Catalog Builder. You do not need to understand databases, APIs, or Printful internals to follow these steps.

---

## 1. Opening Catalog Builder

1. Log in to the admin panel at `/admin`
2. In the left menu, click **Catalog Builder**
3. You will see a step-by-step progress bar at the top

---

## 2. Choosing a Blank Product

The blank product is the physical garment or item that will be printed.

1. Browse or search the product catalog
2. Click a product to select it — you will see the brand, name, and number of available variants
3. The system automatically selects the default printing technique for that product

**Tip**: Start with products you know — Bella+Canvas 3001 (unisex t-shirt) and Bella+Canvas 3010 (oversized tee) are popular starting points.

---

## 3. Selecting Variants

Variants are the specific color and size combinations you want to sell.

1. Variants are grouped by color
2. Click individual variants to select/deselect them
3. Use **Select all** to add every available variant
4. You must select at least one variant to continue

**Tip**: For a first production test, select just one or two variants (e.g. Black / S and Black / M) to keep things simple.

---

## 4. Uploading a New Design

The design stage has two tabs: **Select Existing** and **Upload New**.

To upload a new design:

1. Click the **Upload New** tab
2. Click the upload area or drag your artwork file onto it
3. Supported formats: PNG (recommended), JPEG
4. Maximum file size: 50 MB
5. After upload, the system automatically checks your artwork against the production requirements for the selected product and placement

**What you will see after upload:**
- A preview of your artwork
- The pixel dimensions
- The effective DPI at the intended print size
- A validation result: PASS, PASS WITH WARNING, or FAIL

6. Enter a **Design Name** — this appears in your Design Library and on the review screen
7. Click **Save Design & Use on Product**

> **Important**: Upload the original design file, not a shirt mockup. Mockups are generated separately and are not sent to the printer.

---

## 5. Selecting an Existing Design

If you have already uploaded a design:

1. Click the **Select Existing** tab
2. Browse your active designs — each shows a preview, name, and dimensions
3. Click a design to select it

The system will check the selected design's dimensions against the current product's requirements and show a validation result.

---

## 6. Understanding Artwork Requirements

Different products have different print area sizes. The system fetches the exact requirements from Printful for your chosen product and placement.

**Key terms:**

| Term | Meaning |
|---|---|
| Canvas size | The pixel dimensions Printful expects for this placement |
| DPI | Dots per inch — higher = sharper print |
| Effective DPI | How sharp your artwork will actually print at the intended size |
| fill_mode=fit | Your artwork is scaled to fit within the canvas, preserving its shape |

**General targets:**

| Result | Effective DPI | Meaning |
|---|---|---|
| PASS | ≥ 300 DPI | Meets recommended quality |
| PASS WITH WARNING | 150–299 DPI | Manufacturable but below preferred quality |
| FAIL | < 150 DPI | Below Printful's minimum — do not use for production |

**Example for Bella+Canvas 3001 front:**
- Canvas: 1800 × 2400 px at 150 DPI = 12 × 16 inch print area
- Minimum artwork: 1800 × 2400 px
- Recommended artwork: 3600 × 4800 px

**Example for Bella+Canvas 3010 front:**
- Canvas: 4200 × 4800 px at 300 DPI = 14 × 16 inch print area
- Minimum artwork: 4200 × 4800 px

---

## 7. Difference Between Artwork and Mockups

This is the most important distinction in the system:

| | Manufacturing Artwork | Storefront Mockup |
|---|---|---|
| What it is | Your original design file | A photo-realistic preview of the product |
| Where it goes | Sent to Printful for printing | Shown to customers on the product page |
| Where to upload | Design stage (Upload New tab) | Generated automatically in the Mockups stage |
| Can they be the same file? | No — never upload a mockup as artwork |

**Never upload a shirt mockup as your manufacturing artwork.** The printer receives the artwork file directly. If you upload a mockup (a photo of a shirt with your design on it), the printer will print a photo of a shirt onto a shirt.

---

## 8. Choosing Technique

The technique determines how the design is applied to the garment.

| Technique | Best for |
|---|---|
| DTG (Direct to Garment) | Full-color designs, photos, gradients on cotton |
| Embroidery | Simple logos, text, limited colors |
| DTF (Direct to Film) | Synthetic fabrics, detailed designs |

For most t-shirt designs with colors and gradients, **DTG** is the right choice.

---

## 9. Choosing Placement

Placement is where on the garment the design will be printed.

Common placements:
- **front** — center front chest area
- **back** — center back
- **front_large** — larger front print area (where available)

The system shows only placements available for your chosen product.

---

## 10. Positioning / Scaling Artwork

After choosing placement, the Designer stage shows your artwork on a canvas representing the print area.

- Drag the artwork to reposition it
- Drag the corners to resize it
- The shaded area shows the available print boundary
- Keep important elements (text, faces, logos) away from the edges

The position you set here is used for mockup generation. The manufacturing artwork file itself is sent at full resolution — positioning affects how Printful places it within the print area.

---

## 11. Generating Mockups

Click **Generate Mockups** to create photo-realistic product images.

- Printful generates the mockups using your artwork and positioning
- This may take 30–60 seconds
- Multiple mockup angles are generated automatically
- Mockups are saved to your store's image storage

**Mockups are storefront images only.** They are not sent to the printer.

---

## 12. Entering Title and Description

On the Product Details stage:

- **Title** (required): The product name shown to customers. Example: `Still Original Retro Graphic T-Shirt`
- **Slug** (required): The URL path. Auto-generated from the title. Example: `still-original-retro-graphic-t-shirt`
- **Description**: Full product description shown on the product page
- **Brand**: Optional brand name
- **Product type**: Optional category label (e.g. T-Shirt)

---

## 13. Setting Retail Price

On the Pricing stage, set the retail price for each variant.

- Provider cost is shown for reference
- Set a price that covers your cost and desired margin
- Prices are enforced server-side — customers cannot change them

**Example**: If provider cost is $11.92, a retail price of $34.99 gives approximately 65% margin before shipping.

---

## 14. SEO

SEO fields are optional but recommended:

- **Meta title**: Appears in browser tabs and search results. Default: product title
- **Meta description**: Short description for search engines (150–160 characters)

---

## 15. Reviewing the Product

The Review stage shows a summary before publishing:

- Blank product and variant count
- Design name and technique
- Placement
- Mockup count
- Title, slug, and base price
- **Artwork validation result** — shown here so you can catch issues before publishing

Review everything carefully. Once published, the product is live on your storefront.

---

## 16. Understanding Validation Warnings

| Warning | Meaning | Action |
|---|---|---|
| PASS WITH WARNING | Artwork meets minimum but not recommended DPI | Consider higher-resolution artwork for sharper printing |
| FAIL | Artwork below minimum DPI | Do not publish for production — replace artwork |
| No product images | Mockups were not generated or not selected | Add mockups via Products panel after publishing |

A FAIL validation result blocks the "Save Design & Use on Product" button. You must upload higher-resolution artwork before proceeding.

---

## 17. Saving as Draft

The Catalog Builder currently publishes directly. If you want to save as draft:

- Complete all stages but do not click **Publish Product**
- The product is created as a draft automatically when you reach the Review stage
- You can find it in `/admin/products` with status "draft"
- Publish it later from the Products panel

---

## 18. Publishing

Click **Publish Product** on the Review stage.

The system will:
1. Validate the product has a title, slug, price, variants, and design
2. Set the product status to `active`
3. Make it visible on the storefront

If you see a warning about missing images after publishing, the product is live but has no storefront photos. Add mockups via `/admin/products` → edit product.

---

## 19. Editing an Existing Product

Go to `/admin/products` to find published products.

From there you can:
- Edit title, description, price
- Change publication status
- View the product on the storefront

To change the manufacturing artwork or design, you must create a new product through Catalog Builder. The manufacturing configuration (artwork, placement, technique) is frozen at product creation time and cannot be changed after orders have been placed.

---

## 20. Important Production Safety Notes

**Before the first real production order:**

1. Verify artwork validation shows PASS or PASS WITH WARNING
2. Confirm the correct product, variant, placement, and technique
3. Check that `PRINTFUL_AUTO_CONFIRM` is not set — orders will stop at DRAFT for your review
4. After payment, go to `/admin/orders` → open the order → click "Check Printful" → verify everything is correct before clicking "Confirm → Production"

**The "Confirm → Production" button is the point of no return.** Once confirmed, Printful begins manufacturing. Cancellation after this point requires contacting Printful support.

**Never upload a mockup as manufacturing artwork.** The validation system will catch low-resolution files, but it cannot detect if you accidentally uploaded a mockup image instead of the original design file.
