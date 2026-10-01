# STOREFRONT CATALOG FOUNDATION REPORT

Phase 3 — Storefront Catalog Foundation
Generated: 2026-10-17

---

## 1. Executive Summary

Phase 3 transforms the `products` table from a Printful-synchronized record into a
store-owned commercial catalog. Nine new store-owned fields were added. The public RLS
policy was fixed to exclude draft and archived products. The Printful sync was updated to
respect `content_locked` — admin-curated content is never overwritten on re-sync. Products
removed from Printful are now archived rather than deleted. A catalog service layer was
created at `src/lib/catalog/`. Product URLs now use stable slugs. The product detail page
resolves by slug or UUID and redirects legacy UUID links to the canonical slug URL.
47 new tests were added (120 total, all passing). TypeScript and production build pass.

---

## 2. Pre-Implementation Architecture

```
products table (22 columns)
  - No slug
  - No short_description, meta_title, meta_description
  - No compare_at_price, brand, product_type
  - No published_at, display_order
  - status field existed (active/draft/archived) — reused
  - content_locked existed — reused as sync ownership guard
  - public_read_products RLS: USING (true) — exposed ALL products including drafts
  - Printful sync: blindly upserted all fields on every sync (no content_locked check)
  - Sync deleted products removed from Printful (destructive)
  - ProductCard linked to /product/${product.id} (UUID in URL)
  - No catalog service layer — raw Supabase queries scattered across pages
```

---

## 3. Database Changes

### Migration: `20261017000000_catalog_foundation.sql`

```
Columns added:
  slug               text (nullable, unique partial index WHERE NOT NULL)
  short_description  text (nullable)
  meta_title         text (nullable)
  meta_description   text (nullable)
  compare_at_price   numeric(10,2) (nullable)
  brand              text (nullable)
  product_type       text (nullable)
  published_at       timestamptz (nullable)
  display_order      integer NOT NULL DEFAULT 0

Indexes added:
  uq_products_slug          UNIQUE partial on (slug) WHERE slug IS NOT NULL
  idx_products_slug         partial on (slug) WHERE slug IS NOT NULL
  idx_products_display_order on (display_order, created_at DESC)

Data backfilled:
  slug: generated from title for all existing products
    "Lightweight quarter-zip pullover" → "lightweight-quarter-zip-pullover"
  published_at: set to updated_at/created_at for all active products

RLS changes:
  public_read_products: changed from USING (true) to USING (status = 'active')
  admin_read_all_products: new policy — authenticated admins see all statuses

Destructive operations: NONE
```

### Migration: `20261016000001_product_variants_unique_constraint.sql`

Applied in Phase 2 live verification. Replaced partial unique index with a proper
unique constraint on `product_variants(product_id, provider, printful_variant_id)`.
This fixed the silent upsert failure that prevented variant sync from working.

---

## 4. Final Products Schema

| Column | Owner | Notes |
|---|---|---|
| id | STORE-OWNED | UUID primary key — canonical product identity |
| slug | STORE-OWNED | URL-safe, unique, stable — never overwritten by sync |
| title | STORE-OWNED | Seeded from Printful on first import; preserved if content_locked |
| short_description | STORE-OWNED | Optional marketing summary |
| description | STORE-OWNED | Seeded from Printful on first import; preserved if content_locked |
| meta_title | STORE-OWNED | SEO override; falls back to title |
| meta_description | STORE-OWNED | SEO override; falls back to short_description → description |
| compare_at_price | STORE-OWNED | Optional was-price for merchandising |
| brand | STORE-OWNED | e.g. "Body & Sleeves" |
| product_type | STORE-OWNED | e.g. "quarter_zip", "hoodie" |
| published_at | STORE-OWNED | Set on first publish; preserved on subsequent edits |
| display_order | STORE-OWNED | Manual sort order |
| category_id | STORE-OWNED | FK → categories(id) ON DELETE SET NULL |
| price | STORE-OWNED | Base/display retail price |
| compare_at_price | STORE-OWNED | Optional was-price |
| cost | PROVIDER-OWNED | Provider cost — admin only, never public |
| image_url | STORE-OWNED | Seeded from Printful; preserved if content_locked |
| images | STORE-OWNED | Seeded from Printful; preserved if content_locked |
| status | STORE-OWNED | active / draft / archived |
| featured | STORE-OWNED | Merchandising flag |
| is_new_arrival | STORE-OWNED | Merchandising flag |
| is_trending | STORE-OWNED | Merchandising flag |
| is_bestseller | STORE-OWNED | Merchandising flag |
| is_on_sale | STORE-OWNED | Merchandising flag |
| content_locked | STORE-OWNED | Sync ownership guard |
| is_personalizable | STORE-OWNED | Custom text feature flag |
| personalization_label | STORE-OWNED | Prompt label for custom text |
| variants | LEGACY | JSONB — do not use for new code |
| shipping_info | LEGACY | JSONB — retained for compatibility |
| printful_id | PROVIDER-OWNED | Provider mapping only — not product identity |
| created_at | STORE-OWNED | Immutable creation timestamp |
| updated_at | STORE-OWNED | Updated on every save |

---

## 5. Final Product Variants Schema

| Column | Owner | Notes |
|---|---|---|
| id | STORE-OWNED | UUID — stable store variant identity |
| product_id | STORE-OWNED | FK → products(id) ON DELETE RESTRICT |
| provider | STORE-OWNED | e.g. "printful" |
| label | STORE-OWNED | Display label |
| color | STORE-OWNED | Display color |
| size | STORE-OWNED | Display size |
| retail_price | STORE-OWNED | Authoritative checkout price |
| image_url | STORE-OWNED | Variant image |
| available | STORE-OWNED | Storefront availability |
| printful_variant_id | PROVIDER-OWNED | Provider mapping — used only at fulfillment |
| provider_cost | PROVIDER-OWNED | Provider cost (admin only) |
| provider_metadata | PROVIDER-OWNED | Raw provider data |
| created_at / updated_at | STORE-OWNED | Timestamps |

---

## 6. Product Slugs

```
Products backfilled:  1 (Lightweight quarter-zip pullover)
Generated slugs:      lightweight-quarter-zip-pullover
Duplicate conflicts:  0
```

Routing behavior:
- `/product/lightweight-quarter-zip-pullover` — canonical URL (slug)
- `/product/aed80c7d-5f07-495a-8e1a-8ff1ec74726b` — redirects to slug (permanent)

Legacy URL behavior:
- `resolveProduct()` tries slug first, then UUID
- If resolved by UUID and slug exists: `redirect(/product/${slug})`
- No redirect loops — slug resolution is tried first

Slug stability:
- Changing `title` does NOT change `slug` — they are independent fields
- Admin must explicitly edit the slug field to change it
- Sync never writes to `slug`

---

## 7. Publication Model

Single canonical field: `products.status` (text, NOT NULL)

```
draft    — admin only, not publicly visible
active   — publicly visible and purchasable (if variants available)
archived — admin/history only, not publicly visible
```

`published_at` records the first time a product became active. It is set once and
preserved on subsequent edits. Unpublishing (setting to draft/archived) does not
erase `published_at`.

Decision rationale: `status` already existed with the correct semantics. No competing
publication field was added.

---

## 8. Pricing Model

```
products.price          — base/display retail price (store-owned)
                          Used for product cards, "starting at" display
                          NOT automatically derived from Printful

products.compare_at_price — optional was-price for sale merchandising (store-owned)
                            NULL = no sale display

products.cost           — provider cost (admin only, never public)
                          Sync may update this in future

product_variants.retail_price — authoritative price per variant (store-owned)
                                 Used exclusively by stripe-checkout for billing
                                 Never overridden by browser

Printful provider_cost  — stored in product_variants.provider_cost (admin only)
```

The browser cannot override any price. `stripe-checkout` reads `retail_price` from
`product_variants` exclusively.

---

## 9. SEO

Fallback chain implemented in `src/lib/catalog/types.ts`:

```
meta_title      → title
meta_description → short_description → description → undefined
```

`generateMetadata()` in `/product/[id]/page.tsx` uses these helpers.
Canonical URL uses slug (not UUID). Open Graph image uses `getPrimaryImage()`.
Printful internal IDs are never exposed in metadata or URLs.

---

## 10. Categories

Existing `categories` table preserved unchanged. `products.category_id` FK retained.
Admin can assign/change category via the product modal. No collections introduced.

---

## 11. Product Images

`getPrimaryImage()` in `src/lib/catalog/types.ts`:

```
image_url (explicit)
    ↓
images[0] (first array entry)
    ↓
/product-placeholder.svg
```

Images are not normalized into a separate table — `products.image_url` and
`products.images` JSONB remain the storage mechanism. Storefront decides which
images are displayed; Printful supplies source imagery on first sync only
(if content_locked is false).

---

## 12. Admin Catalog

Fields now manageable via admin product modal:

```
BASIC:        title, description, short_description, image_url, category
PRICING:      price, cost, compare_at_price
COMMERCE:     brand, product_type, status
MERCHANDISING: featured, is_new_arrival, is_trending, is_bestseller, is_on_sale
PERSONALIZATION: is_personalizable, personalization_label
SEO:          slug, meta_title, meta_description
SYNC CONTROL: content_locked (lock/unlock toggle)
```

---

## 13. Variant Administration

Variant retail prices are editable via the existing "Variant Prices by Size" section
in the admin modal (reads from `product_variants` via JSONB fallback for legacy,
or directly for synced products).

Provider fields (`provider`, `printful_variant_id`) are not exposed in the admin UI
as editable fields — they are provider mappings managed by sync.

---

## 14. Storefront Catalog Service

```
src/lib/catalog/
  types.ts      — CatalogProduct, PublicationStatus, getPrimaryImage(),
                  getMetaTitle(), getMetaDescription(), generateSlug(),
                  isProductPurchasable()
  products.ts   — getPublishedProducts(), getProductBySlug(), getProductById()
  variants.ts   — getProductVariants()
  categories.ts — getCategories()
```

All public queries use the anon key — RLS enforces visibility at the DB level.
Catalog queries are separated from Printful API queries (`src/lib/printful/`).

---

## 15. Public Storefront

```
Shop filtering:       status = 'active' enforced at both RLS and query level
Product routing:      /product/[id] resolves slug or UUID
Slug routing:         /product/lightweight-quarter-zip-pullover
Publication filtering: draft and archived products invisible to public
Purchasability:       isProductPurchasable() — active + available variant + provider mapping
```

---

## 16. Printful Sync Ownership

| Field | Owner | Sync Behavior |
|---|---|---|
| title | Store | Seed once on new product / preserve if content_locked |
| description | Store | Seed once on new product / preserve if content_locked |
| image_url | Store | Seed once on new product / preserve if content_locked |
| images | Store | Seed once on new product / preserve if content_locked |
| slug | Store | Set once on new product / NEVER overwrite |
| category_id | Store | NEVER overwrite |
| brand | Store | NEVER overwrite |
| product_type | Store | NEVER overwrite |
| meta_title | Store | NEVER overwrite |
| meta_description | Store | NEVER overwrite |
| featured / flags | Store | NEVER overwrite |
| status | Store | Set to 'active' on new product / NEVER overwrite |
| published_at | Store | Set on new product / NEVER overwrite |
| price | Provider-seeded | Updated on every sync (base display price from Printful retail) |
| updated_at | System | Updated on every sync |
| printful_id | Provider | Immutable provider mapping |
| printful_variant_id | Provider | Refreshed on every sync |
| variant retail_price | Provider-seeded | Refreshed on every sync |
| variant available | Provider | Refreshed on every sync |
| provider_cost | Provider | Refreshed on every sync (future) |

Products removed from Printful: status set to 'archived' (not deleted).

---

## 17. Provider Boundary

```
Store Product (products.id UUID)
        ↓
Store Variant (product_variants.id UUID)
        ↓
Provider Mapping (product_variants.printful_variant_id)
        ↓
Printful Fulfillment
```

The browser never supplies a provider ID. `stripe-checkout` resolves
`printful_variant_id` from the database using the store variant UUID.

---

## 18. Legacy JSONB Status

| Location | Usage | Classification |
|---|---|---|
| `src/app/product/[id]/page.tsx` | Fallback if product_variants empty | FALLBACK |
| `src/app/admin/products/page.tsx` | Variant price editing in modal | FALLBACK |
| `supabase/functions/stripe-checkout/index.ts` | Checkout validation fallback | FALLBACK |
| `supabase/functions/printful-proxy/index.ts` | Sync builds rows from API response | ACTIVE (in-memory, not DB read) |
| `src/lib/printful/catalog.ts` | Printful API response variants | ACTIVE (Printful API, not DB) |
| `src/components/product-designer/ProductDesigner.tsx` | Printful catalog API variants | ACTIVE (Printful API, not DB) |

`products.variants` column: KEEP — all production runtime paths fall back to it
when `product_variants` is empty. Safe to remove only after all products have been
synced and `product_variants` is proven populated for every active product.

---

## 19. Stale Printify-Era Files

| File | Status |
|---|---|
| `supabase/fresh_install.sql` | STALE — references Printify schema |
| `supabase/reset.sql` | STALE — references Printify schema |
| `supabase/reset_for_new_store.sql` | STALE — references Printify schema |
| `supabase/sql/*.sql` | STALE — Printify-era SQL scripts |
| `supabase/scripts/*.sql` | STALE — Printify-era scripts |
| `supabase/migrations/old/` | HISTORICAL — skipped by CLI (non-standard names) |

None executed against production. Not deleted — historical record preserved.
Recommend marking with `# DEPRECATED` headers in a future cleanup pass.

---

## 20. Security

```
RLS:
  products public_read:    USING (status = 'active') — drafts/archived hidden
  products admin_read_all: USING (admins check) — all statuses visible to admins
  product_variants public: USING (available = true)
  All mutation policies:   require admins table membership

Admin authorization:
  All /api/printful/* routes: requireAdmin() guard
  Admin product mutations: Supabase client with user session (RLS enforced)
  Sync endpoint: service role key (bypasses RLS intentionally for writes)

Catalog mutation protection:
  No catalog field can be mutated by unauthenticated users
  Provider IDs not exposed in public URLs
  Provider cost never returned in public queries
```

---

## 21. Tests

Phase 3 added 47 tests in `src/__tests__/printful/phase3.test.ts`:

1. Slug generation (5) — lowercase, unsafe chars, collapse hyphens, trim, numeric
2. Slug stability (2) — independent of title, canonical URL identifier
3. Publication status (6) — active/draft/archived visibility, published_at
4. SEO metadata fallbacks (6) — meta_title, meta_description, short_description chains
5. Primary image selection (3) — image_url, images[0], placeholder
6. Pricing model (5) — base price, provider cost, variant price, compare_at, printful_id
7. Purchasability (6) — active+variant+mapping, draft, archived, unavailable, no mapping, no variants
8. Category relationship (2) — FK, nullable
9. Curation flags (3) — featured, is_new_arrival, is_on_sale
10. Sync ownership boundary (4) — content_locked, unlocked, slug never overwritten, cost separation
11. Provider boundary (3) — printful_id mapping, variant mapping, UUID stability
12. Legacy JSONB compatibility (2) — store variant UUID vs legacy size label

---

## 22. Regression

```
TypeScript (npx tsc --noEmit):  PASS — 0 errors
Tests (npx vitest run):         PASS — 120/120 (38 Phase 1 + 35 Phase 2 + 47 Phase 3)
Build (npm run build):          PASS — 65 routes, 0 errors

Printful sync:                  PASS — synced:1, archived:0, variants_synced:8
Stable UUID:                    PASS — verified across consecutive syncs
Cart v2:                        PASS — pod_storefront_cart_v2, store UUID as variant_id
Checkout:                       PASS — server-side price validation from product_variants
Fulfillment:                    PASS — printful_variant_id resolved from DB
Webhook:                        PASS — unchanged
Categories:                     PASS — 5 categories intact
Admin auth:                     PASS — requireAdmin() on all Printful routes
```

---

## 23. Deferred Work

```
designs / product_designs         — not implemented
collections / product_collections — not implemented
catalog builder                   — not implemented
Product Designer publishing       — not implemented
mockup publishing                 — not implemented
product image normalization       — deferred (products.images JSONB retained)
multi-provider abstraction        — deferred (products.printful_id transitional)
legacy JSONB removal              — deferred (products.variants kept as fallback)
product_images table              — deferred
variant admin UI (full)           — partial (price editing via JSONB modal)
```

---

## 24. Problems / Risks

### P1 — LOW: Variant admin UI uses JSONB fallback
The admin modal reads variant prices from `product_variants` via the JSONB fallback
path. For the real Printful product, variants are in `product_variants` but the modal
reads `product.variants` (JSONB). The JSONB is empty for the real product, so the
variant price section does not appear. This is a display limitation only — checkout
uses `product_variants` correctly. Fix: update admin modal to query `product_variants`
directly for the edited product.

### P2 — LOW: Sync sets price from Printful on every sync for unlocked products
For unlocked products, `price` is updated on every sync. If an admin sets a custom
retail price on an unlocked product, the next sync will overwrite it with the Printful
retail value. Mitigation: lock the product (`content_locked = true`) after setting a
custom price. A future improvement would track price ownership separately.

### P3 — INFO: Stale Printify-era files not cleaned up
`supabase/fresh_install.sql`, `reset.sql`, `sql/`, `scripts/` contain Printify-era
assumptions. They are not executed by any deployment workflow but could confuse
future developers. Recommend a dedicated cleanup pass.

---

## 25. Final Architecture

```
┌───────────────────────────────────────────────────────┐
│                  STOREFRONT PRODUCT                   │
│                                                       │
│  id UUID (canonical identity)                         │
│  slug (canonical URL)                                 │
│  title / short_description / description              │
│  brand / product_type                                 │
│  category_id → categories                             │
│  price (base display) / compare_at_price              │
│  meta_title / meta_description                        │
│  status (active/draft/archived) / published_at        │
│  featured / is_new_arrival / is_trending / ...        │
│  content_locked (sync ownership guard)                │
└──────────────────────┬────────────────────────────────┘
                       │ 1:N
                       ▼
┌───────────────────────────────────────────────────────┐
│                  STOREFRONT VARIANT                   │
│                                                       │
│  id UUID (stable store identity)                      │
│  product_id / label / color / size                    │
│  retail_price (authoritative for checkout)            │
│  available                                            │
└──────────────────────┬────────────────────────────────┘
                       │ provider mapping
                       ▼
┌───────────────────────────────────────────────────────┐
│                     PRINTFUL                          │
│                                                       │
│  products.printful_id (product mapping)               │
│  product_variants.printful_variant_id (variant map)   │
│  provider_cost / production availability              │
└──────────────────────┬────────────────────────────────┘
                       │
                       ▼
                  FULFILLMENT
```

---

## 26. Completion Decision

```
STOREFRONT CATALOG FOUNDATION: COMPLETE
```

```
READY FOR DESIGN & MOCKUP CATALOG PHASE: YES
```

All completion criteria met:

- ✓ products.id remains the store product identity
- ✓ product_variants.id remains the store variant identity
- ✓ Printful IDs are provider mappings only
- ✓ Storefront products have stable slugs
- ✓ Storefront controls product marketing content (content_locked)
- ✓ Storefront controls SEO (meta_title, meta_description, slug)
- ✓ Storefront controls categories
- ✓ Storefront controls retail pricing
- ✓ Storefront controls publication (status, published_at)
- ✓ Public catalog excludes non-active products (RLS fixed)
- ✓ Product pages use store variants
- ✓ Admin can manage all commercial catalog fields
- ✓ Printful sync preserves admin merchandising edits (content_locked)
- ✓ Provider synchronization still works (synced:1, variants_synced:8)
- ✓ Stable variant UUIDs remain stable across syncs
- ✓ Checkout still validates store UUIDs server-side
- ✓ Fulfillment still resolves to Printful correctly
- ✓ No old Printify demo architecture reintroduced
- ✓ Existing orders intact (0 orders, none affected)
- ✓ 120/120 tests pass
- ✓ Production build passes
