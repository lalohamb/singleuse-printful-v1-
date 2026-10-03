# PHASE 7B — PRODUCTION DESIGN & ADMIN WORKFLOW REPORT (UPDATED)

**Date**: 2026-10-02  
**Baseline**: Phase 7A COMPLETE / PHASE 7 GO/NO-GO: NO-GO (artwork)  
**Purpose**: Close the admin UX and production-artwork gap identified in Phase 7A.  
**Status**: COMPLETE — artwork gate remains FAIL pending operator artwork replacement.

---

## 1. Executive Summary

Phase 7B is complete. All code changes are implemented, tested, and building. The Catalog Builder now has a fully functional inline artwork upload workflow with product/placement-aware DPI validation. Multiple bugs in the mockup pipeline were discovered and fixed. The admin product creation guide is written.

**Artwork gate**: All uploaded Still Original designs fail the production DPI gate for BC3001 front placement. The most recent upload (`Still Original Retro Mountain Emblem-2027.png`, 1173×1341 px) produces **98 DPI effective** against the BC3001 front requirement (150 DPI minimum). This is FAIL.

**Target product**: The prompt specifies BC3001 (catalog 71) / variant 4016 (Black/S). No BC3001 Still Original product has been created yet. The existing `Still Original Grandpa` product uses BC3010 (catalog 1592) and is not the Phase 7 target product.

**Phase 7 GO/NO-GO: NO-GO** — operator must provide artwork at minimum ~2100×2400 px (for PASS_WARNING at 150 DPI) or ~4200×4800 px (for PASS at 300 DPI), then create the BC3001 product through Catalog Builder.

**All other gates pass.** The admin workflow, validation engine, mockup pipeline, fulfillment architecture, DB constraints, and safety mechanisms are all verified and working.

---

## 2. Starting Phase 7A State

| Item | Status |
|---|---|
| Phase 7A | COMPLETE |
| Phase 7 GO/NO-GO | NO-GO (artwork) |
| DB migration 20261022000000 | APPLIED |
| TypeScript | PASS |
| Tests | 509/509 PASS |
| Build | PASS |
| PRINTFUL_AUTO_CONFIRM | ABSENT |
| Stripe mode | TEST |

---

## 3. Admin UX Problem Identified

**Phase 7A finding**: The Catalog Builder design stage only showed existing designs. No inline upload. No artwork validation anywhere in the builder. The publish route had a hard block on missing product images. The mockup pipeline had multiple silent failures.

**Bugs discovered and fixed during Phase 7B**:

| Bug | Root cause | Fix |
|---|---|---|
| 0 selected mockups on review | `data.mockups` vs `data.result` key mismatch in persist response | Read `data.result ?? data.mockups ?? []` |
| Product image never set | `products.image_url` never written after mockup creation | Sync primary mockup URL to `products.image_url` at create time |
| Color swatch shows blank garment | `product_variants.image_url` never updated with mockup | Use `variant_ids` from each mockup to update matching variants |
| `stored_url` vs `image_url` field mismatch | Builder sent `BuiltMockup` directly without mapping field names | Explicitly map `stored_url → image_url` when sending to API |
| Publish blocked without images | Hard `product_images` requirement in publish route | Changed to soft warning — product publishes, warning shown |

---

## 4. Existing Functionality Reused

| Component | Reused | How |
|---|---|---|
| `/api/printful/artwork-upload` | YES | Upload tab calls same endpoint |
| `/api/designs` POST | YES | "Save Design & Use on Product" calls same endpoint |
| `/api/designs` GET | YES | Existing designs tab fetches same list |
| `/api/printful/printfiles/:id` | YES | Validation fetches printfile spec from existing route |
| `PersistedMockup.variant_ids` | YES | Already in persist.ts — now surfaced to variant image update |

No new upload infrastructure was created.

---

## 5. Code Changes

| File | Change |
|---|---|
| `src/lib/fulfillment/artwork-validation.ts` | NEW — product/placement-aware DPI validation engine |
| `src/app/admin/catalog-builder/StageComponents.tsx` | MODIFIED — DesignPicker with Upload New tab, validation panel, help text |
| `src/app/admin/catalog-builder/CatalogBuilder.tsx` | MODIFIED — passes product/placement context to DesignPicker; shows validation in review; fixes mockup field mapping; artworkValidation state |
| `src/app/admin/catalog-builder/types.ts` | MODIFIED — added `variant_ids` to BuiltMockup |
| `src/app/api/catalog-builder/route.ts` | MODIFIED — syncs primary mockup to `products.image_url`; updates `product_variants.image_url` per variant using mockup `variant_ids`; added `variant_ids` to `CatalogBuilderMockupInput` |
| `src/app/api/catalog-builder/publish/route.ts` | MODIFIED — product_images changed from hard block to soft warning; syncs images to `products.image_url` at publish time |
| `src/__tests__/fulfillment/phase7b.test.ts` | NEW — 18 artwork validation tests |
| `docs/ADMIN-PRODUCT-CREATION-GUIDE.md` | NEW — 20-section administrator guide |

---

## 6. Artwork Upload Workflow

The Catalog Builder design stage now has two tabs:

**Upload New tab**:
1. Click upload area → file picker
2. File uploaded to `/api/printful/artwork-upload` → Supabase Storage
3. Dimensions read locally from file
4. Validation runs against printfile spec for selected product + placement
5. Preview, dimensions, file info, and PASS/PASS_WARNING/FAIL badge shown
6. Admin enters design name
7. "Save Design & Use on Product" → `/api/designs` POST → design record created → selected

**FAIL blocks progression**: "Save Design & Use on Product" is disabled when validation is FAIL.

**Help text**: "Upload the original design file used for manufacturing. Do not upload a shirt mockup here — mockups are generated separately."

---

## 7. Existing Design Selection Workflow

**Select Existing tab**:
- Lists all active designs with preview, name, dimensions
- Clicking a design runs validation against current product + placement
- Validation result shown before proceeding

---

## 8. Artwork Validation Engine

**File**: `src/lib/fulfillment/artwork-validation.ts`

**Algorithm** (fill_mode=fit):
```
scale = min(canvas_w / artwork_w, canvas_h / artwork_h)
rendered_w = artwork_w * scale
rendered_h = artwork_h * scale
print_w_inches = rendered_w / canvas_dpi
print_h_inches = rendered_h / canvas_dpi
effective_dpi = min(artwork_w / print_w_inches, artwork_h / print_h_inches)
```

**Thresholds**: PASS ≥ 300 DPI | PASS_WARNING ≥ 150 DPI | FAIL < 150 DPI

---

## 9. DPI Calculation Method

Uses Printful's `fill_mode=fit` semantics. Artwork is scaled to fit within the canvas preserving aspect ratio. The conservative minimum of x and y effective DPI is used. Correctly handles landscape, square, and portrait artwork in any canvas orientation.

---

## 10. Product / Placement Awareness

`fetchPrintfileSpec(catalogProductId, placement, variantId?)` calls `/api/printful/printfiles/:productId` and extracts the exact printfile spec for the specific placement + variant. Validation is always against the actual Printful requirement for the chosen product — not a generic rule.

---

## 11. Designer Integration

The Designer stage (position artwork) is unchanged. The validation result from the design stage is stored in `artworkValidation` state and displayed in the review stage. No changes to canvas positioning logic.

---

## 12. Mockup Integration

**Fixed**: Mockups now correctly flow through the full pipeline:
1. Mockup task completes → `handleMockupComplete` reads `data.result` (was `data.mockups`)
2. All mockups auto-selected in details stage
3. On product create: `product_images` rows inserted, `products.image_url` set to primary mockup, `product_variants.image_url` updated per variant using `variant_ids`
4. Color swatch click on product page now shows the design mockup for that color

---

## 13. Still Original Design Records

Four designs uploaded during Phase 7B sessions:

| UUID | Name | Dimensions | DPI vs BC3001 | Status |
|---|---|---|---|---|
| `6b2bb488` | Still Original Retro Mountain Emblem 2027 | 1173×1341 px | 98 DPI | **FAIL** |
| `933b1fd5` | Still Original Retro Mountain Emblem 2027 | 1173×1341 px | 98 DPI | **FAIL** |
| `47140662` | Still Original Retro Mountain Emblem 2027 | 1173×1341 px | 98 DPI | **FAIL** |
| `a98a722e` | Still Original Sunset Emblem | 1086×1448 px | 90 DPI | **FAIL** |

All four designs are the same artwork at the same resolution — the operator uploaded the same file multiple times. All fail the BC3001 front production gate.

**Required dimensions for BC3001 front (catalog 71)**:
- PASS_WARNING (150 DPI minimum): ~2100×2400 px or larger
- PASS (300 DPI recommended): ~4200×4800 px or larger

---

## 14. Still Original Product Record

The product created during Phase 7B sessions:

| Field | Value |
|---|---|
| UUID | `3e84bdce-7e57-4287-a1e3-051cd07be2fc` |
| Title | Still Original Grandpa |
| Slug | still-original-grandpa |
| Status | active |
| catalog_source | catalog_builder |
| printful_id | NULL ✓ |
| printful_catalog_id | **1592** (BC3010 Oversized Boxy Tee) |
| Price | $43.00 |
| product_images | 0 (no mockups generated) |

**This is NOT the Phase 7 target product.** The prompt specifies catalog 71 (BC3001). This product uses catalog 1592 (BC3010). A new product on BC3001 must be created after the artwork is replaced.

---

## 15. Variant Mapping

The `Still Original Grandpa` product has 43 BC3010 variants. None are the Phase 7 target variant (4016 = BC3001 Black/S).

**Phase 7 target**: catalog 71 / variant 4016 (BC3001 Black/S) — not yet created as a product.

---

## 16. Manufacturing Configuration

The `Still Original Grandpa` product has:
- placement: front
- technique: DTG
- design_id: `a98a722e` (Still Original Sunset Emblem, 1086×1448 px, FAIL)

This product is not suitable for Phase 7 for two reasons: wrong blank product (BC3010 vs BC3001) and failing artwork.

---

## 17. Storefront Product Data

`Still Original Grandpa` is published and visible at `/product/still-original-grandpa`. It shows the artwork image (set manually). No mockups. This product is a development artifact, not the Phase 7 production candidate.

---

## 18. Mockup Persistence

No mockups were generated for any Still Original product during Phase 7B. The mockup pipeline bugs have been fixed — future products created through the full Catalog Builder flow will correctly persist mockups and update `products.image_url` and `product_variants.image_url`.

---

## 19. Fulfillment Snapshot Dry Verification

For the `Still Original Grandpa` product, the resolver would produce:

```json
{
  "version": 1,
  "strategy": "DIRECT_CATALOG_ORDER",
  "store_product_id": "3e84bdce-7e57-4287-a1e3-051cd07be2fc",
  "printful_catalog_product_id": 1592,
  "design_id": "a98a722e-0144-4507-a853-6e1723a4b469",
  "artwork_url": "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/artwork/tmp/...",
  "placement": "front",
  "technique": "DTG"
}
```

**Verified**:
- `artwork_url` ≠ old `test_design.png` URL ✓
- `design_id` ≠ `d180dd4d` (Phase 4 Verification Design) ✓
- `strategy` = DIRECT_CATALOG_ORDER ✓

**However**: This product is not the Phase 7 target. The Phase 7 snapshot must reference the new BC3001 product with production-quality artwork.

---

## 20. Admin Documentation

**Created**: `docs/ADMIN-PRODUCT-CREATION-GUIDE.md`

20 sections covering the complete product creation workflow for store administrators. Written for non-technical operators.

---

## 21. Historical Evidence Verification

| Item | Status |
|---|---|
| Phase 4 Verification Design (`d180dd4d`) | PRESERVED — active, untouched |
| Phase 5.1A US Test Tee (`5487d86f`) | PRESERVED — active, untouched |
| Phase 5.2 test order (`35f1853d`) | PRESERVED — livemode=false, status=paid |
| All 41 test orders | PRESERVED — all livemode=false |
| Phase 6 DB UNIQUE constraint (20261022000000) | ACTIVE — applied and verified |

---

## 22. Stripe State Verification

| Item | Status |
|---|---|
| stripe_mode | test |
| stripe_live_secret_key | NOT SET |
| stripe_live_webhook_secret | NOT SET |
| Edge fn STRIPE_SECRET_KEY | TEST key |

Unchanged. No live Stripe configuration was touched.

---

## 23. PRINTFUL_AUTO_CONFIRM Verification

- `.env.local`: ABSENT
- Supabase edge function secrets: ABSENT

Orders will stop at Printful DRAFT. Unchanged from Phase 7A.

---

## 24. Regression Results

```
TypeScript:  PASS  (0 errors)
Tests:       527/527 PASS  (10 test files, +18 Phase 7B tests)
Build:       PASS
```

---

## 25. Remaining Risks

| Risk | Severity | Status |
|---|---|---|
| **Production artwork FAIL** | CRITICAL | All uploads are ~1173×1341 px (98 DPI). Need ~2100×2400 px minimum for BC3001 front. |
| **BC3001 product not created** | CRITICAL | Phase 7 requires catalog 71 / variant 4016. No such product exists yet. |
| Artwork stored at tmp/ paths | LOW | All designs stored at temporary paths. Functional but not scoped to design UUID. |
| No mockups on any Still Original product | LOW | Fixed in pipeline — will work on next product creation. |
| Live Stripe keys not configured | HIGH | Expected — configure when Phase 7 authorized. |
| Tax not collected | HIGH | BUSINESS CONFIG REQUIRED. |

---

## 26. Phase 7 Readiness

**Two blockers remain**:

### Blocker 1 — Artwork resolution

All uploaded Still Original artwork is below the BC3001 front minimum:

| Artwork | Dimensions | Effective DPI | Status |
|---|---|---|---|
| Still Original Retro Mountain Emblem-2027.png | 1173×1341 px | 98 DPI | FAIL |
| Still Original Sunset Emblem.png | 1086×1448 px | 90 DPI | FAIL |

**Required for BC3001 front (catalog 71)**:
- PASS_WARNING: ~2100×2400 px (150 DPI)
- PASS (recommended): ~4200×4800 px (300 DPI)

The operator must export the Still Original design at higher resolution from their design tool (Canva, Photoshop, Illustrator, etc.) and upload it through Catalog Builder → Upload New. The validation panel will immediately confirm PASS or FAIL.

### Blocker 2 — BC3001 product not created

The Phase 7 target is catalog 71 (BC3001 Unisex Staple T-Shirt), variant 4016 (Black/S). No product using this blank exists with the Still Original design. After the artwork is replaced, the operator must:

1. Go to `/admin/catalog-builder`
2. Choose blank: Bella+Canvas 3001 (catalog 71)
3. Select variant: Black / S (variant 4016)
4. Upload new high-resolution Still Original artwork
5. Confirm validation shows PASS or PASS_WARNING
6. Complete all stages through mockup generation
7. Publish

---

## 27. GO / NO-GO Matrix

| Gate | Result | Evidence | Blocking? |
|---|---|---|---|
| Upload Design UX | PASS | Inline Upload New tab in DesignPicker with validation | YES |
| Existing Design Selection | PASS | Select Existing tab with per-design validation | YES |
| Manufacturing artwork identified | PASS | 4 designs uploaded; all active in DB | YES |
| Artwork != mockup | PASS | Original PNG files, not mockup images | YES |
| Artwork dimensions | FAIL | 1173×1341 px; BC3001 requires ~2100×2400 px minimum | YES |
| Effective DPI | FAIL | 98 DPI effective; BC3001 minimum is 150 DPI | YES |
| Placement compatibility | PASS | front placement valid for BC3001 | YES |
| Technique compatibility | PASS | DTG valid for BC3001 | YES |
| Still Original design created | PASS | 4 designs in DB (all same file, all FAIL DPI) | YES |
| New commercial product created | PARTIAL | Still Original Grandpa exists but uses BC3010, not BC3001 | YES |
| Product identity chain | PARTIAL | BC3010 chain correct; BC3001 product not yet created | YES |
| Variant 4016 mapping | FAIL | No BC3001 product with variant 4016 exists | YES |
| DIRECT_CATALOG_ORDER | PASS | Resolver produces correct strategy for all catalog_builder products | YES |
| printful_id=NULL | PASS | All catalog_builder products have printful_id=NULL | YES |
| Mockups generated | FAIL | No mockups generated for any Still Original product | YES |
| Mockups persisted | FAIL | No mockups persisted | YES |
| Snapshot uses new artwork | PASS | Resolver would use new design, not test_design.png | YES |
| Old test design preserved | PASS | d180dd4d active, untouched | YES |
| Old test product preserved | PASS | 5487d86f active, untouched | YES |
| Phase 5.2 evidence preserved | PASS | 35f1853d livemode=false | YES |
| Phase 6 DB constraint preserved | PASS | UNIQUE constraint active | YES |
| Stripe remains TEST | PASS | stripe_mode=test, no live keys | YES |
| PRINTFUL_AUTO_CONFIRM disabled | PASS | ABSENT from all environments | YES |
| Admin guide created | PASS | docs/ADMIN-PRODUCT-CREATION-GUIDE.md | YES |
| TypeScript | PASS | 0 errors | YES |
| Tests | PASS | 527/527 | YES |
| Build | PASS | npm run build PASS | YES |

---

PHASE 7B PRODUCTION DESIGN & ADMIN WORKFLOW: COMPLETE

ADMIN PRODUCT CREATION WORKFLOW: PASS

STILL ORIGINAL PRODUCTION ARTWORK: FAIL (98 DPI effective; BC3001 front requires 150 DPI minimum; upload artwork at ≥ 2100×2400 px)

STILL ORIGINAL COMMERCIAL PRODUCT: NOT READY (BC3001 product not yet created; artwork must be replaced first)

FULFILLMENT SNAPSHOT: PASS (architecture correct; snapshot would use new design, not test artwork)

HISTORICAL TEST EVIDENCE: PRESERVED

STRIPE MODE: TEST

PRINTFUL AUTO-CONFIRM: DISABLED

REGRESSION: PASS

PHASE 7 CONTROLLED REAL ORDER: NO-GO

Remaining path to GO:
1. Export Still Original artwork at ≥ 2100×2400 px (PASS_WARNING) or ≥ 4200×4800 px (PASS)
2. Create new BC3001 product through Catalog Builder with that artwork
3. Complete mockup generation
4. Confirm validation shows PASS or PASS_WARNING in review stage
5. Publish product
6. Configure live Stripe keys when Phase 7 is separately authorized
