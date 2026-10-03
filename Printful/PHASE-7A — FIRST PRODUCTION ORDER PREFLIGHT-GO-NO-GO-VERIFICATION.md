# # PHASE 7A — FIRST PRODUCTION ORDER PREFLIGHT & GO/NO-GO VERIFICATION

You are working in the existing Next.js + Supabase + Stripe + Printful
print-on-demand storefront.

Phase 6 — Production Readiness & Launch Hardening is COMPLETE.

DO NOT redesign the architecture.

DO NOT place a real customer order.

DO NOT create or confirm a Printful production order.

DO NOT charge a real payment card.

DO NOT set PRINTFUL_AUTO_CONFIRM=true.

This phase is a PRE-FLIGHT verification phase only.

The purpose of Phase 7A is to prove that the exact product, variant,
artwork, database, Stripe LIVE configuration, webhook configuration,
Printful configuration, and production environment are ready for ONE
controlled real production order in Phase 7.

============================================================
PHASE 6 VERIFIED BASELINE
============================================================

Preserve all Phase 6 behavior.

Current verified baseline:

- Phase 6 COMPLETE
- Core commerce safety gate PASS
- TypeScript PASS
- 509/509 automated tests PASS
- Production build PASS

Catalog Builder architecture:

catalog_source = "catalog_builder"

products.printful_id = NULL

products.printful_catalog_id =
    Printful CATALOG product ID

product_variants.printful_variant_id =
    Printful CATALOG variant ID

Fulfillment strategy:

DIRECT_CATALOG_ORDER

DO NOT create Printful Sync Products or Sync Variants for
Catalog Builder products.

Legacy:

catalog_source = "printful_sync"

must continue to function without regression.

============================================================
EXISTING PRODUCTION SAFETY ARCHITECTURE
============================================================

Preserve:

Store Variant UUID
    ↓
server-side database resolution
    ↓
immutable fulfillment snapshot
    ↓
Stripe Checkout
    ↓
signed checkout.session.completed webhook
    ↓
local paid order
    ↓
DIRECT_CATALOG_ORDER
    ↓
Printful DRAFT
    ↓
ADMIN REVIEW
    ↓
manual "Confirm → Production"

PRINTFUL_AUTO_CONFIRM must remain absent/false.

The first real order MUST stop at Printful DRAFT.

============================================================
PHASE 7A OBJECTIVE
============================================================

Establish a single, exact production candidate:

ONE store product
ONE store variant
ONE design
ONE manufacturing artwork file
ONE Printful catalog variant
ONE placement
ONE manufacturing technique

Then verify that every production prerequisite is satisfied.

At completion produce:

PHASE-7A-FIRST-PRODUCTION-ORDER-PREFLIGHT-REPORT.md

with a final GO / NO-GO decision.

DO NOT execute Phase 7.

============================================================
STEP 1 — INSPECT CURRENT REPOSITORY
============================================================

Before changing anything:

Inspect the repository and identify the existing implementations for:

- Catalog Builder
- products
- product_variants
- designs
- product_designs
- product_images
- fulfillment snapshots
- Stripe checkout
- Stripe configuration
- Stripe webhook
- Printful proxy
- Printful webhook
- admin orders
- manual Printful confirmation
- cancellation
- shipping
- environment configuration
- Supabase migrations

Do not assume file paths solely from this prompt.

Use the actual repository.

Document the relevant files in the final report.

Do not rewrite working systems unnecessarily.

============================================================
STEP 2 — SELECT THE PRODUCTION CANDIDATE
============================================================

DO NOT automatically select a random product.

Identify suitable ACTIVE Catalog Builder products and report their
production-relevant information.

The operator must be able to choose the exact candidate.

For each reasonable candidate show:

- store product UUID
- product title
- slug
- catalog_source
- active/publication status
- Printful catalog product ID
- available store variant UUIDs
- Printful catalog variant IDs
- color
- size
- technique
- placement
- attached design UUID
- manufacturing artwork URL
- retail price
- provider cost if available

If only one suitable production-quality candidate exists, identify it,
but do not silently assume it is approved.

The final selected candidate must be explicitly recorded as the:

FIRST PRODUCTION CANDIDATE

============================================================
STEP 3 — VERIFY PRODUCT IDENTITY
============================================================

For the selected candidate verify:

store product UUID
    ↓
store variant UUID
    ↓
Printful catalog product ID
    ↓
Printful catalog variant ID

Confirm:

catalog_source = catalog_builder

Confirm:

products.printful_id IS NULL

Confirm:

products.printful_catalog_id IS NOT NULL

Confirm:

product_variants.printful_variant_id IS NOT NULL

Verify the selected Printful catalog product/variant still exists.

Verify the selected variant is appropriate for a US order.

Do not create a Sync Product.

Do not create a Sync Variant.

============================================================
STEP 4 — VERIFY DESIGN OWNERSHIP
============================================================

Trace:

store product
    ↓
product_designs
    ↓
design
    ↓
manufacturing artwork

Record:

- design UUID
- design name/title
- artwork storage location
- artwork URL
- placement
- technique
- product relationship

Verify that the manufacturing artwork is NOT merely a product mockup.

Mockups belong to storefront presentation.

Manufacturing artwork must be the actual production artwork.

FAIL the artwork gate if the system cannot clearly distinguish these.

============================================================
STEP 5 — PRODUCTION ARTWORK INSPECTION
============================================================

This is the primary substantive Phase 7A gate.

Inspect the ACTUAL manufacturing artwork file.

Do not infer production quality merely because Printful previously
accepted an upload.

For the selected product + variant + placement + technique determine
the applicable production requirements.

Validate as much as can be objectively verified from the actual file:

- file format
- pixel dimensions
- aspect ratio
- transparency / alpha channel
- background behavior
- file size
- color mode / embedded color information where detectable
- effective DPI at intended print dimensions
- print-area compatibility
- scaling behavior
- whether important artwork is likely to be clipped
- whether text/details appear excessively small
- whether the source appears to be a mockup rather than artwork

For DPI calculate:

effective_DPI_x =
    artwork_pixel_width / intended_print_width_inches

effective_DPI_y =
    artwork_pixel_height / intended_print_height_inches

Use the actual Printful placement dimensions applicable to the selected
product.

Do not invent dimensions.

If current repository/API data does not provide authoritative dimensions,
retrieve them through the existing Printful integration or clearly mark
the item UNVERIFIED.

Classify artwork:

PASS
PASS WITH WARNING
FAIL
UNVERIFIED

A FAIL or materially UNVERIFIED production artwork result must produce:

PHASE 7A GO/NO-GO = NO-GO

Do not automatically modify the artwork unless specifically instructed.

If artwork needs correction, report exactly what must change.

============================================================
STEP 6 — VERIFY FULFILLMENT SNAPSHOT GENERATION
============================================================

Without creating a Stripe session or charging anything, verify that the
selected candidate can produce a valid fulfillment snapshot through the
existing application logic.

Expected strategy:

DIRECT_CATALOG_ORDER

Verify snapshot would contain the authoritative values required for
manufacturing, including:

- version
- strategy
- store product UUID
- store variant UUID
- Printful catalog product ID
- Printful catalog variant ID
- design UUID
- artwork URL
- placement
- technique
- required options
- frozen timestamp behavior

DO NOT create fake production data.

Prefer exercising existing validation/resolution functions in a safe
non-payment test where possible.

Confirm the snapshot does not depend on browser-provided:

- retail price
- Printful variant ID
- artwork URL
- fulfillment state

============================================================
STEP 7 — APPLY / VERIFY PHASE 6 DATABASE MIGRATION
============================================================

Migration:

supabase/migrations/
20261022000000_phase6_stripe_session_unique.sql

First inspect production DB state.

Determine whether the migration has already been applied.

If not applied:

Run the migration using the project's normal production migration
procedure.

The migration contains a duplicate pre-flight check.

DO NOT bypass it.

DO NOT delete or alter historical orders merely to force the migration
through.

Verify afterward:

orders.stripe_session_id

has the intended UNIQUE constraint.

Also verify the Phase 6 admin-attention indexes exist.

Report:

MIGRATION:
ALREADY APPLIED
or
APPLIED SUCCESSFULLY
or
FAILED

If FAILED:

STOP.

PHASE 7A = NO-GO.

============================================================
STEP 8 — VERIFY TEST/LIVE DATA ISOLATION
============================================================

Verify:

orders.livemode

continues to distinguish test and live orders.

Existing Phase 5.2 test orders must remain:

livemode=false

Do not delete historical Phase 5.2 evidence.

Verify admin order filtering continues to distinguish:

TEST
LIVE

Verify test orders are excluded from live revenue reporting.

============================================================
STEP 9 — STRIPE LIVE CONFIGURATION
============================================================

Inspect the existing Stripe configuration implementation.

Do NOT expose secrets in the report.

Do NOT print complete API keys.

Determine current Stripe mode.

If LIVE Stripe credentials have not yet been configured, report exactly
what operator action is required.

The existing intended workflow is:

/admin/stripe
    ↓
enter LIVE Stripe secret key
    ↓
Save & Activate
    ↓
store live configuration
    ↓
register live webhook
    ↓
push correct secrets to Supabase
    ↓
stripe_mode = live

Do not hardcode credentials.

Do not place credentials in source code.

Do not put credentials in client-side environment variables.

After configuration verify:

- stripe_mode = live
- active secret is LIVE
- live webhook secret exists
- Supabase stripe-webhook function has the appropriate live secret
- no test/live mismatch is detected
- admin interface indicates LIVE mode

Never include the actual secrets in the report.

Display only:

SET
NOT SET
TEST
LIVE
MISMATCH

============================================================
STEP 10 — VERIFY LIVE STRIPE WEBHOOK
============================================================

Verify the production Stripe webhook registration.

Expected endpoint:

https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook

Verify the LIVE Stripe account has a webhook for the correct endpoint.

Verify required handled events include:

checkout.session.completed

payment_intent.payment_failed

Verify:

- webhook is enabled
- webhook secret exists
- application is using the LIVE webhook secret
- signature verification remains enabled

Use Stripe's safe webhook test mechanism if available through the
existing implementation/dashboard workflow.

DO NOT create a real Checkout payment.

DO NOT manufacture anything.

Record:

LIVE STRIPE WEBHOOK:
PASS / FAIL / UNVERIFIED

============================================================
STEP 11 — PRINTFUL AUTO-CONFIRM SAFETY
============================================================

This is a HARD STOP gate.

Inspect the deployed Supabase Edge Function environment.

Verify:

PRINTFUL_AUTO_CONFIRM

is either:

ABSENT

or otherwise resolves to FALSE under the existing exact comparison:

value === "true"

Preferred production state for Phase 7:

ABSENT

If:

PRINTFUL_AUTO_CONFIRM=true

STOP.

Do not place a real order.

Do not automatically change it silently.

Report:

PRINTFUL_AUTO_CONFIRM:
ABSENT — PASS

or

FALSE — PASS

or

TRUE — CRITICAL FAIL

============================================================
STEP 12 — VERIFY PRINTFUL PRODUCTION ACCESS
============================================================

Verify without manufacturing:

- PRINTFUL_API_TOKEN is configured server-side
- Printful API authentication succeeds
- selected catalog product exists
- selected catalog variant exists
- selected variant is available for intended destination
- direct catalog ordering remains supported by current implementation
- Printful store sync is NOT required for this Catalog Builder product

Do not create a Printful production order.

If a temporary harmless API read is necessary, use GET/read-only
operations only.

============================================================
STEP 13 — VERIFY ADMIN PRODUCTION CONTROLS
============================================================

Verify `/admin/orders`.

Confirm the operator has:

Needs Attention filter

and visibility for:

needs_admin_review
failed fulfillment
paid + no Printful order

Verify manual production controls:

Confirm → Production

Cancel Draft

Confirm that "Confirm → Production" requires:

- admin authentication
- paid local order
- Printful order ID
- live provider verification
- Printful status = draft
- valid fulfillment snapshot for Catalog Builder products

Confirm "Cancel Draft" only applies while provider order is draft.

DO NOT execute either operation during Phase 7A.

============================================================
STEP 14 — REFUND / ROLLBACK READINESS
============================================================

Verify the operator can perform the Phase 7 rollback procedure:

Before Printful confirmation:

Printful draft
    ↓
Cancel Draft
    ↓
Stripe refund if necessary

Confirm Stripe refund capability remains admin-protected.

Confirm Printful cancellation remains admin-protected.

Do not issue an actual refund.

Do not cancel historical test evidence unnecessarily.

============================================================
STEP 15 — SHIPPING PREFLIGHT
============================================================

Verify the selected candidate can obtain a valid US Printful shipping
rate using the existing shipping-rate implementation.

Do not create a real checkout session if avoidable.

Verify:

- provider shipping lookup succeeds
- fallback shipping configuration exists
- US remains an allowed destination
- no stale hardcoded production shipping price has replaced the
  provider-derived rate

Record the observed provider rate if safely obtainable.

Do not assume Phase 5.2's $4.95 remains current.

============================================================
STEP 16 — TAX STATUS
============================================================

Do not make tax/legal decisions.

Report the current technical configuration exactly.

Expected current baseline:

Stripe Tax = NOT CONFIGURED
customer tax collection = $0

Do not enable Stripe Tax without operator authorization.

Clearly state that this remains a BUSINESS CONFIGURATION decision for
public launch.

It does not automatically block ONE operator-controlled production test,
but it remains a public-launch issue.

============================================================
STEP 17 — CUSTOMER COMMUNICATION PREFLIGHT
============================================================

Verify:

- order confirmation email path
- shipping notification path
- refund notification path

Do not send unnecessary customer messages during Phase 7A.

Record any remaining manual communication paths.

============================================================
STEP 18 — PRODUCTION OBSERVABILITY PLAN
============================================================

Because Phase 7 will involve real money and a real manufactured item,
create an exact monitoring checklist for the Phase 7 operator.

Identify where to watch:

Stripe
Supabase orders
Supabase stripe-webhook logs
Supabase printful-webhook logs
/admin/orders
Printful Dashboard
customer email inbox

Define expected state transitions.

Expected initial sequence:

Stripe payment:
SUCCESS

Local order:
paid

livemode:
true

Printful:
draft

At this point:

STOP.

No automatic manufacturing should occur.

============================================================
STEP 19 — PHASE 7 EXACT EXECUTION PLAN
============================================================

Prepare—but DO NOT execute—the Phase 7 procedure.

It should contain exact steps:

1. Open production storefront.

2. Select the approved Phase 7A product.

3. Select the approved variant.

4. Add quantity 1.

5. Verify displayed retail price.

6. Begin LIVE Stripe checkout.

7. Verify Stripe checkout is LIVE.

8. Complete payment using operator's real payment method.

9. Verify live Stripe payment.

10. Verify exactly ONE local order exists.

11. Verify:

    livemode=true
    status=paid

12. Verify immutable fulfillment snapshot matches the Phase 7A
    approved candidate.

13. Verify exactly ONE Printful order exists.

14. Verify Printful status:

    draft

15. STOP.

16. Open `/admin/orders`.

17. Click "Check Printful".

18. Verify manually:

    product
    variant
    size
    color
    quantity
    recipient
    artwork
    placement
    technique
    retail amount
    shipping
    provider cost

19. If ANYTHING is wrong:

    DO NOT CONFIRM.

    Cancel Draft.

    Refund Stripe payment if appropriate.

20. If everything is correct:

    click:

    Confirm → Production

21. Verify transition:

    draft
      ↓
    pending / in-production

22. Monitor production.

23. Verify shipping webhook.

24. Verify customer shipping email.

25. Verify tracking information.

26. Receive physical product.

27. Inspect:

    garment/product
    print quality
    print size
    placement
    color
    artwork sharpness
    packaging
    shipping
    overall customer experience

============================================================
STEP 20 — DO NOT OVER-IMPLEMENT
============================================================

Phase 7A is primarily a verification/configuration phase.

Do not introduce unrelated architecture.

Do not:

- build catalog batch generation
- build AI merchandising
- refactor Catalog Builder
- redesign checkout
- redesign admin
- enable automatic manufacturing
- add a second fulfillment provider
- migrate legacy products
- create Printful Sync Products
- execute Phase 7

Only make code changes if a genuine Phase 7A blocker is discovered.

If code changes are necessary:

1. explain the defect
2. implement the smallest safe correction
3. add meaningful regression tests
4. rerun full verification

============================================================
STEP 21 — REGRESSION
============================================================

Run:

npx tsc --noEmit

Expected:
PASS

Run complete automated test suite.

Baseline:
509/509 PASS

Expected:
>=509 tests
ALL PASS

Run:

npm run build

Expected:
PASS

Verify legacy quarter-zip behavior has not regressed.

Verify Catalog Builder remains DIRECT_CATALOG_ORDER.

Verify no Printful Sync Product/Variant was accidentally created.

============================================================
STEP 22 — PHASE 7A GO / NO-GO MATRIX
============================================================

Create this matrix in the report:

| Gate | Result | Evidence | Blocking? |
|---|---|---|---|
| Production candidate selected | | | YES |
| Product identity verified | | | YES |
| Store variant mapping verified | | | YES |
| Catalog Builder ownership model | | | YES |
| Manufacturing artwork identified | | | YES |
| Artwork is not mockup | | | YES |
| Artwork dimensions verified | | | YES |
| Effective DPI verified | | | YES |
| Print area compatibility | | | YES |
| Artwork production quality | | | YES |
| Fulfillment snapshot generation | | | YES |
| Phase 6 DB migration applied | | | YES |
| stripe_session_id UNIQUE verified | | | YES |
| Test/live data isolation | | | YES |
| Stripe LIVE key configured | | | YES |
| stripe_mode=live | | | YES |
| LIVE webhook registered | | | YES |
| LIVE webhook secret active | | | YES |
| Stripe environment consistency | | | YES |
| PRINTFUL_AUTO_CONFIRM absent/false | | | YES |
| Printful API authentication | | | YES |
| Catalog variant available | | | YES |
| Admin manual confirmation | | | YES |
| Admin draft cancellation | | | YES |
| Refund capability | | | YES |
| US shipping rate available | | | YES |
| Tax status documented | | | NO* |
| Customer confirmation path | | | YES |
| Shipping notification path | | | YES |
| Monitoring plan prepared | | | YES |
| TypeScript | | | YES |
| Automated tests | | | YES |
| Production build | | | YES |

*Tax remains a public-launch business configuration decision.
Do not make a legal conclusion.

============================================================
STEP 23 — REQUIRED REPORT
============================================================

Create:

PHASE-7A-FIRST-PRODUCTION-ORDER-PREFLIGHT-REPORT.md

Include:

1. Executive Summary
2. Phase 6 Baseline
3. Repository Inspection
4. Selected First Production Candidate
5. Product Identity Chain
6. Variant Verification
7. Design / Artwork Trace
8. Artwork Technical Inspection
9. Printful Production Requirements
10. Effective DPI Calculation
11. Print Area Compatibility
12. Fulfillment Snapshot Verification
13. Production Database Migration
14. Database Idempotency Verification
15. Test / Live Data Isolation
16. Stripe LIVE Configuration
17. Stripe LIVE Webhook Verification
18. Printful Configuration
19. PRINTFUL_AUTO_CONFIRM Verification
20. Admin Production Controls
21. Refund / Cancellation Rollback
22. Shipping Verification
23. Tax Configuration Status
24. Customer Communications
25. Monitoring Plan
26. Regression Results
27. Remaining Risks
28. Phase 7 Exact Execution Plan
29. GO / NO-GO Matrix
30. Final Decision

============================================================
FINAL DECISION FORMAT
============================================================

End the report with EXACTLY:

PHASE 7A FIRST PRODUCTION ORDER PREFLIGHT:
COMPLETE | INCOMPLETE

PRODUCTION ARTWORK GATE:
PASS | FAIL | UNVERIFIED

PRODUCTION DATABASE GATE:
PASS | FAIL

STRIPE LIVE CONFIGURATION GATE:
PASS | FAIL | UNVERIFIED

STRIPE LIVE WEBHOOK GATE:
PASS | FAIL | UNVERIFIED

PRINTFUL SAFETY GATE:
PASS | FAIL

PRINTFUL AUTO-CONFIRM:
DISABLED | ENABLED

REGRESSION:
PASS | FAIL

PHASE 7 CONTROLLED REAL ORDER:
GO | NO-GO

============================================================
HARD STOP
============================================================

Even if every gate passes:

DO NOT place the real order.

DO NOT charge a card.

DO NOT confirm a Printful order.

DO NOT begin manufacturing.

Stop after producing the Phase 7A report.

The operator must separately authorize:

PHASE 7 — CONTROLLED FIRST REAL PRODUCTION ORDER.N

You are working in the existing Next.js + Supabase + Stripe + Printful
print-on-demand storefront.

Phase 6 — Production Readiness & Launch Hardening is COMPLETE.

DO NOT redesign the architecture.

DO NOT place a real customer order.

DO NOT create or confirm a Printful production order.

DO NOT charge a real payment card.

DO NOT set PRINTFUL_AUTO_CONFIRM=true.

This phase is a PRE-FLIGHT verification phase only.

The purpose of Phase 7A is to prove that the exact product, variant,
artwork, database, Stripe LIVE configuration, webhook configuration,
Printful configuration, and production environment are ready for ONE
controlled real production order in Phase 7.

============================================================
PHASE 6 VERIFIED BASELINE
============================================================

Preserve all Phase 6 behavior.

Current verified baseline:

- Phase 6 COMPLETE
- Core commerce safety gate PASS
- TypeScript PASS
- 509/509 automated tests PASS
- Production build PASS

Catalog Builder architecture:

catalog_source = "catalog_builder"

products.printful_id = NULL

products.printful_catalog_id =
    Printful CATALOG product ID

product_variants.printful_variant_id =
    Printful CATALOG variant ID

Fulfillment strategy:

DIRECT_CATALOG_ORDER

DO NOT create Printful Sync Products or Sync Variants for
Catalog Builder products.

Legacy:

catalog_source = "printful_sync"

must continue to function without regression.

============================================================
EXISTING PRODUCTION SAFETY ARCHITECTURE
============================================================

Preserve:

Store Variant UUID
    ↓
server-side database resolution
    ↓
immutable fulfillment snapshot
    ↓
Stripe Checkout
    ↓
signed checkout.session.completed webhook
    ↓
local paid order
    ↓
DIRECT_CATALOG_ORDER
    ↓
Printful DRAFT
    ↓
ADMIN REVIEW
    ↓
manual "Confirm → Production"

PRINTFUL_AUTO_CONFIRM must remain absent/false.

The first real order MUST stop at Printful DRAFT.

============================================================
PHASE 7A OBJECTIVE
============================================================

Establish a single, exact production candidate:

ONE store product
ONE store variant
ONE design
ONE manufacturing artwork file
ONE Printful catalog variant
ONE placement
ONE manufacturing technique

Then verify that every production prerequisite is satisfied.

At completion produce:

PHASE-7A-FIRST-PRODUCTION-ORDER-PREFLIGHT-REPORT.md

with a final GO / NO-GO decision.

DO NOT execute Phase 7.

============================================================
STEP 1 — INSPECT CURRENT REPOSITORY
============================================================

Before changing anything:

Inspect the repository and identify the existing implementations for:

- Catalog Builder
- products
- product_variants
- designs
- product_designs
- product_images
- fulfillment snapshots
- Stripe checkout
- Stripe configuration
- Stripe webhook
- Printful proxy
- Printful webhook
- admin orders
- manual Printful confirmation
- cancellation
- shipping
- environment configuration
- Supabase migrations

Do not assume file paths solely from this prompt.

Use the actual repository.

Document the relevant files in the final report.

Do not rewrite working systems unnecessarily.

============================================================
STEP 2 — SELECT THE PRODUCTION CANDIDATE
============================================================

DO NOT automatically select a random product.

Identify suitable ACTIVE Catalog Builder products and report their
production-relevant information.

The operator must be able to choose the exact candidate.

For each reasonable candidate show:

- store product UUID
- product title
- slug
- catalog_source
- active/publication status
- Printful catalog product ID
- available store variant UUIDs
- Printful catalog variant IDs
- color
- size
- technique
- placement
- attached design UUID
- manufacturing artwork URL
- retail price
- provider cost if available

If only one suitable production-quality candidate exists, identify it,
but do not silently assume it is approved.

The final selected candidate must be explicitly recorded as the:

FIRST PRODUCTION CANDIDATE

============================================================
STEP 3 — VERIFY PRODUCT IDENTITY
============================================================

For the selected candidate verify:

store product UUID
    ↓
store variant UUID
    ↓
Printful catalog product ID
    ↓
Printful catalog variant ID

Confirm:

catalog_source = catalog_builder

Confirm:

products.printful_id IS NULL

Confirm:

products.printful_catalog_id IS NOT NULL

Confirm:

product_variants.printful_variant_id IS NOT NULL

Verify the selected Printful catalog product/variant still exists.

Verify the selected variant is appropriate for a US order.

Do not create a Sync Product.

Do not create a Sync Variant.

============================================================
STEP 4 — VERIFY DESIGN OWNERSHIP
============================================================

Trace:

store product
    ↓
product_designs
    ↓
design
    ↓
manufacturing artwork

Record:

- design UUID
- design name/title
- artwork storage location
- artwork URL
- placement
- technique
- product relationship

Verify that the manufacturing artwork is NOT merely a product mockup.

Mockups belong to storefront presentation.

Manufacturing artwork must be the actual production artwork.

FAIL the artwork gate if the system cannot clearly distinguish these.

============================================================
STEP 5 — PRODUCTION ARTWORK INSPECTION
============================================================

This is the primary substantive Phase 7A gate.

Inspect the ACTUAL manufacturing artwork file.

Do not infer production quality merely because Printful previously
accepted an upload.

For the selected product + variant + placement + technique determine
the applicable production requirements.

Validate as much as can be objectively verified from the actual file:

- file format
- pixel dimensions
- aspect ratio
- transparency / alpha channel
- background behavior
- file size
- color mode / embedded color information where detectable
- effective DPI at intended print dimensions
- print-area compatibility
- scaling behavior
- whether important artwork is likely to be clipped
- whether text/details appear excessively small
- whether the source appears to be a mockup rather than artwork

For DPI calculate:

effective_DPI_x =
    artwork_pixel_width / intended_print_width_inches

effective_DPI_y =
    artwork_pixel_height / intended_print_height_inches

Use the actual Printful placement dimensions applicable to the selected
product.

Do not invent dimensions.

If current repository/API data does not provide authoritative dimensions,
retrieve them through the existing Printful integration or clearly mark
the item UNVERIFIED.

Classify artwork:

PASS
PASS WITH WARNING
FAIL
UNVERIFIED

A FAIL or materially UNVERIFIED production artwork result must produce:

PHASE 7A GO/NO-GO = NO-GO

Do not automatically modify the artwork unless specifically instructed.

If artwork needs correction, report exactly what must change.

============================================================
STEP 6 — VERIFY FULFILLMENT SNAPSHOT GENERATION
============================================================

Without creating a Stripe session or charging anything, verify that the
selected candidate can produce a valid fulfillment snapshot through the
existing application logic.

Expected strategy:

DIRECT_CATALOG_ORDER

Verify snapshot would contain the authoritative values required for
manufacturing, including:

- version
- strategy
- store product UUID
- store variant UUID
- Printful catalog product ID
- Printful catalog variant ID
- design UUID
- artwork URL
- placement
- technique
- required options
- frozen timestamp behavior

DO NOT create fake production data.

Prefer exercising existing validation/resolution functions in a safe
non-payment test where possible.

Confirm the snapshot does not depend on browser-provided:

- retail price
- Printful variant ID
- artwork URL
- fulfillment state

============================================================
STEP 7 — APPLY / VERIFY PHASE 6 DATABASE MIGRATION
============================================================

Migration:

supabase/migrations/
20261022000000_phase6_stripe_session_unique.sql

First inspect production DB state.

Determine whether the migration has already been applied.

If not applied:

Run the migration using the project's normal production migration
procedure.

The migration contains a duplicate pre-flight check.

DO NOT bypass it.

DO NOT delete or alter historical orders merely to force the migration
through.

Verify afterward:

orders.stripe_session_id

has the intended UNIQUE constraint.

Also verify the Phase 6 admin-attention indexes exist.

Report:

MIGRATION:
ALREADY APPLIED
or
APPLIED SUCCESSFULLY
or
FAILED

If FAILED:

STOP.

PHASE 7A = NO-GO.

============================================================
STEP 8 — VERIFY TEST/LIVE DATA ISOLATION
============================================================

Verify:

orders.livemode

continues to distinguish test and live orders.

Existing Phase 5.2 test orders must remain:

livemode=false

Do not delete historical Phase 5.2 evidence.

Verify admin order filtering continues to distinguish:

TEST
LIVE

Verify test orders are excluded from live revenue reporting.

============================================================
STEP 9 — STRIPE LIVE CONFIGURATION
============================================================

Inspect the existing Stripe configuration implementation.

Do NOT expose secrets in the report.

Do NOT print complete API keys.

Determine current Stripe mode.

If LIVE Stripe credentials have not yet been configured, report exactly
what operator action is required.

The existing intended workflow is:

/admin/stripe
    ↓
enter LIVE Stripe secret key
    ↓
Save & Activate
    ↓
store live configuration
    ↓
register live webhook
    ↓
push correct secrets to Supabase
    ↓
stripe_mode = live

Do not hardcode credentials.

Do not place credentials in source code.

Do not put credentials in client-side environment variables.

After configuration verify:

- stripe_mode = live
- active secret is LIVE
- live webhook secret exists
- Supabase stripe-webhook function has the appropriate live secret
- no test/live mismatch is detected
- admin interface indicates LIVE mode

Never include the actual secrets in the report.

Display only:

SET
NOT SET
TEST
LIVE
MISMATCH

============================================================
STEP 10 — VERIFY LIVE STRIPE WEBHOOK
============================================================

Verify the production Stripe webhook registration.

Expected endpoint:

https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook

Verify the LIVE Stripe account has a webhook for the correct endpoint.

Verify required handled events include:

checkout.session.completed

payment_intent.payment_failed

Verify:

- webhook is enabled
- webhook secret exists
- application is using the LIVE webhook secret
- signature verification remains enabled

Use Stripe's safe webhook test mechanism if available through the
existing implementation/dashboard workflow.

DO NOT create a real Checkout payment.

DO NOT manufacture anything.

Record:

LIVE STRIPE WEBHOOK:
PASS / FAIL / UNVERIFIED

============================================================
STEP 11 — PRINTFUL AUTO-CONFIRM SAFETY
============================================================

This is a HARD STOP gate.

Inspect the deployed Supabase Edge Function environment.

Verify:

PRINTFUL_AUTO_CONFIRM

is either:

ABSENT

or otherwise resolves to FALSE under the existing exact comparison:

value === "true"

Preferred production state for Phase 7:

ABSENT

If:

PRINTFUL_AUTO_CONFIRM=true

STOP.

Do not place a real order.

Do not automatically change it silently.

Report:

PRINTFUL_AUTO_CONFIRM:
ABSENT — PASS

or

FALSE — PASS

or

TRUE — CRITICAL FAIL

============================================================
STEP 12 — VERIFY PRINTFUL PRODUCTION ACCESS
============================================================

Verify without manufacturing:

- PRINTFUL_API_TOKEN is configured server-side
- Printful API authentication succeeds
- selected catalog product exists
- selected catalog variant exists
- selected variant is available for intended destination
- direct catalog ordering remains supported by current implementation
- Printful store sync is NOT required for this Catalog Builder product

Do not create a Printful production order.

If a temporary harmless API read is necessary, use GET/read-only
operations only.

============================================================
STEP 13 — VERIFY ADMIN PRODUCTION CONTROLS
============================================================

Verify `/admin/orders`.

Confirm the operator has:

Needs Attention filter

and visibility for:

needs_admin_review
failed fulfillment
paid + no Printful order

Verify manual production controls:

Confirm → Production

Cancel Draft

Confirm that "Confirm → Production" requires:

- admin authentication
- paid local order
- Printful order ID
- live provider verification
- Printful status = draft
- valid fulfillment snapshot for Catalog Builder products

Confirm "Cancel Draft" only applies while provider order is draft.

DO NOT execute either operation during Phase 7A.

============================================================
STEP 14 — REFUND / ROLLBACK READINESS
============================================================

Verify the operator can perform the Phase 7 rollback procedure:

Before Printful confirmation:

Printful draft
    ↓
Cancel Draft
    ↓
Stripe refund if necessary

Confirm Stripe refund capability remains admin-protected.

Confirm Printful cancellation remains admin-protected.

Do not issue an actual refund.

Do not cancel historical test evidence unnecessarily.

============================================================
STEP 15 — SHIPPING PREFLIGHT
============================================================

Verify the selected candidate can obtain a valid US Printful shipping
rate using the existing shipping-rate implementation.

Do not create a real checkout session if avoidable.

Verify:

- provider shipping lookup succeeds
- fallback shipping configuration exists
- US remains an allowed destination
- no stale hardcoded production shipping price has replaced the
  provider-derived rate

Record the observed provider rate if safely obtainable.

Do not assume Phase 5.2's $4.95 remains current.

============================================================
STEP 16 — TAX STATUS
============================================================

Do not make tax/legal decisions.

Report the current technical configuration exactly.

Expected current baseline:

Stripe Tax = NOT CONFIGURED
customer tax collection = $0

Do not enable Stripe Tax without operator authorization.

Clearly state that this remains a BUSINESS CONFIGURATION decision for
public launch.

It does not automatically block ONE operator-controlled production test,
but it remains a public-launch issue.

============================================================
STEP 17 — CUSTOMER COMMUNICATION PREFLIGHT
============================================================

Verify:

- order confirmation email path
- shipping notification path
- refund notification path

Do not send unnecessary customer messages during Phase 7A.

Record any remaining manual communication paths.

============================================================
STEP 18 — PRODUCTION OBSERVABILITY PLAN
============================================================

Because Phase 7 will involve real money and a real manufactured item,
create an exact monitoring checklist for the Phase 7 operator.

Identify where to watch:

Stripe
Supabase orders
Supabase stripe-webhook logs
Supabase printful-webhook logs
/admin/orders
Printful Dashboard
customer email inbox

Define expected state transitions.

Expected initial sequence:

Stripe payment:
SUCCESS

Local order:
paid

livemode:
true

Printful:
draft

At this point:

STOP.

No automatic manufacturing should occur.

============================================================
STEP 19 — PHASE 7 EXACT EXECUTION PLAN
============================================================

Prepare—but DO NOT execute—the Phase 7 procedure.

It should contain exact steps:

1. Open production storefront.

2. Select the approved Phase 7A product.

3. Select the approved variant.

4. Add quantity 1.

5. Verify displayed retail price.

6. Begin LIVE Stripe checkout.

7. Verify Stripe checkout is LIVE.

8. Complete payment using operator's real payment method.

9. Verify live Stripe payment.

10. Verify exactly ONE local order exists.

11. Verify:

    livemode=true
    status=paid

12. Verify immutable fulfillment snapshot matches the Phase 7A
    approved candidate.

13. Verify exactly ONE Printful order exists.

14. Verify Printful status:

    draft

15. STOP.

16. Open `/admin/orders`.

17. Click "Check Printful".

18. Verify manually:

    product
    variant
    size
    color
    quantity
    recipient
    artwork
    placement
    technique
    retail amount
    shipping
    provider cost

19. If ANYTHING is wrong:

    DO NOT CONFIRM.

    Cancel Draft.

    Refund Stripe payment if appropriate.

20. If everything is correct:

    click:

    Confirm → Production

21. Verify transition:

    draft
      ↓
    pending / in-production

22. Monitor production.

23. Verify shipping webhook.

24. Verify customer shipping email.

25. Verify tracking information.

26. Receive physical product.

27. Inspect:

    garment/product
    print quality
    print size
    placement
    color
    artwork sharpness
    packaging
    shipping
    overall customer experience

============================================================
STEP 20 — DO NOT OVER-IMPLEMENT
============================================================

Phase 7A is primarily a verification/configuration phase.

Do not introduce unrelated architecture.

Do not:

- build catalog batch generation
- build AI merchandising
- refactor Catalog Builder
- redesign checkout
- redesign admin
- enable automatic manufacturing
- add a second fulfillment provider
- migrate legacy products
- create Printful Sync Products
- execute Phase 7

Only make code changes if a genuine Phase 7A blocker is discovered.

If code changes are necessary:

1. explain the defect
2. implement the smallest safe correction
3. add meaningful regression tests
4. rerun full verification

============================================================
STEP 21 — REGRESSION
============================================================

Run:

npx tsc --noEmit

Expected:
PASS

Run complete automated test suite.

Baseline:
509/509 PASS

Expected:
>=509 tests
ALL PASS

Run:

npm run build

Expected:
PASS

Verify legacy quarter-zip behavior has not regressed.

Verify Catalog Builder remains DIRECT_CATALOG_ORDER.

Verify no Printful Sync Product/Variant was accidentally created.

============================================================
STEP 22 — PHASE 7A GO / NO-GO MATRIX
============================================================

Create this matrix in the report:

| Gate | Result | Evidence | Blocking? |
|---|---|---|---|
| Production candidate selected | | | YES |
| Product identity verified | | | YES |
| Store variant mapping verified | | | YES |
| Catalog Builder ownership model | | | YES |
| Manufacturing artwork identified | | | YES |
| Artwork is not mockup | | | YES |
| Artwork dimensions verified | | | YES |
| Effective DPI verified | | | YES |
| Print area compatibility | | | YES |
| Artwork production quality | | | YES |
| Fulfillment snapshot generation | | | YES |
| Phase 6 DB migration applied | | | YES |
| stripe_session_id UNIQUE verified | | | YES |
| Test/live data isolation | | | YES |
| Stripe LIVE key configured | | | YES |
| stripe_mode=live | | | YES |
| LIVE webhook registered | | | YES |
| LIVE webhook secret active | | | YES |
| Stripe environment consistency | | | YES |
| PRINTFUL_AUTO_CONFIRM absent/false | | | YES |
| Printful API authentication | | | YES |
| Catalog variant available | | | YES |
| Admin manual confirmation | | | YES |
| Admin draft cancellation | | | YES |
| Refund capability | | | YES |
| US shipping rate available | | | YES |
| Tax status documented | | | NO* |
| Customer confirmation path | | | YES |
| Shipping notification path | | | YES |
| Monitoring plan prepared | | | YES |
| TypeScript | | | YES |
| Automated tests | | | YES |
| Production build | | | YES |

*Tax remains a public-launch business configuration decision.
Do not make a legal conclusion.

============================================================
STEP 23 — REQUIRED REPORT
============================================================

Create:

PHASE-7A-FIRST-PRODUCTION-ORDER-PREFLIGHT-REPORT.md

Include:

1. Executive Summary
2. Phase 6 Baseline
3. Repository Inspection
4. Selected First Production Candidate
5. Product Identity Chain
6. Variant Verification
7. Design / Artwork Trace
8. Artwork Technical Inspection
9. Printful Production Requirements
10. Effective DPI Calculation
11. Print Area Compatibility
12. Fulfillment Snapshot Verification
13. Production Database Migration
14. Database Idempotency Verification
15. Test / Live Data Isolation
16. Stripe LIVE Configuration
17. Stripe LIVE Webhook Verification
18. Printful Configuration
19. PRINTFUL_AUTO_CONFIRM Verification
20. Admin Production Controls
21. Refund / Cancellation Rollback
22. Shipping Verification
23. Tax Configuration Status
24. Customer Communications
25. Monitoring Plan
26. Regression Results
27. Remaining Risks
28. Phase 7 Exact Execution Plan
29. GO / NO-GO Matrix
30. Final Decision

============================================================
FINAL DECISION FORMAT
============================================================

End the report with EXACTLY:

PHASE 7A FIRST PRODUCTION ORDER PREFLIGHT:
COMPLETE | INCOMPLETE

PRODUCTION ARTWORK GATE:
PASS | FAIL | UNVERIFIED

PRODUCTION DATABASE GATE:
PASS | FAIL

STRIPE LIVE CONFIGURATION GATE:
PASS | FAIL | UNVERIFIED

STRIPE LIVE WEBHOOK GATE:
PASS | FAIL | UNVERIFIED

PRINTFUL SAFETY GATE:
PASS | FAIL

PRINTFUL AUTO-CONFIRM:
DISABLED | ENABLED

REGRESSION:
PASS | FAIL

PHASE 7 CONTROLLED REAL ORDER:
GO | NO-GO

============================================================
HARD STOP
============================================================

Even if every gate passes:

DO NOT place the real order.

DO NOT charge a card.

DO NOT confirm a Printful order.

DO NOT begin manufacturing.

Stop after producing the Phase 7A report.

The operator must separately authorize:

PHASE 7 — CONTROLLED FIRST REAL PRODUCTION ORDER.