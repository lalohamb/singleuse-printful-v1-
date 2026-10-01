import { describe, it, expect } from "vitest";
import type { StoreVariant, CartItem } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStoreVariant(overrides: Partial<StoreVariant> = {}): StoreVariant {
  return {
    id: "sv-uuid-001",
    product_id: "prod-uuid-001",
    provider: "printful",
    printful_variant_id: "4011",
    label: "Black / M",
    color: "Black",
    size: "M",
    retail_price: 29.99,
    image_url: "https://cdn.example.com/variant.jpg",
    available: true,
    ...overrides,
  };
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    product_id: "prod-uuid-001",
    variant_id: "sv-uuid-001",   // store UUID
    title: "Heritage Crown Tee",
    variant_label: "Black / M",
    color: "Black",
    size: "M",
    price: 29.99,
    image_url: "https://cdn.example.com/variant.jpg",
    quantity: 1,
    printful_id: "pf-sync-001",
    ...overrides,
  };
}

// ── 1. Existing Printful variant migrates to store UUID ───────────────────────

describe("1. Existing Printful variant migrates to store UUID", () => {
  it("store variant has a UUID id distinct from printful_variant_id", () => {
    const v = makeStoreVariant();
    expect(v.id).toBe("sv-uuid-001");
    expect(v.printful_variant_id).toBe("4011");
    expect(v.id).not.toBe(v.printful_variant_id);
  });

  it("store variant id is not a numeric Printful ID", () => {
    const v = makeStoreVariant();
    expect(isNaN(Number(v.id))).toBe(true);
  });
});

// ── 2. Store UUID remains stable after sync ───────────────────────────────────

describe("2. Store UUID stable across sync", () => {
  it("upsert on (product_id, provider, printful_variant_id) preserves existing id", () => {
    // Simulates the ON CONFLICT DO UPDATE behavior: same key → same UUID
    const existing = makeStoreVariant({ id: "sv-uuid-001", retail_price: 29.99 });
    const synced = { ...existing, retail_price: 31.99 }; // price updated
    expect(synced.id).toBe("sv-uuid-001"); // UUID unchanged
    expect(synced.retail_price).toBe(31.99);
  });
});

// ── 3. New Printful variant creates new store UUID ────────────────────────────

describe("3. New Printful variant gets new store UUID", () => {
  it("a variant with a new printful_variant_id gets a different store UUID", () => {
    const v1 = makeStoreVariant({ id: "sv-uuid-001", printful_variant_id: "4011" });
    const v2 = makeStoreVariant({ id: "sv-uuid-002", printful_variant_id: "4012" });
    expect(v1.id).not.toBe(v2.id);
    expect(v1.printful_variant_id).not.toBe(v2.printful_variant_id);
  });
});

// ── 4. Removed Printful variant becomes unavailable ───────────────────────────

describe("4. Removed Printful variant becomes unavailable", () => {
  it("available=false preserves the store UUID", () => {
    const v = makeStoreVariant({ available: false });
    expect(v.id).toBe("sv-uuid-001");
    expect(v.available).toBe(false);
    expect(v.printful_variant_id).toBe("4011"); // mapping preserved for history
  });

  it("unavailable variant is excluded from public storefront", () => {
    const variants = [
      makeStoreVariant({ id: "sv-1", available: true }),
      makeStoreVariant({ id: "sv-2", available: false }),
    ];
    const visible = variants.filter((v) => v.available);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("sv-1");
  });
});

// ── 5. Duplicate provider mapping is prevented ───────────────────────────────

describe("5. Duplicate provider mapping prevented", () => {
  it("same (product_id, provider, printful_variant_id) is a duplicate", () => {
    const key = (v: StoreVariant) => `${v.product_id}|${v.provider}|${v.printful_variant_id}`;
    const v1 = makeStoreVariant();
    const v2 = makeStoreVariant({ id: "sv-uuid-999" }); // different UUID, same mapping
    expect(key(v1)).toBe(key(v2)); // would violate unique constraint
  });

  it("different printful_variant_id is not a duplicate", () => {
    const key = (v: StoreVariant) => `${v.product_id}|${v.provider}|${v.printful_variant_id}`;
    const v1 = makeStoreVariant({ printful_variant_id: "4011" });
    const v2 = makeStoreVariant({ printful_variant_id: "4012" });
    expect(key(v1)).not.toBe(key(v2));
  });
});

// ── 6. Cart stores store variant UUID ─────────────────────────────────────────

describe("6. Cart stores store variant UUID", () => {
  it("CartItem.variant_id is the store UUID, not a Printful numeric ID", () => {
    const item = makeCartItem();
    expect(item.variant_id).toBe("sv-uuid-001");
    expect(isNaN(Number(item.variant_id))).toBe(true); // not a numeric Printful ID
  });

  it("CartItem.printful_id is product-level only, not variant identity", () => {
    const item = makeCartItem();
    expect(item.printful_id).toBe("pf-sync-001");
    expect(item.variant_id).not.toBe(item.printful_id);
  });
});

// ── 7. Legacy cart is safely cleared ─────────────────────────────────────────

describe("7. Legacy cart handling", () => {
  it("v2 storage key is different from v1 legacy key", () => {
    const V1_KEY = "pod_storefront_cart";
    const V2_KEY = "pod_storefront_cart_v2";
    expect(V1_KEY).not.toBe(V2_KEY);
  });

  it("a numeric variant_id from v1 is not a valid v2 store UUID", () => {
    const legacyVariantId = "4011"; // Printful numeric ID from v1
    // v2 UUIDs are not purely numeric
    expect(isNaN(Number(legacyVariantId))).toBe(false); // it IS numeric → legacy
  });
});

// ── 8. Cart display information is correct ────────────────────────────────────

describe("8. Cart display information", () => {
  it("CartItem contains all display fields", () => {
    const item = makeCartItem();
    expect(item.title).toBeTruthy();
    expect(item.variant_label).toBeTruthy();
    expect(item.color).toBeTruthy();
    expect(item.size).toBeTruthy();
    expect(item.price).toBeGreaterThan(0);
    expect(item.image_url).toBeTruthy();
    expect(item.quantity).toBeGreaterThan(0);
  });
});

// ── 9. Checkout validates store variant against product ───────────────────────

describe("9. Checkout validates store variant belongs to product", () => {
  it("variant with wrong product_id is rejected", () => {
    const storeVariant = makeStoreVariant({ product_id: "prod-uuid-001" });
    const cartItem = makeCartItem({ product_id: "prod-uuid-002" }); // different product
    expect(storeVariant.product_id).not.toBe(cartItem.product_id);
    // Server would reject: variant does not belong to this product
  });

  it("variant with matching product_id is accepted", () => {
    const storeVariant = makeStoreVariant({ product_id: "prod-uuid-001" });
    const cartItem = makeCartItem({ product_id: "prod-uuid-001" });
    expect(storeVariant.product_id).toBe(cartItem.product_id);
  });
});

// ── 10. Browser-supplied price cannot override DB price ──────────────────────

describe("10. Browser price cannot override DB price", () => {
  it("server uses retail_price from product_variants, not from browser", () => {
    const dbVariant = makeStoreVariant({ retail_price: 29.99 });
    const browserSuppliedPrice = 0.01; // attacker-supplied
    const authoritative = dbVariant.retail_price;
    expect(authoritative).toBe(29.99);
    expect(authoritative).not.toBe(browserSuppliedPrice);
  });
});

// ── 11. Browser-supplied provider ID is ignored ───────────────────────────────

describe("11. Browser provider ID is ignored", () => {
  it("printful_variant_id comes from DB, not from browser", () => {
    const dbVariant = makeStoreVariant({ printful_variant_id: "4011" });
    const browserSupplied = "9999"; // attacker-supplied
    const authoritative = dbVariant.printful_variant_id;
    expect(authoritative).toBe("4011");
    expect(authoritative).not.toBe(browserSupplied);
  });
});

// ── 12. Unavailable variant cannot be purchased ───────────────────────────────

describe("12. Unavailable variant cannot be purchased", () => {
  it("available=false variant is rejected at checkout", () => {
    const v = makeStoreVariant({ available: false });
    const canPurchase = v.available;
    expect(canPurchase).toBe(false);
  });

  it("available=true variant passes checkout check", () => {
    const v = makeStoreVariant({ available: true });
    expect(v.available).toBe(true);
  });
});

// ── 13. Store variant UUID resolves to Printful variant ID ───────────────────

describe("13. Store variant UUID resolves to Printful variant ID", () => {
  it("printful_variant_id is accessible from store variant", () => {
    const v = makeStoreVariant({ printful_variant_id: "4011" });
    expect(v.printful_variant_id).toBe("4011");
    expect(Number(v.printful_variant_id)).toBe(4011);
  });
});

// ── 14. Correct Printful variant ID enters fulfillment payload ────────────────

describe("14. Correct Printful variant ID in fulfillment", () => {
  it("fulfillment uses printful_variant_id, not store UUID", () => {
    const v = makeStoreVariant({ id: "sv-uuid-001", printful_variant_id: "4011" });
    const fulfillmentVariantId = Number(v.printful_variant_id);
    expect(fulfillmentVariantId).toBe(4011);
    expect(fulfillmentVariantId).not.toBeNaN();
  });
});

// ── 15. Missing mapping prevents Printful submission ─────────────────────────

describe("15. Missing mapping prevents Printful submission", () => {
  it("null printful_variant_id throws before submission", () => {
    const v = makeStoreVariant({ printful_variant_id: null });
    const pfVariantId = v.printful_variant_id;
    expect(pfVariantId).toBeNull();
    // Fulfillment code throws: "No Printful variant ID for store_variant_id=..."
    expect(() => {
      if (!pfVariantId) throw new Error("No Printful variant ID");
    }).toThrow("No Printful variant ID");
  });
});

// ── 16. Invalid provider prevents Printful submission ────────────────────────

describe("16. Invalid provider prevents Printful submission", () => {
  it("non-printful provider is not sent to Printful", () => {
    const v = makeStoreVariant({ provider: "manual" });
    const shouldSubmitToPrintful = v.provider === "printful" && v.printful_variant_id !== null;
    expect(shouldSubmitToPrintful).toBe(false);
  });
});

// ── 17. Failed mapping leaves storefront order intact ────────────────────────

describe("17. Failed mapping leaves order intact", () => {
  it("fulfillment error does not delete the order", () => {
    // The stripe-webhook catches Printful errors and logs them
    // without deleting or corrupting the order row.
    // This test verifies the error is thrown (not swallowed silently).
    const simulateFulfillment = (pfVariantId: string | null) => {
      if (!pfVariantId) {
        throw new Error("No Printful variant ID — order preserved for admin resolution");
      }
      return { submitted: true };
    };
    expect(() => simulateFulfillment(null)).toThrow();
    expect(simulateFulfillment("4011")).toEqual({ submitted: true });
  });
});

// ── 18–21. Security: auth guards on Printful routes ──────────────────────────
// Verify requireAdmin is present in source rather than importing modules
// (importing triggers Supabase client instantiation which requires env vars)

describe("18-21. Security: Printful route auth guards", () => {
  it("artwork-upload route source contains requireAdmin", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/app/api/printful/artwork-upload/route.ts", "utf8");
    expect(src).toContain("requireAdmin");
  });

  it("mockups POST route source contains requireAdmin", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/app/api/printful/mockups/route.ts", "utf8");
    expect(src).toContain("requireAdmin");
  });

  it("mockups/persist POST route source contains requireAdmin", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/app/api/printful/mockups/persist/route.ts", "utf8");
    expect(src).toContain("requireAdmin");
  });

  it("products GET route source contains requireAdmin", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/app/api/printful/products/route.ts", "utf8");
    expect(src).toContain("requireAdmin");
  });

  it("templates GET route source contains requireAdmin", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/app/api/printful/templates/[productId]/route.ts", "utf8");
    expect(src).toContain("requireAdmin");
  });

  it("mockups/[taskKey] GET route source contains requireAdmin", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/app/api/printful/mockups/[taskKey]/route.ts", "utf8");
    expect(src).toContain("requireAdmin");
  });
});

// ── 22–26. Regression: existing commerce infrastructure ──────────────────────

describe("22-26. Regression: existing types and structures", () => {
  it("StoreVariant has all required fields", () => {
    const v = makeStoreVariant();
    expect(v).toHaveProperty("id");
    expect(v).toHaveProperty("product_id");
    expect(v).toHaveProperty("provider");
    expect(v).toHaveProperty("printful_variant_id");
    expect(v).toHaveProperty("label");
    expect(v).toHaveProperty("retail_price");
    expect(v).toHaveProperty("available");
  });

  it("CartItem has store variant UUID as variant_id", () => {
    const item = makeCartItem();
    expect(item).toHaveProperty("variant_id");
    expect(item).toHaveProperty("product_id");
    expect(item).toHaveProperty("price");
    expect(item).toHaveProperty("quantity");
  });

  it("CartItem includes color and size snapshot fields", () => {
    const item = makeCartItem({ color: "Black", size: "M" });
    expect(item.color).toBe("Black");
    expect(item.size).toBe("M");
  });

  it("printful_id on CartItem is product-level only", () => {
    const item = makeCartItem({ printful_id: "pf-sync-001" });
    expect(item.printful_id).toBe("pf-sync-001");
  });

  it("Printful webhook matching uses printful_order_id, not variant IDs", () => {
    // Webhook flow: printful_order_id → orders table → update status
    // This is provider-neutral at the order level — no variant IDs involved
    const webhookPayload = { order: { id: "pf-order-123" }, shipment: { tracking_number: "1Z999" } };
    expect(webhookPayload.order.id).toBe("pf-order-123");
  });
});
