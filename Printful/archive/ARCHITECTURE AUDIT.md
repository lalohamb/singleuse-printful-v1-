# READ-ONLY STOREFRONT CATALOG & DATABASE ARCHITECTURE AUDIT

## ROLE

Act as a senior Next.js, Supabase/PostgreSQL, e-commerce, and systems architecture engineer.

Your assignment is to perform a comprehensive **READ-ONLY architecture audit** of this repository.

The application previously contained Printify-oriented code and has since been adapted toward Printful.

A new Printful integration has recently been completed, including:

- Printful server library
- Catalog API access
- Product and variant retrieval
- Print files
- Techniques
- Layout templates
- Mockup generation
- Product Designer
- Artwork upload
- Supabase Storage integration
- Existing Printful synchronization/order Edge Functions
- Existing Printful webhook infrastructure

The next planned development phase is a **storefront-owned product catalog**.

Before implementing that phase, we must understand exactly what product/catalog/database infrastructure already exists.

---

# CRITICAL RULE: READ ONLY

DO NOT MODIFY THE PROJECT.

This is an architecture audit only.

You MUST NOT:

- create files;
- modify files;
- delete files;
- rename files;
- run database migrations;
- create migrations;
- modify Supabase;
- alter database tables;
- run SQL that changes data;
- install packages;
- uninstall packages;
- update packages;
- run formatters that modify files;
- run automatic fixes;
- refactor code;
- remove Printify code;
- replace Printify code;
- create Printful code;
- create catalog code;
- modify environment files;
- change configuration;
- commit anything.

Commands used during this audit must be non-destructive.

Do NOT run:

```bash
npm audit fix
npm update
npm install
npm uninstall
eslint --fix
prettier --write
supabase db push
supabase migration up
supabase db reset
```

or any equivalent mutating command.

If something should eventually be changed, document the recommendation.

DO NOT implement it.

---

# PRIMARY OBJECTIVE

Determine the current architecture of:

1. storefront products;
2. product variants;
3. product categories;
4. product collections;
5. product images;
6. product designs/artwork;
7. provider mappings;
8. Printify remnants;
9. Printful integration;
10. product synchronization;
11. product administration;
12. product publication;
13. cart;
14. checkout;
15. orders;
16. fulfillment;
17. Supabase database schema;
18. Supabase Storage;
19. Stripe relationships;
20. product-related API routes;
21. product-related Edge Functions;
22. product-related TypeScript types.

We need to determine what can be preserved and what should eventually be refactored before implementing the storefront catalog.

---

# TARGET ARCHITECTURE

The future architecture is intended to follow this principle:

> THE STOREFRONT OWNS THE COMMERCIAL PRODUCT CATALOG.
> PRINTFUL PROVIDES MANUFACTURING CAPABILITIES AND FULFILLMENT.

The intended separation is:

```text
STOREFRONT
    |
    +-- Products
    +-- Variants
    +-- Categories
    +-- Collections
    +-- Pricing
    +-- SEO
    +-- Designs
    +-- Product Images
    +-- Publication
    +-- Orders
    |
    v
Provider Mapping
    |
    v
Printful Service Layer
    |
    +-- Catalog
    +-- Manufacturing Products
    +-- Provider Variants
    +-- Print Files
    +-- Techniques
    +-- Layout Templates
    +-- Mockups
    +-- Fulfillment
    +-- Shipping
```

Do NOT implement this architecture during the audit.

Use it only as the comparison target.

---

# PHASE 1 — REPOSITORY INVENTORY

Inspect the repository structure.

Identify:

- Next.js application directories;
- Supabase directories;
- migrations;
- Edge Functions;
- API routes;
- product components;
- admin components;
- cart components;
- checkout components;
- order components;
- Printify code;
- Printful code;
- Stripe code;
- product types;
- product utilities;
- synchronization logic.

Report the relevant directory tree.

Do not dump the entire repository.

Show only architecture-relevant paths.

Example:

```text
src/
  app/
  components/
  lib/
  types/

supabase/
  functions/
  migrations/
```

Expand relevant product/provider directories.

---

# PHASE 2 — PACKAGE AND FRAMEWORK INSPECTION

Inspect:

```text
package.json
tsconfig.json
next.config.*
middleware.*
```

Determine:

- Next.js version;
- React version;
- Supabase packages;
- Stripe packages;
- image libraries;
- validation libraries;
- state-management libraries;
- testing framework;
- relevant commerce packages.

Determine whether any dependencies appear to exist solely for the old Printify implementation.

DO NOT remove them.

Document them.

---

# PHASE 3 — DATABASE MIGRATION AUDIT

Inspect ALL Supabase migration files relevant to:

- products;
- variants;
- categories;
- collections;
- designs;
- artwork;
- product images;
- purchases;
- orders;
- order items;
- entitlements;
- provider mappings;
- Printify;
- Printful;
- Stripe;
- inventory;
- pricing.

Reconstruct the effective schema as accurately as possible from migrations.

Do NOT assume that the newest migration contains the entire schema.

Trace schema evolution where necessary.

For each relevant table report:

```text
TABLE:
PURPOSE:
PRIMARY KEY:
FOREIGN KEYS:
IMPORTANT COLUMNS:
PROVIDER-SPECIFIC COLUMNS:
RLS:
INDEXES:
USED BY:
CONCERNS:
```

---

# PHASE 4 — PRODUCT TABLE AUDIT

Locate every table representing products.

Determine whether the application currently has:

```text
products
store_products
catalog_products
printify_products
printful_products
products_cache
```

or equivalent structures.

For the primary product table determine:

- internal primary key;
- product name/title;
- slug;
- description;
- retail price;
- provider cost;
- provider ID;
- status;
- publication state;
- images;
- metadata;
- timestamps.

Most importantly answer:

> Is the current product record truly storefront-owned, or is it effectively a synchronized copy of a POD provider product?

Explain the evidence.

---

# PHASE 5 — VARIANT AUDIT

Locate all variant structures.

Determine:

- internal variant ID;
- product relationship;
- provider variant ID;
- size;
- color;
- SKU;
- retail price;
- provider cost;
- availability;
- inventory status;
- metadata.

Determine whether variant identity is:

```text
STORE VARIANT
      |
      v
PROVIDER MAPPING
```

or effectively:

```text
PRINTIFY/PRINTFUL VARIANT
      =
STORE VARIANT
```

Document the current behavior.

---

# PHASE 6 — PRINTIFY REMNANT AUDIT

Search the repository comprehensively for case-insensitive references to:

```text
printify
PRINTIFY
printifyProduct
printify_product
printifyVariant
printify_variant
blueprint
provider_id
shop_id
```

Also identify code that may be Printify-specific without containing the word "Printify."

Examples:

- Printify response shapes;
- blueprint assumptions;
- Printify shop IDs;
- Printify publishing logic;
- Printify image structures;
- Printify variant structures;
- Printify order payloads;
- Printify webhook handling;
- Printify environment variables.

For every meaningful remnant classify it as:

### A — REMOVE EVENTUALLY

Obsolete Printify-only code with no current purpose.

### B — REFACTOR EVENTUALLY

Useful commerce functionality that remains coupled to Printify.

### C — PRESERVE

Generic functionality that originated in the Printify implementation but is provider-neutral and remains useful.

### D — INVESTIGATE

Purpose or usage cannot be determined confidently.

DO NOT remove anything.

---

# PHASE 7 — PRINTFUL AUDIT

Inspect the completed Printful implementation.

Pay particular attention to:

```text
src/lib/printful/
src/app/api/printful/
src/components/product-designer/
supabase/functions/printful-proxy/
supabase/functions/printful-webhook/
```

Confirm how these pieces relate to each other.

Determine whether there are now TWO Printful integration layers:

```text
Next.js Printful API layer
```

and:

```text
Supabase Printful Edge Function layer
```

If so, document their respective responsibilities.

Determine whether any responsibilities overlap.

DO NOT consolidate them.

Only report findings.

---

# PHASE 8 — PROVIDER COUPLING AUDIT

Search for provider-specific IDs being used directly as internal IDs.

Look for patterns such as:

```text
product.id = printify product ID
product.id = printful product ID

variant.id = provider variant ID
```

Determine whether the storefront has independent IDs.

We want eventually:

```text
STORE PRODUCT ID
       |
       v
PROVIDER MAPPING
       |
       +-- provider
       +-- provider_product_id
```

and:

```text
STORE VARIANT ID
       |
       v
PROVIDER VARIANT MAPPING
       |
       +-- provider
       +-- provider_variant_id
```

Report whether this abstraction already exists.

---

# PHASE 9 — CATEGORY AND COLLECTION AUDIT

Determine whether the storefront already supports:

- categories;
- collections;
- tags;
- product types;
- gender/audience;
- featured products;
- trending products;
- gifts;
- personalized products;
- price-based collections;
- new arrivals.

Identify whether these are:

- database-driven;
- hard-coded;
- derived from provider data;
- configuration-driven;
- absent.

Do not create new taxonomy.

---

# PHASE 10 — PRODUCT IMAGE AUDIT

Determine how product images currently work.

Identify:

- provider image URLs;
- Supabase Storage images;
- local images;
- generated mockups;
- cached images;
- thumbnails;
- hero images.

Determine whether product pages depend directly on Printify or Printful-hosted URLs.

Identify whether the newly implemented mockup persistence mechanism can become the long-term product-image storage strategy.

Do not migrate images.

---

# PHASE 11 — DESIGN / ARTWORK AUDIT

Determine whether designs currently exist as independent database entities.

Search for:

```text
design
designs
artwork
artwork_url
print_file
placement
mockup
template
```

Determine whether artwork is currently:

- attached directly to products;
- stored independently;
- stored only in Printful;
- stored in Supabase;
- uploaded dynamically;
- not modeled.

Determine whether the architecture already supports:

```text
DESIGN
   |
   +-- Product A
   +-- Product B
   +-- Product C
```

or whether artwork is permanently tied to individual products.

---

# PHASE 12 — SUPABASE STORAGE AUDIT

Inspect how Supabase Storage is used.

Document known buckets and their purposes.

Pay particular attention to:

```text
store-images
```

Determine:

- upload paths;
- public/private access assumptions;
- artwork usage;
- product image usage;
- generated mockup usage.

Do not modify bucket policies.

---

# PHASE 13 — ADMIN PRODUCT MANAGEMENT AUDIT

Locate existing admin pages/components.

Determine whether administrators can currently:

- create products;
- edit products;
- delete products;
- publish products;
- unpublish products;
- change pricing;
- assign categories;
- manage variants;
- synchronize products;
- manage images;
- manage artwork;
- generate mockups.

Determine whether the admin UI is:

- Printify-oriented;
- Printful-oriented;
- provider-neutral;
- mixed.

---

# PHASE 14 — STOREFRONT PRODUCT PAGE AUDIT

Trace the complete data flow for a public product page.

For example:

```text
URL
 |
 v
Next.js Page
 |
 v
Database/API
 |
 v
Product
 |
 v
Variants
 |
 v
Images
 |
 v
Add to Cart
```

Identify exactly where the product information originates.

Determine whether public product pages depend directly on provider response structures.

---

# PHASE 15 — CART AUDIT

Trace:

```text
Product
   |
   v
Variant Selection
   |
   v
Add to Cart
   |
   v
Cart State
```

Document what the cart stores.

Determine whether it stores:

- internal product ID;
- provider product ID;
- internal variant ID;
- provider variant ID;
- SKU;
- price;
- image;
- product name.

Identify provider coupling.

---

# PHASE 16 — CHECKOUT AND STRIPE AUDIT

Trace:

```text
Cart
 |
 v
Checkout
 |
 v
Stripe
 |
 v
Payment Confirmation
 |
 v
Order
```

Determine:

- where price is sourced;
- whether Stripe price IDs exist;
- whether dynamic Stripe prices are created;
- how order metadata is passed;
- whether provider IDs are embedded in Stripe metadata;
- how payment success is reconciled.

Do NOT change Stripe integration.

---

# PHASE 17 — ORDER DATABASE AUDIT

Identify:

```text
orders
order_items
purchases
transactions
```

or equivalent tables.

Determine which entity is the canonical storefront order.

Document relationships among:

```text
Customer
Order
Order Item
Product
Variant
Stripe
Printful
```

Determine whether Printful order IDs replace internal order IDs or are mapped to them.

---

# PHASE 18 — PRINTFUL ORDER FLOW AUDIT

Inspect the existing:

```text
supabase/functions/printful-proxy
```

and related code.

Trace the fulfillment flow:

```text
Paid Storefront Order
        |
        v
Printful Order Request
        |
        v
Printful Order ID
        |
        v
Manufacturing
        |
        v
Shipment
```

Determine:

- how products are mapped;
- how variants are mapped;
- what identifiers are sent;
- whether designs/files are included;
- how order state is persisted.

---

# PHASE 19 — WEBHOOK AUDIT

Inspect:

```text
supabase/functions/printful-webhook
```

Determine how events such as:

```text
shipped
fulfilled
cancelled
```

are processed.

Determine which database records are updated.

Identify whether webhook logic depends on provider-specific product IDs or only provider order IDs.

---

# PHASE 20 — TYPE SYSTEM AUDIT

Locate product-related TypeScript interfaces/types.

Identify duplicate or conflicting types such as:

```text
Product
StoreProduct
PrintifyProduct
PrintfulProduct
CatalogProduct
Variant
PrintifyVariant
PrintfulVariant
```

Document:

- where each type lives;
- where it is used;
- whether it represents storefront data or provider data.

Identify naming collisions.

Do not refactor them.

---

# PHASE 21 — API ROUTE AUDIT

Inventory product-related routes.

Classify each route as:

```text
STOREFRONT
PRINTFUL
PRINTIFY
STRIPE
ADMIN
FULFILLMENT
UNKNOWN
```

For each route report:

```text
METHOD
PATH
PURPOSE
AUTH
DATABASE TABLES
EXTERNAL PROVIDER
CURRENT STATUS
```

---

# PHASE 22 — DEAD CODE ANALYSIS

Identify code that appears to be orphaned.

Evidence can include:

- no imports;
- no route usage;
- no component references;
- obsolete Printify environment variables;
- replaced services;
- duplicate implementations.

Do NOT delete it.

Classify confidence:

```text
HIGH CONFIDENCE DEAD
LIKELY DEAD
UNCERTAIN
```

---

# PHASE 23 — DUPLICATION ANALYSIS

Look specifically for duplicate responsibilities.

Examples:

```text
Printful catalog retrieval in two locations

Product synchronization in two locations

Two product types representing the same thing

Two variant models

Two order submission mechanisms

Two webhook processors
```

Report duplication without changing it.

---

# PHASE 24 — SOURCE-OF-TRUTH ANALYSIS

For each domain identify the CURRENT source of truth:

| Domain | Current Source |
|---|---|
| Store products | ? |
| Product variants | ? |
| Retail pricing | ? |
| Provider cost | ? |
| Product images | ? |
| Designs | ? |
| Categories | ? |
| Collections | ? |
| Customer orders | ? |
| Payment status | ? |
| Fulfillment status | ? |
| Shipping status | ? |

Then provide the recommended FUTURE source of truth.

Do not implement recommendations.

---

# PHASE 25 — GAP ANALYSIS

Compare the current implementation against this desired architecture:

```text
STOREFRONT DATABASE
|
+-- Products
+-- Variants
+-- Categories
+-- Collections
+-- Designs
+-- Product Images
+-- Pricing
+-- SEO
+-- Publication
+-- Orders
|
v
Provider Mapping
|
v
Printful
```

For each capability classify:

```text
EXISTS AND SUITABLE
EXISTS BUT NEEDS REFACTOR
PARTIALLY EXISTS
MISSING
OBSOLETE
UNKNOWN
```

---

# PHASE 26 — RISK ANALYSIS

Identify risks before implementing the new catalog.

Examples:

- deleting useful existing product data;
- duplicate product tables;
- duplicate variant tables;
- provider ID collisions;
- broken foreign keys;
- RLS incompatibilities;
- checkout regressions;
- Stripe metadata dependencies;
- Printful fulfillment dependencies;
- webhook dependencies;
- stale Printify assumptions;
- product image migration issues.

Rate each:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Explain why.

---

# PHASE 27 — DO NOT DESIGN MIGRATIONS YET

Do NOT write SQL.

Do NOT create migrations.

Do NOT propose exact destructive migration commands.

At this stage we want architecture understanding first.

You may recommend conceptually that something should eventually be:

```text
preserved
renamed
normalized
mapped
deprecated
removed
```

but do not implement or generate executable destructive SQL.

---

# REQUIRED FINAL REPORT

Produce:

```text
STOREFRONT CATALOG / DATABASE ARCHITECTURE AUDIT
```

Use the following structure.

## 1. Executive Summary

Explain the current architecture in plain language.

Answer:

- Is the storefront currently provider-neutral?
- How much Printify architecture remains?
- Is Printful properly isolated?
- Is there already a usable storefront product catalog?
- Is a major rewrite necessary?
- What should be preserved?

---

## 2. Repository Architecture

Show relevant directory structure.

---

## 3. Current Database Schema

Document all commerce-relevant tables and relationships.

Include a textual relationship diagram.

Example:

```text
products
   |
   +-- variants
   |
   +-- product_images
   |
   +-- order_items
```

Use the actual schema found.

---

## 4. Current Product Architecture

Explain how products currently enter and move through the system.

---

## 5. Current Variant Architecture

Explain variant identity and provider relationships.

---

## 6. Printify Remnants

Create a table:

| Location | Purpose | Classification | Recommendation |
|---|---|---|---|

Classifications:

```text
PRESERVE
REFACTOR
REMOVE EVENTUALLY
INVESTIGATE
```

---

## 7. Printful Architecture

Document:

```text
src/lib/printful
src/app/api/printful
ProductDesigner
printful-proxy
printful-webhook
```

Explain responsibilities and overlap.

---

## 8. Product Catalog Status

Classify the current storefront catalog as:

```text
STRONG
PARTIAL
PROVIDER-COUPLED
MINIMAL
ABSENT
```

Explain the evidence.

Do not classify based on assumptions.

---

## 9. Categories and Collections

Document current implementation.

---

## 10. Designs and Artwork

Document current implementation.

---

## 11. Product Images

Document current implementation and storage.

---

## 12. Admin Product Management

Document current capabilities.

---

## 13. Public Storefront Flow

Trace:

```text
database -> product page -> variant -> cart
```

using actual files.

---

## 14. Checkout Flow

Trace:

```text
cart -> Stripe -> payment -> order
```

using actual files.

---

## 15. Fulfillment Flow

Trace:

```text
order -> Printful -> webhook -> shipping
```

using actual files.

---

## 16. Current Sources of Truth

Provide a table:

| Domain | Current Source | Recommended Future Source | Change Needed? |
|---|---|---|---|

---

## 17. Provider Coupling

List every important place where commerce logic is tied directly to Printify or Printful.

---

## 18. Duplicate Responsibilities

Document overlapping systems.

---

## 19. Dead / Obsolete Code

Document likely obsolete code with confidence level.

---

## 20. Architecture Gap Analysis

Use:

| Capability | Status | Evidence | Future Need |
|---|---|---|---|

---

## 21. Risk Register

Use:

| Risk | Severity | Why | Future Mitigation |
|---|---|---|---|

---

## 22. Preserve / Refactor / Remove / Add

Create four sections:

### PRESERVE

Existing infrastructure that should remain.

### REFACTOR LATER

Useful infrastructure that needs provider-neutralization or cleanup.

### REMOVE LATER

Obsolete infrastructure that appears safe to retire after dependency verification.

### ADD

Missing infrastructure required for the storefront-owned catalog.

---

## 23. Recommended Phase 2 Scope

Based ONLY on what actually exists in the repository, define what the next implementation phase should contain.

Do not implement it.

Separate recommendations into:

```text
MUST HAVE
SHOULD HAVE
LATER
```

---

## 24. Proposed Future Architecture

Produce a diagram based on the audit findings.

Target concept:

```text
                    STOREFRONT
                        |
                 PRODUCT CATALOG
                        |
       +----------------+----------------+
       |                |                |
    Products         Variants         Designs
       |                |                |
       +----------------+----------------+
                        |
                 Provider Mapping
                        |
                        v
                 Printful Service
                        |
          +-------------+-------------+
          |             |             |
       Catalog       Mockups        Orders
          |             |             |
          +-------------+-------------+
                        |
                     Printful
```

Modify this diagram if the repository evidence indicates a better structure.

---

## 25. Migration Complexity Assessment

Without writing migrations, estimate:

```text
LOW
MODERATE
HIGH
VERY HIGH
```

Explain what makes the transition simple or difficult.

---

## 26. Final Recommendation

End with:

```text
READY FOR PHASE 2: YES / NO / CONDITIONAL
```

If conditional, list the conditions.

Then state the recommended next implementation objective in one paragraph.

---

# EVIDENCE REQUIREMENT

Every significant conclusion must identify the actual evidence.

Reference:

- file paths;
- migration names;
- table names;
- component names;
- API routes;
- functions;
- types.

Do not make unsupported architectural assumptions.

If something cannot be determined from the repository, state:

```text
NOT DETERMINED FROM CURRENT REPOSITORY
```

Do not invent an answer.

---

# FINAL SAFETY CHECK

Before returning the audit report, confirm:

```text
FILES CREATED: 0
FILES MODIFIED: 0
FILES DELETED: 0
MIGRATIONS CREATED: 0
DATABASE CHANGES: 0
PACKAGES INSTALLED: 0
PACKAGES REMOVED: 0
```

If any number is not zero, explain exactly why before proceeding.

This audit must leave the repository in the same state in which it was found.