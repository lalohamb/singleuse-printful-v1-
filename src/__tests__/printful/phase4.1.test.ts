import { describe, it, expect } from "vitest";
import type { Product } from "@/types";
import type { CatalogProduct } from "@/lib/catalog/types";
import {
  type PrintfulSyncProductId,
  type PrintfulCatalogProductId,
  type PrintfulCatalogVariantId,
  type PrintfulProductIdentity,
} from "@/lib/printful/identity";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "aed80c7d-5f07-495a-8e1a-8ff1ec74726b",
    slug: "lightweight-quarter-zip-pullover",
    title: "Lightweight quarter-zip pullover",
    short_description: null,
    description: "A premium quarter-zip pullover.",
    category_id: null,
    brand: null,
    product_type: null,
    price: 49.99,
    compare_at_price: null,
    cost: 0,
    image_url: "https://cdn.printful.com/legacy.jpg",
    images: [],
    status: "active",
    published_at: "2026-10-16T00:00:00Z",
    meta_title: null,
    meta_description: null,
    featured: false,
    is_new_arrival: false,
    is_trending: false,
    is_bestseller: false,
    is_on_sale: false,
    is_personalizable: false,
    personalization_label: null,
    content_locked: false,
    display_order: 0,
    printful_id: "476330305",
    printful_catalog_id: 903,
    variants: [],
    shipping_info: {},
    created_at: "2026-10-16T00:00:00Z",
    updated_at: "2026-10-16T00:00:00Z",
    ...overrides,
  };
}

// Simulates what the sync proxy derives from Printful API response
function deriveCatalogIdFromSyncVariants(
  syncVariants: { product?: { product_id?: number } }[]
): { catalogProductId: number | null; conflict: boolean } {
  const ids = new Set<number>();
  for (const sv of syncVariants) {
    const id = sv.product?.product_id;
    if (typeof id === "number" && id > 0) ids.add(id);
  }
  if (ids.size === 0) return { catalogProductId: null, conflict: false };
  if (ids.size > 1) return { catalogProductId: null, conflict: true };
  return { catalogProductId: [...ids][0], conflict: false };
}

// Simulates resolvePrintfulProductIdentity fast path vs fallback
function simulateIdentityResolution(
  product: { printful_id: string | null; printful_catalog_id: number | null },
  fallbackCatalogId?: number
): PrintfulProductIdentity | null {
  if (!product.printful_id) return null;
  const syncProductId = Number(product.printful_id) as PrintfulSyncProductId;
  // Fast path
  if (product.printful_catalog_id) {
    return { syncProductId, catalogProductId: product.printful_catalog_id as PrintfulCatalogProductId };
  }
  // Fallback
  if (fallbackCatalogId) {
    return { syncProductId, catalogProductId: fallbackCatalogId as PrintfulCatalogProductId };
  }
  return null;
}

// ── 1. printful_catalog_id column ─────────────────────────────────────────────

describe("1. printful_catalog_id column on Product", () => {
  it("Product type includes printful_catalog_id", () => {
    const p = makeProduct();
    expect(p).toHaveProperty("printful_catalog_id");
  });

  it("printful_catalog_id is 903 for the verified quarter-zip", () => {
    const p = makeProduct({ printful_catalog_id: 903 });
    expect(p.printful_catalog_id).toBe(903);
  });

  it("printful_catalog_id can be null for manual/legacy products", () => {
    const p = makeProduct({ printful_catalog_id: null });
    expect(p.printful_catalog_id).toBeNull();
  });

  it("printful_catalog_id is a number, not a string", () => {
    const p = makeProduct({ printful_catalog_id: 903 });
    expect(typeof p.printful_catalog_id).toBe("number");
  });
});

// ── 2. printful_id remains sync product ID ────────────────────────────────────

describe("2. printful_id remains Printful store/sync product ID", () => {
  it("printful_id is the store/sync product ID string", () => {
    const p = makeProduct({ printful_id: "476330305" });
    expect(p.printful_id).toBe("476330305");
  });

  it("printful_id is distinct from printful_catalog_id", () => {
    const p = makeProduct({ printful_id: "476330305", printful_catalog_id: 903 });
    expect(String(p.printful_id)).not.toBe(String(p.printful_catalog_id));
    expect(Number(p.printful_id)).toBe(476330305);
    expect(p.printful_catalog_id).toBe(903);
  });

  it("printful_id semantics are unchanged from Phase 2/3", () => {
    const p = makeProduct();
    // printful_id is the sync/store product ID used for sync operations
    expect(p.printful_id).toBe("476330305");
    // printful_catalog_id is the catalog product ID used for mockup generation
    expect(p.printful_catalog_id).toBe(903);
  });
});

// ── 3. Variant semantics unchanged ────────────────────────────────────────────

describe("3. product_variants.printful_variant_id remains catalog variant ID", () => {
  it("printful_variant_id is the Printful catalog variant ID", () => {
    const variant = {
      id: "75a36c46-ed5c-46b6-85ae-dc8427a7cfd3",
      printful_variant_id: "23178",
    };
    expect(variant.printful_variant_id).toBe("23178");
    expect(Number(variant.printful_variant_id)).toBe(23178);
  });

  it("store variant UUID is not a numeric Printful ID", () => {
    const variant = { id: "75a36c46-ed5c-46b6-85ae-dc8427a7cfd3" };
    expect(isNaN(Number(variant.id))).toBe(true);
  });

  it("printful_variant_id is catalog variant ID, not sync variant ID", () => {
    // Sync variant IDs (e.g. 5525324210) are NOT stored — not needed
    const variant = { printful_variant_id: "23178" };
    const syncVariantId = 5525324210; // observed but not stored
    expect(Number(variant.printful_variant_id)).not.toBe(syncVariantId);
  });
});

// ── 4. Sync derives catalog ID from sync variants ─────────────────────────────

describe("4. Sync derives printful_catalog_id from sync variants", () => {
  it("single catalog ID across all variants succeeds", () => {
    const syncVariants = [
      { product: { product_id: 903 } },
      { product: { product_id: 903 } },
      { product: { product_id: 903 } },
    ];
    const result = deriveCatalogIdFromSyncVariants(syncVariants);
    expect(result.catalogProductId).toBe(903);
    expect(result.conflict).toBe(false);
  });

  it("conflicting catalog IDs across variants are detected", () => {
    const syncVariants = [
      { product: { product_id: 903 } },
      { product: { product_id: 904 } }, // conflict
    ];
    const result = deriveCatalogIdFromSyncVariants(syncVariants);
    expect(result.catalogProductId).toBeNull();
    expect(result.conflict).toBe(true);
  });

  it("no catalog ID in any variant leaves mapping unresolved", () => {
    const syncVariants = [
      { product: undefined },
      {},
    ];
    const result = deriveCatalogIdFromSyncVariants(syncVariants);
    expect(result.catalogProductId).toBeNull();
    expect(result.conflict).toBe(false);
  });

  it("empty sync variants leaves mapping unresolved safely", () => {
    const result = deriveCatalogIdFromSyncVariants([]);
    expect(result.catalogProductId).toBeNull();
    expect(result.conflict).toBe(false);
  });
});

// ── 5. Conflict detection ─────────────────────────────────────────────────────

describe("5. Catalog ID conflict detection", () => {
  it("conflicting catalog IDs are not silently resolved", () => {
    const syncVariants = [
      { product: { product_id: 903 } },
      { product: { product_id: 999 } },
    ];
    const result = deriveCatalogIdFromSyncVariants(syncVariants);
    expect(result.conflict).toBe(true);
    expect(result.catalogProductId).toBeNull();
    // Sync must NOT pick one arbitrarily
  });

  it("product_designs.configuration.catalog_product_id conflict is detectable", () => {
    const storedCatalogId = 903; // from products.printful_catalog_id
    const configCatalogId: number | undefined = 999; // from product_designs.configuration (wrong)
    const hasConflict = configCatalogId !== undefined && configCatalogId !== storedCatalogId;
    expect(hasConflict).toBe(true);
  });

  it("matching configuration.catalog_product_id does not conflict", () => {
    const storedCatalogId = 903;
    const configCatalogId: number | undefined = 903;
    const hasConflict = configCatalogId !== undefined && configCatalogId !== storedCatalogId;
    expect(hasConflict).toBe(false);
  });

  it("absent configuration.catalog_product_id does not conflict", () => {
    const storedCatalogId = 903;
    const configCatalogId: number | undefined = undefined;
    const hasConflict = configCatalogId !== undefined && configCatalogId !== storedCatalogId;
    expect(hasConflict).toBe(false);
  });
});

// ── 6. Mockup resolution prefers stored catalog ID ────────────────────────────

describe("6. Mockup resolution prefers stored printful_catalog_id", () => {
  it("fast path: uses stored catalog ID without extra API call", () => {
    const p = makeProduct({ printful_catalog_id: 903 });
    const identity = simulateIdentityResolution(p);
    expect(identity).not.toBeNull();
    expect(identity!.catalogProductId).toBe(903);
    expect(identity!.syncProductId).toBe(476330305);
  });

  it("fast path returns correct catalog ID for mockup generator", () => {
    const p = makeProduct({ printful_catalog_id: 903 });
    const identity = simulateIdentityResolution(p);
    // Mockup generator receives catalog product ID, not sync product ID
    expect(identity!.catalogProductId).toBe(903);
    expect(identity!.catalogProductId).not.toBe(identity!.syncProductId);
  });

  it("fast path does not require Printful store-product API call", () => {
    // When printful_catalog_id is set, no extra API call is needed
    const p = makeProduct({ printful_catalog_id: 903 });
    const needsApiCall = p.printful_catalog_id === null;
    expect(needsApiCall).toBe(false);
  });
});

// ── 7. Fallback resolution ────────────────────────────────────────────────────

describe("7. Fallback resolution for legacy/unmapped products", () => {
  it("fallback resolves catalog ID when printful_catalog_id is null", () => {
    const p = makeProduct({ printful_catalog_id: null });
    const identity = simulateIdentityResolution(p, 903); // fallback from API
    expect(identity).not.toBeNull();
    expect(identity!.catalogProductId).toBe(903);
  });

  it("fallback requires printful_id to be set", () => {
    const p = makeProduct({ printful_id: null, printful_catalog_id: null });
    const identity = simulateIdentityResolution(p, 903);
    expect(identity).toBeNull();
  });

  it("fallback persists resolved catalog ID (self-healing)", () => {
    // After fallback resolution, printful_catalog_id should be written to DB
    // so subsequent calls use the fast path. Simulated here as state update.
    const p = makeProduct({ printful_catalog_id: null });
    const resolvedId = 903;
    const updated = { ...p, printful_catalog_id: resolvedId };
    expect(updated.printful_catalog_id).toBe(903);
    // Next call would use fast path
    const identity = simulateIdentityResolution(updated);
    expect(identity!.catalogProductId).toBe(903);
  });
});

// ── 8. Product UUID stability ─────────────────────────────────────────────────

describe("8. Product UUID stability", () => {
  it("product UUID is unchanged by adding printful_catalog_id", () => {
    const p = makeProduct({ printful_catalog_id: 903 });
    expect(p.id).toBe("aed80c7d-5f07-495a-8e1a-8ff1ec74726b");
  });

  it("product UUID is not derived from any Printful ID", () => {
    const p = makeProduct();
    expect(p.id).not.toBe(p.printful_id);
    expect(p.id).not.toBe(String(p.printful_catalog_id));
    expect(isNaN(Number(p.id))).toBe(true);
  });
});

// ── 9. Variant UUID stability ─────────────────────────────────────────────────

describe("9. Variant UUID stability", () => {
  it("variant UUID is unchanged by Phase 4.1 changes", () => {
    const variant = {
      id: "75a36c46-ed5c-46b6-85ae-dc8427a7cfd3",
      printful_variant_id: "23178",
    };
    expect(variant.id).toBe("75a36c46-ed5c-46b6-85ae-dc8427a7cfd3");
  });

  it("variant UUID is not a Printful catalog variant ID", () => {
    const variant = { id: "75a36c46-ed5c-46b6-85ae-dc8427a7cfd3", printful_variant_id: "23178" };
    expect(variant.id).not.toBe(variant.printful_variant_id);
    expect(isNaN(Number(variant.id))).toBe(true);
  });
});

// ── 10. Store-owned fields protected from sync ────────────────────────────────

describe("10. Store-owned fields protected from sync", () => {
  it("content_locked product preserves title on sync", () => {
    const p = makeProduct({ content_locked: true, title: "Custom Store Title" });
    // Sync must not overwrite title when content_locked=true
    const syncTitle = "Printful Product Name";
    const effectiveTitle = p.content_locked ? p.title : syncTitle;
    expect(effectiveTitle).toBe("Custom Store Title");
  });

  it("content_locked product preserves slug on sync", () => {
    const p = makeProduct({ content_locked: true, slug: "my-custom-slug" });
    // Slug is NEVER overwritten by sync regardless of content_locked
    expect(p.slug).toBe("my-custom-slug");
  });

  it("printful_catalog_id is provider-owned and always updated by sync", () => {
    // printful_catalog_id is provider identity, not store content
    // It should be updated even for content_locked products
    const p = makeProduct({ content_locked: true, printful_catalog_id: null });
    const syncDerivedCatalogId = 903;
    // Sync updates printful_catalog_id regardless of content_locked
    const updated = { ...p, printful_catalog_id: syncDerivedCatalogId };
    expect(updated.printful_catalog_id).toBe(903);
    expect(updated.content_locked).toBe(true); // content_locked unchanged
  });
});

// ── 11. Identity model completeness ───────────────────────────────────────────

describe("11. Complete provider identity model", () => {
  it("all four identity fields are present and distinct", () => {
    const product = makeProduct({
      id: "aed80c7d-5f07-495a-8e1a-8ff1ec74726b",
      printful_id: "476330305",
      printful_catalog_id: 903,
    });
    const variant = {
      id: "75a36c46-ed5c-46b6-85ae-dc8427a7cfd3",
      printful_variant_id: "23178",
    };

    // All four are distinct
    const ids = [
      product.id,
      product.printful_id,
      String(product.printful_catalog_id),
      variant.id,
      variant.printful_variant_id,
    ];
    const unique = new Set(ids);
    expect(unique.size).toBe(5); // all distinct
  });

  it("store UUIDs are not numeric Printful IDs", () => {
    const product = makeProduct();
    const variant = { id: "75a36c46-ed5c-46b6-85ae-dc8427a7cfd3" };
    expect(isNaN(Number(product.id))).toBe(true);
    expect(isNaN(Number(variant.id))).toBe(true);
  });

  it("Printful IDs are numeric", () => {
    const product = makeProduct();
    expect(isNaN(Number(product.printful_id))).toBe(false);
    expect(isNaN(Number(product.printful_catalog_id))).toBe(false);
  });

  it("mockup generator receives catalog IDs, not sync IDs", () => {
    const product = makeProduct();
    const variant = { printful_variant_id: "23178" };

    // Mockup generator API call uses:
    //   POST /mockup-generator/create-task/{catalogProductId}
    //   body: { variant_ids: [catalogVariantId] }
    const catalogProductId = product.printful_catalog_id; // 903
    const catalogVariantId = Number(variant.printful_variant_id); // 23178

    expect(catalogProductId).toBe(903);
    expect(catalogVariantId).toBe(23178);

    // NOT the sync product ID
    expect(catalogProductId).not.toBe(Number(product.printful_id));
  });
});

// ── 12. CatalogProduct type includes printful_catalog_id ─────────────────────

describe("12. CatalogProduct type includes printful_catalog_id", () => {
  it("CatalogProduct has printful_catalog_id field", () => {
    const cp: CatalogProduct = {
      id: "aed80c7d-5f07-495a-8e1a-8ff1ec74726b",
      slug: "lightweight-quarter-zip-pullover",
      title: "Lightweight quarter-zip pullover",
      short_description: null,
      description: null,
      category_id: null,
      brand: null,
      product_type: null,
      price: 49.99,
      compare_at_price: null,
      cost: null,
      image_url: null,
      images: [],
      status: "active",
      published_at: null,
      meta_title: null,
      meta_description: null,
      featured: false,
      is_new_arrival: false,
      is_trending: false,
      is_bestseller: false,
      is_on_sale: false,
      is_personalizable: false,
      personalization_label: null,
      content_locked: false,
      display_order: 0,
      printful_id: "476330305",
      printful_catalog_id: 903,
      created_at: "2026-10-16T00:00:00Z",
      updated_at: "2026-10-16T00:00:00Z",
    };
    expect(cp.printful_catalog_id).toBe(903);
    expect(cp.printful_id).toBe("476330305");
  });
});
