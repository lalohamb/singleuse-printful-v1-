# Mockup Generator V2 Migration Guide

## Current state

The integration uses the stable Printful Mockup Generator v1 API:

| Endpoint | Purpose |
|---|---|
| `GET /mockup-generator/printfiles/{productId}` | Print files + placements |
| `GET /mockup-generator/templates/{productId}` | Layout templates |
| `POST /mockup-generator/create-task/{productId}` | Create async task |
| `GET /mockup-generator/task?task_key=` | Poll task status |

All Printful-specific logic is isolated in `src/lib/printful/`.
The `ProductDesigner` UI never calls Printful directly.

---

## What changes in V2

Printful Mockup Generator v2 introduces:

- A different task creation endpoint and request schema
- Potentially synchronous or webhook-based result delivery
- Different response shapes for mockup results

---

## Files to change for V2

Only these two files need to change. Nothing else.

### `src/lib/printful/mockups.ts`

Replace `createMockupTask` and `getMockupTask` with v2 equivalents.
The function signatures should stay identical so callers are unaffected:

```ts
// Keep the same exported function names and parameter types.
// Only the internal fetch paths and request/response mapping change.

export async function createMockupTask(
  productId: number,
  request: PrintfulMockupTaskRequest
): Promise<PrintfulMockupTask>

export async function getMockupTask(taskKey: string): Promise<PrintfulMockupTask>
```

### `src/lib/printful/templates.ts`

If v2 uses a different templates endpoint, update `getLayoutTemplates`.
`getPrintfiles` may remain unchanged if the printfiles endpoint is stable.

---

## Files that do NOT change

| File | Reason |
|---|---|
| `src/lib/printful/client.ts` | Generic fetch wrapper — endpoint-agnostic |
| `src/lib/printful/errors.ts` | Error class — unchanged |
| `src/lib/printful/types.ts` | Add v2 types alongside v1; keep v1 types until cutover |
| `src/lib/printful/catalog.ts` | Catalog API is separate from mockup generator |
| `src/lib/printful/persist.ts` | Downloads from any URL — unaffected by v2 |
| All API routes under `src/app/api/printful/` | Thin wrappers — unaffected |
| All components under `src/components/product-designer/` | Never call Printful directly |

---

## Migration steps

1. Add v2 types to `src/lib/printful/types.ts` (prefix with `V2` to avoid collision).
2. Update `mockups.ts` to use v2 endpoints behind the same exported functions.
3. Update `templates.ts` if the v2 template endpoint differs.
4. Run `npm run test` — all 38 existing tests should still pass (update mocks for new shapes).
5. Run `npm run build` — no component changes required.
6. Remove v1 types from `types.ts` after cutover is confirmed.
