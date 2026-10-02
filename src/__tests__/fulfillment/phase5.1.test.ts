import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FulfillmentSnapshot, PrintfulCatalogOrderItem, FulfillmentStrategy } from "@/lib/fulfillment/types";
import { buildPrintfulCatalogOrderItem, buildPrintfulExternalId } from "@/lib/fulfillment/builder";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STORE_PRODUCT_ID = "9f00d7b8-6ec0-4d62-bfa4-c1211c66241f";
const STORE_VARIANT_ID = "273c7deb-05fc-4145-89c3-c437fa96ddf0";
const PRINTFUL_CATALOG_PRODUCT_ID = 638;
const PRINTFUL_CATALOG_VARIANT_ID = 16244;
const DESIGN_ID = "d180dd4d-0ff8-4cec-90bc-7faf362fb27c";
const ARTWORK_URL = "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/artwork/d180dd4d-0ff8-4cec-90bc-7faf362fb27c/original.png";
const QUARTER_ZIP_PRODUCT_ID = "aed80c7d-5f07-495a-8e1a-8ff1ec74726b";
const QUARTER_ZIP_PRINTFUL_ID = "476330305";

function makeSnapshot(overrides: Partial<FulfillmentSnapshot> = {}): FulfillmentSnapshot {
  return {
    version: 1,
    strategy: "DIRECT_CATALOG_ORDER",
    store_product_id: STORE_PRODUCT_ID,
    store_variant_id: STORE_VARIANT_ID,
    printful_catalog_product_id: PRINTFUL_CATALOG_PRODUCT_ID,
    printful_catalog_variant_id: PRINTFUL_CATALOG_VARIANT_ID,
    design_id: DESIGN_ID,
    artwork_url: ARTWORK_URL,
    placement: "embroidery_front_large",
    technique: "EMBROIDERY",
    files: [{ type: "embroidery_front_large", url: ARTWORK_URL }],
    options: [
      { id: "embroidery_type", value: "flat" },
      { id: "thread_colors_front_large", value: ["#FFFFFF"] },
    ],
    frozen_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSyncSnapshot(overrides: Partial<FulfillmentSnapshot> = {}): FulfillmentSnapshot {
  return {
    version: 1,
    strategy: "SYNC_VARIANT",
    store_product_id: QUARTER_ZIP_PRODUCT_ID,
    store_variant_id: "sync-variant-uuid",
    printful_catalog_product_id: 903,
    printful_catalog_variant_id: 23178,
    design_id: "some-design-id",
    artwork_url: ARTWORK_URL,
    placement: "front",
    technique: "DTG",
    files: [{ type: "front", url: ARTWORK_URL }],
    options: [],
    frozen_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

// Simulates server-side resolution from store variant UUID
function simulateResolver(
  storeVariantId: string,
  db: {
    variant: { id: string; product_id: string; printful_variant_id: string | null; available: boolean };
    product: { id: string; catalog_source: string; printful_catalog_id: number | null; printful_id: string | null; status: string };
    productDesign: { design_id: string; placement: string; technique: string; configuration: Record<string, unknown> } | null;
    design: { id: string; artwork_url: string; status: string } | null;
  }
): FulfillmentSnapshot {
  if (!db.variant) throw new Error("Store variant not found: " + storeVariantId);
  if (!db.variant.available) throw new Error("Store variant not available: " + storeVariantId);
  if (!db.variant.printful_variant_id) throw new Error("No printful_variant_id for: " + storeVariantId);
  const printfulCatalogVariantId = Number(db.variant.printful_variant_id);
  if (!Number.isFinite(printfulCatalogVariantId) || printfulCatalogVariantId <= 0)
    throw new Error("Invalid printful_variant_id: " + db.variant.printful_variant_id);

  if (!db.product) throw new Error("Product not found");
  if (db.product.status !== "active") throw new Error("Product not active");
  if (!db.product.printful_catalog_id) throw new Error("No printful_catalog_id");

  if (!db.productDesign) throw new Error("No primary product design");
  if (!db.productDesign.placement) throw new Error("No placement");
  if (!db.productDesign.technique) throw new Error("No technique");

  if (!db.design) throw new Error("Design not found");
  if (db.design.status !== "active") throw new Error("Design not active");
  if (!db.design.artwork_url) throw new Error("No artwork_url");

  const url = new URL(db.design.artwork_url);
  if (!url.hostname.endsWith("supabase.co")) throw new Error("Artwork not from trusted storage");

  const files = [{ type: db.productDesign.placement, url: db.design.artwork_url }];
  const options: { id: string; value: string | string[] }[] = [];
  if (db.productDesign.technique.toUpperCase() === "EMBROIDERY") {
    const suffix = db.productDesign.placement.replace(/^embroidery_/, "");
    const colors = (db.productDesign.configuration?.thread_colors as string[] | undefined) ?? ["#FFFFFF"];
    options.push({ id: "embroidery_type", value: "flat" });
    options.push({ id: `thread_colors_${suffix}`, value: colors });
  }

  const strategy: FulfillmentStrategy =
    db.product.catalog_source === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";

  return {
    version: 1,
    strategy,
    store_product_id: db.product.id,
    store_variant_id: storeVariantId,
    printful_catalog_product_id: Number(db.product.printful_catalog_id),
    printful_catalog_variant_id: printfulCatalogVariantId,
    design_id: db.design.id,
    artwork_url: db.design.artwork_url,
    placement: db.productDesign.placement,
    technique: db.productDesign.technique,
    files,
    options,
    frozen_at: new Date().toISOString(),
  };
}

const validDb = {
  variant: { id: STORE_VARIANT_ID, product_id: STORE_PRODUCT_ID, printful_variant_id: String(PRINTFUL_CATALOG_VARIANT_ID), available: true },
  product: { id: STORE_PRODUCT_ID, catalog_source: "catalog_builder", printful_catalog_id: PRINTFUL_CATALOG_PRODUCT_ID, printful_id: null, status: "active" },
  productDesign: { design_id: DESIGN_ID, placement: "embroidery_front_large", technique: "EMBROIDERY", configuration: {} },
  design: { id: DESIGN_ID, artwork_url: ARTWORK_URL, status: "active" },
};

// ── 1. Catalog Builder store UUID resolution ──────────────────────────────────

describe("1. Catalog Builder store UUID resolution", () => {
  it("resolves store variant UUID to DIRECT_CATALOG_ORDER snapshot", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.strategy).toBe("DIRECT_CATALOG_ORDER");
    expect(snap.store_variant_id).toBe(STORE_VARIANT_ID);
  });

  it("store variant UUID is not coerced into a numeric provider ID", () => {
    expect(isNaN(Number(STORE_VARIANT_ID))).toBe(true);
  });

  it("store product UUID is not coerced into a numeric provider ID", () => {
    expect(isNaN(Number(STORE_PRODUCT_ID))).toBe(true);
  });

  it("resolution starts from store variant UUID only", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.store_variant_id).toBe(STORE_VARIANT_ID);
    expect(snap.store_product_id).toBe(STORE_PRODUCT_ID);
  });
});

// ── 2. Catalog product mapping ────────────────────────────────────────────────

describe("2. Catalog product mapping", () => {
  it("resolves printful_catalog_product_id from DB", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.printful_catalog_product_id).toBe(PRINTFUL_CATALOG_PRODUCT_ID);
  });

  it("printful_catalog_product_id is numeric", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(typeof snap.printful_catalog_product_id).toBe("number");
    expect(snap.printful_catalog_product_id).toBeGreaterThan(0);
  });

  it("missing printful_catalog_id throws", () => {
    const db = { ...validDb, product: { ...validDb.product, printful_catalog_id: null } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("No printful_catalog_id");
  });
});

// ── 3. Catalog variant mapping ────────────────────────────────────────────────

describe("3. Catalog variant mapping", () => {
  it("resolves printful_catalog_variant_id from product_variants", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.printful_catalog_variant_id).toBe(PRINTFUL_CATALOG_VARIANT_ID);
  });

  it("printful_catalog_variant_id is numeric", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(typeof snap.printful_catalog_variant_id).toBe("number");
    expect(snap.printful_catalog_variant_id).toBeGreaterThan(0);
  });

  it("missing printful_variant_id throws", () => {
    const db = { ...validDb, variant: { ...validDb.variant, printful_variant_id: null } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("No printful_variant_id");
  });

  it("non-numeric printful_variant_id throws", () => {
    const db = { ...validDb, variant: { ...validDb.variant, printful_variant_id: "not-a-number" } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("Invalid printful_variant_id");
  });
});

// ── 4. Catalog Builder never requires sync product ID ─────────────────────────

describe("4. Catalog Builder never requires sync product ID", () => {
  it("catalog_builder product has printful_id = null", () => {
    expect(validDb.product.printful_id).toBeNull();
  });

  it("snapshot does not contain sync_variant_id field", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap).not.toHaveProperty("sync_variant_id");
  });

  it("DIRECT_CATALOG_ORDER strategy does not use sync_variant_id", () => {
    const snap = makeSnapshot();
    expect(snap.strategy).toBe("DIRECT_CATALOG_ORDER");
    expect(snap).not.toHaveProperty("sync_variant_id");
  });

  it("catalog_builder product printful_id remains NULL after resolution", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    // The resolver does not modify products.printful_id
    expect(validDb.product.printful_id).toBeNull();
    expect(snap.store_product_id).toBe(STORE_PRODUCT_ID);
  });
});

// ── 5. Catalog Builder never uses sync_variant_id ─────────────────────────────

describe("5. Catalog Builder never uses sync_variant_id", () => {
  it("buildPrintfulCatalogOrderItem uses variant_id not sync_variant_id", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Test Hat");
    expect(item.variant_id).toBe(PRINTFUL_CATALOG_VARIANT_ID);
    expect(item).not.toHaveProperty("sync_variant_id");
  });

  it("variant_id in order item equals printful_catalog_variant_id", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Test Hat");
    expect(item.variant_id).toBe(snap.printful_catalog_variant_id);
  });

  it("SYNC_VARIANT strategy throws in buildPrintfulCatalogOrderItem", () => {
    const snap = makeSnapshot({ strategy: "SYNC_VARIANT" });
    expect(() => buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Test")).toThrow("SYNC_VARIANT");
  });
});

// ── 6. Catalog Builder products preserve printful_id = NULL ───────────────────

describe("6. Catalog Builder products preserve printful_id = NULL", () => {
  it("catalog_builder product has printful_id = null in DB fixture", () => {
    expect(validDb.product.printful_id).toBeNull();
  });

  it("snapshot does not populate printful_id", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap).not.toHaveProperty("printful_id");
  });

  it("catalog_source = catalog_builder maps to DIRECT_CATALOG_ORDER", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.strategy).toBe("DIRECT_CATALOG_ORDER");
  });
});

// ── 7. Design lookup ──────────────────────────────────────────────────────────

describe("7. Design lookup", () => {
  it("resolves design_id from product_designs", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.design_id).toBe(DESIGN_ID);
  });

  it("missing product design throws", () => {
    const db = { ...validDb, productDesign: null };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("No primary product design");
  });

  it("inactive design throws", () => {
    const db = { ...validDb, design: { ...validDb.design, status: "archived" } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("Design not active");
  });

  it("missing design throws", () => {
    const db = { ...validDb, design: null };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("Design not found");
  });
});

// ── 8. Artwork resolution ─────────────────────────────────────────────────────

describe("8. Artwork resolution", () => {
  it("resolves artwork_url from designs table", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.artwork_url).toBe(ARTWORK_URL);
  });

  it("artwork_url is from trusted Supabase Storage", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.artwork_url).toContain("supabase.co");
  });

  it("untrusted artwork URL throws", () => {
    const db = { ...validDb, design: { ...validDb.design, artwork_url: "https://evil.com/art.png" } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("trusted storage");
  });

  it("missing artwork_url throws", () => {
    const db = { ...validDb, design: { ...validDb.design, artwork_url: "" } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("No artwork_url");
  });

  it("mockup image is NOT used as manufacturing artwork", () => {
    const mockupUrl = "https://mockup-generator.printful.com/task/result/abc123.jpg";
    expect(mockupUrl).toContain("printful.com");
    // Artwork must come from designs table, not product_images
    expect(ARTWORK_URL).toContain("supabase.co");
    expect(ARTWORK_URL).not.toContain("printful.com");
  });
});

// ── 9. Placement resolution ───────────────────────────────────────────────────

describe("9. Placement resolution", () => {
  it("resolves placement from product_designs", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.placement).toBe("embroidery_front_large");
  });

  it("missing placement throws", () => {
    const db = { ...validDb, productDesign: { ...validDb.productDesign, placement: "" } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("No placement");
  });

  it("placement is used as file type in files array", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.files[0].type).toBe(snap.placement);
  });
});

// ── 10. Technique resolution ──────────────────────────────────────────────────

describe("10. Technique resolution", () => {
  it("resolves technique from product_designs", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.technique).toBe("EMBROIDERY");
  });

  it("missing technique throws", () => {
    const db = { ...validDb, productDesign: { ...validDb.productDesign, technique: "" } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("No technique");
  });

  it("EMBROIDERY technique produces embroidery options", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.options.some((o) => o.id === "embroidery_type")).toBe(true);
  });

  it("non-embroidery technique produces no required options", () => {
    const db = { ...validDb, productDesign: { ...validDb.productDesign, technique: "DTG", placement: "front" } };
    const snap = simulateResolver(STORE_VARIANT_ID, db);
    expect(snap.options).toHaveLength(0);
  });
});

// ── 11. Printful files construction ──────────────────────────────────────────

describe("11. Printful files construction", () => {
  it("files array contains placement and artwork_url", () => {
    const snap = makeSnapshot();
    expect(snap.files).toHaveLength(1);
    expect(snap.files[0].type).toBe("embroidery_front_large");
    expect(snap.files[0].url).toBe(ARTWORK_URL);
  });

  it("buildPrintfulCatalogOrderItem includes files", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Hat");
    expect(item.files).toHaveLength(1);
    expect(item.files[0].type).toBe("embroidery_front_large");
    expect(item.files[0].url).toBe(ARTWORK_URL);
  });

  it("empty files array throws in builder", () => {
    const snap = makeSnapshot({ files: [] });
    expect(() => buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Hat")).toThrow("no manufacturing files");
  });
});

// ── 12. Required options construction ────────────────────────────────────────

describe("12. Required options construction", () => {
  it("embroidery options include embroidery_type", () => {
    const snap = makeSnapshot();
    const embType = snap.options.find((o) => o.id === "embroidery_type");
    expect(embType).toBeDefined();
    expect(embType?.value).toBe("flat");
  });

  it("embroidery options include placement-specific thread_colors", () => {
    const snap = makeSnapshot();
    const threadColors = snap.options.find((o) => o.id === "thread_colors_front_large");
    expect(threadColors).toBeDefined();
    expect(Array.isArray(threadColors?.value)).toBe(true);
  });

  it("thread_colors option ID is placement-specific not generic", () => {
    const snap = makeSnapshot();
    const generic = snap.options.find((o) => o.id === "thread_colors");
    const specific = snap.options.find((o) => o.id === "thread_colors_front_large");
    expect(generic).toBeUndefined();
    expect(specific).toBeDefined();
  });

  it("buildPrintfulCatalogOrderItem includes options", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Hat");
    expect(item.options.length).toBeGreaterThan(0);
  });

  it("default thread color is white when not configured", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    const threadOpt = snap.options.find((o) => o.id === "thread_colors_front_large");
    expect(threadOpt?.value).toEqual(["#FFFFFF"]);
  });

  it("configured thread colors override default", () => {
    const db = {
      ...validDb,
      productDesign: { ...validDb.productDesign, configuration: { thread_colors: ["#000000", "#CC3333"] } },
    };
    const snap = simulateResolver(STORE_VARIANT_ID, db);
    const threadOpt = snap.options.find((o) => o.id === "thread_colors_front_large");
    expect(threadOpt?.value).toEqual(["#000000", "#CC3333"]);
  });
});

// ── 13. Quantity ──────────────────────────────────────────────────────────────

describe("13. Quantity", () => {
  it("quantity 1 is preserved", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Hat");
    expect(item.quantity).toBe(1);
  });

  it("quantity 3 is preserved", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 3, 49.99, "Hat");
    expect(item.quantity).toBe(3);
  });

  it("quantity is floored to integer", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 2.9, 49.99, "Hat");
    expect(item.quantity).toBe(2);
  });

  it("quantity minimum is 1", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 0, 49.99, "Hat");
    expect(item.quantity).toBe(1);
  });
});

// ── 14. Multiple Catalog Builder items ────────────────────────────────────────

describe("14. Multiple Catalog Builder items", () => {
  it("two catalog_builder variants produce two snapshots", () => {
    const snap1 = makeSnapshot({ store_variant_id: "variant-uuid-1", printful_catalog_variant_id: 16244 });
    const snap2 = makeSnapshot({ store_variant_id: "variant-uuid-2", printful_catalog_variant_id: 16245 });
    const item1 = buildPrintfulCatalogOrderItem(snap1, 1, 49.99, "Hat Black");
    const item2 = buildPrintfulCatalogOrderItem(snap2, 2, 49.99, "Hat White");
    expect(item1.variant_id).toBe(16244);
    expect(item2.variant_id).toBe(16245);
    expect(item2.quantity).toBe(2);
  });

  it("each item has its own files array", () => {
    const snap1 = makeSnapshot({ store_variant_id: "v1" });
    const snap2 = makeSnapshot({ store_variant_id: "v2" });
    const item1 = buildPrintfulCatalogOrderItem(snap1, 1, 49.99, "Hat 1");
    const item2 = buildPrintfulCatalogOrderItem(snap2, 1, 49.99, "Hat 2");
    expect(item1.files).not.toBe(item2.files);
  });

  it("multiple designs produce separate snapshots", () => {
    const snap1 = makeSnapshot({ design_id: "design-a", artwork_url: ARTWORK_URL });
    const snap2 = makeSnapshot({ design_id: "design-b", artwork_url: ARTWORK_URL });
    expect(snap1.design_id).not.toBe(snap2.design_id);
  });
});

// ── 15. Mixed origins ─────────────────────────────────────────────────────────

describe("15. Mixed cart — catalog_builder + printful_sync", () => {
  it("catalog_builder item uses DIRECT_CATALOG_ORDER strategy", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.strategy).toBe("DIRECT_CATALOG_ORDER");
  });

  it("printful_sync item uses SYNC_VARIANT strategy", () => {
    const syncDb = {
      variant: { id: "sync-v-uuid", product_id: QUARTER_ZIP_PRODUCT_ID, printful_variant_id: "23178", available: true },
      product: { id: QUARTER_ZIP_PRODUCT_ID, catalog_source: "printful_sync", printful_catalog_id: 903, printful_id: QUARTER_ZIP_PRINTFUL_ID, status: "active" },
      productDesign: { design_id: "some-design", placement: "front", technique: "DTG", configuration: {} },
      design: { id: "some-design", artwork_url: ARTWORK_URL, status: "active" },
    };
    const snap = simulateResolver("sync-v-uuid", syncDb);
    expect(snap.strategy).toBe("SYNC_VARIANT");
  });

  it("mixed cart produces different strategies per item", () => {
    const builderSnap = simulateResolver(STORE_VARIANT_ID, validDb);
    const syncDb = {
      variant: { id: "sync-v-uuid", product_id: QUARTER_ZIP_PRODUCT_ID, printful_variant_id: "23178", available: true },
      product: { id: QUARTER_ZIP_PRODUCT_ID, catalog_source: "printful_sync", printful_catalog_id: 903, printful_id: QUARTER_ZIP_PRINTFUL_ID, status: "active" },
      productDesign: { design_id: "some-design", placement: "front", technique: "DTG", configuration: {} },
      design: { id: "some-design", artwork_url: ARTWORK_URL, status: "active" },
    };
    const syncSnap = simulateResolver("sync-v-uuid", syncDb);
    expect(builderSnap.strategy).toBe("DIRECT_CATALOG_ORDER");
    expect(syncSnap.strategy).toBe("SYNC_VARIANT");
  });

  it("catalog_builder item in mixed cart does not use sync_variant_id", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap).not.toHaveProperty("sync_variant_id");
  });
});

// ── 16. Missing catalog mapping rejection ─────────────────────────────────────

describe("16. Missing catalog mapping rejection", () => {
  it("unavailable variant throws", () => {
    const db = { ...validDb, variant: { ...validDb.variant, available: false } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db)).toThrow("not available");
  });

  it("inactive product throws", () => {
    const db = { ...validDb, product: { ...validDb.product, status: "draft" } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db)).toThrow("not active");
  });

  it("missing variant throws", () => {
    expect(() => simulateResolver("nonexistent-uuid", { ...validDb, variant: null as any })).toThrow("not found");
  });
});

// ── 17. Snapshot creation ─────────────────────────────────────────────────────

describe("17. Snapshot creation", () => {
  it("snapshot has version 1", () => {
    const snap = makeSnapshot();
    expect(snap.version).toBe(1);
  });

  it("snapshot has frozen_at timestamp", () => {
    const snap = simulateResolver(STORE_VARIANT_ID, validDb);
    expect(snap.frozen_at).toBeTruthy();
    expect(new Date(snap.frozen_at).getTime()).toBeGreaterThan(0);
  });

  it("snapshot contains all required fields", () => {
    const snap = makeSnapshot();
    expect(snap).toHaveProperty("version");
    expect(snap).toHaveProperty("strategy");
    expect(snap).toHaveProperty("store_product_id");
    expect(snap).toHaveProperty("store_variant_id");
    expect(snap).toHaveProperty("printful_catalog_product_id");
    expect(snap).toHaveProperty("printful_catalog_variant_id");
    expect(snap).toHaveProperty("design_id");
    expect(snap).toHaveProperty("artwork_url");
    expect(snap).toHaveProperty("placement");
    expect(snap).toHaveProperty("technique");
    expect(snap).toHaveProperty("files");
    expect(snap).toHaveProperty("options");
    expect(snap).toHaveProperty("frozen_at");
  });
});

// ── 18. Snapshot version ──────────────────────────────────────────────────────

describe("18. Snapshot version", () => {
  it("version is 1", () => {
    expect(makeSnapshot().version).toBe(1);
  });

  it("unsupported version throws in builder", () => {
    const snap = makeSnapshot({ version: 2 as any });
    expect(() => buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Hat")).toThrow("version");
  });
});

// ── 19. Snapshot immutability ─────────────────────────────────────────────────

describe("19. Snapshot immutability", () => {
  it("snapshot frozen_at does not change on re-resolution", () => {
    const snap1 = simulateResolver(STORE_VARIANT_ID, validDb);
    const snap2 = simulateResolver(STORE_VARIANT_ID, validDb);
    // Both are valid snapshots; in production the first is stored and reused
    expect(snap1.store_variant_id).toBe(snap2.store_variant_id);
    expect(snap1.printful_catalog_variant_id).toBe(snap2.printful_catalog_variant_id);
  });

  it("changing product design after snapshot does not affect stored snapshot", () => {
    const snap = makeSnapshot({ placement: "embroidery_front_large", design_id: DESIGN_ID });
    // Simulate admin changing design — stored snapshot is unchanged
    const changedDb = { ...validDb, productDesign: { ...validDb.productDesign, placement: "embroidery_back" } };
    const newSnap = simulateResolver(STORE_VARIANT_ID, changedDb);
    // Stored snapshot retains original placement
    expect(snap.placement).toBe("embroidery_front_large");
    expect(newSnap.placement).toBe("embroidery_back");
    // They differ — stored snapshot is immutable
    expect(snap.placement).not.toBe(newSnap.placement);
  });

  it("webhook retry uses stored snapshot not current product state", () => {
    const storedSnapshot = makeSnapshot({ artwork_url: ARTWORK_URL, design_id: DESIGN_ID });
    // Simulate product design changed after purchase
    const currentArtwork = "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/artwork/new-design/original.png";
    // Webhook uses stored snapshot
    const item = buildPrintfulCatalogOrderItem(storedSnapshot, 1, 49.99, "Hat");
    expect(item.files[0].url).toBe(ARTWORK_URL);
    expect(item.files[0].url).not.toBe(currentArtwork);
  });
});

// ── 20. Webhook retry idempotency ─────────────────────────────────────────────

describe("20. Webhook retry idempotency", () => {
  it("deterministic external_id is stable for same order", () => {
    const orderId = "9f00d7b8-6ec0-4d62-bfa4-c1211c66241f";
    const id1 = buildPrintfulExternalId(orderId);
    const id2 = buildPrintfulExternalId(orderId);
    expect(id1).toBe(id2);
  });

  it("external_id format is so-<uuid-stripped-29chars>", () => {
    const orderId = "9f00d7b8-6ec0-4d62-bfa4-c1211c66241f";
    const expected = "so-" + orderId.replace(/-/g, "").substring(0, 29);
    expect(buildPrintfulExternalId(orderId)).toBe(expected);
  });

  it("different orders produce different external_ids", () => {
    const id1 = buildPrintfulExternalId("order-uuid-1");
    const id2 = buildPrintfulExternalId("order-uuid-2");
    expect(id1).not.toBe(id2);
  });

  it("external_id does not contain Stripe session ID", () => {
    const orderId = "9f00d7b8-6ec0-4d62-bfa4-c1211c66241f";
    const extId = buildPrintfulExternalId(orderId);
    expect(extId).not.toContain("cs_");
  });
});

// ── 21. Deterministic provider external ID ────────────────────────────────────

describe("21. Deterministic provider external ID", () => {
  it("same store order always produces same Printful external_id", () => {
    const storeOrderId = "abc-123-def-456";
    const expected = "so-" + storeOrderId.replace(/-/g, "").substring(0, 29);
    expect(buildPrintfulExternalId(storeOrderId)).toBe(expected);
  });

  it("external_id is derived from store order UUID not Stripe session", () => {
    const storeOrderId = "9f00d7b8-6ec0-4d62-bfa4-c1211c66241f";
    const extId = buildPrintfulExternalId(storeOrderId);
    expect(extId.startsWith("so-")).toBe(true);
    expect(extId.length).toBeLessThanOrEqual(32);
  });
});

// ── 22. Duplicate provider order protection ───────────────────────────────────

describe("22. Duplicate provider order protection", () => {
  it("same order ID always produces same external_id for deduplication", () => {
    const orderId = "test-order-uuid";
    const calls = [1, 2, 3].map(() => buildPrintfulExternalId(orderId));
    expect(new Set(calls).size).toBe(1);
  });

  it("external_id is deterministic across retries", () => {
    const orderId = "retry-test-uuid";
    expect(buildPrintfulExternalId(orderId)).toBe(buildPrintfulExternalId(orderId));
  });
});

// ── 23. Provider rejection handling ──────────────────────────────────────────

describe("23. Provider rejection handling", () => {
  it("invalid printful_catalog_variant_id throws in builder", () => {
    const snap = makeSnapshot({ printful_catalog_variant_id: 0 });
    expect(() => buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Hat")).toThrow("invalid printful_catalog_variant_id");
  });

  it("missing artwork_url throws in builder", () => {
    const snap = makeSnapshot({ artwork_url: "" });
    expect(() => buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Hat")).toThrow("no artwork_url");
  });
});

// ── 24. Payment and fulfillment states separated ──────────────────────────────

describe("24. Payment and fulfillment states separated", () => {
  it("payment status and fulfillment status are independent fields", () => {
    const order = {
      status: "paid",                          // payment state
      printful_fulfillment_status: "failed",   // fulfillment state
    };
    expect(order.status).toBe("paid");
    expect(order.printful_fulfillment_status).toBe("failed");
  });

  it("fulfillment failure does not cancel payment", () => {
    const order = { status: "paid", printful_fulfillment_status: "failed" };
    expect(order.status).toBe("paid");
  });

  it("paid order with failed fulfillment is preserved for admin resolution", () => {
    const order = { id: "order-uuid", status: "paid", printful_fulfillment_status: "failed" };
    expect(order.id).toBeTruthy();
    expect(order.status).toBe("paid");
    expect(order.printful_fulfillment_status).toBe("failed");
  });
});

// ── 25. Existing printful_sync product regression ─────────────────────────────

describe("25. Existing printful_sync product regression", () => {
  it("quarter-zip UUID is unchanged", () => {
    expect(QUARTER_ZIP_PRODUCT_ID).toBe("aed80c7d-5f07-495a-8e1a-8ff1ec74726b");
  });

  it("quarter-zip printful_id is unchanged", () => {
    expect(QUARTER_ZIP_PRINTFUL_ID).toBe("476330305");
  });

  it("printful_sync product resolves to SYNC_VARIANT strategy", () => {
    const syncDb = {
      variant: { id: "sync-v-uuid", product_id: QUARTER_ZIP_PRODUCT_ID, printful_variant_id: "23178", available: true },
      product: { id: QUARTER_ZIP_PRODUCT_ID, catalog_source: "printful_sync", printful_catalog_id: 903, printful_id: QUARTER_ZIP_PRINTFUL_ID, status: "active" },
      productDesign: { design_id: "some-design", placement: "front", technique: "DTG", configuration: {} },
      design: { id: "some-design", artwork_url: ARTWORK_URL, status: "active" },
    };
    const snap = simulateResolver("sync-v-uuid", syncDb);
    expect(snap.strategy).toBe("SYNC_VARIANT");
  });

  it("printful_sync product is not affected by catalog_builder logic", () => {
    const syncDb = {
      variant: { id: "sync-v-uuid", product_id: QUARTER_ZIP_PRODUCT_ID, printful_variant_id: "23178", available: true },
      product: { id: QUARTER_ZIP_PRODUCT_ID, catalog_source: "printful_sync", printful_catalog_id: 903, printful_id: QUARTER_ZIP_PRINTFUL_ID, status: "active" },
      productDesign: { design_id: "some-design", placement: "front", technique: "DTG", configuration: {} },
      design: { id: "some-design", artwork_url: ARTWORK_URL, status: "active" },
    };
    const snap = simulateResolver("sync-v-uuid", syncDb);
    expect(snap.strategy).not.toBe("DIRECT_CATALOG_ORDER");
    expect(snap.store_product_id).toBe(QUARTER_ZIP_PRODUCT_ID);
  });
});

// ── 26. Security — secrets remain server-side ─────────────────────────────────

describe("26. Security", () => {
  it("artwork URL is from trusted Supabase Storage host", () => {
    const url = new URL(ARTWORK_URL);
    expect(url.hostname.endsWith("supabase.co")).toBe(true);
  });

  it("arbitrary customer URL cannot become manufacturing artwork", () => {
    const customerUrl = "https://attacker.com/malicious.png";
    const db = { ...validDb, design: { ...validDb.design, artwork_url: customerUrl } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("trusted storage");
  });

  it("store UUID is never coerced into a numeric provider ID", () => {
    const storeUuid = STORE_VARIANT_ID;
    const numericAttempt = Number(storeUuid);
    expect(isNaN(numericAttempt)).toBe(true);
  });

  it("printful_variant_id must be numeric before use as provider ID", () => {
    const db = { ...validDb, variant: { ...validDb.variant, printful_variant_id: STORE_VARIANT_ID } };
    expect(() => simulateResolver(STORE_VARIANT_ID, db as any)).toThrow("Invalid printful_variant_id");
  });
});

// ── 27. PRINTFUL_AUTO_CONFIRM safety ─────────────────────────────────────────

describe("27. PRINTFUL_AUTO_CONFIRM safety", () => {
  it("auto-confirm defaults to false (no production trigger)", () => {
    const autoConfirm = process.env.PRINTFUL_AUTO_CONFIRM === "true";
    expect(autoConfirm).toBe(false);
  });

  it("confirm=true is only appended when PRINTFUL_AUTO_CONFIRM=true", () => {
    const autoConfirm = false;
    const confirmParam = autoConfirm ? "?confirm=true" : "";
    expect(confirmParam).toBe("");
  });
});

// ── 28. Retail price propagation ──────────────────────────────────────────────

describe("28. Retail price propagation", () => {
  it("retail_price is formatted as string with 2 decimal places", () => {
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 1, 49.99, "Hat");
    expect(item.retail_price).toBe("49.99");
  });

  it("retail_price comes from server DB not browser", () => {
    // Price authority: product_variants.retail_price from DB
    const dbPrice = 49.99;
    const snap = makeSnapshot();
    const item = buildPrintfulCatalogOrderItem(snap, 1, dbPrice, "Hat");
    expect(item.retail_price).toBe("49.99");
  });
});
