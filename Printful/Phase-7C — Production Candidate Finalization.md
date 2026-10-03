# PHASE 7C — PRODUCTION CANDIDATE FINALIZATION

## PURPOSE

Phase 7C is a narrow completion step between:

Phase 7B — Production Design & Admin Workflow
and
Phase 7 — First Controlled Real Production Order.

DO NOT redesign the platform.

DO NOT begin Phase 8 admin modernization.

DO NOT activate Stripe LIVE.

DO NOT place an order.

The purpose of Phase 7C is to establish ONE clean, verified,
production-ready commercial product that Phase 7 can use for the first
controlled real order.

============================================================
CURRENT VERIFIED BASELINE
============================================================

Phase 7B is COMPLETE.

Verified baseline:

TypeScript: PASS
Tests: 527/527 PASS
Build: PASS

Stripe:
stripe_mode = test

Live Stripe key:
NOT SET

Live webhook secret:
NOT SET

PRINTFUL_AUTO_CONFIRM:
ABSENT / DISABLED

Fulfillment strategy:
DIRECT_CATALOG_ORDER

Historical test evidence:
PRESERVED

Database unique stripe_session_id constraint:
ACTIVE

DO NOT regress any of these conditions.

============================================================
CURRENT PHASE 7B FINDINGS
============================================================

The existing product:

Still Original Grandpa

UUID:
3e84bdce-7e57-4287-a1e3-051cd07be2fc

uses:

Printful catalog product 1592
BC3010 Oversized Boxy Tee

This is NOT the Phase 7 production candidate.

Treat it as a development artifact.

Do not delete it during Phase 7C.

Do not repurpose it as the Phase 7 product.

The intended Phase 7 product remains:

Bella + Canvas 3001
Printful catalog product: 71

Initial controlled-order variant:

Black / S
Printful catalog variant: 4016

Technique:
DTG

Placement:
front

============================================================
FAILED ARTWORK — PRESERVE AS HISTORY
============================================================

Existing Still Original artwork records failed production validation.

Examples include:

Still Original Sunset Emblem
1086 × 1448
~90 DPI effective
FAIL

Still Original Retro Mountain Emblem 2027
1173 × 1341
~98 DPI effective
FAIL

DO NOT use these files for the Phase 7 production candidate.

DO NOT falsely upgrade their validation status.

DO NOT overwrite their metadata to make them appear production-ready.

============================================================
OPERATOR ACTION REQUIRED FIRST
============================================================

The operator will provide/upload a NEW high-resolution Still Original
production artwork file.

Use the existing Phase 7B:

Catalog Builder
→ Design
→ Upload New

workflow.

The new artwork must be validated by the actual artwork-validation
engine.

Do not manually mark it PASS.

Do not bypass validation.

============================================================
IMPORTANT DPI RULE
============================================================

Do NOT determine production readiness merely because the file canvas is
4200 × 4800.

Production readiness must continue to use:

- actual artwork dimensions
- selected Printful product
- selected placement
- Printful printfile specification
- intended physical print dimensions
- effective DPI
- aspect-ratio-preserving fit

Transparent padding alone must NOT artificially convert low-resolution
source artwork into PASS.

Use the Phase 7B validation engine.

Thresholds currently established:

PASS:
>= 300 effective DPI

PASS_WARNING:
>= 150 and < 300 effective DPI

FAIL:
< 150 effective DPI

For the first controlled production order, prefer PASS.

If the result is only PASS_WARNING:

STOP and report it.

Do not automatically treat PASS_WARNING as authorization for Phase 7.

============================================================
PART A — CREATE THE REAL PHASE 7 PRODUCT
============================================================

Once production artwork passes validation, create a NEW product using
the normal Catalog Builder.

Blank:

Bella + Canvas 3001

Printful catalog product:

71

Required initial variant:

Black / S

Printful catalog variant:

4016

Technique:

DTG

Placement:

front

catalog_source:

catalog_builder

products.printful_id:

NULL

products.printful_catalog_id:

71

Do NOT create a Printful Sync Product.

Do NOT create a Printful Sync Variant.

============================================================
PRODUCT IDENTITY
============================================================

This must create a NEW store-owned product UUID.

The Phase 7 candidate must NOT be:

Phase 5.1A US Test Tee

and must NOT be:

Still Original Grandpa

and must NOT overwrite either product.

Record the new:

store product UUID
store variant UUID
design UUID
slug

============================================================
COMMERCIAL PRODUCT DATA
============================================================

Use the Catalog Builder normally.

The operator should be able to set:

Product title
Description
Slug
Retail price
SEO title
SEO description
Category
Collections
Publication status

Do not hardcode commercial copy into the database.

Do not modify checkout pricing architecture.

============================================================
PART B — MOCKUPS
============================================================

Complete the Catalog Builder mockup stage.

Generate actual Printful mockups using:

BC3001
new production artwork
DTG
front
selected variants

Verify the Phase 7B mockup fixes work in an actual product creation.

Verify:

product_images contains mockup records

products.image_url contains the primary mockup

product_variants.image_url is populated appropriately

primary image is correctly designated

mockups are persisted to owned storage

temporary Printful mockup URLs are not the permanent storefront source

============================================================
CRITICAL DISTINCTION
============================================================

Verify again:

MANUFACTURING ARTWORK != STOREFRONT MOCKUP

The manufacturing artwork URL used by fulfillment must reference the
new production artwork.

It must NOT reference:

a shirt mockup
a model mockup
products.image_url
product_images
old test_design.png
old low-resolution Still Original artwork

============================================================
PART C — VERIFY PRODUCT IDENTITY CHAIN
============================================================

After product creation verify:

STORE PRODUCT UUID
      ↓
STORE VARIANT UUID
      ↓
PRINTFUL CATALOG PRODUCT 71
      ↓
PRINTFUL CATALOG VARIANT 4016
      ↓
DIRECT_CATALOG_ORDER

Verify:

catalog_source = catalog_builder

printful_id = NULL

printful_catalog_id = 71

product_variants.printful_variant_id = 4016
for Black / S.

============================================================
PART D — PRODUCTION ARTWORK VERIFICATION
============================================================

Record:

Design UUID

Artwork filename

Artwork storage URL

Pixel width

Pixel height

File type

Transparency status

Printful placement

Printful technique

Printfile canvas

Intended physical print dimensions

Effective DPI

Validation status

Expected:

PASS

If FAIL:

STOP.

If UNVERIFIED:

STOP.

If PASS_WARNING:

STOP and request operator decision.

Do not proceed toward Phase 7 authorization automatically.

============================================================
PART E — FULFILLMENT SNAPSHOT DRY RUN
============================================================

WITHOUT creating Stripe Checkout and WITHOUT placing an order:

Run the fulfillment resolver against:

new Phase 7 product
Black / S store variant

Verify it can construct the immutable fulfillment snapshot.

Snapshot must include the expected:

strategy

store_product_id

store_variant_id

printful_catalog_product_id

printful_catalog_variant_id

design_id

artwork_url

placement

technique

manufacturing options

quantity structure where applicable

============================================================
SNAPSHOT ARTWORK SAFETY
============================================================

Explicitly verify:

snapshot.artwork_url =
NEW PRODUCTION ARTWORK

snapshot.artwork_url !=
old test_design.png

snapshot.artwork_url !=
1086×1448 failed artwork

snapshot.artwork_url !=
1173×1341 failed artwork

snapshot.artwork_url !=
any generated mockup

snapshot.design_id =
NEW production design UUID

============================================================
PART F — PRINTFUL PREFLIGHT
============================================================

Using read-only Printful API operations only, verify:

catalog product 71 still exists

catalog variant 4016 still exists

variant corresponds to Black / S

variant is appropriate for US fulfillment

front placement remains supported

DTG remains supported

required printfile information can be retrieved

Do NOT create a Printful order.

Do NOT create a Sync Product.

============================================================
PART G — STOREFRONT VERIFICATION
============================================================

Verify the new product page renders correctly.

Check:

title

price

primary image

variant selector

Black / S

description

mockups

SEO metadata

active/draft state

Do not place an order.

============================================================
PART H — RECORD ADMIN BACKLOG
============================================================

Phase 7B operator testing identified additional admin-management work.

Record these issues in the Phase 7C report as POST-PHASE-7 backlog:

1. No complete post-creation Product Designer control.

2. No complete post-creation product image manager.

3. Existing product modal is based on the older Printful Sync workflow
   and does not represent the current store-owned Catalog Builder
   architecture well.

4. Design library needs lifecycle management for duplicate/failed
   artwork records.

These are NOT Phase 7C implementation tasks.

Do not rebuild the product admin.

Do not redesign the modal.

Do not build Phase 8A.

Simply preserve these requirements for the next admin-management phase.

============================================================
PART I — HISTORICAL EVIDENCE
============================================================

Verify the following remain preserved:

Phase 4 Verification Design

Phase 5.1A US Test Tee

Phase 5.2 E2E test order

all existing test orders

Still Original Grandpa development artifact

failed Phase 7B artwork records

Do not delete historical evidence during Phase 7C.

============================================================
PART J — STRIPE SAFETY
============================================================

Stripe must remain:

TEST

Do NOT:

configure sk_live

configure live webhook secret

change stripe_mode to live

register production webhook

create a real Checkout Session

charge a card

Those actions belong to Phase 7.

============================================================
PART K — PRINTFUL SAFETY
============================================================

Verify:

PRINTFUL_AUTO_CONFIRM remains ABSENT.

Do NOT set it true.

Do NOT submit a real Printful order.

Do NOT confirm manufacturing.

============================================================
PART L — REGRESSION
============================================================

Run:

npx tsc --noEmit

Expected:

PASS

Run complete test suite.

Baseline:

527/527 PASS

Expected:

>=527 tests
ALL PASS

Run:

npm run build

Expected:

PASS

Do not weaken tests.

============================================================
PHASE 7C REPORT
============================================================

Create:

PHASE-7C-PRODUCTION-CANDIDATE-FINALIZATION-REPORT.md

Include:

1. Executive Summary

2. Phase 7B Starting State

3. Production Artwork

4. Artwork Validation

5. Effective DPI

6. New BC3001 Product

7. Product UUID

8. Store Variant UUID

9. Design UUID

10. Printful Mapping

11. Manufacturing Configuration

12. Mockup Generation

13. Mockup Persistence

14. Storefront Verification

15. Product Identity Chain

16. Fulfillment Snapshot Dry Run

17. Snapshot Artwork Verification

18. Printful Read-Only Preflight

19. Historical Evidence

20. Stripe State

21. PRINTFUL_AUTO_CONFIRM State

22. Regression Results

23. Admin Product Management Backlog

24. Remaining Risks

25. Phase 7 GO / NO-GO Matrix

============================================================
FINAL GO / NO-GO MATRIX
============================================================

Include at minimum:

| Gate | Result | Evidence | Blocking? |
|---|---|---|---|
| Production artwork | | | YES |
| Artwork effective DPI | | | YES |
| Artwork validation | | | YES |
| BC3001 product created | | | YES |
| New store product UUID | | | YES |
| Black/S store variant | | | YES |
| Printful catalog product 71 | | | YES |
| Printful variant 4016 | | | YES |
| DTG/front configuration | | | YES |
| DIRECT_CATALOG_ORDER | | | YES |
| printful_id=NULL | | | YES |
| Mockups generated | | | YES |
| Mockups persisted | | | YES |
| Primary storefront image | | | YES |
| Snapshot generated | | | YES |
| Snapshot uses production artwork | | | YES |
| Snapshot excludes mockup | | | YES |
| Printful read-only preflight | | | YES |
| Historical evidence preserved | | | YES |
| Stripe remains TEST | | | YES |
| PRINTFUL_AUTO_CONFIRM disabled | | | YES |
| TypeScript | | | YES |
| Tests | | | YES |
| Build | | | YES |

============================================================
FINAL DECISION
============================================================

End with:

PHASE 7C PRODUCTION CANDIDATE FINALIZATION:
COMPLETE | INCOMPLETE

PRODUCTION ARTWORK:
PASS | PASS_WARNING | FAIL | UNVERIFIED

BC3001 PRODUCTION PRODUCT:
READY | NOT READY

MOCKUP PIPELINE:
PASS | FAIL

PRODUCT IDENTITY CHAIN:
PASS | FAIL

FULFILLMENT SNAPSHOT:
PASS | FAIL

SNAPSHOT ARTWORK:
PRODUCTION ARTWORK | INCORRECT

STRIPE MODE:
TEST | LIVE | ERROR

PRINTFUL AUTO-CONFIRM:
DISABLED | ENABLED

REGRESSION:
PASS | FAIL

ADMIN MANAGEMENT BACKLOG:
RECORDED | NOT RECORDED

PHASE 7 CONTROLLED REAL ORDER:
GO | NO-GO

============================================================
HARD STOP
============================================================

STOP after Phase 7C.

A GO result means only:

"The production candidate is ready for Phase 7."

It does NOT authorize:

Stripe LIVE activation

a real card charge

a real Printful order

Printful confirmation

manufacturing

The next authorized phase remains:

PHASE 7 — FIRST CONTROLLED REAL PRODUCTION ORDER