# Product Creation Engine

## Overview

The Product Creation Engine is the deterministic service layer between UI/recipes and the database/provider APIs. It ensures that all catalog_builder product creation goes through a validated, normalized pipeline regardless of the source.

```
Catalog Builder UI  ──┐
Product Recipe      ──┤──► ProductSpecification ──► validate ──► create/update
Batch Generator     ──┘
```

**File:** `src/lib/catalog/product-engine.ts`

---

## ProductSpecification

The canonical input type for creating or updating a catalog_builder product.

```typescript
interface ProductSpecification {
  printful_catalog_id: number;      // Printful catalog product ID — validated
  variants: ProductSpecVariant[];   // Must all belong to printful_catalog_id
  design_id: string;                // Must be active design
  placement: string;                // e.g. "front_dtf"
  technique: string;                // e.g. "DTFILM"
  printfile_id: string | null;
  design_configuration: Record<string, unknown>;
  title: string;
  slug: string;                     // lowercase alphanumeric + hyphens
  description: string | null;
  short_description: string | null;
  brand: string | null;
  product_type: string | null;
  category_id: string | null;
  meta_title: string | null;
  meta_description: string | null;
  price: number;                    // base retail price > 0
  mockups: ProductSpecMockup[];
  publication_mode: "draft" | "active";
  idempotency_key: string;
}
```

Does NOT include: Stripe fields, order fields, `fulfillment_snapshot`, `printful_id` (sync product).

---

## Validation

```typescript
const result = validateProductSpecification(spec);
// result.valid: boolean
// result.errors: SpecValidationError[]
```

Rejects:
- `printful_catalog_id` ≤ 0
- Empty variants array
- Variant with missing `printful_variant_id` or `retail_price ≤ 0`
- Missing `design_id`, `placement`, `technique`, `title`
- Invalid slug (must match `/^[a-z0-9-]+$/`)
- `price ≤ 0`
- Missing `idempotency_key`

---

## Dry-Run

```typescript
const result = dryRunProductSpecification(spec);
// result.valid: boolean
// result.errors: SpecValidationError[]
// result.resolved: { variant_count, price_range, expected_db_operations, ... } | null
```

Pure function — no database mutations, no Printful calls, no Stripe activity.

Also available as an API endpoint:

```
POST /api/catalog-builder/dry-run
Authorization: Bearer <admin-token>
Content-Type: application/json

{ ...ProductSpecification }
```

The API additionally validates against the database (design exists/active, slug unique, category exists).

---

## Edit Mode

To initialize a ProductSpecification from an existing product:

```typescript
const spec = existingProductToSpec(existingProductState, idempotencyKey);
```

Returns `null` if the product has no `printful_catalog_id` or no primary design.

---

## Provider Validation Boundary

Provider IDs must always be validated against Printful data — never passed through raw from AI or recipe systems.

```
AI / Recipe
      ↓
validated ProductSpecification
      ↓
Product Creation Engine
      ↓
/api/catalog-builder (create) or /api/catalog-builder/update (edit)
      ↓
database + Printful APIs
```

The engine validates that:
- `printful_catalog_id` is a positive integer
- All `printful_variant_id` values are present and non-empty
- The design exists and is active

Future recipe systems must not bypass this validation layer.

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/catalog-builder` | POST | Create new catalog_builder product |
| `/api/catalog-builder/update` | POST | Update existing catalog_builder product |
| `/api/catalog-builder/load` | GET | Load existing product state for edit mode |
| `/api/catalog-builder/publish` | POST | Publish draft product |
| `/api/catalog-builder/dry-run` | POST | Validate spec + return plan (no mutations) |

---

## Idempotency

Both create and update routes accept `idempotency_key`. The create route uses slug uniqueness as the idempotency anchor — a second call with the same slug returns the existing product without error.

---

## Optimistic Concurrency

The update route accepts `updated_at_check`. If the product's `updated_at` differs from the provided value, the route returns `409 { conflict: true }` to prevent stale overwrites.

---

## Future Integration (Phase 8C+)

A Product Recipe will provide a `ProductSpecification` to the engine. The engine validates it, resolves provider mappings, and calls the create/update routes. The recipe system never directly constructs provider IDs or calls Printful APIs.
