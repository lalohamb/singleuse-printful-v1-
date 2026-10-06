COUNTYBUYS — PRINTFUL V2 COMPLETE BUILD ALIGNMENT
ARCHITECTURE CONTRACT
Read: Printful/CURRENT-ARCHITECTURE-CONTRACT.md — read in full.
Change log: Printful/CONTRACT-CHANGE-LOG.md — read in full.

Conflicts found: None. The contract is internally consistent. All 6 delta corrections from the last change set are present and correct. The two ⚠️ IMPLEMENTATION MIGRATION PENDING markers in §4.4 and §8.1 accurately describe the current code state.

CURRENT STATE SUMMARY
CountyBuys has a working Stripe commerce rail, a working Catalog Builder UI, and a working fulfillment snapshot pipeline. The Printful integration is a hybrid V1/V2 system. The V2 migration is partially complete:

V2 catalog variants: DONE — getCatalogVariants() is live and correct

V2 pricing: DONE — getCatalogProductPrices() is live and correct

V2 mockup-templates: LIVE-PROVEN but NOT YET IMPLEMENTED in Catalog Builder

V2 mockup-styles: LIVE-PROVEN but NOT YET USED

V1 printfiles/templates: STILL ACTIVE in Catalog Builder production stage

V1 mockup task creation/polling: STILL ACTIVE — V2 not yet verified

V1 shipping rates: STILL ACTIVE in stripe-checkout and stripe-webhook

V1 order creation: STILL ACTIVE in stripe-webhook — V2 not yet verified

V1 order retrieval/confirmation: STILL ACTIVE in printful-proxy

Printful webhook (shipment/tracking): ACTIVE — V1 event format, no V2 migration needed

PROTECTED PRODUCTION RAILS
These are confirmed working and must not be redesigned:

Rail	Location	Status
CountyBuys Product UUID	products.id	PROTECTED
CountyBuys Store Variant UUID	product_variants.id	PROTECTED
Supabase product persistence	catalog-builder/route.ts	PROTECTED
Published storefront products	products.status = active	PROTECTED
Customer retail pricing	product_variants.retail_price	PROTECTED
Stripe Checkout session creation	stripe-checkout/index.ts	PROTECTED
Stripe webhook verification	stripe-webhook/index.ts — constructEventAsync	PROTECTED
Payment idempotency	printful_order_id guard + OR-13 recovery	PROTECTED
Purchase records	orders table	PROTECTED
Immutable fulfillment snapshots	orders.fulfillment_snapshot JSONB	PROTECTED
Existing successful payment behavior	Full stripe-checkout + stripe-webhook pipeline	PROTECTED
CURRENT PRINTFUL ARCHITECTURE
CATALOG BUILDER PATH (primary):
  BlankSelector → GET /products (V1)
  VariantMatrix → GET /v2/catalog-products/{id}/catalog-variants (V2 ✓)
  product-summary → GET /v2/catalog-products/{id}/catalog-variants (V2 ✓)
  loadProduction → GET /mockup-generator/printfiles/{id} (V1 ⚠️)
                 → GET /mockup-generator/templates/{id} (V1 ⚠️)
  resolveTemplate → V1 variant_mapping[0] fallback (V1 ⚠️ NONCOMPLIANT)
  fetchPrintfileSpec → V1 variant_printfiles[0] fallback (V1 ⚠️ UNSAFE)
  fetchAndApplyCost → GET /v2/catalog-products/{id}/prices (V2 ✓)
  handleGenerate → POST /mockup-generator/create-task/{id} (V1)
  getMockupTask → GET /mockup-generator/task (V1)

FULFILLMENT PATH:
  stripe-checkout → resolveFulfillmentSnapshot (server-side, trusted)
                  → POST /shipping/rates (V1)
  stripe-webhook → POST /orders (V1)
                 → GET /orders/@{external_id} (V1 recovery)

PRINTFUL WEBHOOK:
  printful-webhook → package_shipped, order_updated (V1 event format)

SYNC PATH (legacy):
  printful-proxy → POST /sync → /store/products (V1)
                → GET /orders/{id} (V1)
                → POST /orders/{id}/confirm (V1)
                → DELETE /orders/{id} (V1)
                → POST /shipping (V1)


Copy
CAPABILITY MATRIX
CAPABILITY	CURRENT ENDPOINT	V	CURRENT CALLERS	IDENTITY USED	STATUS	LIVE-PROVEN V2	V2 AVAILABLE	V2 VERIFIED	CLASSIFICATION	RISK	TARGET STATE
Catalog product discovery	GET /products	V1	getCatalogProducts() → BlankSelector, product-summary	Printful catalog product ID	Working	NO	UNKNOWN	NO	KEEP V1	Low — no V2 catalog-list endpoint confirmed	Verify V2 catalog-products list; migrate if available
Catalog product detail	GET /products/{id}	V1	getCatalogProduct() → product-summary, products/[productId]	Printful catalog product ID	Working	NO	UNKNOWN	NO	KEEP V1	Low	Verify V2; migrate if available
Catalog variant identity	GET /v2/catalog-products/{id}/catalog-variants	V2	getCatalogVariants() → VariantMatrix, product-summary, products/[productId]	V2 CatalogVariant.id	Working, paginated, deduped	YES	YES	YES	MODERN V2 PATH	None	Done
Eligibility	V2 catalog-variants (404 = unavailable)	V2	getCatalogVariants()	V2	Working	YES	YES	YES	MODERN V2 PATH	None	Done
Provider pricing	GET /v2/catalog-products/{id}/prices	V2	getCatalogProductPrices() → prices/[productId] → CatalogBuilder	V2 variant ID	Working, paginated	YES	YES	YES	MODERN V2 PATH	None	Done
Production-template geometry	GET /v2/catalog-products/{id}/mockup-templates	V2	NONE — not yet called	V2 catalog_variant_ids	Live-proven, NOT implemented	YES	YES	YES	MIGRATE TO V2	HIGH — current code uses prohibited V1 path	New getMockupTemplates() + resolveV2Template()
Mockup styles	GET /v2/catalog-products/{id}/mockup-styles	V2	NONE — not yet called	V2	Live-proven, NOT implemented	YES	YES	YES	MIGRATE TO V2	Medium	New getMockupStyles() for DPI/style metadata
Placement discovery	GET /mockup-generator/printfiles/{id}?technique=	V1	getPrintfiles() → printfiles/[productId] → CatalogBuilder.loadProduction()	V1 product ID	Working	NO	UNKNOWN	NO	TRANSITIONAL V1	Medium — V2 placement discovery not verified	Verify V2; migrate or keep V1
DPI / printfile spec	GET /mockup-generator/printfiles/{id}?technique=	V1	fetchPrintfileSpec() → CatalogBuilder placement selection	V1 variant_printfiles[0] fallback ⚠️	Working with unsafe fallback	NO	UNKNOWN	NO	TRANSITIONAL V1	HIGH — variantPrintfiles[0] is unsafe	Resolve via V2 mockup-templates print_area or verify V2 printfiles
Conflicting placements	GET /mockup-generator/templates/{id}?technique=	V1	getLayoutTemplates() → templates/[productId] → CatalogBuilder	V1	Working	NO	UNKNOWN	NO	TRANSITIONAL V1	Low	Keep V1 until V2 equivalent verified
Template geometry (Catalog Builder)	GET /mockup-generator/templates/{id}	V1	getLayoutTemplates() → CatalogBuilder.resolveTemplate()	V1 variant_mapping[0] ⚠️ NONCOMPLIANT	Working but prohibited	YES	YES	YES	REMOVE AFTER MIGRATION	CRITICAL — contract violation	Replace with V2 mockup-templates in Workstream A
Template geometry (ProductDesigner)	GET /mockup-generator/templates/{id}	V1	getLayoutTemplates() → ProductDesigner	V1 variant_mapping	Working	NO	YES	YES	LEGACY COMPATIBILITY	Low	Keep V1 for ProductDesigner until deliberate migration
Mockup task creation	POST /mockup-generator/create-task/{id}	V1	createMockupTask() → mockups/route.ts → CatalogBuilder.handleGenerate()	V1 variant IDs (but CatalogBuilder passes V2 IDs) ⚠️	Working in practice	NO	UNKNOWN	NO	VERIFY V2 FIRST	HIGH — V2 IDs passed to V1 endpoint	Verify V2 mockup task creation
Mockup task polling	GET /mockup-generator/task?task_key=	V1	getMockupTask() → mockups/[taskKey] → MockupStatus	task_key	Working	NO	UNKNOWN	NO	VERIFY V2 FIRST	Low	Verify V2; migrate with task creation
Mockup persistence	Supabase Storage download + upload	N/A	persistGeneratedMockups() → mockups/persist	task_key	Working	N/A	N/A	N/A	MODERN V2 PATH	None	No change needed
Shipping rates	POST /shipping/rates	V1	getPrintfulShipping() in stripe-checkout + stripe-webhook	V1 variant IDs (numeric)	Working with fallback	NO	UNKNOWN	NO	VERIFY V2 FIRST	Medium — V2 shipping not verified	Verify V2 shipping endpoint
Order creation	POST /orders	V1	stripe-webhook checkout.session.completed	V1 (but uses V2 catalog variant IDs for DIRECT_CATALOG_ORDER)	Working	NO	UNKNOWN	NO	VERIFY V2 FIRST	HIGH — core fulfillment	Verify V2 order creation
Order retrieval (lost-response)	GET /orders/@{external_id}	V1	stripe-webhook OR-13 recovery	external_id	Working	NO	UNKNOWN	NO	VERIFY V2 FIRST	Medium	Verify V2 equivalent
Order retrieval (admin)	GET /orders/{id}	V1	printful-proxy	Printful order ID	Working	NO	UNKNOWN	NO	KEEP V1	Low	Verify V2; migrate if available
Order confirmation (admin)	POST /orders/{id}/confirm	V1	printful-proxy	Printful order ID	Working	NO	UNKNOWN	NO	KEEP V1	Low	Verify V2
Order cancellation (admin)	DELETE /orders/{id}	V1	printful-proxy	Printful order ID	Working	NO	UNKNOWN	NO	KEEP V1	Low	Verify V2
Shipment/tracking (webhook)	Printful webhook package_shipped	V1 event	printful-webhook edge function	printful_order_id	Working	NO	UNKNOWN	NO	KEEP V1	Low — event format may be same in V2	Verify V2 webhook event format
Order status (webhook)	Printful webhook order_updated	V1 event	printful-webhook edge function	printful_order_id	Working	NO	UNKNOWN	NO	KEEP V1	Low	Verify V2 webhook event format
Sync product list	GET /store/products	V1	printful-proxy /sync	Printful sync product ID	Working	NO	N/A	NO	LEGACY ONLY	Low	printful_sync disposition
Sync product detail	GET /store/products/{id}	V1	printful-proxy, identity.ts	Printful sync product ID	Working	NO	N/A	NO	LEGACY ONLY	Low	printful_sync disposition
Catalog ID resolution from sync	GET /store/products/{id}	V1	resolvePrintfulProductIdentity()	sync → catalog ID	Working	NO	N/A	NO	LEGACY ONLY	Low	printful_sync disposition
KNOWN LIVE-PROVEN V2 CAPABILITIES
All four are recorded in the contract and confirmed in code:

GET /v2/catalog-products/{id}/catalog-variants — paginated, V2 envelope, CatalogVariant.id namespace

GET /v2/catalog-products/{id}/prices — paginated, per-variant technique pricing + placement pricing

GET /v2/catalog-products/{id}/mockup-templates — 60 templates for product 679, catalog_variant_ids[], role, placement, technique, pixel geometry

GET /v2/catalog-products/{id}/mockup-styles — placement/technique/DPI/style metadata

V2 CAPABILITIES REQUIRING LIVE VERIFICATION
Batch 1 — Production Metadata (blocks Workstream A)
V2 Printfiles / Placement Discovery

Why needed: Current GET /mockup-generator/printfiles/{id}?technique= provides available_placements and variant_printfiles. Need to determine if V2 mockup-templates already provides sufficient placement + print-area data to eliminate this V1 call.

Candidate endpoint: GET /v2/catalog-products/{id}/mockup-templates already live-proven. The placement field and print_area_* fields may be sufficient to replace available_placements and DPI validation.

What must be proven: Does the set of distinct placement values across all templates equal available_placements? Does print_area_width/height in pixels + dpi from mockup-styles provide equivalent DPI validation?

Read-only: YES

Safe method: Read all templates for product 679, extract distinct placements, compare to known available_placements from V1. Read mockup-styles for DPI values.

Blocks implementation: YES — determines whether loadProduction() can drop the V1 printfiles call

V2 Mockup Task Creation

Why needed: POST /mockup-generator/create-task/{id} is V1. CatalogBuilder currently passes V2 CatalogVariant.id values as variant_ids to this V1 endpoint. This is an identity-space mismatch that works in practice but is not contractually sound.

Candidate endpoint: V2 mockup task creation endpoint — name not yet confirmed

What must be proven: Endpoint path, request shape (does it accept catalog_variant_ids?), response shape (task_key format), polling endpoint

Read-only: NO — requires creating a test task (write operation)

Safe method: Controlled single-variant mockup task with a known design, operator-authorized

Blocks implementation: YES for Workstream A mockup migration. If V2 not verified, V1 mockup task creation stays with documented justification.

Batch 2 — Fulfillment (blocks Workstream B)
V2 Shipping Rates

Why needed: POST /shipping/rates is V1. Used in both stripe-checkout and stripe-webhook with a hardcoded fallback. V2 may have a different endpoint path or request shape.

Candidate endpoint: POST /v2/shipping/rates or similar

What must be proven: Endpoint path, request shape (does it still accept variant_id as numeric?), response shape (rate array), error format

Read-only: YES — shipping rate estimation is read-only

Safe method: Single POST with a known variant ID and US address

Blocks implementation: YES for Workstream B

V2 Order Creation

Why needed: POST /orders is V1. This is the core fulfillment write operation. V2 may have a different path, different item shape, or different response.

Candidate endpoint: POST /v2/orders or similar

What must be proven: Endpoint path, item shape (does variant_id still work for catalog variants?), external_id behavior, confirm parameter, OR-13 equivalent, response shape

Read-only: NO — requires creating a draft order (write operation, must be cancelled immediately)

Safe method: Controlled draft order (no confirm=true), immediately cancelled, operator-authorized

Blocks implementation: YES for Workstream B

V2 Order Retrieval / Status

Why needed: GET /orders/{id} and GET /orders/@{external_id} are V1. Used for admin order management and lost-response recovery.

Candidate endpoint: GET /v2/orders/{id} or similar

What must be proven: Endpoint path, response shape, @external_id lookup support

Read-only: YES

Safe method: Fetch an existing known Printful order ID

Blocks implementation: Partially — V1 can remain for admin panel; V2 needed for lost-response recovery path

V2 Webhook Event Format

Why needed: printful-webhook handles package_shipped and order_updated. If V2 changes event type names or payload shape, the handler breaks silently.

Candidate: Printful V2 webhook documentation

What must be proven: Are event type names the same? Is data.order.id still the Printful order ID? Is data.shipment.tracking_number/url still present?

Read-only: YES (documentation review + test event)

Blocks implementation: Low — V1 events likely still delivered; verify before Workstream B

TRANSITIONAL V1 CAPABILITIES
These V1 dependencies are explicitly authorized as transitional by the contract:

Capability	Endpoint	Authorized By	Condition for Migration
Catalog product discovery	GET /products	§4.6	V2 catalog-products list live-verified
Placement discovery	GET /mockup-generator/printfiles/{id}	§4.7, §8.2	V2 placement data proven sufficient
DPI validation	GET /mockup-generator/printfiles/{id}	§4.7, §8.2	V2 print-area + mockup-styles proven sufficient
Conflicting placements	GET /mockup-generator/templates/{id}	§4.8, §8.3	V2 equivalent live-verified
Mockup task creation	POST /mockup-generator/create-task/{id}	§4.9	V2 mockup task contract live-verified
Mockup task polling	GET /mockup-generator/task	§4.9	V2 mockup task contract live-verified
Shipping rates	POST /shipping/rates	§10.3	V2 shipping live-verified
Order creation	POST /orders	§10.3	V2 order creation live-verified
Order retrieval	GET /orders/{id}, GET /orders/@{id}	§10.3	V2 order retrieval live-verified
Printful webhook events	package_shipped, order_updated	§10.3	V2 event format confirmed
UNSAFE IDENTITY CROSSINGS
Two confirmed unsafe crossings exist in the current codebase:

Crossing 1 — Template Resolution (CRITICAL — contract violation)
Location: CatalogBuilder.tsx resolveTemplate() (lines ~220–240)

V2 CatalogVariant.id (e.g. 17008)
        ↓
V1 variant_mapping.find(m => m.variant_id === variantId)
        ↓
variant_mapping[0] fallback when not found

Copy
This is explicitly prohibited by §4.8, §4.12, §8.1, §8.3. The V2 ID will never match a V1 variant_mapping.variant_id. The fallback always fires. The template resolved is arbitrary, not authoritative.

Also in: resolveLayoutTemplateForVariantPlacement() in templates.ts — same logic, same fallback. This function is called by CatalogBuilder.resolveTemplate() indirectly (the logic is duplicated inline in CatalogBuilder).

Crossing 2 — DPI / Printfile Spec (UNSAFE — authorized as transitional)
Location: fetchPrintfileSpec() in artwork-validation.ts (lines ~100–120)

V2 CatalogVariant.id passed as variantId
        ↓
V1 variant_printfiles.find(v => v.variant_id === variantId)
        ↓
variantPrintfiles[0] fallback when not found

Copy
This is the same ID-space problem. The V2 variant ID will not match V1 variant_printfiles[].variant_id. The fallback always fires. The printfile spec resolved is the first variant's spec, not the selected variant's spec.

Assessment of options A–D from the audit brief:

Option A (remove V1 fallback, retain V1 DPI metadata): Partially viable. Removing variantPrintfiles[0] fallback would cause fetchPrintfileSpec() to return null for all Catalog Builder calls (since V2 IDs never match V1 IDs). This would set artworkValidation = null (UNVERIFIED), which is honest but loses DPI feedback entirely.

Option B (V2 provides sufficient print-area/DPI): The live-proven V2 mockup-templates response contains print_area_width, print_area_height in pixels. The live-proven V2 mockup-styles response contains dpi and print_area_width/height in inches. Together these provide equivalent information to V1 printfiles for DPI validation. This is the correct V2 path.

Option C (explicit non-identity resolution): The V2 mockup-templates print_area_* fields are not per-variant — they are per-template (shared across variants for standard apparel). This means a non-identity-based resolution (select template by placement + technique, read print_area) is both safe and correct for DPI validation.

Option D (live contract verification): Batch 1 verification (above) will confirm whether V2 mockup-templates + mockup-styles fully replace V1 printfiles for DPI purposes.

Conclusion: Option B/C is the correct target. DPI validation should be derived from the V2 template resolved by resolveV2Template() (Workstream A). The variantPrintfiles[0] fallback should be removed. Until Workstream A is complete, the current behavior (UNVERIFIED result when V2 ID doesn't match) is acceptable if the fallback is explicitly documented as transitional.

ARBITRARY PROVIDER FALLBACKS
Fallback	Location	Risk	Disposition
variant_mapping[0]	CatalogBuilder.resolveTemplate()	CRITICAL — always fires for V2 IDs, resolves arbitrary template	REMOVE in Workstream A
variant_mapping[0]	resolveLayoutTemplateForVariantPlacement() in templates.ts	Same risk — called by ProductDesigner with V1 IDs (safe there), but function is shared	SCOPE: safe for V1-only callers; unsafe if called with V2 IDs
variantPrintfiles[0]	fetchPrintfileSpec() in artwork-validation.ts	HIGH — always fires for V2 IDs, resolves arbitrary printfile spec	REPLACE with V2 template print_area in Workstream A
templates[0]	Not present in current code	N/A	N/A
variants[0] for pricing	Not present — resolveProviderCost() returns unknown on miss	None	Correct
CATALOG BUILDER FINAL TARGET
Stage: Blank
CountyBuys-owned: nothing yet

Printful-owned: catalog product list

V2 source: NONE (V1 GET /products — transitional)

Remaining V1: getCatalogProducts() — authorized transitional

Validation: product must have at least one technique

Persistence: none

Failure: show error, operator retries

Stage: Variants
CountyBuys-owned: selected variant set

Printful-owned: V2 catalog variant identity, eligibility

V2 source: GET /v2/catalog-products/{id}/catalog-variants

Remaining V1: none

Validation: eligibility must be "eligible", at least one variant selected

Persistence: none (builder state only)

Failure: show eligibility reason, block Continue

Stage: Design
CountyBuys-owned: design selection, artwork_url

Printful-owned: nothing

V2 source: none

Remaining V1: none

Validation: design must be active, artwork_url must be trusted Supabase host

Persistence: none

Failure: show error

Stage: Production
CountyBuys-owned: technique selection, placement selection

Printful-owned: available placements, template geometry, DPI spec

V2 source (target): GET /v2/catalog-products/{id}/mockup-templates for geometry + placement list; GET /v2/catalog-products/{id}/mockup-styles for DPI

Remaining V1 (transitional): GET /mockup-generator/printfiles/{id}?technique= for available_placements and conflicting_placements until V2 placement discovery verified; GET /mockup-generator/templates/{id}?technique= for conflicting_placements only

Validation: placement must resolve exactly one primary V2 template; zero = unresolved (block Continue); multiple = ambiguous (block Continue)

Persistence: none

Failure: show "No template found for this placement" — do not proceed

Stage: Designer (Position)
CountyBuys-owned: artwork position (canvas rect)

Printful-owned: template pixel geometry (from V2 template)

V2 source: resolved V2 template print_area_* fields

Remaining V1: none

Validation: artwork must be positioned within print area

Persistence: none

Failure: show positioning error

Stage: Mockups
CountyBuys-owned: mockup task key, persisted mockup URLs

Printful-owned: mockup generation

V2 source (target): V2 mockup task creation (pending verification)

Remaining V1: POST /mockup-generator/create-task/{id} + GET /mockup-generator/task until V2 verified

Validation: task must complete; at least one mockup returned

Persistence: mockup images downloaded to Supabase Storage immediately

Failure: show error, allow retry from designer stage

Stage: Details
CountyBuys-owned: title, slug, description, brand, product_type, category_id, meta fields

Printful-owned: nothing

V2 source: none

Remaining V1: none

Validation: title required, slug required and unique

Persistence: none

Failure: show field errors

Stage: Pricing
CountyBuys-owned: retail_price per variant

Printful-owned: provider_cost per variant

V2 source: GET /v2/catalog-products/{id}/prices

Remaining V1: none

Validation: retail_price > 0 for all variants; COST_PLUS requires known provider_cost

Persistence: none

Failure: show cost unavailable; allow FIXED_PRICE to proceed

Stage: Review & Publish
CountyBuys-owned: all above

Printful-owned: nothing new

V2 source: none

Remaining V1: none

Validation: all required fields present; at least one variant; at least one mockup (soft)

Persistence: POST /api/catalog-builder → products + product_variants + product_designs + product_images; then POST /api/catalog-builder/publish

Failure: show error, allow retry

PRODUCTION / DPI TARGET
Current state: V1 variant_printfiles[0] fallback — always fires for V2 IDs, always arbitrary.

Target state:

loadProduction() calls GET /v2/catalog-products/{id}/mockup-templates (already live-proven) to get all templates for the product.

resolveV2Template(templates, variantId, technique, placement) resolves exactly one primary template using catalog_variant_ids.includes(variantId) && technique === t && placement === p && role === "primary".

The resolved template provides print_area_width, print_area_height, print_area_top, print_area_left in pixels — sufficient for canvas positioning.

For DPI validation: GET /v2/catalog-products/{id}/mockup-styles provides dpi and print_area_width/height in inches per placement/technique. This replaces fetchPrintfileSpec() for Catalog Builder.

available_placements is derived from the distinct placement values across all V2 templates (pending Batch 1 verification that this is equivalent to V1 available_placements).

conflicting_placements remains V1 (getLayoutTemplates()) until a V2 equivalent is verified.

fetchPrintfileSpec() is no longer called for Catalog Builder. It may remain for ProductDesigner (V1-only workflow).

Unsafe fallbacks removed:

variant_mapping[0] in CatalogBuilder.resolveTemplate() — replaced by V2 template resolution

variantPrintfiles[0] in fetchPrintfileSpec() — replaced by V2 mockup-styles DPI data

MOCKUP TARGET
Current state: V1 POST /mockup-generator/create-task/{id} with V2 variant IDs passed as variant_ids. This is an identity-space mismatch that works in practice because Printful's V1 mockup generator appears to accept catalog variant IDs, but it is not contractually sound.

Target state:

If V2 mockup task creation is verified (Batch 1): migrate createMockupTask() to V2 endpoint, use catalog_variant_ids directly.

If V2 mockup task creation is NOT verified: keep V1 with explicit documentation that V2 catalog variant IDs are being passed to a V1 endpoint, and that this is a known transitional risk pending verification.

Mockup persistence (persistGeneratedMockups()) is provider-agnostic — no change needed regardless of V1/V2 migration.

Mockup polling: migrate with task creation (same verification batch).

Style selection: V2 mockup-styles provides style IDs for the mockup task request. Once V2 task creation is verified, style IDs from getMockupStyles() can be passed to the task request for better mockup presentation.

FULFILLMENT TARGET
Preserved (no change):

resolveFulfillmentSnapshot() — correct, trusted, server-side

buildPrintfulCatalogOrderItem() — correct

FulfillmentSnapshot type — correct

DIRECT_CATALOG_ORDER strategy — correct

Stripe checkout snapshot creation in stripe-checkout/index.ts — correct

Stripe webhook snapshot validation and order construction in stripe-webhook/index.ts — correct

V2 migration targets (Workstream B, after verification):

Shipping rates: replace POST /shipping/rates with V2 equivalent in both
FULFILLMENT TARGET (continued)
V2 migration targets (Workstream B, after verification):

Shipping rates: replace POST /shipping/rates with V2 equivalent in both stripe-checkout/index.ts and stripe-webhook/index.ts. The fallback logic (default_shipping_cost from settings) must be preserved regardless of V1/V2 migration.

Order creation: replace POST /orders in stripe-webhook/index.ts with V2 equivalent. The external_id idempotency mechanism, OR-13 duplicate detection, and lost-response recovery via GET /orders/@{external_id} must all be re-verified against the V2 order API before migration.

Order retrieval: replace GET /orders/{id} and GET /orders/@{external_id} in printful-proxy/index.ts and stripe-webhook/index.ts with V2 equivalents after verification.

Order confirmation: replace POST /orders/{id}/confirm in printful-proxy/index.ts with V2 equivalent after verification.

Order cancellation: replace DELETE /orders/{id} in printful-proxy/index.ts with V2 equivalent after verification.

V1 that may remain permanently:

Printful webhook event handling (printful-webhook/index.ts) — package_shipped and order_updated event types. These are Printful-push events. If V2 uses the same event type names and payload shape, no code change is needed. If V2 changes event format, the handler must be updated. This is a verification task, not necessarily a code migration.

What does NOT change:

orders table schema

fulfillment_snapshot JSONB structure

FulfillmentSnapshot TypeScript type

DIRECT_CATALOG_ORDER strategy

SYNC_VARIANT strategy (until printful_sync disposition decided)

Stripe session creation logic

Stripe webhook signature verification

Payment idempotency guard (printful_order_id check)

OR-13 recovery pattern (logic preserved, endpoint updated)

buildExternalId() format

PRINTFUL_SYNC SECOND REVIEW
Current Purpose
printful_sync is the legacy provider-managed product architecture. Products with catalog_source = printful_sync have a non-null products.printful_id (Printful Sync Product ID). Their fulfillment strategy is SYNC_VARIANT. The sync infrastructure consists of:

printful-proxy/index.ts — POST /sync route that fetches all store products from Printful and upserts them into the products and product_variants tables

printful-proxy/index.ts — order management routes (GET /orders/{id}, POST /orders/{id}/confirm, DELETE /orders/{id})

stripe-webhook/index.ts — SYNC_VARIANT branch in the fulfillment loop (no snapshot required, uses printful_variant_id directly)

stripe-checkout/index.ts — skips snapshot creation for non-catalog_builder products

resolveFulfillmentSnapshot() — SYNC_VARIANT strategy branch

Current Dependencies
1. How many code paths depend on printful_sync?

Confirmed code paths:

stripe-checkout/index.ts — skips snapshot for catalog_source !== "catalog_builder" (implicit sync support)

stripe-webhook/index.ts — SYNC_VARIANT branch handles items without a snapshot

resolveFulfillmentSnapshot() — SYNC_VARIANT strategy returned when catalog_source !== "catalog_builder"

printful-proxy/index.ts — entire /sync route, archive logic scoped to catalog_source = printful_sync

catalog-builder/load/route.ts — explicitly rejects non-catalog_builder products

catalog-builder/route.ts — sets catalog_source = "catalog_builder" and printful_id = null on creation

admin/products/[id]/tabs/OverviewTab.tsx — displays printful_id when present

admin/products/page.tsx — product list includes sync products

2. Which admin workflows depend on it?

Admin products list — displays sync products alongside catalog_builder products

Admin order management — printful-proxy order routes used for all Printful orders regardless of source

Admin sync trigger — POST /sync via printful-proxy is the mechanism for refreshing sync products

Admin settings — Integrations.tsx shows Printful connection status

3. Does Catalog Builder depend on it?

No. CatalogBuilder.tsx sets printful_id = null and catalog_source = "catalog_builder" on every product it creates. The Catalog Builder never calls the sync route. The catalog-builder/load/route.ts explicitly rejects sync products.

4. Does DIRECT_CATALOG_ORDER depend on it?

No. DIRECT_CATALOG_ORDER is explicitly scoped to catalog_source = "catalog_builder" in resolveFulfillmentSnapshot() and stripe-webhook/index.ts. The two strategies are mutually exclusive.

5. Does Stripe depend on it?

Stripe does not depend on the sync architecture. The Stripe session creation and webhook verification are identical for both paths. The only difference is whether a fulfillment snapshot is created at checkout time.

6. Does storefront rendering depend on it?

The storefront renders products from the products table regardless of catalog_source. A sync product and a catalog_builder product are rendered identically. Removing sync products from the database would remove them from the storefront, but the rendering code itself has no sync dependency.

7. Do historical fulfillment snapshots depend on preserving sync identity?

Partially. Historical orders for sync products have fulfillment_snapshot = {} (empty — no snapshot was created). Their fulfillment was handled via the SYNC_VARIANT branch using printful_variant_id directly. These historical records are immutable and do not require the sync infrastructure to remain readable. However, if a historical sync order needed to be re-fulfilled (e.g., replacement order), the SYNC_VARIANT path in stripe-webhook would need to remain functional.

8. Do existing active products still use it?

Based on the contract change log: one confirmed sync product exists — the Lightweight quarter-zip pullover. Its catalog_source = "printful_sync" and printful_id is non-null. It is currently active in the store. Whether it has been ordered by real customers is not determinable from code alone — requires a database query.

9. Does any existing real order history use it?

Cannot be determined from code alone. Requires: SELECT COUNT(*) FROM orders WHERE fulfillment_snapshot IS NULL OR fulfillment_snapshot = '{}' combined with checking whether those orders correspond to sync products. This is a database query, not a code inspection.

10. Must the quarter-zip stay on the sync path?

Unknown. The quarter-zip could be rebuilt as a Catalog Builder product if its Printful catalog product ID is known and its variants are available via V2. Whether the operator wants to do this is a business decision, not a technical one.

Recommendation
OPTIONAL

Rationale:

The sync infrastructure is not required for any new Catalog Builder product

DIRECT_CATALOG_ORDER is fully independent of sync

Only one confirmed active sync product exists

The sync code is isolated and does not contaminate the Catalog Builder path

Removing it now would require verifying no real customer orders depend on the SYNC_VARIANT fulfillment path

The quarter-zip may or may not be intended to remain as a sync product

OPTIONAL means: the sync infrastructure may be preserved indefinitely at zero cost to the Catalog Builder migration, or it may be removed after the operator confirms no active orders depend on it and the quarter-zip is either rebuilt as a Catalog Builder product or intentionally retired.

Evidence Still Needed
Before choosing DEPRECATE or REMOVE LATER:

SELECT COUNT(*) FROM orders WHERE status IN ('paid','fulfilled') AND (fulfillment_snapshot IS NULL OR fulfillment_snapshot::text = '{}') — how many real paid orders used the sync path

SELECT id, title, status FROM products WHERE catalog_source = 'printful_sync' — full list of active sync products

Operator decision: should the quarter-zip be rebuilt as a Catalog Builder product or retired?

Whether printful-proxy order management routes are used for Catalog Builder orders too (they are — GET /orders/{id} and POST /orders/{id}/confirm are used for all Printful orders regardless of source)

PRESERVATION MATRIX
PROTECTED — DO NOT CHANGE
File	Reason
supabase/functions/stripe-checkout/index.ts	Working Stripe session creation, snapshot freezing, shipping quote
supabase/functions/stripe-webhook/index.ts	Working payment processing, Printful order creation, OR-13 recovery
src/lib/fulfillment/types.ts	FulfillmentSnapshot, FulfillmentStrategy, PrintfulCatalogOrderItem
src/lib/fulfillment/resolver.ts	resolveFulfillmentSnapshot() — trusted server-side resolver
src/lib/fulfillment/builder.ts	buildPrintfulCatalogOrderItem(), buildPrintfulExternalId()
src/app/api/catalog-builder/route.ts	Product creation — atomic, idempotent
src/app/api/catalog-builder/publish/route.ts	Publication validation
src/app/api/catalog-builder/load/route.ts	Edit mode loader
src/app/api/catalog-builder/update/route.ts	Edit mode updater
src/lib/printful/client.ts	printfulGet(), printfulGetV2(), printfulPost() — correct, tested
src/lib/printful/errors.ts	PrintfulApiError
src/lib/printful/catalog.ts	getCatalogVariants(), getCatalogProducts(), getCatalogProduct()
src/lib/printful/pricing.ts	getCatalogProductPrices(), resolveProviderCost(), effectiveAmount()
src/lib/printful/persist.ts	persistGeneratedMockups()
src/lib/printful/identity.ts	resolvePrintfulProductIdentity()
src/lib/printful/techniques.ts	VALID_TECHNIQUES
src/app/api/printful/prices/[productId]/route.ts	V2 pricing route
src/app/api/printful/mockups/persist/route.ts	Mockup persistence
src/app/api/catalog-builder/product-summary/route.ts	V2 product summary
src/app/api/catalog-builder/dry-run/route.ts	Dry-run validation
supabase/functions/printful-webhook/index.ts	Shipment/tracking webhook handler
All src/__tests__/ files	Existing passing tests
MODERN V2 PATH
File	Notes
src/lib/printful/catalog.ts	V2 catalog variants — complete
src/lib/printful/pricing.ts	V2 pricing — complete
src/lib/printful/client.ts	printfulGetV2() — ready for new V2 calls
src/app/api/printful/prices/[productId]/route.ts	V2 pricing route — complete
src/app/api/catalog-builder/product-summary/route.ts	Uses V2 variants — complete
src/app/api/printful/products/[productId]/route.ts	Merges V1 product + V2 variants — correct hybrid
TRANSITIONAL V1
File	V1 Dependency	Authorized Until
src/lib/printful/templates.ts	getPrintfiles(), getLayoutTemplates()	V2 placement/template verified
src/app/api/printful/templates/[productId]/route.ts	V1 templates route	V2 template route added
src/app/api/printful/printfiles/[productId]/route.ts	V1 printfiles route	V2 placement route added or V2 templates sufficient
src/lib/fulfillment/artwork-validation.ts	fetchPrintfileSpec() with variantPrintfiles[0]	V2 DPI path implemented
supabase/functions/stripe-checkout/index.ts	POST /shipping/rates	V2 shipping verified
supabase/functions/stripe-webhook/index.ts	POST /orders, GET /orders/@{id}	V2 order creation verified
supabase/functions/printful-proxy/index.ts	All order management routes	V2 order routes verified
LEGACY COMPATIBILITY
File	Notes
supabase/functions/printful-proxy/index.ts	Sync infrastructure — OPTIONAL disposition
src/lib/fulfillment/resolver.ts	SYNC_VARIANT branch — preserved until disposition
supabase/functions/stripe-webhook/index.ts	SYNC_VARIANT fulfillment branch
supabase/functions/stripe-checkout/index.ts	Non-snapshot path for sync products
REMOVE AFTER VERIFIED REPLACEMENT
File / Code	What Replaces It
CatalogBuilder.resolveTemplate() — variant_mapping[0] fallback	V2 resolveV2Template()
CatalogBuilder.loadProduction() — getLayoutTemplates() call	V2 getMockupTemplates() call
CatalogBuilder.templates state (PrintfulTemplatesResponse)	V2 template array state
fetchPrintfileSpec() call in CatalogBuilder placement selection	V2 mockup-styles DPI lookup
src/app/api/printful/templates/[productId]/route.ts (for Catalog Builder)	New V2 mockup-templates route
resolveLayoutTemplateForVariantPlacement() in templates.ts (for Catalog Builder)	resolveV2Template() in new file
UNKNOWN / NEEDS VERIFICATION
Item	What Must Be Determined
V2 mockup task creation endpoint	Path, request shape, response shape
V2 shipping rates endpoint	Path, request shape, response shape
V2 order creation endpoint	Path, item shape, external_id behavior
V2 order retrieval endpoint	Path, @external_id support
V2 catalog product list endpoint	Whether V2 exposes a catalog-products list
V2 webhook event format	Whether package_shipped/order_updated names and payload shape are unchanged
V2 placement discovery	Whether V2 mockup-templates placement values are equivalent to V1 available_placements
WORKSTREAM A — V2 CATALOG / PRODUCTION / MOCKUPS
Objective
Close the complete Catalog Builder provider path from blank selection through mockup generation using V2-first provider data. Remove all prohibited identity crossings and arbitrary fallbacks from the Catalog Builder. Retain V1 only where V2 is not yet verified.

Exact Files Expected to Change
File	Change
src/lib/printful/templates.ts	Add getMockupTemplates() (V2), add getMockupStyles() (V2), add resolveV2Template() pure function. Existing getPrintfiles() and getLayoutTemplates() remain for ProductDesigner and legacy callers.
src/lib/printful/types.ts	Add V2MockupTemplate interface (live-proven fields). Add V2MockupStyle interface. No changes to existing types.
src/lib/fulfillment/artwork-validation.ts	Replace fetchPrintfileSpec() Catalog Builder call path with V2 mockup-styles DPI lookup. The function itself may remain for ProductDesigner (V1-only).
src/app/admin/catalog-builder/CatalogBuilder.tsx	Replace loadProduction() V1 template fetch with V2 getMockupTemplates(). Replace resolveTemplate() with resolveV2Template(). Replace fetchPrintfileSpec() DPI call with V2 mockup-styles data. Remove templates state typed as PrintfulTemplatesResponse. Add V2 template state.
src/app/admin/catalog-builder/types.ts	Update CatalogBuilderState.activeTemplate type from PrintfulLayoutTemplate to V2MockupTemplate.
New Files Expected
File	Purpose
src/app/api/printful/mockup-templates/[productId]/route.ts	Server route for GET /v2/catalog-products/{id}/mockup-templates. Admin-only. Returns all pages accumulated.
src/app/api/printful/mockup-styles/[productId]/route.ts	Server route for GET /v2/catalog-products/{id}/mockup-styles. Admin-only.
Database Migration Required
NO

V2 Endpoints
GET /v2/catalog-products/{id}/mockup-templates — live-proven

GET /v2/catalog-products/{id}/mockup-styles — live-proven

V2 mockup task creation — requires Batch 1 verification before implementation

V1 Endpoints Retained
GET /mockup-generator/printfiles/{id}?technique= — retained for available_placements and conflicting_placements until V2 placement discovery verified

GET /mockup-generator/templates/{id}?technique= — retained for conflicting_placements only; retained for ProductDesigner

POST /mockup-generator/create-task/{id} — retained if V2 mockup task not verified; migrated if verified

GET /mockup-generator/task — retained with task creation

V1 Code Removed (from Catalog Builder path only)
CatalogBuilder.resolveTemplate() — entire function replaced

CatalogBuilder.loadProduction() — V1 getLayoutTemplates() call removed; V1 getPrintfiles() call retained for available_placements until V2 verified

variant_mapping[0] fallback — removed

variantPrintfiles[0] fallback — removed from Catalog Builder DPI path

Live Contracts Already Proven
GET /v2/catalog-products/{id}/mockup-templates — product 679, 60 templates, 4 placements, dtfilm

GET /v2/catalog-products/{id}/mockup-styles — product 679, placement/technique/DPI metadata

Live Contracts Requiring Verification (Batch 1)
V2 mockup-templates placement values vs V1 available_placements — read-only, safe

V2 mockup-styles dpi field sufficiency for DPI validation — read-only, safe

V2 mockup task creation — write operation, operator-authorized

Tests
Unit: resolveV2Template() — zero matches, one match, multiple matches, technique case normalization

Unit: V2 DPI validation using mockup-styles data

Unit: getMockupTemplates() pagination accumulation

Integration: Catalog Builder production stage resolves template without variant_mapping[0]

Regression: existing resolveLayoutTemplateForVariantPlacement() tests must still pass (V1 function unchanged)

Regression: existing pricing tests must still pass

Operator Test
Open Catalog Builder

Select a blank product (e.g. product 679)

Select variants

Select a design

Enter production stage — verify placements load from V2 templates

Select "front" placement — verify template resolves without fallback

Verify canvas geometry matches live-proven values (print area 1429×1809px scaled to 400×400 canvas)

Verify DPI validation shows correct result

Position artwork and generate mockups

Verify mockups complete and persist

Rollback Boundary
All changes are in the Catalog Builder UI and provider library layer. The commerce rail (Stripe, fulfillment snapshots, order creation) is untouched. Rollback = revert CatalogBuilder.tsx, templates.ts, types.ts, and the two new API routes. No database changes to roll back.

Definition of Done
resolveTemplate() no longer exists in CatalogBuilder.tsx

variant_mapping[0] does not appear in any Catalog Builder code path

variantPrintfiles[0] does not appear in any Catalog Builder code path

V2 getMockupTemplates() is called during production stage load

resolveV2Template() returns exactly one primary template or blocks Continue

DPI validation uses V2 data

TypeScript: 0 errors

Production build: PASS

All existing tests pass

Operator test passes

WORKSTREAM B — V2 FULFILLMENT / SHIPPING / ORDERS / WEBHOOKS
Objective
Migrate the provider fulfillment path (shipping, order creation, order management) to V2 after live contract verification. Preserve all Stripe behavior, fulfillment snapshots, and idempotency mechanisms exactly. Retain V1 for any capability where V2 is not verified.

Exact Files Expected to Change
File	Change
supabase/functions/stripe-checkout/index.ts	Replace POST /shipping/rates with V2 equivalent after verification
supabase/functions/stripe-webhook/index.ts	Replace POST /orders and GET /orders/@{id} with V2 equivalents after verification
supabase/functions/printful-proxy/index.ts	Replace GET /orders/{id}, POST /orders/{id}/confirm, DELETE /orders/{id} with V2 equivalents after verification
supabase/functions/printful-webhook/index.ts	Update event handling if V2 webhook event format differs from V1
New Files Expected
NONE — all changes are in-place migrations of existing edge functions.

Database Migration Required
NO

V2 Endpoints (after verification)
V2 shipping rates endpoint

V2 order creation endpoint

V2 order retrieval endpoint (@external_id support must be confirmed)

V2 order confirmation endpoint

V2 order cancellation endpoint

V1 Endpoints Retained
Any V2 endpoint that cannot be verified before implementation remains V1 with explicit documentation. The minimum acceptable state is: V2 shipping + V2 order creation verified and migrated. Order management (confirm/cancel) may remain V1 longer.

V1 Code Removed
POST /shipping/rates calls — replaced with V2

POST /orders call — replaced with V2

GET /orders/@{external_id} call — replaced with V2 equivalent

Live Contracts Already Proven
None for this workstream — all require Batch 2 verification.

Live Contracts Requiring Verification (Batch 2)
V2 shipping rates — read-only, safe

V2 order creation — write (draft, immediately cancelled), operator-authorized

V2 order retrieval + @external_id — read-only once an order exists

V2 order confirmation — write, operator-authorized (use the draft from #2)

V2 order cancellation — write, operator-authorized (cancel the draft from #2)

V2 webhook event format — documentation review + Printful test event

Tests
Unit: V2 order item construction from FulfillmentSnapshot

Unit: OR-13 equivalent detection in V2 error response

Integration: stripe-webhook creates a V2 order from a DIRECT_CATALOG_ORDER snapshot

Regression: SYNC_VARIANT path unchanged

Regression: OR-13 lost-response recovery still works

Regression: printful_order_id duplicate guard still works

Regression: all existing fulfillment tests pass

Operator Test
Place a test order through Stripe test mode

Verify Stripe webhook fires

Verify Printful order created via V2 endpoint

Verify orders.printful_order_id populated

Verify orders.fulfillment_status = "pending"

Simulate Printful package_shipped webhook

Verify orders.fulfillment_status = "shipped", tracking_number populated

Verify shipping confirmation email sent

Rollback Boundary
Edge functions are deployed independently. Rollback = redeploy previous version of stripe-checkout, stripe-webhook, printful-proxy. No database changes. No Stripe changes. The FulfillmentSnapshot structure is unchanged — a rolled-back webhook can still process existing snapshots.

Definition of Done
Shipping rates fetched via V2

Printful orders created via V2

Lost-response recovery works via V2 @external_id equivalent

Order status/tracking updates via Printful webhook (V1 or V2 event format, whichever is current)

TypeScript: 0 errors (Deno edge functions)

All existing fulfillment tests pass

Operator test passes

WORKSTREAM C — LEGACY CLEANUP / SYNC DISPOSITION / FINAL REGRESSION
Objective
Resolve the printful_sync disposition, remove obsolete V1 Catalog Builder dependencies that were replaced in Workstream A, perform complete regression, and verify the full operator lifecycle end-to-end.

Exact Files Expected to Change
Depends on printful_sync disposition:

If OPTIONAL or KEEP:

No sync code deleted

Add explicit // LEGACY COMPATIBILITY — printful_sync comments to sync code paths

Update CURRENT-ARCHITECTURE-CONTRACT.md §3 and §10.2 with final disposition

If DEPRECATE:

Mark sync routes in printful-proxy/index.ts as deprecated

Add admin UI warning for sync products

No code deletion yet

If REMOVE LATER (requires confirmed zero active orders on sync path):

supabase/functions/printful-proxy/index.ts — remove /sync route and sync-specific logic; retain order management routes (used for all Printful orders)

supabase/functions/stripe-webhook/index.ts — remove SYNC_VARIANT branch

supabase/functions/stripe-checkout/index.ts — remove non-snapshot path

src/lib/fulfillment/resolver.ts — remove SYNC_VARIANT branch

src/lib/fulfillment/types.ts — remove SYNC_VARIANT from FulfillmentStrategy union

Additional cleanup regardless of sync disposition:

src/lib/printful/templates.ts — add deprecation comment to resolveLayoutTemplateForVariantPlacement() noting it must not be called with V2 IDs

src/app/api/printful/templates/[productId]/route.ts — add comment scoping it to ProductDesigner / legacy use only

Printful/CURRENT-ARCHITECTURE-CONTRACT.md — update §3 with final printful_sync disposition, update §8.1 and §4.4 to remove ⚠️ IMPLEMENTATION MIGRATION PENDING markers (migration complete), update change log

New Files Expected
NONE

Database Migration Required
NO (unless sync products are being archived — that is a data operation, not a schema migration)

V2 Endpoints
None new — all V2 migrations completed in Workstreams A and B.

V1 Endpoints Retained
Only those explicitly justified:

GET /products — catalog product discovery (if V2 equivalent not verified)

GET /products/{id} — catalog product detail (if V2 equivalent not verified)

GET /mockup-generator/printfiles/{id} — conflicting_placements (if V2 not verified)

GET /mockup-generator/templates/{id} — ProductDesigner, conflicting_placements

V1 mockup task creation — if V2 not verified in Workstream A

V1 Code Removed
All Catalog Builder V1 dependencies replaced in Workstream A are confirmed removed and not re-introduced.

Tests
Full test suite run: all tests pass

TypeScript: 0 errors across entire project

Production build: npm run build passes with 0 errors and 0 warnings

Regression: complete Catalog Builder flow (blank → publish)

Regression: complete fulfillment flow (checkout → Printful order)

Regression: Printful webhook (shipment → tracking update)

Regression: edit mode (load existing product → save changes)

Operator Test — Complete Lifecycle Verification
This is the §25 system Definition of Done verification:

Catalog: Open admin Catalog Builder, browse blank products, verify eligibility check works

Build Product: Select product, select variants, select design, configure production (V2 template resolves, no fallback), position artwork, generate mockups

Publish: Complete details, set pricing, review, publish — verify product appears in storefront

Storefront: Navigate to product page, verify images, variants, pricing display correctly

Cart: Add to cart, proceed to checkout

Stripe payment: Complete Stripe test mode payment

Purchase: Verify orders record created with status = "paid" and fulfillment_snapshot populated

Fulfillment snapshot: Verify snapshot contains correct DIRECT_CATALOG_ORDER strategy, correct printful_catalog_variant_id, correct artwork_url, correct placement and technique

Printful draft/order: Verify orders.printful_order_id populated, verify Printful order exists in Printful dashboard as draft

Provider status: Verify orders.fulfillment_status = "pending" or "draft"

Shipment/tracking path: Simulate or trigger Printful package_shipped webhook, verify orders.fulfillment_status = "shipped" and tracking_number populated

No manufacturing confirmation required unless operator explicitly authorizes.

Rollback Boundary
Workstream C is primarily documentation, cleanup, and regression. The only irreversible action is sync code deletion (if REMOVE LATER). That deletion must be preceded by confirmed database evidence of zero active sync orders. All other changes are reversible.

Definition of Done
printful_sync has a documented final disposition in the contract

All ⚠️ IMPLEMENTATION MIGRATION PENDING markers removed from contract (migrations complete)

No variant_mapping[0] in any Catalog Builder code path

No variantPrintfiles[0] in any Catalog Builder code path

All remaining V1 calls are explicitly commented with justification

TypeScript: 0 errors

Production build: PASS

All tests pass

Complete operator lifecycle verified

IMPLEMENTATION ORDER
BATCH 1 VERIFICATION (read-only)
  → V2 mockup-templates placement discovery
  → V2 mockup-styles DPI sufficiency
  (operator-authorized write: V2 mockup task creation)
        ↓
WORKSTREAM A
  V2 Catalog / Production / Mockups
  → getMockupTemplates(), getMockupStyles(), resolveV2Template()
  → Remove variant_mapping[0] from CatalogBuilder
  → Remove variantPrintfiles[0] from Catalog Builder DPI path
  → New API routes for V2 templates and styles
  → Tests + operator test
        ↓
BATCH 2 VERIFICATION (read-only + operator-authorized writes)
  → V2 shipping rates
  → V2 order creation (draft, immediately cancelled)
  → V2 order retrieval + @external_id
  → V2 order confirmation + cancellation
  → V2 webhook event format
        ↓
WORKSTREAM B
  V2 Fulfillment / Shipping / Orders / Webhooks
  → Migrate stripe-checkout shipping
  → Migrate stripe-webhook order creation
  → Migrate printful-proxy order management
  → Tests + operator test
        ↓
WORKSTREAM C
  Legacy Cleanup / Sync Disposition / Final Regression
Workstream C — Definition of Done (continued)
printful_sync has a documented final disposition in the contract

All ⚠️ IMPLEMENTATION MIGRATION PENDING markers removed from contract (migrations complete)

No variant_mapping[0] in any Catalog Builder code path

No variantPrintfiles[0] in any Catalog Builder code path

All remaining V1 calls are explicitly commented with justification

TypeScript: 0 errors

Production build: PASS

All tests pass

Complete operator lifecycle verified end-to-end

ROLLBACK STRATEGY
General Principle
Each workstream is bounded so that a rollback does not affect the commerce rail. Stripe, fulfillment snapshots, purchase records, and product identity are untouched by all three workstreams.

Workstream A Rollback
Trigger: V2 template resolution produces incorrect geometry, mockup generation fails, or TypeScript errors introduced.

Method:

Revert CatalogBuilder.tsx to pre-Workstream-A version

Revert src/lib/printful/templates.ts to pre-Workstream-A version

Revert src/lib/printful/types.ts to pre-Workstream-A version

Revert src/app/admin/catalog-builder/types.ts to pre-Workstream-A version

Delete new API routes mockup-templates/[productId]/route.ts and mockup-styles/[productId]/route.ts

Effect: Catalog Builder returns to V1 variant_mapping[0] fallback behavior. Noncompliant but functional. No customer-facing impact. No database changes to revert.

Workstream B Rollback
Trigger: V2 order creation fails, OR-13 equivalent not confirmed, shipping rates incorrect, or fulfillment breaks.

Method:

Redeploy previous version of stripe-checkout/index.ts edge function

Redeploy previous version of stripe-webhook/index.ts edge function

Redeploy previous version of printful-proxy/index.ts edge function

Effect: Returns to V1 order creation and shipping. All existing FulfillmentSnapshot records remain valid — the snapshot structure is unchanged. Orders already created via V2 retain their printful_order_id and are unaffected. No database changes to revert.

Workstream C Rollback
Trigger: Sync deletion caused unexpected breakage, or disposition decision was premature.

Method:

Restore deleted sync code from version control

Redeploy affected edge functions

Effect: Sync infrastructure restored. No database changes involved (sync product records were never deleted — only code paths).

What Cannot Be Rolled Back
Published products (storefront impact — operator decision required)

Completed Stripe payments (immutable)

Printful orders already confirmed for manufacturing (provider decision required)

Fulfillment snapshots (immutable by design)

COMPLETE DEFINITION OF DONE
The Printful integration is complete when all 25 conditions are met:

Catalog Builder works end-to-end — blank → variants → design → production → position → mockups → details → pricing → review → publish

New Catalog Builder functionality is V2-first — templates, styles, variants, pricing all use V2 endpoints

No unsafe V2→V1 identity crossing remains in the modern path — variant_mapping[0] and variantPrintfiles[0] removed from all Catalog Builder code paths

No arbitrary provider record fallback remains in the modern path — zero matches = unresolved, not silently resolved

Variant identity is authoritative — V2 CatalogVariant.id used directly in template resolution via catalog_variant_ids.includes()

Availability is authoritative — V2 eligibility check ("eligible" / "unavailable" / "error") used; "unknown" never collapsed

Provider pricing is authoritative — V2 prices endpoint used; null never converted to $0

Production geometry is authoritative — V2 mockup-templates print_area_* fields used; zero or multiple matches block Continue

Artwork validation is authoritative — DPI derived from V2 data; UNVERIFIED shown honestly when data unavailable

Mockup generation works through the final chosen provider path — V2 if verified, V1 with documented justification if not

CountyBuys retail pricing remains CountyBuys-owned — retail_price on product_variants never overwritten by provider data

Stripe behavior remains regression-identical — session creation, webhook verification, payment idempotency unchanged

Fulfillment snapshots remain immutable — orders.fulfillment_snapshot never rewritten after creation

DIRECT_CATALOG_ORDER remains primary — no silent fallback to SYNC_VARIANT for Catalog Builder products

Shipping works — live Printful shipping rate used at checkout; fallback to default_shipping_cost when provider unavailable

Provider order creation works — Printful order created on checkout.session.completed; printful_order_id stored

Order status works — orders.fulfillment_status updated by Printful webhook

Shipment/tracking works — tracking_number and tracking_url populated by Printful package_shipped event; shipping email sent

Relevant provider events/webhooks work — package_shipped and order_updated handled correctly

Remaining V1 calls are explicitly justified and documented — each surviving V1 call has an inline comment stating why V2 was not used

printful_sync has a final documented disposition — one of KEEP / OPTIONAL / DEPRECATE / REMOVE LATER recorded in contract

Tests PASS — all existing tests pass; new tests added for V2 template resolution, V2 DPI validation, V2 order construction

TypeScript = 0 errors — npx tsc --noEmit passes

Production build PASS — npm run build completes with 0 errors

One controlled customer lifecycle is operator verified — complete path from Catalog Builder through Printful draft order confirmed working

ESTIMATED IMPLEMENTATION BOUNDARY
Implementation workstreams: 3

BATCH 1 VERIFICATION (read-only + one authorized write)
  Scope: V2 mockup-templates placement discovery,
         V2 mockup-styles DPI sufficiency,
         V2 mockup task creation (operator-authorized)
  Blocking: YES — must complete before Workstream A mockup migration
  Safe to start: immediately

WORKSTREAM A — V2 Catalog / Production / Mockups
  Files changed: 4 existing + 2 new API routes
  Database migrations: 0
  Commerce rail touched: NO
  Blocking dependency: Batch 1 verification (placement + DPI)
  Mockup task migration: conditional on Batch 1 write verification
  Estimated scope: bounded — all changes within Catalog Builder UI
                   and provider library layer

BATCH 2 VERIFICATION (read-only + operator-authorized writes)
  Scope: V2 shipping, V2 order creation/retrieval/confirmation/cancellation,
         V2 webhook event format
  Blocking: YES — must complete before Workstream B
  Safe to start: after Workstream A operator test passes

WORKSTREAM B — V2 Fulfillment / Shipping / Orders / Webhooks
  Files changed: 3 edge functions (in-place migration)
  Database migrations: 0
  Commerce rail touched: provider adapter layer only —
                         Stripe session and snapshot logic unchanged
  Blocking dependency: Batch 2 verification

WORKSTREAM C — Legacy Cleanup / Sync Disposition / Final Regression
  Files changed: depends on printful_sync disposition
  Database migrations: 0
  Commerce rail touched: NO (unless sync removal authorized)
  Blocking dependency: Workstreams A and B complete,
                       database evidence for sync disposition gathered


Copy
No workstream may begin implementation before its blocking verification batch is complete. No workstream may be subdivided further unless a live provider contract genuinely blocks execution mid-workstream.

CODE MODIFIED: NO
DATABASE WRITES: 0
PRINTFUL WRITES: 0
STRIPE ACTIVITY: 0

WAITING FOR OPERATOR REVIEW: YES

STOP.