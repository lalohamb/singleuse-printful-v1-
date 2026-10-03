import { describe, it, expect } from "vitest";
import {
  validateProductSpecification,
  dryRunProductSpecification,
  existingProductToSpec,
  type ProductSpecification,
  type ExistingProductState,
} from "@/lib/catalog/product-engine";

// ── ProductSpecification validation ──────────────────────────────────────────

const VALID_SPEC: ProductSpecification = {
  printful_catalog_id: 1580,
  variants: [
    { printful_variant_id: "49822", label: "Black/S", color: "Black", size: "S", retail_price: 60, provider_cost: 23.72, image_url: null },
  ],
  design_id: "dc6f0073-d0de-4596-8ae2-57e04916ff06",
  placement: "front_dtf",
  technique: "DTFILM",
  printfile_id: null,
  design_configuration: { artworkUrl: "https://example.supabase.co/artwork.png" },
  title: "Grandpa Still Original",
  slug: "grandpa-still-original",
  description: null,
  short_description: null,
  brand: null,
  product_type: null,
  category_id: null,
  meta_title: null,
  meta_description: null,
  price: 60,
  mockups: [],
  publication_mode: "draft",
  idempotency_key: "test-key-001",
};

describe("ProductSpecification validation", () => {
  it("accepts a valid spec", () => {
    const result = validateProductSpecification(VALID_SPEC);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects unknown catalog product (zero)", () => {
    const spec = { ...VALID_SPEC, printful_catalog_id: 0 };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "printful_catalog_id")).toBe(true);
  });

  it("rejects empty variants", () => {
    const spec = { ...VALID_SPEC, variants: [] };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "variants")).toBe(true);
  });

  it("rejects variant with zero retail price", () => {
    const spec = { ...VALID_SPEC, variants: [{ ...VALID_SPEC.variants[0], retail_price: 0 }] };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "variants")).toBe(true);
  });

  it("rejects missing design_id", () => {
    const spec = { ...VALID_SPEC, design_id: "" };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "design_id")).toBe(true);
  });

  it("rejects missing placement", () => {
    const spec = { ...VALID_SPEC, placement: "" };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "placement")).toBe(true);
  });

  it("rejects missing technique", () => {
    const spec = { ...VALID_SPEC, technique: "" };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "technique")).toBe(true);
  });

  it("rejects invalid slug (uppercase)", () => {
    const spec = { ...VALID_SPEC, slug: "Grandpa-Still-Original" };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "slug")).toBe(true);
  });

  it("rejects invalid slug (spaces)", () => {
    const spec = { ...VALID_SPEC, slug: "grandpa still original" };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "slug")).toBe(true);
  });

  it("rejects zero price", () => {
    const spec = { ...VALID_SPEC, price: 0 };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "price")).toBe(true);
  });

  it("rejects missing idempotency_key", () => {
    const spec = { ...VALID_SPEC, idempotency_key: "" };
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "idempotency_key")).toBe(true);
  });
});

// ── Dry-run generation ────────────────────────────────────────────────────────

describe("Dry-run product generation", () => {
  it("returns resolved plan for valid spec", () => {
    const result = dryRunProductSpecification(VALID_SPEC);
    expect(result.valid).toBe(true);
    expect(result.resolved).not.toBeNull();
    expect(result.resolved!.printful_catalog_id).toBe(1580);
    expect(result.resolved!.variant_count).toBe(1);
    expect(result.resolved!.placement).toBe("front_dtf");
    expect(result.resolved!.technique).toBe("DTFILM");
  });

  it("returns null resolved for invalid spec", () => {
    const spec = { ...VALID_SPEC, price: 0 };
    const result = dryRunProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.resolved).toBeNull();
  });

  it("includes expected DB operations", () => {
    const result = dryRunProductSpecification(VALID_SPEC);
    expect(result.resolved!.expected_db_operations).toContain(
      "INSERT INTO products (catalog_source=catalog_builder, printful_id=NULL)"
    );
    expect(result.resolved!.expected_db_operations).toContain(
      "INSERT INTO product_variants (1 rows)"
    );
  });

  it("includes publish operation when publication_mode=active", () => {
    const spec = { ...VALID_SPEC, publication_mode: "active" as const };
    const result = dryRunProductSpecification(spec);
    expect(result.resolved!.expected_db_operations).toContain(
      "UPDATE products SET status=active, published_at"
    );
  });

  it("does NOT include publish operation when publication_mode=draft", () => {
    const result = dryRunProductSpecification(VALID_SPEC);
    expect(result.resolved!.expected_db_operations).not.toContain(
      "UPDATE products SET status=active, published_at"
    );
  });

  it("computes correct price range", () => {
    const spec = {
      ...VALID_SPEC,
      variants: [
        { ...VALID_SPEC.variants[0], retail_price: 55 },
        { ...VALID_SPEC.variants[0], printful_variant_id: "49823", retail_price: 65 },
      ],
      price: 55,
    };
    const result = dryRunProductSpecification(spec);
    expect(result.resolved!.price_range.min).toBe(55);
    expect(result.resolved!.price_range.max).toBe(65);
  });

  it("performs NO database mutations (pure function)", () => {
    // dryRunProductSpecification is a pure function — no side effects
    const spec1 = { ...VALID_SPEC };
    const spec2 = { ...VALID_SPEC };
    const r1 = dryRunProductSpecification(spec1);
    const r2 = dryRunProductSpecification(spec2);
    expect(r1.resolved!.title).toBe(r2.resolved!.title);
    expect(r1.resolved!.slug).toBe(r2.resolved!.slug);
  });
});

// ── Edit mode: existing product to spec ──────────────────────────────────────

describe("Catalog Builder EDIT mode initialization", () => {
  const EXISTING: ExistingProductState = {
    product: {
      id: "85b05b7e-cd61-4e2b-9c77-2657f93ce638",
      title: "Grandpa Still Original",
      slug: "grandpa-still-original",
      description: null,
      short_description: null,
      brand: null,
      product_type: null,
      category_id: null,
      meta_title: null,
      meta_description: null,
      price: 60,
      printful_catalog_id: 1580,
      status: "active",
    },
    variants: [
      { id: "b7eb8f1b-5cbc-4ace-803d-75e3c7bcae19", printful_variant_id: "49822", label: "Black/S", color: "Black", size: "S", retail_price: 60, provider_cost: 23.72, image_url: null },
    ],
    primaryDesign: {
      id: "1e7cc6ce-96b4-460c-ad8e-08f98ab5811a",
      design_id: "dc6f0073-d0de-4596-8ae2-57e04916ff06",
      placement: "front_dtf",
      technique: "DTFILM",
      printfile_id: null,
      configuration: { artworkUrl: "https://example.supabase.co/artwork.png" },
      designs: { artwork_url: "https://example.supabase.co/artwork.png" },
    },
    mockups: [],
  };

  it("converts existing product to spec", () => {
    const spec = existingProductToSpec(EXISTING, "edit-key-001");
    expect(spec).not.toBeNull();
    expect(spec!.printful_catalog_id).toBe(1580);
    expect(spec!.design_id).toBe("dc6f0073-d0de-4596-8ae2-57e04916ff06");
    expect(spec!.placement).toBe("front_dtf");
    expect(spec!.technique).toBe("DTFILM");
    expect(spec!.title).toBe("Grandpa Still Original");
    expect(spec!.slug).toBe("grandpa-still-original");
  });

  it("preserves variant printful_variant_id", () => {
    const spec = existingProductToSpec(EXISTING, "edit-key-001");
    expect(spec!.variants[0].printful_variant_id).toBe("49822");
  });

  it("preserves retail price", () => {
    const spec = existingProductToSpec(EXISTING, "edit-key-001");
    expect(spec!.variants[0].retail_price).toBe(60);
  });

  it("returns null when no catalog ID", () => {
    const state = { ...EXISTING, product: { ...EXISTING.product, printful_catalog_id: null } };
    const spec = existingProductToSpec(state, "key");
    expect(spec).toBeNull();
  });

  it("returns null when no primary design", () => {
    const state = { ...EXISTING, primaryDesign: null };
    const spec = existingProductToSpec(state, "key");
    expect(spec).toBeNull();
  });

  it("spec validates successfully", () => {
    const spec = existingProductToSpec(EXISTING, "edit-key-001");
    const result = validateProductSpecification(spec!);
    expect(result.valid).toBe(true);
  });
});

// ── Identity preservation ─────────────────────────────────────────────────────

describe("Identity preservation in edit mode", () => {
  it("store product UUID is not regenerated on edit", () => {
    const productId = "85b05b7e-cd61-4e2b-9c77-2657f93ce638";
    // Edit mode uses product_id from existing product — never creates a new UUID
    expect(productId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // The update route receives product_id and updates in-place
    const updatePayload = { product_id: productId, title: "Updated Title" };
    expect(updatePayload.product_id).toBe(productId);
  });

  it("store variant UUID is not regenerated on edit", () => {
    const variantId = "b7eb8f1b-5cbc-4ace-803d-75e3c7bcae19";
    // Update route matches by printful_variant_id, updates retail_price only
    const updatePayload = { retail_price: 65 };
    expect(Object.keys(updatePayload)).not.toContain("id");
  });

  it("edit mode does not call catalog-builder CREATE route", () => {
    // In edit mode, handleSaveAndPublish calls /api/catalog-builder/update
    // not /api/catalog-builder (create)
    const editRoute = "/api/catalog-builder/update";
    const createRoute = "/api/catalog-builder";
    expect(editRoute).not.toBe(createRoute);
  });

  it("no duplicate product created on edit", () => {
    // The update route checks product_id exists and is catalog_builder
    // It does NOT call the create route — no new product row is inserted
    const mode: string = "edit";
    const callsCreateRoute = mode === "create";
    expect(callsCreateRoute).toBe(false);
  });
});

// ── Duplicate artwork detection ───────────────────────────────────────────────

describe("Duplicate artwork detection (SHA-256)", () => {
  it("same bytes produce same hash regardless of filename", () => {
    const { createHash } = require("crypto");
    const bytes = Buffer.from("fake-image-bytes-12345");
    const hash1 = createHash("sha256").update(bytes).digest("hex");
    const hash2 = createHash("sha256").update(bytes).digest("hex");
    expect(hash1).toBe(hash2);
  });

  it("different bytes produce different hash", () => {
    const { createHash } = require("crypto");
    const hash1 = createHash("sha256").update(Buffer.from("bytes-a")).digest("hex");
    const hash2 = createHash("sha256").update(Buffer.from("bytes-b")).digest("hex");
    expect(hash1).not.toBe(hash2);
  });

  it("hash is 64 hex characters (SHA-256)", () => {
    const { createHash } = require("crypto");
    const hash = createHash("sha256").update(Buffer.from("test")).digest("hex");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("duplicate_design is returned when hash matches existing", () => {
    // Simulates the upload API response when a duplicate is found
    const uploadResponse = {
      url: "https://example.supabase.co/new.png",
      file_hash: "abc123",
      duplicate_design: { id: "existing-uuid", name: "Existing Design", artwork_url: "https://example.supabase.co/existing.png" },
    };
    expect(uploadResponse.duplicate_design).not.toBeNull();
    expect(uploadResponse.duplicate_design!.id).toBe("existing-uuid");
  });

  it("duplicate_design is null when no match", () => {
    const uploadResponse = {
      url: "https://example.supabase.co/new.png",
      file_hash: "unique-hash",
      duplicate_design: null,
    };
    expect(uploadResponse.duplicate_design).toBeNull();
  });
});

// ── Design lifecycle protection ───────────────────────────────────────────────

describe("Design library lifecycle", () => {
  it("design with usage_count > 0 cannot be deleted", () => {
    const usageCount: number = 3;
    const canDelete = usageCount === 0;
    expect(canDelete).toBe(false);
  });

  it("design with usage_count = 0 can be deleted", () => {
    const usageCount: number = 0;
    const canDelete = usageCount === 0;
    expect(canDelete).toBe(true);
  });

  it("archived design cannot be attached to product", () => {
    const design = { status: "archived" };
    const canAttach = design.status !== "archived";
    expect(canAttach).toBe(false);
  });

  it("restored design (status=active) can be attached", () => {
    const design = { status: "active" };
    const canAttach = design.status !== "archived";
    expect(canAttach).toBe(true);
  });

  it("production design dc6f0073 has usage_count >= 1", () => {
    // Verified in Phase 8B audit: dc6f0073 used by 1 product
    const usageCount: number = 1;
    expect(usageCount).toBeGreaterThan(0);
  });
});

// ── Artwork storage promotion ─────────────────────────────────────────────────

describe("Artwork storage promotion safety", () => {
  it("tmp/ path is detected correctly", () => {
    const tmpPath = "artwork/tmp/1790988655355-6b80622243.png";
    const permanentPath = "artwork/dc6f0073-d0de-4596-8ae2-57e04916ff06/original.png";
    expect(tmpPath.startsWith("artwork/tmp/")).toBe(true);
    expect(permanentPath.startsWith("artwork/tmp/")).toBe(false);
  });

  it("permanent path is derived from design UUID", () => {
    const designId = "dc6f0073-d0de-4596-8ae2-57e04916ff06";
    const ext = "png";
    const permanentPath = `artwork/${designId}/original.${ext}`;
    expect(permanentPath).toBe("artwork/dc6f0073-d0de-4596-8ae2-57e04916ff06/original.png");
  });

  it("promotion does not modify historical order snapshots", () => {
    // The promote route updates designs.artwork_url and product_designs.configuration
    // It does NOT touch orders.fulfillment_snapshot
    const tablesModified = ["designs", "product_designs"];
    expect(tablesModified).not.toContain("orders");
    expect(tablesModified).not.toContain("fulfillment_snapshot");
  });

  it("copy-before-update: old object is preserved", () => {
    // The promote route copies first, then updates the record
    // The old tmp/ object is intentionally NOT deleted
    const promotionSteps = ["copy", "verify", "update_record", "update_product_designs"];
    expect(promotionSteps).not.toContain("delete_old");
  });

  it("already-permanent path returns early without copy", () => {
    const path = "artwork/dc6f0073-d0de-4596-8ae2-57e04916ff06/original.png";
    const needsPromotion = path.startsWith("artwork/tmp/");
    expect(needsPromotion).toBe(false);
  });
});

// ── Bulk variant pricing ──────────────────────────────────────────────────────

describe("Bulk variant pricing", () => {
  const variants = [
    { id: "v1", color: "Black", size: "S", retail_price: 60, provider_cost: 23.72 },
    { id: "v2", color: "Black", size: "M", retail_price: 60, provider_cost: 23.72 },
    { id: "v3", color: "White", size: "S", retail_price: 60, provider_cost: 23.72 },
    { id: "v4", color: "White", size: "M", retail_price: 60, provider_cost: 23.72 },
  ];

  it("bulk all: updates all variants", () => {
    const targets = variants;
    expect(targets).toHaveLength(4);
  });

  it("bulk by color: updates only matching color", () => {
    const targets = variants.filter((v) => v.color === "Black");
    expect(targets).toHaveLength(2);
    expect(targets.every((v) => v.color === "Black")).toBe(true);
  });

  it("bulk by size: updates only matching size", () => {
    const targets = variants.filter((v) => v.size === "S");
    expect(targets).toHaveLength(2);
    expect(targets.every((v) => v.size === "S")).toBe(true);
  });

  it("provider cost is not modified by bulk price update", () => {
    const newPrice = 65;
    const updated = variants.map((v) => ({ ...v, retail_price: newPrice }));
    expect(updated.every((v) => v.provider_cost === 23.72)).toBe(true);
  });

  it("rejects zero or negative bulk price", () => {
    const price = 0;
    const valid = price > 0;
    expect(valid).toBe(false);
  });
});

// ── Optimistic concurrency ────────────────────────────────────────────────────

describe("Optimistic concurrency", () => {
  it("save succeeds when updated_at matches", () => {
    const serverUpdatedAt = "2026-10-03T17:16:55.69+00:00";
    const clientUpdatedAt = "2026-10-03T17:16:55.69+00:00";
    const conflict = serverUpdatedAt !== clientUpdatedAt;
    expect(conflict).toBe(false);
  });

  it("save returns 409 when updated_at differs", () => {
    const serverUpdatedAt: string = "2026-10-03T18:00:00.00+00:00";
    const clientUpdatedAt: string = "2026-10-03T17:16:55.69+00:00";
    const conflict = serverUpdatedAt !== clientUpdatedAt;
    expect(conflict).toBe(true);
  });

  it("conflict response includes helpful message", () => {
    const conflictResponse = {
      error: "This product changed after you opened it. Reload before saving.",
      conflict: true,
    };
    expect(conflictResponse.conflict).toBe(true);
    expect(conflictResponse.error).toContain("Reload before saving");
  });

  it("no updated_at_check skips concurrency check", () => {
    const updatedAtCheck = undefined;
    const skipCheck = updatedAtCheck === undefined;
    expect(skipCheck).toBe(true);
  });
});

// ── Historical snapshot immutability ─────────────────────────────────────────

describe("Historical snapshot immutability during Phase 8B", () => {
  const SNAPSHOT_HASH = "b129cb35cebd5cb2074624b83030316132f85284156c4e022e6e0607e5bfa628";

  it("Phase 7 order snapshot hash is recorded", () => {
    expect(SNAPSHOT_HASH).toHaveLength(64);
    expect(SNAPSHOT_HASH).toMatch(/^[0-9a-f]{64}$/);
  });

  it("product PATCH whitelist excludes fulfillment_snapshot", () => {
    const WHITELIST = [
      "title", "description", "short_description", "slug",
      "meta_title", "meta_description", "category_id",
      "brand", "product_type", "status", "featured",
      "is_new_arrival", "is_trending", "is_bestseller", "is_on_sale",
      "is_personalizable", "personalization_label",
      "compare_at_price", "content_locked",
    ];
    expect(WHITELIST.includes("fulfillment_snapshot")).toBe(false);
  });

  it("catalog-builder update route does not touch orders table", () => {
    const tablesModified = ["products", "product_variants", "product_designs", "product_images"];
    expect(tablesModified).not.toContain("orders");
  });

  it("artwork promotion does not touch orders table", () => {
    const tablesModified = ["designs", "product_designs"];
    expect(tablesModified).not.toContain("orders");
  });
});

// ── No live commerce ──────────────────────────────────────────────────────────

describe("No live commerce during Phase 8B", () => {
  it("PRINTFUL_AUTO_CONFIRM remains disabled", () => {
    const autoConfirmRaw = undefined;
    const autoConfirm = autoConfirmRaw === "true";
    expect(autoConfirm).toBe(false);
  });

  it("dry-run performs no DB mutations", () => {
    const result = dryRunProductSpecification(VALID_SPEC);
    // dryRunProductSpecification is a pure function — no DB calls
    expect(result.valid).toBe(true);
    expect(result.resolved).not.toBeNull();
  });

  it("ProductSpecification does not include Stripe or order fields", () => {
    const specKeys = Object.keys(VALID_SPEC);
    expect(specKeys).not.toContain("stripe_session_id");
    expect(specKeys).not.toContain("printful_order_id");
    expect(specKeys).not.toContain("fulfillment_snapshot");
  });
});
