CONTRACT-CONSISTENCY CHECK REPORT
Contract version : Phase 11A.5A
Scope : §§1–16 vs. current source code
Code modified : NO

METHODOLOGY
Each contract claim was traced to the specific file and line that either confirms or contradicts it. Findings are grouped by contract section.

§3 — CATALOG SOURCES
Claim	Code finding	Status
catalog_builder: products.printful_id = NULL	resolver.ts checks product.printful_catalog_id not printful_id for catalog_builder path — consistent	✅ CONSISTENT
catalog_builder: products.printful_catalog_id = catalog product ID	resolver.ts line: Number(product.printful_catalog_id) — consistent	✅ CONSISTENT
catalog_builder uses V2 catalog variant ID	CatalogBuilder.tsx selectedVariants[0].id comes from getCatalogVariants() (V2) — consistent	✅ CONSISTENT
printful_sync: products.printful_id non-null	resolver.ts branches on catalogSource === "catalog_builder" else SYNC_VARIANT — consistent	✅ CONSISTENT
No silent merge of the two identity models	resolver.ts branch is explicit, no fallback between strategies	✅ CONSISTENT
Sync code must not be deleted until dependencies proven	No deletion observed	✅ CONSISTENT
§4.1 — V2-FIRST POLICY
Claim	Code finding	Status
New Catalog Builder work must use V2 when available	CatalogBuilder.tsx production stage still calls GET /mockup-generator/templates/{id} (V1) via loadProduction() for template resolution	⚠️ GAP — not a violation yet (V2 migration not implemented), but the code has not caught up to the contract direction
No new V1 dependency introduced merely because V1 exists	loadProduction() was written before §4.1 existed — it is a pre-existing V1 dependency, not a new one introduced after the policy	✅ CONSISTENT (pre-existing)
§4.2 — V2 CATALOG VARIANTS
Claim	Code finding	Status
printfulGetV2() used	catalog.ts getCatalogVariants() uses printfulGetV2()	✅ CONSISTENT
All pages accumulated	catalog.ts do-while loop with accumulated.length < total	✅ CONSISTENT
Deduplicated by variant ID	seenIds Set in catalog.ts	✅ CONSISTENT
CatalogVariant has no price/in_stock	types.ts CatalogVariant interface — no price, in_stock, availability fields	✅ CONSISTENT
paging.total authoritative	catalog.ts reads envelope.paging?.total	✅ CONSISTENT
§4.3 — V2 PROVIDER PRICING
Claim	Code finding	Status
printfulGetV2() used	pricing.ts getCatalogProductPrices() uses printfulGetV2()	✅ CONSISTENT
CatalogVariant must not gain cost fields	CatalogVariant in types.ts has no cost fields	✅ CONSISTENT
"0.00" is valid known zero, not missing	effectiveAmount() in pricing.ts: parseFloat("0.00") = 0, isFinite(0) = true, returns 0	✅ CONSISTENT
Unknown cost never converted to $0	resolveProviderCost() returns {status:"unknown"} when not found	✅ CONSISTENT
No fan-out on catalog browse	StageComponents.tsx BlankSelector.useEffect fetches only /api/printful/products (catalog list), no pricing fan-out	✅ CONSISTENT
Retail price owned by CountyBuys	CatalogBuilder.tsx pricing stage — operator sets retail_price, provider cost is display-only	✅ CONSISTENT
§4.4 — V2 MOCKUP-TEMPLATES (NEW CONTRACT)
Claim	Code finding	Status
Catalog Builder must use GET /v2/catalog-products/{id}/mockup-templates	CatalogBuilder.tsx loadProduction() calls GET /api/printful/templates/{id} which calls V1 GET /mockup-generator/templates/{id}	❌ NOT YET IMPLEMENTED — contract states this is the authoritative path; code still uses V1
Resolution via catalog_variant_ids.includes() + role === "primary"	No such code exists anywhere in the codebase	❌ NOT YET IMPLEMENTED
Do not use variant_mapping[0] for Catalog Builder	CatalogBuilder.tsx resolveTemplate() still uses variant_mapping[0] fallback	❌ CONTRACT VIOLATION — §4.4 and §8.1 prohibit this; code still does it
Do not use templates[0]	Not observed in Catalog Builder code	✅ CONSISTENT
Zero matches = unresolved, do not proceed	Not yet implemented (V2 path not built)	❌ NOT YET IMPLEMENTED
Summary : §4.4 and §8.1 describe the target state. The code has not been migrated yet. The variant_mapping[0] fallback in CatalogBuilder.tsx is a direct violation of the new contract. This is the primary implementation gap.

§4.5 — V2 MOCKUP STYLES
Claim	Code finding	Status
Mockup styles not authoritative for pixel geometry	No code calls the mockup-styles endpoint at all	✅ CONSISTENT (endpoint unused, no violation)
§4.6 — TRANSITIONAL V1 CATALOG DISCOVERY
Claim	Code finding	Status
GET /products via printfulGet() / getCatalogProducts()	catalog.ts getCatalogProducts() uses printfulGet("/products")	✅ CONSISTENT
GET /products/{id}/variants does not exist, must not be used	Not called anywhere in codebase	✅ CONSISTENT
GET /products/{id} returns flat object, no variants array	catalog.ts getCatalogProduct() — consistent with contract note	✅ CONSISTENT
§4.7 — TRANSITIONAL V1 PRINTFILES
Claim	Code finding	Status
technique parameter required	templates.ts getPrintfiles() passes ?technique=	✅ CONSISTENT
Must not redefine V2 catalog variant identity	artwork-validation.ts fetchPrintfileSpec() uses variantId for printfile lookup but falls back to variantPrintfiles[0] — this is a V1 ID lookup using a V2 ID passed in from CatalogBuilder.tsx	⚠️ SAME ID-SPACE ISSUE as template resolution — V2 CatalogVariant.id passed as variantId to a V1 variant_printfiles[].variant_id lookup. Falls back to variantPrintfiles[0] silently. Authorized by §8.2 as transitional, but the fallback is the same pattern as variant_mapping[0]
§4.8 — TRANSITIONAL V1 TEMPLATE METADATA
Claim	Code finding	Status
V1 variant_mapping valid only for V1-only workflows	templates.ts resolveLayoutTemplateForVariantPlacement() uses variant_mapping[0] fallback — called by batch/recipe routes (V1 workflows)	✅ CONSISTENT for those callers
Prohibited: V2 CatalogVariant.id → V1 variant_mapping.variant_id	CatalogBuilder.tsx resolveTemplate() passes state.selectedVariants[0].id (V2 ID) into V1 variant_mapping.find() then falls back to variant_mapping[0]	❌ CONTRACT VIOLATION — explicitly prohibited by §4.8 and §8.3
conflicting_placements normalization	templates.ts getLayoutTemplates() normalizes array→Record	✅ CONSISTENT
§4.9 — TRANSITIONAL V1 MOCKUP TASK
Claim	Code finding	Status
POST /mockup-generator/create-task/{id} remains V1	mockups.ts createMockupTask() uses printfulPost("/mockup-generator/create-task/...")	✅ CONSISTENT
GET /mockup-generator/task?task_key= remains V1	mockups.ts getMockupTask() uses printfulGet("/mockup-generator/task?...")	✅ CONSISTENT
Do not migrate without live V2 verification	No V2 mockup task code exists	✅ CONSISTENT
§4.10 — LEGACY SYNC PATH
Claim	Code finding	Status
printful_sync not primary architecture	resolver.ts branches catalog_builder first, sync is else-branch	✅ CONSISTENT
No Printful Sync product created for Catalog Builder fulfillment	No sync product creation in any catalog-builder route	✅ CONSISTENT
§4.11 — RESPONSE HELPERS
Claim	Code finding	Status
printfulGet() for V1, printfulGetV2() for V2, not interchangeable	All V1 calls use printfulGet(), all V2 calls use printfulGetV2() — no mixing observed	✅ CONSISTENT
§4.12 — PROVIDER IDENTITY BOUNDARY
Claim	Code finding	Status
V2 CatalogVariant.id ≠ V1 variant_mapping.variant_id	Confirmed by Phase 11A.5A live audit	✅ CONSISTENT (documented fact)
Do not use variant_mapping[0] to resolve identity mismatch	CatalogBuilder.tsx resolveTemplate() does exactly this	❌ CONTRACT VIOLATION
V2 catalog_variant_ids must be used directly for Catalog Builder geometry	Not yet implemented	❌ NOT YET IMPLEMENTED
§5 — CATALOG VARIANT SEMANTICS
Claim	Code finding	Status
CatalogVariant fields: id, catalog_product_id, name, size, color, color_code, image	types.ts CatalogVariant interface matches exactly	✅ CONSISTENT
No price/in_stock/availability fields	types.ts confirms absence	✅ CONSISTENT
No fabrication of missing fields	catalog.ts normalizeVariant() maps only the 7 authorized fields	✅ CONSISTENT
§6 — ELIGIBILITY
Claim	Code finding	Status
getCatalogVariants() never throws	catalog.ts — all errors caught, returns CatalogVariantResult	✅ CONSISTENT
unknown never collapsed to unavailable	StageComponents.tsx BlankSelector: eligibility === null → isUnknown, only isUnavailable disables the Select button	✅ CONSISTENT
error never collapsed to unavailable	isError and isUnavailable are separate branches	✅ CONSISTENT
§7 — PRICING SEMANTICS
Claim	Code finding	Status
provider_cost: null means unknown, not $0	pricing.ts resolveProviderCost() returns {status:"unknown"} → CatalogBuilder.tsx sets provider_cost: null	✅ CONSISTENT
COST_PLUS blocked when cost unknown	recipe-engine.ts pushes error when providerCost === null && strategy === "COST_PLUS"	✅ CONSISTENT
price: 1 dry-run sentinel	CatalogBuilder.tsx multi-dry-run uses price: 1	✅ CONSISTENT
§8.1 — V2 TEMPLATE RESOLUTION (NEW)
Claim	Code finding	Status
Catalog Builder uses V2 mockup-templates	CatalogBuilder.tsx uses V1 getLayoutTemplates()	❌ NOT YET IMPLEMENTED
variant_mapping[0] prohibited for Catalog Builder	CatalogBuilder.tsx resolveTemplate() uses it	❌ CONTRACT VIOLATION
§8.2 — TRANSITIONAL V1 PRINTFILES
Claim	Code finding	Status
Authorized for placement discovery and DPI validation	CatalogBuilder.tsx uses loadProduction() → V1 printfiles for available_placements	✅ CONSISTENT
technique required	Route validates technique, getPrintfiles() passes it	✅ CONSISTENT
§8.3 — TRANSITIONAL V1 TEMPLATE METADATA
Claim	Code finding	Status
V1 variant_mapping valid only for V1-identity workflows	templates.ts resolveLayoutTemplateForVariantPlacement() — used by batch/recipe routes with V1 PrintfulVariant.id	✅ CONSISTENT for those callers
Prohibited crossing: V2 ID → V1 variant_mapping	CatalogBuilder.tsx resolveTemplate() does this crossing	❌ CONTRACT VIOLATION
§8.4 — TECHNIQUE AWARENESS
Claim	Code finding	Status
Technique change invalidates stale state	CatalogBuilder.tsx technique change: clears artworkValidation, pricingData, resets provider_cost to null, calls loadProduction() which clears printfiles, templates, placement, activeTemplate	✅ CONSISTENT
Placement change invalidates stale provider cost	CatalogBuilder.tsx placement change: setPricingData(null), resets provider_cost to null	✅ CONSISTENT
V1 uppercase / V2 lowercase casing normalization	pricing.ts resolveProviderCost() uses .toLowerCase() on both sides	✅ CONSISTENT
VALID_TECHNIQUES in techniques.ts	File exists with correct set	✅ CONSISTENT
§8.6 — CONFLICTING PLACEMENTS
Claim	Code finding	Status
getLayoutTemplates() normalizes to Record<string, string[]>	templates.ts — array normalization present	✅ CONSISTENT
Isolated from V2 template identity resolution	conflicting_placements used only in PlacementSelector display, not in template resolution	✅ CONSISTENT
§9 — PRODUCT DESIGNER RACE SAFETY
Claim	Code finding	Status
Technique change clears stale state immediately	ProductDesigner.tsx useEffect on technique: sets printfiles, templates, placement, activeTemplate to null before fetch	✅ CONSISTENT
AbortController used	ProductDesigner.tsx creates controller, aborts on cleanup	✅ CONSISTENT
AbortError suppressed	catch checks e.name === "AbortError"	✅ CONSISTENT
§10 — FULFILLMENT
Claim	Code finding	Status
DIRECT_CATALOG_ORDER for catalog_builder	resolver.ts line: catalogSource === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT"	✅ CONSISTENT
No silent fallback DIRECT_CATALOG_ORDER → SYNC_VARIANT	Branch is explicit, no fallback	✅ CONSISTENT
Artwork validated from trusted Supabase Storage host	resolver.ts assertTrustedArtwork() checks hostname.endsWith("supabase.co")	✅ CONSISTENT
Fails closed — throws if required field missing	resolver.ts throws on every missing field	✅ CONSISTENT
§11 — FULFILLMENT SNAPSHOTS
Claim	Code finding	Status
Immutable historical records	No snapshot mutation code observed in any catalog-builder route	✅ CONSISTENT
§12 — PROVIDER CONTRACT RULE
Claim	Code finding	Status
No new endpoint implemented from inference alone	No new V2 endpoints added to code since contract was written	✅ CONSISTENT
§13 — RATE-LIMIT SAFETY
Claim	Code finding	Status
No fan-out on page load	StageComponents.tsx BlankSelector.useEffect fetches only /api/printful/products — 1 request	✅ CONSISTENT
_summaryCache used	StageComponents.tsx module-level _summaryCache Map present	✅ CONSISTENT
Lazy/operator-driven	Summaries fetched only via batchFetchSummaries() which is not called on load	✅ CONSISTENT
§16 — AMAZON Q CHANGE CONTROL
Claim	Code finding	Status
Read contract before implementing	Procedural — not verifiable in code	N/A
SUMMARY
Violations (contract says X, code does Y)
#	Contract rule	File	Specific code	Severity
V1	§4.4 / §8.1 / §4.12: Catalog Builder must not use variant_mapping[0]	CatalogBuilder.tsx resolveTemplate()	if (!mapping) mapping = variant_mapping[0]	HIGH — directly prohibited
V2	§4.8 / §8.3: V2 CatalogVariant.id → V1 variant_mapping.variant_id crossing prohibited	CatalogBuilder.tsx resolveTemplate()	variant_mapping.find(m => m.variant_id === variantId) where variantId is a V2 ID	HIGH — explicitly prohibited
Both violations are in the same function ( resolveTemplate()) and are the same root issue: the Catalog Builder production stage has not yet been migrated to V2 mockup-templates. They are pre-announced — the contract was written to describe the target state, and the migration is the next implementation workstream.

Implementation gaps (contract describes target state not yet built)
#	Contract rule	What is missing
G1	§4.4 / §8.1	GET /v2/catalog-products/{id}/mockup-templates not yet called anywhere
G2	§4.4 / §8.1	catalog_variant_ids.includes() + role === "primary" resolver not yet implemented
G3	§4.4	No API route for V2 mockup-templates exists
Consistent (contract matches code)
37 of 40 checked claims are fully consistent. All V2 catalog variant, pricing, eligibility, fulfillment, race safety, rate-limit, and technique-awareness behaviors match the contract exactly.

One additional observation
artwork-validation.ts fetchPrintfileSpec() passes a V2 CatalogVariant.id as variantId into a V1 variant_printfiles[].variant_id lookup, then silently falls back to variantPrintfiles[0]. This is the same V1/V2 ID-space issue as template resolution, applied to DPI validation. It is authorized as transitional by §8.2, but it is worth noting as a parallel gap that will need the same treatment when V2 printfile/DPI validation is eventually migrated.

CODE MODIFIED: NO