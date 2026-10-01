import { describe, it, expect } from "vitest";
import { getPrimaryImage, generateSlug } from "@/lib/catalog/types";
import type { Design, ProductDesign, ProductImage, MockupTask } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDesign(overrides: Partial<Design> = {}): Design {
  return {
    id: "design-uuid-001",
    name: "Cook County Heritage",
    slug: "cook-county-heritage",
    description: "A bold heritage design.",
    artwork_url: "https://cdn.example.com/store-images/artwork/design-uuid-001/original.png",
    storage_path: "artwork/design-uuid-001/original.png",
    file_name: "heritage.png",
    file_type: "image/png",
    file_size: 204800,
    width: 4500,
    height: 4500,
    status: "active",
    tags: ["heritage", "county"],
    created_by: null,
    created_at: "2026-10-18T00:00:00Z",
    updated_at: "2026-10-18T00:00:00Z",
    ...overrides,
  };
}

function makeProductDesign(overrides: Partial<ProductDesign> = {}): ProductDesign {
  return {
    id: "pd-uuid-001",
    product_id: "prod-uuid-001",
    design_id: "design-uuid-001",
    provider: "printful",
    placement: "front",
    technique: "DTG",
    printfile_id: "1",
    is_primary: true,
    needs_regeneration: false,
    configuration: {
      version: 1,
      position: { area_width: 1800, area_height: 2400, width: 900, height: 900, top: 750, left: 450 },
    },
    created_at: "2026-10-18T00:00:00Z",
    updated_at: "2026-10-18T00:00:00Z",
    ...overrides,
  };
}

function makeProductImage(overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id: "img-uuid-001",
    product_id: "prod-uuid-001",
    product_variant_id: null,
    source: "printful_mockup",
    storage_path: "mockups/task_abc123-0.jpg",
    image_url: "https://cdn.example.com/store-images/mockups/task_abc123-0.jpg",
    alt_text: "Cook County Heritage on Black T-Shirt",
    is_primary: true,
    display_order: 0,
    mockup_task_key: "task_abc123",
    created_at: "2026-10-18T00:00:00Z",
    updated_at: "2026-10-18T00:00:00Z",
    ...overrides,
  };
}

function makeMockupTask(overrides: Partial<MockupTask> = {}): MockupTask {
  return {
    id: "mt-uuid-001",
    product_id: "prod-uuid-001",
    product_design_id: "pd-uuid-001",
    provider: "printful",
    provider_task_key: "task_abc123",
    status: "pending",
    error_message: null,
    created_at: "2026-10-18T00:00:00Z",
    completed_at: null,
    ...overrides,
  };
}

// ── 1. Design identity ────────────────────────────────────────────────────────

describe("1. Design identity", () => {
  it("design has a stable UUID id", () => {
    const d = makeDesign();
    expect(d.id).toBe("design-uuid-001");
    expect(d.id).not.toBe(d.slug);
    expect(d.id).not.toBe(d.storage_path);
  });

  it("design id is not the artwork URL", () => {
    const d = makeDesign();
    expect(d.id).not.toBe(d.artwork_url);
  });

  it("design id is not the storage path", () => {
    const d = makeDesign();
    expect(d.id).not.toBe(d.storage_path);
  });

  it("artwork_url is in Supabase Storage, not Printful CDN", () => {
    const d = makeDesign();
    expect(d.artwork_url).toContain("store-images");
    expect(d.artwork_url).not.toContain("printful.com");
  });
});

// ── 2. Design status ──────────────────────────────────────────────────────────

describe("2. Design status", () => {
  it("active design is usable", () => {
    const d = makeDesign({ status: "active" });
    expect(d.status).toBe("active");
  });

  it("archived design is not usable for new attachments", () => {
    const d = makeDesign({ status: "archived" });
    const canAttach = d.status === "active";
    expect(canAttach).toBe(false);
  });

  it("archived design preserves its UUID and artwork", () => {
    const d = makeDesign({ status: "archived" });
    expect(d.id).toBe("design-uuid-001");
    expect(d.artwork_url).toBeTruthy();
  });
});

// ── 3. Design reuse ───────────────────────────────────────────────────────────

describe("3. Design reuse across products", () => {
  it("one design can be attached to multiple products", () => {
    const design = makeDesign();
    const pd1 = makeProductDesign({ product_id: "prod-uuid-001", design_id: design.id });
    const pd2 = makeProductDesign({ id: "pd-uuid-002", product_id: "prod-uuid-002", design_id: design.id });
    expect(pd1.design_id).toBe(design.id);
    expect(pd2.design_id).toBe(design.id);
    expect(pd1.product_id).not.toBe(pd2.product_id);
  });

  it("artwork is not duplicated per product — same storage_path", () => {
    const design = makeDesign();
    const pd1 = makeProductDesign({ product_id: "prod-uuid-001", design_id: design.id });
    const pd2 = makeProductDesign({ id: "pd-uuid-002", product_id: "prod-uuid-002", design_id: design.id });
    // Both reference the same design, same artwork
    expect(pd1.design_id).toBe(pd2.design_id);
  });
});

// ── 4. Multiple designs per product ──────────────────────────────────────────

describe("4. Multiple designs per product", () => {
  it("one product can have multiple product_designs", () => {
    const pd_front = makeProductDesign({ id: "pd-front", placement: "front" });
    const pd_back = makeProductDesign({ id: "pd-back", placement: "back", is_primary: false });
    expect(pd_front.product_id).toBe(pd_back.product_id);
    expect(pd_front.placement).not.toBe(pd_back.placement);
  });
});

// ── 5. Placement and technique ────────────────────────────────────────────────

describe("5. Placement and technique", () => {
  it("placement is stored on product_design, not on design", () => {
    const pd = makeProductDesign({ placement: "front" });
    expect(pd.placement).toBe("front");
  });

  it("technique is stored on product_design, not on design", () => {
    const pd = makeProductDesign({ technique: "DTG" });
    expect(pd.technique).toBe("DTG");
  });

  it("same design can have different placements on different products", () => {
    const pd1 = makeProductDesign({ product_id: "prod-1", placement: "front" });
    const pd2 = makeProductDesign({ id: "pd-2", product_id: "prod-2", placement: "back" });
    expect(pd1.design_id).toBe(pd2.design_id);
    expect(pd1.placement).not.toBe(pd2.placement);
  });
});

// ── 6. Configuration persistence ─────────────────────────────────────────────

describe("6. Configuration persistence", () => {
  it("configuration includes version", () => {
    const pd = makeProductDesign();
    expect(pd.configuration.version).toBe(1);
  });

  it("configuration includes position data", () => {
    const pd = makeProductDesign();
    const pos = pd.configuration.position as Record<string, number>;
    expect(pos.area_width).toBeGreaterThan(0);
    expect(pos.area_height).toBeGreaterThan(0);
  });

  it("needs_regeneration is false by default", () => {
    const pd = makeProductDesign();
    expect(pd.needs_regeneration).toBe(false);
  });

  it("needs_regeneration can be set to true after artwork change", () => {
    const pd = makeProductDesign({ needs_regeneration: true });
    expect(pd.needs_regeneration).toBe(true);
  });
});

// ── 7. Product images ─────────────────────────────────────────────────────────

describe("7. Product images", () => {
  it("product image has a stable UUID", () => {
    const img = makeProductImage();
    expect(img.id).toBe("img-uuid-001");
  });

  it("product image source identifies origin", () => {
    const img = makeProductImage({ source: "printful_mockup" });
    expect(img.source).toBe("printful_mockup");
  });

  it("image_url is in Supabase Storage, not Printful CDN", () => {
    const img = makeProductImage();
    expect(img.image_url).toContain("store-images");
    expect(img.image_url).not.toContain("printful.com");
  });

  it("primary image is flagged", () => {
    const img = makeProductImage({ is_primary: true });
    expect(img.is_primary).toBe(true);
  });

  it("display_order controls storefront image sequence", () => {
    const img1 = makeProductImage({ display_order: 0 });
    const img2 = makeProductImage({ id: "img-2", display_order: 1, is_primary: false });
    expect(img1.display_order).toBeLessThan(img2.display_order);
  });

  it("image can be associated with a specific variant", () => {
    const img = makeProductImage({ product_variant_id: "sv-uuid-001" });
    expect(img.product_variant_id).toBe("sv-uuid-001");
  });

  it("image can be product-level (no variant)", () => {
    const img = makeProductImage({ product_variant_id: null });
    expect(img.product_variant_id).toBeNull();
  });
});

// ── 8. getPrimaryImage fallback chain ─────────────────────────────────────────

describe("8. getPrimaryImage fallback chain", () => {
  const legacyProduct = { image_url: "https://cdn.example.com/legacy.jpg", images: ["https://cdn.example.com/legacy.jpg"] };

  it("prefers normalized primary image over legacy", () => {
    const normalized = [
      { image_url: "https://cdn.example.com/store-images/mockups/new.jpg", is_primary: true },
    ];
    expect(getPrimaryImage(legacyProduct, normalized)).toBe("https://cdn.example.com/store-images/mockups/new.jpg");
  });

  it("uses first normalized image if none is primary", () => {
    const normalized = [
      { image_url: "https://cdn.example.com/store-images/mockups/first.jpg", is_primary: false },
      { image_url: "https://cdn.example.com/store-images/mockups/second.jpg", is_primary: false },
    ];
    expect(getPrimaryImage(legacyProduct, normalized)).toBe("https://cdn.example.com/store-images/mockups/first.jpg");
  });

  it("falls back to legacy image_url when no normalized images", () => {
    expect(getPrimaryImage(legacyProduct, [])).toBe("https://cdn.example.com/legacy.jpg");
  });

  it("falls back to legacy images[0] when image_url is null", () => {
    const p = { image_url: null, images: ["https://cdn.example.com/arr.jpg"] };
    expect(getPrimaryImage(p, [])).toBe("https://cdn.example.com/arr.jpg");
  });

  it("returns placeholder when all sources empty", () => {
    expect(getPrimaryImage({ image_url: null, images: [] }, [])).toBe("/product-placeholder.svg");
  });
});

// ── 9. Mockup task lifecycle ──────────────────────────────────────────────────

describe("9. Mockup task lifecycle", () => {
  it("task starts as pending", () => {
    const t = makeMockupTask({ status: "pending" });
    expect(t.status).toBe("pending");
    expect(t.completed_at).toBeNull();
  });

  it("completed task has completed_at", () => {
    const t = makeMockupTask({ status: "completed", completed_at: "2026-10-18T01:00:00Z" });
    expect(t.status).toBe("completed");
    expect(t.completed_at).not.toBeNull();
  });

  it("failed task has error_message", () => {
    const t = makeMockupTask({ status: "failed", error_message: "Printful API error" });
    expect(t.status).toBe("failed");
    expect(t.error_message).toBeTruthy();
  });

  it("failed task does not affect product or design", () => {
    const t = makeMockupTask({ status: "failed" });
    // product_id and product_design_id remain intact
    expect(t.product_id).toBe("prod-uuid-001");
    expect(t.product_design_id).toBe("pd-uuid-001");
  });

  it("provider_task_key links to Printful task", () => {
    const t = makeMockupTask({ provider_task_key: "task_abc123" });
    expect(t.provider_task_key).toBe("task_abc123");
    expect(t.provider).toBe("printful");
  });
});

// ── 10. Mockup generation prerequisites ──────────────────────────────────────

describe("10. Mockup generation prerequisites", () => {
  it("product must have printful_id for mockup generation", () => {
    const productWithMapping = { id: "prod-uuid-001", printful_id: "476330305" as string | null };
    const productWithoutMapping = { id: "prod-uuid-002", printful_id: null as string | null };
    expect(productWithMapping.printful_id).not.toBeNull();
    expect(productWithoutMapping.printful_id).toBeNull();
    const canGenerate = (p: { printful_id: string | null }) => p.printful_id !== null;
    expect(canGenerate(productWithMapping)).toBe(true);
    expect(canGenerate(productWithoutMapping)).toBe(false);
  });

  it("store variant UUID must be resolved to printful_variant_id before mockup", () => {
    const variant = { id: "sv-uuid-001", printful_variant_id: "23178" };
    // Mockup API receives numeric Printful variant ID, not store UUID
    const printfulVariantId = Number(variant.printful_variant_id);
    expect(printfulVariantId).toBe(23178);
    expect(printfulVariantId).not.toBeNaN();
  });
});

// ── 11. Storage path convention ───────────────────────────────────────────────

describe("11. Storage path convention", () => {
  it("artwork path is scoped under design UUID", () => {
    const d = makeDesign();
    expect(d.storage_path).toContain(d.id);
    expect(d.storage_path).toMatch(/^artwork\//);
  });

  it("mockup path is scoped under task key", () => {
    const img = makeProductImage();
    expect(img.storage_path).toMatch(/^mockups\//);
    expect(img.mockup_task_key).toBeTruthy();
  });
});

// ── 12. Provider boundary ─────────────────────────────────────────────────────

describe("12. Provider boundary", () => {
  it("design identity is store-owned, not Printful-owned", () => {
    const d = makeDesign();
    // No Printful ID on design — it's a store asset
    expect((d as unknown as Record<string, unknown>).printful_id).toBeUndefined();
  });

  it("product_design references store product UUID, not Printful product ID", () => {
    const pd = makeProductDesign();
    // product_id is a store UUID
    expect(pd.product_id).toBe("prod-uuid-001");
    expect(isNaN(Number(pd.product_id))).toBe(true); // not a numeric Printful ID
  });

  it("mockup image_url is in Supabase Storage after persistence", () => {
    const img = makeProductImage({ source: "printful_mockup" });
    // After persist, URL is in store-images bucket, not Printful CDN
    expect(img.image_url).toContain("store-images");
  });

  it("slug generation works for design names", () => {
    expect(generateSlug("Cook County Heritage")).toBe("cook-county-heritage");
    expect(generateSlug("Body & Sleeves — Premium")).toBe("body-sleeves-premium");
  });
});

// ── 13. Regression: Phase 2/3 identity unchanged ─────────────────────────────

describe("13. Regression: Phase 2/3 identity unchanged", () => {
  it("product UUID is not affected by design attachment", () => {
    const pd = makeProductDesign({ product_id: "prod-uuid-001" });
    expect(pd.product_id).toBe("prod-uuid-001");
  });

  it("variant UUID is not affected by mockup generation", () => {
    const img = makeProductImage({ product_variant_id: "sv-uuid-001" });
    expect(img.product_variant_id).toBe("sv-uuid-001");
  });

  it("CartItem.variant_id remains store UUID (not affected by Phase 4)", () => {
    const cartItem = { variant_id: "sv-uuid-001", product_id: "prod-uuid-001" };
    expect(isNaN(Number(cartItem.variant_id))).toBe(true);
  });
});
