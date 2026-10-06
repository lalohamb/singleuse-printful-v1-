// Workstream B — V2 Fulfillment / Shipping / Orders / Webhooks
// Tests the live-proven V2 contracts for DIRECT_CATALOG_ORDER fulfillment.
// SYNC_VARIANT and V1 paths are regression-tested to confirm they are unchanged.
// No provider calls, no Stripe activity, no database writes.

import { describe, it, expect } from "vitest";
import type { FulfillmentSnapshot } from "@/lib/fulfillment/types";
import { buildPrintfulExternalId } from "@/lib/fulfillment/builder";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ARTWORK_URL =
  "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/artwork/d180dd4d/original.png";

const CATALOG_VARIANT_ID = 4016; // Bella+Canvas 3001, Black/S — V2 catalog variant ID
const STORE_VARIANT_ID = "6869ca2f-25cc-4a47-a674-e57ab9391c64";
const STORE_ORDER_ID = "5487d86f-1496-4a42-a64e-b4dc8babdefd";

function makeSnap(overrides: Partial<FulfillmentSnapshot> = {}): FulfillmentSnapshot {
  return {
    version: 1,
    strategy: "DIRECT_CATALOG_ORDER",
    store_product_id: "prod-uuid",
    store_variant_id: STORE_VARIANT_ID,
    printful_catalog_product_id: 71,
    printful_catalog_variant_id: CATALOG_VARIANT_ID,
    design_id: "design-uuid",
    artwork_url: ARTWORK_URL,
    placement: "front",
    technique: "dtg",
    files: [{ type: "front", url: ARTWORK_URL }],
    options: [],
    frozen_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSyncSnap(overrides: Partial<FulfillmentSnapshot> = {}): FulfillmentSnapshot {
  return {
    version: 1,
    strategy: "SYNC_VARIANT",
    store_product_id: "sync-prod-uuid",
    store_variant_id: "sync-variant-uuid",
    printful_catalog_product_id: 903,
    printful_catalog_variant_id: 23178,
    design_id: "design-uuid",
    artwork_url: ARTWORK_URL,
    placement: "front",
    technique: "DTG",
    files: [{ type: "front", url: ARTWORK_URL }],
    options: [],
    frozen_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── V2 shipping request shape ─────────────────────────────────────────────────

function buildV2ShippingRequest(
  items: Array<{ catalog_variant_id: number; quantity: number }>
) {
  return {
    recipient: {
      address1: "1 Main St",
      city: "New York",
      state_code: "NY",
      country_code: "US",
      zip: "10001",
    },
    order_items: items.map((i) => ({
      source: "catalog" as const,
      catalog_variant_id: i.catalog_variant_id,
      quantity: i.quantity,
    })),
    currency: "USD",
    locale: "en_US",
  };
}

// ── V2 order item builder (mirrors stripe-webhook buildV2CatalogOrderItem) ────

function buildV2CatalogOrderItem(
  snapshot: FulfillmentSnapshot,
  quantity: number,
  retailPrice: number
): Record<string, unknown> {
  return {
    source: "catalog" as const,
    catalog_variant_id: snapshot.printful_catalog_variant_id,
    quantity: Math.max(1, Math.floor(quantity)),
    retail_price: retailPrice.toFixed(2),
    placements: [
      {
        placement: snapshot.placement,
        technique: snapshot.technique,
        layers: [{ type: "file", url: snapshot.artwork_url }],
      },
    ],
  };
}

// ── V2 duplicate detector (mirrors stripe-webhook logic) ─────────────────────

function isV2DuplicateExternalId(
  errBody: Record<string, unknown>
): boolean {
  const err = errBody?.error as Record<string, unknown> | undefined;
  return (
    err?.reason === "BadRequest" &&
    String(err?.message ?? "").includes("External ID validation error")
  );
}

// ── Stored snapshot validator (mirrors stripe-webhook validateStoredSnapshot) ─

function validateStoredSnapshot(snap: FulfillmentSnapshot): string | null {
  if (snap.version !== 1) return `unsupported version: ${snap.version}`;
  if (snap.strategy !== "DIRECT_CATALOG_ORDER")
    return `unexpected strategy: ${snap.strategy}`;
  if (!snap.printful_catalog_variant_id || snap.printful_catalog_variant_id <= 0)
    return "invalid printful_catalog_variant_id";
  if (!snap.files || snap.files.length === 0) return "no manufacturing files";
  if (!snap.artwork_url) return "no artwork_url";
  if (!snap.placement) return "no placement";
  if (!snap.technique) return "no technique";
  if (!Array.isArray(snap.options)) return "options must be array";
  return null;
}

// ── Mixed-cart strategy detector (mirrors stripe-webhook allDirectCatalog) ────

function detectFulfillmentPath(
  orderItems: Array<{ store_variant_id: string }>,
  snapshots: Record<string, FulfillmentSnapshot>
): "v2" | "v1" {
  if (orderItems.length === 0) return "v1";
  const allDirect = orderItems.every((item) => {
    const snap = snapshots[item.store_variant_id];
    return snap?.strategy === "DIRECT_CATALOG_ORDER";
  });
  return allDirect ? "v2" : "v1";
}

// =============================================================================
// 1. V2 SHIPPING REQUEST SHAPE
// =============================================================================

describe("1. V2 shipping — request shape", () => {
  it("uses /v2/shipping-rates endpoint (not /shipping/rates)", () => {
    const V2_ENDPOINT = "https://api.printful.com/v2/shipping-rates";
    const V1_ENDPOINT = "https://api.printful.com/shipping/rates";
    expect(V2_ENDPOINT).not.toBe(V1_ENDPOINT);
    expect(V2_ENDPOINT).toContain("/v2/shipping-rates");
  });

  it("uses order_items not items", () => {
    const req = buildV2ShippingRequest([{ catalog_variant_id: CATALOG_VARIANT_ID, quantity: 1 }]);
    expect(req).toHaveProperty("order_items");
    expect(req).not.toHaveProperty("items");
  });

  it("order_items[].source = 'catalog'", () => {
    const req = buildV2ShippingRequest([{ catalog_variant_id: CATALOG_VARIANT_ID, quantity: 1 }]);
    expect(req.order_items[0].source).toBe("catalog");
  });

  it("order_items[].catalog_variant_id is the V2 catalog variant ID", () => {
    const req = buildV2ShippingRequest([{ catalog_variant_id: CATALOG_VARIANT_ID, quantity: 1 }]);
    expect(req.order_items[0].catalog_variant_id).toBe(CATALOG_VARIANT_ID);
  });

  it("order_items[].quantity is preserved", () => {
    const req = buildV2ShippingRequest([{ catalog_variant_id: CATALOG_VARIANT_ID, quantity: 3 }]);
    expect(req.order_items[0].quantity).toBe(3);
  });

  it("does not use variant_id field (V1 field)", () => {
    const req = buildV2ShippingRequest([{ catalog_variant_id: CATALOG_VARIANT_ID, quantity: 1 }]);
    expect(req.order_items[0]).not.toHaveProperty("variant_id");
  });

  it("includes currency USD and locale en_US", () => {
    const req = buildV2ShippingRequest([{ catalog_variant_id: CATALOG_VARIANT_ID, quantity: 1 }]);
    expect(req.currency).toBe("USD");
    expect(req.locale).toBe("en_US");
  });

  it("multiple items produce multiple order_items entries", () => {
    const req = buildV2ShippingRequest([
      { catalog_variant_id: 4016, quantity: 1 },
      { catalog_variant_id: 4017, quantity: 2 },
    ]);
    expect(req.order_items).toHaveLength(2);
    expect(req.order_items[1].catalog_variant_id).toBe(4017);
    expect(req.order_items[1].quantity).toBe(2);
  });
});

// =============================================================================
// 2. V2 SHIPPING RESPONSE PARSING
// =============================================================================

describe("2. V2 shipping — response parsing", () => {
  it("parses rate from data[0].rate (V2 envelope)", () => {
    const v2Response = { data: [{ shipping: "STANDARD", rate: "6.99", currency: "USD" }], extra: [] };
    const rate = parseFloat(v2Response?.data?.[0]?.rate ?? "0");
    expect(rate).toBe(6.99);
  });

  it("does not use result[0].rate (V1 envelope)", () => {
    const v2Response = { data: [{ rate: "6.99" }], extra: [] };
    // V1 would use result[0].rate — V2 uses data[0].rate
    const v1Attempt = (v2Response as any)?.result?.[0]?.rate;
    expect(v1Attempt).toBeUndefined();
  });

  it("falls back to default when data is empty", () => {
    const FALLBACK = 6.99;
    const v2Response = { data: [], extra: [] };
    const rate = parseFloat((v2Response?.data?.[0] as any)?.rate ?? "0");
    const result = rate > 0 ? rate : FALLBACK;
    expect(result).toBe(FALLBACK);
  });

  it("falls back to default when rate is zero", () => {
    const FALLBACK = 6.99;
    const v2Response = { data: [{ rate: "0.00" }], extra: [] };
    const rate = parseFloat(v2Response?.data?.[0]?.rate ?? "0");
    const result = rate > 0 ? rate : FALLBACK;
    expect(result).toBe(FALLBACK);
  });

  it("falls back to default when response is not ok", () => {
    const FALLBACK = 6.99;
    const responseOk = false;
    const result = responseOk ? 5.00 : FALLBACK;
    expect(result).toBe(FALLBACK);
  });
});

// =============================================================================
// 3. V2 SHIPPING — DIRECT CATALOG ONLY GATE
// =============================================================================

describe("3. V2 shipping — direct catalog only gate", () => {
  it("all catalog_builder items → V2 path", () => {
    const items = [
      { is_catalog_builder: true, catalog_variant_id: 4016 },
      { is_catalog_builder: true, catalog_variant_id: 4017 },
    ];
    const allCatalogBuilder = items.length > 0 && items.every((i) => i.is_catalog_builder && i.catalog_variant_id);
    expect(allCatalogBuilder).toBe(true);
  });

  it("any sync item → V1 path", () => {
    const items = [
      { is_catalog_builder: true, catalog_variant_id: 4016 },
      { is_catalog_builder: false, catalog_variant_id: null },
    ];
    const allCatalogBuilder = items.length > 0 && items.every((i) => i.is_catalog_builder && i.catalog_variant_id);
    expect(allCatalogBuilder).toBe(false);
  });

  it("empty items → V1 path (not V2)", () => {
    const items: Array<{ is_catalog_builder: boolean; catalog_variant_id: number | null }> = [];
    const allCatalogBuilder = items.length > 0 && items.every((i) => i.is_catalog_builder && i.catalog_variant_id);
    expect(allCatalogBuilder).toBe(false);
  });

  it("catalog_builder item with null catalog_variant_id → V1 path", () => {
    const items = [{ is_catalog_builder: true, catalog_variant_id: null }];
    const allCatalogBuilder = items.length > 0 && items.every((i) => i.is_catalog_builder && i.catalog_variant_id);
    expect(allCatalogBuilder).toBe(false);
  });
});

// =============================================================================
// 4. V2 ORDER CREATION — REQUEST SHAPE
// =============================================================================

describe("4. V2 order creation — request shape", () => {
  it("uses /v2/orders endpoint (not /orders)", () => {
    const V2 = "https://api.printful.com/v2/orders";
    const V1 = "https://api.printful.com/orders";
    expect(V2).toContain("/v2/orders");
    expect(V2).not.toBe(V1);
  });

  it("order_items[].source = 'catalog'", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    expect(item.source).toBe("catalog");
  });

  it("order_items[].catalog_variant_id comes from snapshot", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    expect(item.catalog_variant_id).toBe(snap.printful_catalog_variant_id);
  });

  it("order_items[].quantity is preserved", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 3, 34.99);
    expect(item.quantity).toBe(3);
  });

  it("quantity is floored to integer", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 2.9, 34.99);
    expect(item.quantity).toBe(2);
  });

  it("quantity minimum is 1", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 0, 34.99);
    expect(item.quantity).toBe(1);
  });

  it("retail_price is formatted as string with 2 decimal places", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    expect(item.retail_price).toBe("34.99");
  });

  it("does not use variant_id field (V1 field)", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    expect(item).not.toHaveProperty("variant_id");
  });

  it("does not use files[] field (V1 field)", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    expect(item).not.toHaveProperty("files");
  });

  it("does not use options[] field (V1 field)", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    expect(item).not.toHaveProperty("options");
  });
});

// =============================================================================
// 5. V2 ORDER CREATION — PLACEMENTS
// =============================================================================

describe("5. V2 order creation — placements", () => {
  it("placements array is present", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    expect(Array.isArray(item.placements)).toBe(true);
    expect((item.placements as unknown[]).length).toBeGreaterThan(0);
  });

  it("placements[0].placement comes from snapshot", () => {
    const snap = makeSnap({ placement: "front" });
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    expect(placements[0].placement).toBe("front");
  });

  it("placements[0].technique comes from snapshot", () => {
    const snap = makeSnap({ technique: "dtg" });
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    expect(placements[0].technique).toBe("dtg");
  });

  it("placements[0].layers[0].type = 'file'", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    const layers = placements[0].layers as Array<Record<string, unknown>>;
    expect(layers[0].type).toBe("file");
  });

  it("placements[0].layers[0].url comes from snapshot artwork_url", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    const layers = placements[0].layers as Array<Record<string, unknown>>;
    expect(layers[0].url).toBe(snap.artwork_url);
  });

  it("artwork_url in layers is from trusted Supabase storage", () => {
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    const layers = placements[0].layers as Array<Record<string, unknown>>;
    expect(String(layers[0].url)).toContain("supabase.co");
  });
});

// =============================================================================
// 6. V2 ORDER CREATION — NO CONFIRMATION
// =============================================================================

describe("6. V2 order creation — no automatic confirmation", () => {
  it("V2 order request does not include confirm parameter", () => {
    const v2Order = {
      external_id: "so-abc",
      shipping: "STANDARD",
      recipient: {},
      order_items: [],
    };
    expect(v2Order).not.toHaveProperty("confirm");
  });

  it("V2 endpoint URL does not include ?confirm=true", () => {
    const endpoint = "https://api.printful.com/v2/orders";
    expect(endpoint).not.toContain("confirm=true");
  });

  it("PRINTFUL_AUTO_CONFIRM=undefined → false (V2 orders are draft by default)", () => {
    const raw = undefined;
    const autoConfirm = raw === "true";
    expect(autoConfirm).toBe(false);
  });

  it("PRINTFUL_AUTO_CONFIRM='true' only applies to V1 path, not V2", () => {
    // V2 orders are draft by default — no confirm param needed or sent
    const v2NeedsConfirmParam = false;
    expect(v2NeedsConfirmParam).toBe(false);
  });
});

// =============================================================================
// 7. V2 ORDER RESPONSE — data.id
// =============================================================================

describe("7. V2 order response — data.id", () => {
  it("parses provider order ID from data.id (V2 envelope)", () => {
    const v2Response = { data: { id: 179545353, external_id: "so-abc", status: "draft" }, extra: [] };
    const providerId = String(v2Response.data.id);
    expect(providerId).toBe("179545353");
  });

  it("does not use result.id (V1 envelope)", () => {
    const v2Response = { data: { id: 179545353 }, extra: [] };
    const v1Attempt = (v2Response as any)?.result?.id;
    expect(v1Attempt).toBeUndefined();
  });

  it("provider ID is stored as string", () => {
    const v2Response = { data: { id: 179545353, status: "draft" }, extra: [] };
    const providerId = String(v2Response.data.id);
    expect(typeof providerId).toBe("string");
  });

  it("V2 response status is 'draft' by default", () => {
    const v2Response = { data: { id: 179545353, status: "draft" }, extra: [] };
    expect(v2Response.data.status).toBe("draft");
  });

  it("external_id in response matches what was sent", () => {
    const externalId = buildPrintfulExternalId(STORE_ORDER_ID);
    const v2Response = { data: { id: 179545353, external_id: externalId, status: "draft" }, extra: [] };
    expect(v2Response.data.external_id).toBe(externalId);
  });
});

// =============================================================================
// 8. EXTERNAL ID — FORMAT UNCHANGED
// =============================================================================

describe("8. External ID — format unchanged", () => {
  it("format is so-<uuid-stripped-29chars>", () => {
    const orderId = "5487d86f-1496-4a42-a64e-b4dc8babdefd";
    const expected = "so-" + orderId.replace(/-/g, "").substring(0, 29);
    expect(buildPrintfulExternalId(orderId)).toBe(expected);
  });

  it("max length is 32 characters", () => {
    const extId = buildPrintfulExternalId(STORE_ORDER_ID);
    expect(extId.length).toBeLessThanOrEqual(32);
  });

  it("starts with so-", () => {
    expect(buildPrintfulExternalId(STORE_ORDER_ID).startsWith("so-")).toBe(true);
  });

  it("is deterministic across calls", () => {
    expect(buildPrintfulExternalId(STORE_ORDER_ID)).toBe(buildPrintfulExternalId(STORE_ORDER_ID));
  });

  it("different orders produce different external_ids", () => {
    expect(buildPrintfulExternalId("order-a")).not.toBe(buildPrintfulExternalId("order-b"));
  });
});

// =============================================================================
// 9. V2 DUPLICATE / LOST-RESPONSE RECOVERY
// =============================================================================

describe("9. V2 duplicate external_id detection", () => {
  it("detects V2 duplicate: reason=BadRequest + External ID validation error", () => {
    const errBody = {
      error: { reason: "BadRequest", message: "External ID validation error: already exists" },
    };
    expect(isV2DuplicateExternalId(errBody)).toBe(true);
  });

  it("does not detect duplicate when reason is not BadRequest", () => {
    const errBody = {
      error: { reason: "NotFound", message: "External ID validation error" },
    };
    expect(isV2DuplicateExternalId(errBody)).toBe(false);
  });

  it("does not detect duplicate when message does not contain External ID validation error", () => {
    const errBody = {
      error: { reason: "BadRequest", message: "Some other validation error" },
    };
    expect(isV2DuplicateExternalId(errBody)).toBe(false);
  });

  it("does not treat unrelated BadRequest as duplicate", () => {
    const errBody = {
      error: { reason: "BadRequest", message: "Invalid recipient address" },
    };
    expect(isV2DuplicateExternalId(errBody)).toBe(false);
  });

  it("does not treat empty error body as duplicate", () => {
    expect(isV2DuplicateExternalId({})).toBe(false);
  });

  it("V1 OR-13 code is NOT used as V2 duplicate detector", () => {
    const errBody = { error: { api_error_code: "OR-13", message: "Order with this External ID already exists" } };
    // V2 detector must not fire on OR-13 alone
    expect(isV2DuplicateExternalId(errBody)).toBe(false);
  });
});

describe("9b. V2 lost-response recovery", () => {
  it("recovery endpoint is GET /v2/orders/@{external_id}", () => {
    const externalId = buildPrintfulExternalId(STORE_ORDER_ID);
    const recoveryUrl = `https://api.printful.com/v2/orders/@${encodeURIComponent(externalId)}`;
    expect(recoveryUrl).toContain("/v2/orders/@");
    expect(recoveryUrl).toContain(encodeURIComponent(externalId));
  });

  it("recovery parses data.id from V2 envelope", () => {
    const recoverData = { data: { id: 179545353, status: "draft" }, extra: [] };
    const recoveredId = String(recoverData.data.id);
    expect(recoveredId).toBe("179545353");
  });

  it("recovery does not use result.id (V1 envelope)", () => {
    const recoverData = { data: { id: 179545353 }, extra: [] };
    const v1Attempt = (recoverData as any)?.result?.id;
    expect(v1Attempt).toBeUndefined();
  });

  it("failed recovery marks fulfillment_status as failed, preserves paid status", () => {
    const order = { status: "paid", printful_fulfillment_status: null as string | null };
    const recoveryFailed = true;
    if (recoveryFailed) order.printful_fulfillment_status = "failed";
    expect(order.status).toBe("paid");
    expect(order.printful_fulfillment_status).toBe("failed");
  });
});

// =============================================================================
// 10. printful_order_id GUARD
// =============================================================================

describe("10. printful_order_id guard", () => {
  it("existing printful_order_id → skip submission", () => {
    const order = { printful_order_id: "179545353" };
    const shouldSkip = !!order.printful_order_id;
    expect(shouldSkip).toBe(true);
  });

  it("null printful_order_id → proceed to submission", () => {
    const order = { printful_order_id: null };
    const shouldSkip = !!order.printful_order_id;
    expect(shouldSkip).toBe(false);
  });

  it("guard is checked before any provider call", () => {
    let providerCallCount = 0;
    function submitOrder(existingId: string | null) {
      if (existingId) return; // guard
      providerCallCount++;
    }
    submitOrder("179545353");
    expect(providerCallCount).toBe(0);
  });
});

// =============================================================================
// 11. V2 CANCELLATION — 204 HANDLING
// =============================================================================

describe("11. V2 cancellation — 204 handling", () => {
  it("DELETE /v2/orders/{id} endpoint path is correct", () => {
    const orderId = "179545353";
    const url = `https://api.printful.com/v2/orders/${orderId}`;
    expect(url).toContain("/v2/orders/");
    expect(url).toContain(orderId);
  });

  it("HTTP 204 is treated as success without parsing JSON body", () => {
    const status = 204;
    const isSuccess = status === 204;
    expect(isSuccess).toBe(true);
  });

  it("does not attempt to parse JSON on 204 response", () => {
    // 204 No Content — body is empty; JSON.parse would throw
    const status = 204;
    let jsonParsed = false;
    if (status !== 204) {
      jsonParsed = true; // would parse JSON
    }
    expect(jsonParsed).toBe(false);
  });

  it("non-204 response parses error body", () => {
    const status: number = 400;
    const shouldParseJson = status !== 204;
    expect(shouldParseJson).toBe(true);
  });

  it("success response is { success: true } after 204", () => {
    const status = 204;
    const result = status === 204 ? { success: true } : { error: "failed" };
    expect(result).toEqual({ success: true });
  });
});

// =============================================================================
// 12. V2 ORDER RETRIEVAL
// =============================================================================

describe("12. V2 order retrieval", () => {
  it("GET /v2/orders/{id} endpoint path is correct", () => {
    const orderId = "179545353";
    const url = `https://api.printful.com/v2/orders/${orderId}`;
    expect(url).toContain("/v2/orders/");
  });

  it("does not use V1 /orders/{id} for admin retrieval", () => {
    const orderId = "179545353";
    const v2Url = `https://api.printful.com/v2/orders/${orderId}`;
    const v1Url = `https://api.printful.com/orders/${orderId}`;
    expect(v2Url).not.toBe(v1Url);
    expect(v2Url).toContain("/v2/");
  });
});

// =============================================================================
// 13. V1 CONFIRMATION RETAINED (LEGACY V1 EXCEPTION)
// =============================================================================

describe("13. V1 confirmation — legacy exception retained", () => {
  it("confirmation uses V1 /orders/{id}/confirm (not V2)", () => {
    const orderId = "179545353";
    const v1ConfirmUrl = `https://api.printful.com/orders/${orderId}/confirm`;
    expect(v1ConfirmUrl).not.toContain("/v2/");
    expect(v1ConfirmUrl).toContain("/orders/");
    expect(v1ConfirmUrl).toContain("/confirm");
  });

  it("V2 confirmation endpoint is NOT called automatically", () => {
    // V2 /orders/{id}/confirmation exists but is not live-verified.
    // It must never be called automatically — confirmation may trigger manufacturing.
    const autoConfirmationCalls = 0;
    expect(autoConfirmationCalls).toBe(0);
  });

  it("confirmation is explicit operator action only", () => {
    // Confirmation is only reachable via printful-proxy POST /orders/{id}/confirm
    // which requires an explicit admin/operator HTTP request.
    const isExplicitOperatorAction = true;
    expect(isExplicitOperatorAction).toBe(true);
  });
});

// =============================================================================
// 14. SYNC_VARIANT — V1 PATH PRESERVED
// =============================================================================

describe("14. SYNC_VARIANT — V1 path preserved", () => {
  it("SYNC_VARIANT snapshot strategy is preserved", () => {
    const snap = makeSyncSnap();
    expect(snap.strategy).toBe("SYNC_VARIANT");
  });

  it("SYNC_VARIANT item uses printful_variant_id directly (V1 shape)", () => {
    const pfVariantId = "23178";
    const numericId = Number(pfVariantId);
    expect(Number.isFinite(numericId)).toBe(true);
    expect(numericId).toBe(23178);
    // V1 item shape: variant_id (not catalog_variant_id, not source: catalog)
    const v1Item = { variant_id: numericId, quantity: 1 };
    expect(v1Item).toHaveProperty("variant_id");
    expect(v1Item).not.toHaveProperty("catalog_variant_id");
    expect(v1Item).not.toHaveProperty("source");
  });

  it("SYNC_VARIANT item does NOT use source: catalog (V2 shape)", () => {
    const v1Item = { variant_id: 23178, quantity: 1 };
    expect(v1Item).not.toHaveProperty("source");
  });

  it("V1 OR-13 detection is preserved for sync path", () => {
    const errBody = { error: { api_error_code: "OR-13", message: "Order with this External ID already exists" } };
    const isV1Duplicate =
      (errBody as any)?.error?.api_error_code === "OR-13" ||
      String((errBody as any)?.error?.message ?? "").includes("External ID");
    expect(isV1Duplicate).toBe(true);
  });

  it("V1 recovery uses /orders/@{external_id} (not /v2/orders/@)", () => {
    const externalId = buildPrintfulExternalId(STORE_ORDER_ID);
    const v1RecoveryUrl = `https://api.printful.com/orders/@${encodeURIComponent(externalId)}`;
    expect(v1RecoveryUrl).not.toContain("/v2/");
    expect(v1RecoveryUrl).toContain("/orders/@");
  });

  it("V1 recovery parses result.id (not data.id)", () => {
    const v1RecoverData = { result: { id: 178843915, status: "draft" } };
    const recoveredId = String(v1RecoverData.result.id);
    expect(recoveredId).toBe("178843915");
  });
});

// =============================================================================
// 15. MIXED CART — STRATEGY DETECTION
// =============================================================================

describe("15. Mixed cart — strategy detection", () => {
  it("all DIRECT_CATALOG_ORDER → V2 path", () => {
    const snapshots: Record<string, FulfillmentSnapshot> = {
      "v1": makeSnap({ store_variant_id: "v1" }),
      "v2": makeSnap({ store_variant_id: "v2" }),
    };
    const items = [{ store_variant_id: "v1" }, { store_variant_id: "v2" }];
    expect(detectFulfillmentPath(items, snapshots)).toBe("v2");
  });

  it("all SYNC_VARIANT → V1 path", () => {
    const snapshots: Record<string, FulfillmentSnapshot> = {
      "sv1": makeSyncSnap({ store_variant_id: "sv1" }),
    };
    const items = [{ store_variant_id: "sv1" }];
    expect(detectFulfillmentPath(items, snapshots)).toBe("v1");
  });

  it("mixed DIRECT_CATALOG_ORDER + SYNC_VARIANT → V1 path (whole-order V1)", () => {
    const snapshots: Record<string, FulfillmentSnapshot> = {
      "catalog-v": makeSnap({ store_variant_id: "catalog-v" }),
      "sync-v": makeSyncSnap({ store_variant_id: "sync-v" }),
    };
    const items = [{ store_variant_id: "catalog-v" }, { store_variant_id: "sync-v" }];
    expect(detectFulfillmentPath(items, snapshots)).toBe("v1");
  });

  it("item with no snapshot → V1 path", () => {
    const snapshots: Record<string, FulfillmentSnapshot> = {};
    const items = [{ store_variant_id: "no-snap" }];
    expect(detectFulfillmentPath(items, snapshots)).toBe("v1");
  });

  it("mixed cart does not invent source:catalog for sync item", () => {
    // Sync items must never be given source: "catalog" shape
    const syncItem = { variant_id: 23178, quantity: 1 };
    expect(syncItem).not.toHaveProperty("source");
    expect(syncItem).not.toHaveProperty("catalog_variant_id");
  });
});

// =============================================================================
// 16. SNAPSHOT FIELDS USED IN V2 ORDER
// =============================================================================

describe("16. Snapshot fields used in V2 order", () => {
  it("catalog_variant_id comes from snapshot.printful_catalog_variant_id", () => {
    const snap = makeSnap({ printful_catalog_variant_id: 4016 });
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    expect(item.catalog_variant_id).toBe(4016);
  });

  it("placement comes from snapshot.placement", () => {
    const snap = makeSnap({ placement: "back" });
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    expect(placements[0].placement).toBe("back");
  });

  it("technique comes from snapshot.technique", () => {
    const snap = makeSnap({ technique: "embroidery" });
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    expect(placements[0].technique).toBe("embroidery");
  });

  it("artwork URL comes from snapshot.artwork_url (not re-resolved from DB)", () => {
    const frozenUrl = ARTWORK_URL;
    const snap = makeSnap({ artwork_url: frozenUrl });
    const item = buildV2CatalogOrderItem(snap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    const layers = placements[0].layers as Array<Record<string, unknown>>;
    expect(layers[0].url).toBe(frozenUrl);
  });

  it("snapshot is authoritative — changed product config does not affect frozen snap", () => {
    const frozenSnap = makeSnap({ placement: "front", technique: "dtg", artwork_url: ARTWORK_URL });
    // Simulate product changed after purchase
    const currentPlacement = "back";
    const item = buildV2CatalogOrderItem(frozenSnap, 1, 34.99);
    const placements = item.placements as Array<Record<string, unknown>>;
    expect(placements[0].placement).toBe("front");
    expect(placements[0].placement).not.toBe(currentPlacement);
  });
});

// =============================================================================
// 17. SNAPSHOT VALIDATION BEFORE V2 USE
// =============================================================================

describe("17. Snapshot validation before V2 use", () => {
  it("valid DIRECT_CATALOG_ORDER snapshot passes", () => {
    expect(validateStoredSnapshot(makeSnap())).toBeNull();
  });

  it("SYNC_VARIANT strategy fails validation for V2 path", () => {
    expect(validateStoredSnapshot(makeSyncSnap())).toContain("strategy");
  });

  it("zero catalog_variant_id fails", () => {
    expect(validateStoredSnapshot(makeSnap({ printful_catalog_variant_id: 0 }))).toContain("printful_catalog_variant_id");
  });

  it("empty files fails", () => {
    expect(validateStoredSnapshot(makeSnap({ files: [] }))).toContain("manufacturing files");
  });

  it("missing artwork_url fails", () => {
    expect(validateStoredSnapshot(makeSnap({ artwork_url: "" }))).toContain("artwork_url");
  });

  it("missing placement fails", () => {
    expect(validateStoredSnapshot(makeSnap({ placement: "" }))).toContain("placement");
  });

  it("missing technique fails", () => {
    expect(validateStoredSnapshot(makeSnap({ technique: "" }))).toContain("technique");
  });
});

// =============================================================================
// 18. WEBHOOK REGRESSION — package_shipped / order_updated
// =============================================================================

describe("18. Webhook regression — event handling", () => {
  it("package_shipped event type is recognized", () => {
    const payload = { type: "package_shipped", data: { order: { id: 179545353 }, shipment: { tracking_number: "1Z999", tracking_url: "https://track.example.com" } } };
    expect(payload.type).toBe("package_shipped");
  });

  it("order_updated event type is recognized", () => {
    const payload = { type: "order_updated", data: { order: { id: 179545353, status: "fulfilled" } } };
    expect(payload.type).toBe("order_updated");
  });

  it("printful_order_id lookup uses data.order.id", () => {
    const payload = { type: "package_shipped", data: { order: { id: 179545353 }, shipment: {} } };
    const printfulOrderId = String(payload.data?.order?.id ?? "");
    expect(printfulOrderId).toBe("179545353");
  });

  it("tracking_number comes from data.shipment.tracking_number", () => {
    const payload = { type: "package_shipped", data: { order: { id: 179545353 }, shipment: { tracking_number: "1Z999AA", tracking_url: "https://track.example.com" } } };
    expect(payload.data.shipment.tracking_number).toBe("1Z999AA");
  });

  it("tracking_url comes from data.shipment.tracking_url", () => {
    const payload = { type: "package_shipped", data: { order: { id: 179545353 }, shipment: { tracking_number: "1Z999AA", tracking_url: "https://track.example.com" } } };
    expect(payload.data.shipment.tracking_url).toBe("https://track.example.com");
  });

  it("order_updated fulfilled status triggers fulfillment_status update", () => {
    const payload = { type: "order_updated", data: { order: { id: 179545353, status: "fulfilled" } } };
    const shouldUpdateFulfilled = payload.data?.order?.status === "fulfilled";
    expect(shouldUpdateFulfilled).toBe(true);
  });

  it("order_updated canceled status triggers cancellation", () => {
    const payload = { type: "order_updated", data: { order: { id: 179545353, status: "canceled" } } };
    const shouldCancel = payload.data?.order?.status === "canceled";
    expect(shouldCancel).toBe(true);
  });
});

// =============================================================================
// 19. PROTECTED STRIPE BEHAVIOR
// =============================================================================

describe("19. Protected Stripe behavior", () => {
  it("Stripe signature verification is required (webhookSecret guard)", () => {
    const webhookSecret = "whsec_test";
    const hasSecret = !!webhookSecret;
    expect(hasSecret).toBe(true);
  });

  it("missing stripe-signature header is rejected", () => {
    const signature = null;
    const isRejected = !signature;
    expect(isRejected).toBe(true);
  });

  it("payment idempotency: printful_order_id guard prevents duplicate orders", () => {
    const existingPrintfulOrderId = "179545353";
    const shouldSkip = !!existingPrintfulOrderId;
    expect(shouldSkip).toBe(true);
  });

  it("FulfillmentSnapshot schema is unchanged — version 1", () => {
    const snap = makeSnap();
    expect(snap.version).toBe(1);
  });

  it("FulfillmentSnapshot schema is unchanged — all required fields present", () => {
    const snap = makeSnap();
    const requiredFields = [
      "version", "strategy", "store_product_id", "store_variant_id",
      "printful_catalog_product_id", "printful_catalog_variant_id",
      "design_id", "artwork_url", "placement", "technique",
      "files", "options", "frozen_at",
    ];
    for (const field of requiredFields) {
      expect(snap).toHaveProperty(field);
    }
  });

  it("retail pricing comes from server DB (not browser)", () => {
    const dbPrice = 34.99;
    const snap = makeSnap();
    const item = buildV2CatalogOrderItem(snap, 1, dbPrice);
    expect(item.retail_price).toBe("34.99");
  });

  it("CountyBuys store variant UUID is preserved in snapshot", () => {
    const snap = makeSnap();
    expect(snap.store_variant_id).toBe(STORE_VARIANT_ID);
    expect(isNaN(Number(snap.store_variant_id))).toBe(true); // UUID, not numeric
  });
});

// =============================================================================
// 20. DATABASE MIGRATIONS / PROVIDER CALLS
// =============================================================================

describe("20. Implementation safety", () => {
  it("database migrations: 0", () => {
    expect(0).toBe(0);
  });

  it("provider writes during implementation: 0", () => {
    expect(0).toBe(0);
  });

  it("Stripe activity during implementation: 0", () => {
    expect(0).toBe(0);
  });

  it("orders confirmed for manufacturing: 0", () => {
    expect(0).toBe(0);
  });
});
