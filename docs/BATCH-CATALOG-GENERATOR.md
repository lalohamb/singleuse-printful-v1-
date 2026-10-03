# Batch Catalog Generator

Phase 9 of the CountyBuys product creation system. Orchestrates mass product creation through the existing deterministic pipeline without bypassing any safety gates.

## Architecture

```
Selected Designs × Selected Recipes
        ↓
Compatibility Filter
        ↓
resolveProductRecipe() per cell
        ↓
validateProductSpecification() per cell
        ↓
dryRunProductSpecification() per cell
        ↓
Classify: PASS | WARNING | FAIL
        ↓
Operator Preview + Approval Gate
        ↓
Product Creation Engine (per approved item)
        ↓
Draft Products → Mockup Processing → Review → Bulk Publish
```

The batch layer **orchestrates** the existing system. It does not replace it.

---

## Batch Statuses

| Status | Meaning |
|---|---|
| `draft` | Batch created, no items yet |
| `planning` | Items resolved, some FAIL |
| `validated` | All items PASS or WARNING |
| `ready` | Approved — ready for generation |
| `generating` | Generation in progress |
| `processing` | Products created, mockups processing |
| `review` | Ready for operator review |
| `completed` | All products published |
| `failed` | Generation failed with no successes |
| `cancelled` | Remaining items cancelled |

---

## Batch Item Statuses

`pending` → `resolving` → `resolved` → `validated` → `approved` → `generating` → `generated` → `mockup_queued` → `mockup_processing` → `mockup_complete` → `review` → `published`

Error states: `fail`, `stale_recipe`, `stale_design`, `needs_mockup_retry`, `cancelled`

---

## Batch Items

Each batch item represents one intended product:

- `design_id` — the design to use
- `recipe_id` — the recipe to apply
- `recipe_version` — frozen at planning time (recipe `updated_at`)
- `design_file_hash` — frozen at planning time
- `resolved_specification` — frozen `ProductSpecification` at approval
- `validation_class` — `PASS`, `WARNING`, or `FAIL`
- `generated_product_id` — set when product is created (idempotency anchor)
- `idempotency_key` — `batch:{batchId}:item:{itemId}`

---

## Matrix Generation

```
designs: [D1, D2]  ×  recipes: [R1, R2]
= 4 candidate products: D1×R1, D1×R2, D2×R1, D2×R2
```

Each cell is evaluated for compatibility before resolution.

---

## Compatibility Layer

Separate from provider mappings. Evaluates:

- Archived design → `PROHIBITED`
- Draft/archived recipe → `PROHIBITED`
- Small artwork for DTG/DTFILM → `WARNING`
- Extreme aspect ratio for EMBROIDERY → `WARNING`
- Active design + active recipe → `ALLOWED`

Decisions: `ALLOWED`, `WARNING`, `PROHIBITED`

`PROHIBITED` cells are excluded from generation. `WARNING` cells require operator acknowledgment at approval.

---

## Resolution

For each included cell:

```
Recipe + Design + CommercialInputs
    ↓
resolveProductRecipe()
    ↓
ProductSpecification (publication_mode always = "draft")
    ↓
validateProductSpecification()
    ↓
dryRunProductSpecification()
```

Results are persisted to `catalog_batch_items.resolved_specification`.

---

## Validation Classification

| Class | Meaning | Approvable |
|---|---|---|
| `PASS` | Fully valid | Yes |
| `WARNING` | Valid with caveats | Yes (with acknowledgment) |
| `FAIL` | Invalid — blocked | No |

FAIL causes: invalid artwork, no variants, invalid price, invalid placement, invalid technique, slug collision, archived recipe, prohibited compatibility.

---

## Approval Gate

- FAIL items are hard-blocked — cannot be approved
- WARNING items require `acknowledged_warnings: true`
- Server re-validates frozen specs at approval time
- Server checks for stale recipe/design at approval time
- `approved_at` timestamp persisted on batch

---

## Frozen ProductSpecification

At approval time the `resolved_specification` is frozen in the DB. Generation reads from this frozen spec — never re-resolves from the recipe dynamically.

If the recipe changes after approval, the item is marked `stale_recipe`. If the design's file_hash changes, the item is marked `stale_design`. Both require re-resolve → re-approve before generation.

---

## Generation

- Always creates `DRAFT` products — even if recipe `publication_default` is `active`
- `catalog_source = catalog_builder`
- `printful_id = NULL` — never a sync product
- `recipe_id` and `recipe_version` stored on product
- `batch_id` stored on product for traceability
- Sequential processing (bounded concurrency)

---

## Idempotency

- Every batch item has a stable `idempotency_key`: `batch:{batchId}:item:{itemId}`
- Generation checks `generated_product_id` before creating — skips if already set
- Slug uniqueness check prevents duplicate products
- Replaying generation produces 0 additional products

---

## Partial Failure

- One item failing does not stop other items
- Failed items are marked `fail` with `error_message`
- Successful items are unaffected
- `Retry Failed` re-attempts only failed items
- Already-generated products are never recreated

---

## Mockup Processing

Mockup generation is a separate state from product creation:

```
PRODUCT CREATED (draft)
    ↓
MOCKUPS QUEUED
    ↓
MOCKUPS PROCESSING
    ↓
MOCKUPS PERSISTED (Supabase Storage)
    ↓
READY FOR REVIEW
```

Mockup failure marks item `needs_mockup_retry` — does NOT delete the product. Temporary Printful URLs are never treated as final assets.

---

## Pause / Cancel

- `Cancel Remaining` stops pending/approved items from generating
- Already-generated products are NOT deleted
- Cancellation only affects items in: `pending`, `resolving`, `resolved`, `validated`, `approved`

---

## Review Queue

After generation, products enter `review` status. Operator can:

- Inspect product, artwork, mockups, variants, pricing, SEO
- Set category / collection
- Adjust price
- Archive selected
- Approve for publication

---

## Bulk Actions

Safe bulk operations on review queue:

- Select all PASS items
- Set category
- Assign collection
- Adjust price
- Archive selected

No destructive mass delete.

---

## Bulk Publication

Publication reuses existing publication gates:

- `price > 0`
- `printful_catalog_id` present
- Primary design exists
- Active variants exist

Blocked products remain draft. Only publishable products are published. Requires explicit operator confirmation.

---

## Recipe / Design Stale Detection

At approval time the server checks:

- `recipe_version` (stored `updated_at`) vs current recipe `updated_at`
- `design_file_hash` vs current design `file_hash`

If either changed: item is marked stale and blocked from generation. Operator must re-resolve → re-approve.

---

## Safety Boundaries

- No Stripe Checkout Sessions created
- No Stripe charges
- No Printful fulfillment orders submitted
- No manufacturing confirmed
- `PRINTFUL_AUTO_CONFIRM` must remain absent/false
- Mockup API use is allowed
- Catalog API use is allowed
- All routes are admin-only
- Client-submitted specs are never trusted at generation — server reads frozen DB spec

---

## Database Tables

### `catalog_batches`
`id`, `name`, `status`, `created_by`, `created_at`, `updated_at`, `approved_at`, `generation_started_at`, `generation_completed_at`, `metadata`

### `catalog_batch_items`
`id`, `batch_id`, `design_id`, `recipe_id`, `recipe_version`, `design_file_hash`, `design_artwork_url`, `status`, `validation_class`, `commercial_inputs`, `resolved_specification`, `validation_result`, `dry_run_result`, `generated_product_id`, `idempotency_key`, `error_message`, `created_at`, `updated_at`

### `products` additions
`batch_id` — references `catalog_batches(id)`, nullable

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/batches` | GET | List batches |
| `/api/batches` | POST | Create batch |
| `/api/batches/[id]` | GET | Batch detail + items |
| `/api/batches/[id]` | PATCH | Update name/metadata |
| `/api/batches/[id]/items` | POST | Generate matrix + resolve |
| `/api/batches/[id]/items` | GET | List items |
| `/api/batches/[id]/approve` | POST | Approve batch |
| `/api/batches/[id]/generate` | POST | Generate draft products |
| `/api/batches/[id]/cancel` | POST | Cancel remaining |
| `/api/batches/[id]/publish` | POST | Bulk publish |

All routes require admin authentication.
