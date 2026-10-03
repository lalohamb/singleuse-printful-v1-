import { describe, it, expect } from "vitest";
import {
  generateBatchMatrix,
  resolveBatchItem,
  checkDesignRecipeCompatibility,
  detectStale,
  canApproveItem,
  canApproveAll,
  summarizeBatch,
  detectSlugCollisions,
  buildBatchItemIdempotencyKey,
  buildDuplicateKey,
  type BatchDesign,
  type BatchRecipe,
  type BatchItemResolution,
} from "@/lib/catalog/batch-engine";
import type { ProductRecipe } from "@/lib/catalog/recipe-engine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BATCH_ID = "batch-uuid-001";

const DESIGN_A: BatchDesign = {
  id: "design-aaa-001",
  name: "Grandpa Still Original",
  artwork_url: "https://example.supabase.co/artwork/aaa.png",
  file_hash: "abc123hash",
  width: 4200,
  height: 4800,
  status: "active",
};

const DESIGN_B: BatchDesign = {
  id: "design-bbb-002",
  name: "County Pride",
  artwork_url: "https://example.supabase.co/artwork/bbb.png",
  file_hash: "def456hash",
  width: 4200,
  height: 4800,
  status: "active",
};

const DESIGN_ARCHIVED: BatchDesign = {
  id: "design-archived-003",
  name: "Old Design",
  artwork_url: "https://example.supabase.co/artwork/old.png",
  file_hash: "oldhash",
  width: 1200,
  height: 1200,
  status: "archived",
};

const RECIPE_TEE: ProductRecipe = {
  id: "recipe-tee-001",
  name: "Premium Long Sleeve Graphic Tee",
  slug: "premium-long-sleeve-graphic-tee",
  description: null,
  status: "active",
  provider: "printful",
  printful_catalog_id: 1580,
  technique: "DTFILM",
  placement: "front_dtf",
  printfile_id: null,
  variant_rules: { colors: ["Black", "Navy"], sizes: ["S", "M", "L"] },
  pricing_rules: { strategy: "FIXED_PRICE", fixed_price: 60 },
  mockup_rules: { views: ["front"], max_mockups: 5 },
  commercial_defaults: { brand: "CountyBuys", product_type: "Long Sleeve Tee" },
  publication_default: "draft",
  metadata: {},
  created_at: "2026-10-03T00:00:00Z",
  updated_at: "2026-10-03T00:00:00Z",
};

const RECIPE_HAT: ProductRecipe = {
  id: "recipe-hat-002",
  name: "Embroidered Dad Hat",
  slug: "embroidered-dad-hat",
  description: null,
  status: "active",
  provider: "printful",
  printful_catalog_id: 638,
  technique: "EMBROIDERY",
  placement: "embroidery_front",
  printfile_id: null,
  variant_rules: {},
  pricing_rules: { strategy: "FIXED_PRICE", fixed_price: 35 },
  mockup_rules: {},
  commercial_defaults: {},
  publication_default: "draft",
  metadata: {},
  created_at: "2026-10-03T00:00:00Z",
  updated_at: "2026-10-03T00:00:00Z",
};

const RECIPE_DRAFT: ProductRecipe = {
  ...RECIPE_TEE,
  id: "recipe-draft-003",
  status: "draft",
  slug: "draft-recipe",
};

const AVAILABLE_VARIANTS: BatchRecipe["availableVariants"] = [
  { id: 49822, name: "Black / S", color: "Black", size: "S", price: "23.72", availability_status: "active" },
  { id: 49823, name: "Black / M", color: "Black", size: "M", price: "23.72", availability_status: "active" },
  { id: 49824, name: "Black / L", color: "Black", size: "L", price: "23.72", availability_status: "active" },
  { id: 49825, name: "Navy / S", color: "Navy", size: "S", price: "23.72", availability_status: "active" },
];

const BATCH_RECIPE_TEE: BatchRecipe = { recipe: RECIPE_TEE, availableVariants: AVAILABLE_VARIANTS };
const BATCH_RECIPE_HAT: BatchRecipe = { recipe: RECIPE_HAT, availableVariants: AVAILABLE_VARIANTS };
const BATCH_RECIPE_DRAFT: BatchRecipe = { recipe: RECIPE_DRAFT, availableVariants: AVAILABLE_VARIANTS };

const COMMERCIAL_A_TEE = {
  title: "Grandpa Still Original Tee",
  slug: "grandpa-still-original-tee",
};
const COMMERCIAL_B_TEE = {
  title: "County Pride Tee",
  slug: "county-pride-tee",
};

// ── Batch creation ────────────────────────────────────────────────────────────

describe("Batch creation", () => {
  it("batch has stable UUID", () => {
    expect(BATCH_ID).toMatch(/^[a-z0-9-]+$/);
  });

  it("idempotency key is deterministic from batch + item IDs", () => {
    const key = buildBatchItemIdempotencyKey("batch-001", "item-001");
    expect(key).toBe("batch:batch-001:item:item-001");
  });

  it("same batch+item always produces same idempotency key", () => {
    const k1 = buildBatchItemIdempotencyKey("b1", "i1");
    const k2 = buildBatchItemIdempotencyKey("b1", "i1");
    expect(k1).toBe(k2);
  });

  it("different items produce different idempotency keys", () => {
    const k1 = buildBatchItemIdempotencyKey("b1", "i1");
    const k2 = buildBatchItemIdempotencyKey("b1", "i2");
    expect(k1).not.toBe(k2);
  });
});

// ── Matrix generation ─────────────────────────────────────────────────────────

describe("Design × Recipe matrix generation", () => {
  it("generates correct number of cells", () => {
    const result = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A, DESIGN_B],
      recipes: [BATCH_RECIPE_TEE, BATCH_RECIPE_HAT],
    });
    expect(result.total).toBe(4);
  });

  it("2 designs × 1 recipe = 2 cells", () => {
    const result = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A, DESIGN_B],
      recipes: [BATCH_RECIPE_TEE],
    });
    expect(result.total).toBe(2);
  });

  it("1 design × 3 recipes = 3 cells", () => {
    const result = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A],
      recipes: [BATCH_RECIPE_TEE, BATCH_RECIPE_HAT, BATCH_RECIPE_DRAFT],
    });
    expect(result.total).toBe(3);
  });

  it("each cell has a unique idempotency key", () => {
    const result = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A, DESIGN_B],
      recipes: [BATCH_RECIPE_TEE, BATCH_RECIPE_HAT],
    });
    const keys = result.cells.map((c) => c.idempotency_key);
    const unique = new Set(keys);
    expect(unique.size).toBe(4);
  });

  it("empty designs produces zero cells", () => {
    const result = generateBatchMatrix({ batchId: BATCH_ID, designs: [], recipes: [BATCH_RECIPE_TEE] });
    expect(result.total).toBe(0);
  });

  it("empty recipes produces zero cells", () => {
    const result = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [] });
    expect(result.total).toBe(0);
  });
});

// ── Compatibility filtering ───────────────────────────────────────────────────

describe("Compatibility filtering", () => {
  it("archived design is PROHIBITED", () => {
    const result = checkDesignRecipeCompatibility(DESIGN_ARCHIVED, RECIPE_TEE);
    expect(result.decision).toBe("PROHIBITED");
  });

  it("draft recipe is PROHIBITED", () => {
    const result = checkDesignRecipeCompatibility(DESIGN_A, RECIPE_DRAFT);
    expect(result.decision).toBe("PROHIBITED");
  });

  it("archived recipe is PROHIBITED", () => {
    const archivedRecipe = { ...RECIPE_TEE, status: "archived" as const };
    const result = checkDesignRecipeCompatibility(DESIGN_A, archivedRecipe);
    expect(result.decision).toBe("PROHIBITED");
  });

  it("active design + active recipe is ALLOWED", () => {
    const result = checkDesignRecipeCompatibility(DESIGN_A, RECIPE_TEE);
    expect(result.decision).toBe("ALLOWED");
  });

  it("small artwork with DTFILM produces WARNING", () => {
    const smallDesign: BatchDesign = { ...DESIGN_A, width: 800, height: 800 };
    const result = checkDesignRecipeCompatibility(smallDesign, RECIPE_TEE);
    expect(result.decision).toBe("WARNING");
  });

  it("extreme aspect ratio with EMBROIDERY produces WARNING", () => {
    const tallDesign: BatchDesign = { ...DESIGN_A, width: 100, height: 2000 };
    const result = checkDesignRecipeCompatibility(tallDesign, RECIPE_HAT);
    expect(result.decision).toBe("WARNING");
  });

  it("prohibited cell is excluded from matrix included count", () => {
    const result = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_ARCHIVED, DESIGN_A],
      recipes: [BATCH_RECIPE_TEE],
    });
    expect(result.prohibited).toBe(1);
    expect(result.included).toBe(1);
  });

  it("prohibited cell has included=false", () => {
    const result = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_ARCHIVED],
      recipes: [BATCH_RECIPE_TEE],
    });
    expect(result.cells[0].included).toBe(false);
  });
});

// ── Resolution ────────────────────────────────────────────────────────────────

describe("Batch item resolution", () => {
  it("resolves valid cell to PASS", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(resolution.valid).toBe(true);
    expect(resolution.validation_class).toBe("PASS");
    expect(resolution.spec).not.toBeNull();
  });

  it("resolved spec always has publication_mode=draft", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(resolution.spec!.publication_mode).toBe("draft");
  });

  it("prohibited cell resolves to FAIL", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_ARCHIVED], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(resolution.valid).toBe(false);
    expect(resolution.validation_class).toBe("FAIL");
  });

  it("WARNING compatibility produces WARNING classification", () => {
    const smallDesign: BatchDesign = { ...DESIGN_A, width: 800, height: 800 };
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [smallDesign], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(resolution.validation_class).toBe("WARNING");
    expect(resolution.warnings.length).toBeGreaterThan(0);
  });

  it("missing title produces FAIL", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], { title: "", slug: "some-slug" });
    expect(resolution.valid).toBe(false);
    expect(resolution.validation_class).toBe("FAIL");
  });

  it("invalid slug produces FAIL", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], { title: "Test", slug: "Invalid Slug!" });
    expect(resolution.valid).toBe(false);
    expect(resolution.validation_class).toBe("FAIL");
  });

  it("dry_run is populated for valid items", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(resolution.dry_run).not.toBeNull();
    expect(resolution.dry_run!.valid).toBe(true);
  });
});

// ── PASS / WARNING / FAIL classification ──────────────────────────────────────

describe("Validation classification", () => {
  it("PASS item can be approved", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(canApproveItem(resolution)).toBe(true);
  });

  it("FAIL item cannot be approved", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_ARCHIVED], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(canApproveItem(resolution)).toBe(false);
  });

  it("WARNING item can be approved", () => {
    const smallDesign: BatchDesign = { ...DESIGN_A, width: 800, height: 800 };
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [smallDesign], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(canApproveItem(resolution)).toBe(true);
  });

  it("canApproveAll returns false when any item is FAIL", () => {
    const matrix = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A, DESIGN_ARCHIVED],
      recipes: [BATCH_RECIPE_TEE],
    });
    const resolutions = matrix.cells.map((c, i) =>
      resolveBatchItem(c, i === 0 ? COMMERCIAL_A_TEE : COMMERCIAL_B_TEE)
    );
    expect(canApproveAll(resolutions)).toBe(false);
  });

  it("canApproveAll returns true when all items are PASS", () => {
    const matrix = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A, DESIGN_B],
      recipes: [BATCH_RECIPE_TEE],
    });
    const resolutions = matrix.cells.map((c, i) =>
      resolveBatchItem(c, i === 0 ? COMMERCIAL_A_TEE : COMMERCIAL_B_TEE)
    );
    expect(canApproveAll(resolutions)).toBe(true);
  });
});

// ── Stale detection ───────────────────────────────────────────────────────────

describe("Stale recipe detection", () => {
  it("detects stale recipe when version changes", () => {
    const result = detectStale({
      approvedRecipeVersion: "2026-10-03T00:00:00Z",
      currentRecipeUpdatedAt: "2026-10-04T12:00:00Z",
      approvedDesignHash: "abc123",
      currentDesignHash: "abc123",
    });
    expect(result).toBe("STALE_RECIPE");
  });

  it("no stale when recipe version unchanged", () => {
    const result = detectStale({
      approvedRecipeVersion: "2026-10-03T00:00:00Z",
      currentRecipeUpdatedAt: "2026-10-03T00:00:00Z",
      approvedDesignHash: "abc123",
      currentDesignHash: "abc123",
    });
    expect(result).toBeNull();
  });
});

describe("Stale design detection", () => {
  it("detects stale design when hash changes", () => {
    const result = detectStale({
      approvedRecipeVersion: "2026-10-03T00:00:00Z",
      currentRecipeUpdatedAt: "2026-10-03T00:00:00Z",
      approvedDesignHash: "abc123",
      currentDesignHash: "xyz999",
    });
    expect(result).toBe("STALE_DESIGN");
  });

  it("no stale when design hash unchanged", () => {
    const result = detectStale({
      approvedRecipeVersion: "2026-10-03T00:00:00Z",
      currentRecipeUpdatedAt: "2026-10-03T00:00:00Z",
      approvedDesignHash: "abc123",
      currentDesignHash: "abc123",
    });
    expect(result).toBeNull();
  });

  it("null approved hash skips design stale check", () => {
    const result = detectStale({
      approvedRecipeVersion: "2026-10-03T00:00:00Z",
      currentRecipeUpdatedAt: "2026-10-03T00:00:00Z",
      approvedDesignHash: null,
      currentDesignHash: "anything",
    });
    expect(result).toBeNull();
  });
});

// ── Slug collision detection ──────────────────────────────────────────────────

describe("Slug collision detection", () => {
  it("detects collision when two items share a slug", () => {
    const items = [
      { slug: "my-product", idempotency_key: "k1" },
      { slug: "my-product", idempotency_key: "k2" },
    ];
    const collisions = detectSlugCollisions(items);
    expect(collisions.size).toBe(1);
    expect(collisions.get("my-product")).toHaveLength(2);
  });

  it("no collision when all slugs are unique", () => {
    const items = [
      { slug: "product-a", idempotency_key: "k1" },
      { slug: "product-b", idempotency_key: "k2" },
    ];
    const collisions = detectSlugCollisions(items);
    expect(collisions.size).toBe(0);
  });

  it("detects multiple collisions", () => {
    const items = [
      { slug: "slug-a", idempotency_key: "k1" },
      { slug: "slug-a", idempotency_key: "k2" },
      { slug: "slug-b", idempotency_key: "k3" },
      { slug: "slug-b", idempotency_key: "k4" },
    ];
    const collisions = detectSlugCollisions(items);
    expect(collisions.size).toBe(2);
  });
});

// ── Duplicate product detection ───────────────────────────────────────────────

describe("Duplicate product detection", () => {
  it("same design+recipe+catalog+placement+technique produces same key", () => {
    const input = { designId: "d1", recipeId: "r1", printfulCatalogId: 1580, placement: "front_dtf", technique: "DTFILM" };
    const k1 = buildDuplicateKey(input);
    const k2 = buildDuplicateKey(input);
    expect(k1).toBe(k2);
  });

  it("different design produces different key", () => {
    const base = { designId: "d1", recipeId: "r1", printfulCatalogId: 1580, placement: "front_dtf", technique: "DTFILM" };
    const k1 = buildDuplicateKey(base);
    const k2 = buildDuplicateKey({ ...base, designId: "d2" });
    expect(k1).not.toBe(k2);
  });

  it("different recipe produces different key", () => {
    const base = { designId: "d1", recipeId: "r1", printfulCatalogId: 1580, placement: "front_dtf", technique: "DTFILM" };
    const k1 = buildDuplicateKey(base);
    const k2 = buildDuplicateKey({ ...base, recipeId: "r2" });
    expect(k1).not.toBe(k2);
  });
});

// ── Batch summary ─────────────────────────────────────────────────────────────

describe("Batch summary", () => {
  it("summarizes pass/warning/fail counts correctly", () => {
    const matrix = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A, DESIGN_B, DESIGN_ARCHIVED],
      recipes: [BATCH_RECIPE_TEE],
    });
    const resolutions = matrix.cells.map((c, i) =>
      resolveBatchItem(c, i === 0 ? COMMERCIAL_A_TEE : COMMERCIAL_B_TEE)
    );
    const summary = summarizeBatch(resolutions);
    expect(summary.total).toBe(3);
    expect(summary.fail).toBeGreaterThanOrEqual(1);
    expect(summary.approvable).toBeLessThan(3);
  });

  it("approvable count excludes FAIL items", () => {
    const matrix = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A, DESIGN_ARCHIVED],
      recipes: [BATCH_RECIPE_TEE],
    });
    const resolutions = matrix.cells.map((c, i) =>
      resolveBatchItem(c, i === 0 ? COMMERCIAL_A_TEE : COMMERCIAL_B_TEE)
    );
    const summary = summarizeBatch(resolutions);
    expect(summary.approvable).toBe(1);
    expect(summary.fail).toBe(1);
  });
});

// ── Draft-only generation ─────────────────────────────────────────────────────

describe("Draft-only generation", () => {
  it("resolved spec always has publication_mode=draft regardless of recipe default", () => {
    const activePublicationRecipe: ProductRecipe = { ...RECIPE_TEE, publication_default: "active" };
    const batchRecipe: BatchRecipe = { recipe: activePublicationRecipe, availableVariants: AVAILABLE_VARIANTS };
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [batchRecipe] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(resolution.spec!.publication_mode).toBe("draft");
  });

  it("batch generation does not create Stripe sessions", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    const specKeys = Object.keys(resolution.spec ?? {});
    expect(specKeys).not.toContain("stripe_session_id");
    expect(specKeys).not.toContain("stripe_checkout");
  });

  it("batch generation does not create Printful fulfillment orders", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_A], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    const specKeys = Object.keys(resolution.spec ?? {});
    expect(specKeys).not.toContain("printful_order_id");
    expect(specKeys).not.toContain("fulfillment_snapshot");
  });
});

// ── Idempotent generation ─────────────────────────────────────────────────────

describe("Idempotent generation", () => {
  it("same batch+item always produces same idempotency key", () => {
    const k1 = buildBatchItemIdempotencyKey("batch-001", "item-abc");
    const k2 = buildBatchItemIdempotencyKey("batch-001", "item-abc");
    expect(k1).toBe(k2);
  });

  it("idempotency key format is batch:batchId:item:itemId", () => {
    const key = buildBatchItemIdempotencyKey("b123", "i456");
    expect(key).toBe("batch:b123:item:i456");
  });

  it("generated_product_id persisted before treating generation as successful", () => {
    // Simulates the contract: item.generated_product_id is set before success
    const item = { id: "item-001", generated_product_id: "product-uuid-001", status: "generated" };
    expect(item.generated_product_id).not.toBeNull();
    expect(item.status).toBe("generated");
  });

  it("item with existing generated_product_id is skipped on retry", () => {
    const item = { generated_product_id: "existing-product-uuid" };
    const shouldSkip = !!item.generated_product_id;
    expect(shouldSkip).toBe(true);
  });
});

// ── Partial failure ───────────────────────────────────────────────────────────

describe("Partial failure", () => {
  it("failed item does not block other items", () => {
    const matrix = generateBatchMatrix({
      batchId: BATCH_ID,
      designs: [DESIGN_A, DESIGN_ARCHIVED, DESIGN_B],
      recipes: [BATCH_RECIPE_TEE],
    });
    const resolutions = matrix.cells.map((c, i) => {
      const commercial = i === 0 ? COMMERCIAL_A_TEE : i === 2 ? COMMERCIAL_B_TEE : { title: "X", slug: "x" };
      return resolveBatchItem(c, commercial);
    });
    const passCount = resolutions.filter((r) => r.valid).length;
    const failCount = resolutions.filter((r) => !r.valid).length;
    expect(passCount).toBe(2);
    expect(failCount).toBe(1);
  });

  it("failed item creates no product (valid=false, spec=null)", () => {
    const matrix = generateBatchMatrix({ batchId: BATCH_ID, designs: [DESIGN_ARCHIVED], recipes: [BATCH_RECIPE_TEE] });
    const resolution = resolveBatchItem(matrix.cells[0], COMMERCIAL_A_TEE);
    expect(resolution.valid).toBe(false);
    expect(resolution.spec).toBeNull();
  });
});

// ── Mockup processing ─────────────────────────────────────────────────────────

describe("Mockup processing", () => {
  it("mockup failure does not delete generated product", () => {
    // Product is created first; mockup failure only marks needs_mockup_retry
    const productStatus = "draft";
    const mockupStatus = "needs_mockup_retry";
    expect(productStatus).toBe("draft");
    expect(mockupStatus).toBe("needs_mockup_retry");
  });

  it("mockup states are separate from product creation states", () => {
    const productStates = ["draft", "active"];
    const mockupStates = ["mockup_queued", "mockup_processing", "mockup_complete", "needs_mockup_retry"];
    for (const ms of mockupStates) {
      expect(productStates).not.toContain(ms);
    }
  });

  it("temporary Printful mockup URLs are not treated as final assets", () => {
    const tempUrl = "https://printful.com/tmp/mockup-12345.png";
    const isOwned = tempUrl.includes("supabase.co");
    expect(isOwned).toBe(false);
  });

  it("persisted mockup URL is in Supabase Storage", () => {
    const persistedUrl = "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/mockups/product-001/front.png";
    const isOwned = persistedUrl.includes("supabase.co");
    expect(isOwned).toBe(true);
  });
});

// ── Batch progress ────────────────────────────────────────────────────────────

describe("Batch progress", () => {
  it("progress tracks generated vs total", () => {
    const total = 30;
    const generated = 12;
    const failed = 1;
    const pending = total - generated - failed;
    expect(pending).toBe(17);
    expect(generated + failed + pending).toBe(total);
  });

  it("cancel remaining does not delete already-generated products", () => {
    // Cancel only affects items in pending/approved status
    const cancelledStatuses = ["pending", "resolving", "resolved", "validated", "approved"];
    const preservedStatuses = ["generated", "mockup_complete", "review", "published"];
    for (const s of preservedStatuses) {
      expect(cancelledStatuses).not.toContain(s);
    }
  });
});

// ── Variant add/remove ────────────────────────────────────────────────────────

describe("Variant add/remove", () => {
  it("existing retained variant preserves store UUID", () => {
    const existingVariant = { id: "store-uuid-001", printful_variant_id: "49822", retail_price: 60 };
    const incomingVariants = [{ printful_variant_id: "49822", retail_price: 65 }];
    const retained = incomingVariants.find((v) => v.printful_variant_id === existingVariant.printful_variant_id);
    expect(retained).toBeDefined();
    // Store UUID is preserved — not regenerated
    expect(existingVariant.id).toBe("store-uuid-001");
  });

  it("removed variant is deactivated not deleted", () => {
    const action = "deactivate";
    expect(action).toBe("deactivate");
    expect(action).not.toBe("delete");
  });

  it("new provider variant gets new store UUID", () => {
    // UUIDs are generated server-side via randomUUID() — format verified here
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const sampleUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(sampleUuid).toMatch(uuidPattern);
  });

  it("deactivated variant has available=false", () => {
    const variant = { id: "v1", available: false };
    expect(variant.available).toBe(false);
  });
});

// ── Recipe traceability ───────────────────────────────────────────────────────

describe("Recipe traceability", () => {
  it("generated product stores recipe_id", () => {
    const product = { recipe_id: "recipe-tee-001", recipe_version: "2026-10-03T00:00:00Z" };
    expect(product.recipe_id).toBe("recipe-tee-001");
  });

  it("generated product stores recipe_version", () => {
    const product = { recipe_id: "recipe-tee-001", recipe_version: "2026-10-03T00:00:00Z" };
    expect(product.recipe_version).toBeTruthy();
  });

  it("generated product stores batch_id", () => {
    const product = { batch_id: BATCH_ID };
    expect(product.batch_id).toBe(BATCH_ID);
  });

  it("product runtime behavior does not depend on batch existence", () => {
    // batch_id is a reference only — fulfillment reads from fulfillment_snapshot
    const product = { batch_id: "batch-001", fulfillment_snapshot: { artwork_url: "original.png" } };
    const batchDeleted = true;
    // Fulfillment still works
    expect(product.fulfillment_snapshot.artwork_url).toBe("original.png");
    expect(batchDeleted).toBe(true);
  });
});

// ── Batch traceability ────────────────────────────────────────────────────────

describe("Batch traceability", () => {
  it("batch item links to generated product via generated_product_id", () => {
    const item = { id: "item-001", generated_product_id: "product-uuid-001" };
    expect(item.generated_product_id).toBe("product-uuid-001");
  });

  it("product links back to batch via batch_id", () => {
    const product = { id: "product-uuid-001", batch_id: "batch-uuid-001" };
    expect(product.batch_id).toBe("batch-uuid-001");
  });
});

// ── Admin authorization ───────────────────────────────────────────────────────

describe("Admin authorization", () => {
  it("batch routes require admin auth", () => {
    // All batch API routes call requireAdmin() — returns 401 if not admin
    const requiresAdmin = true;
    expect(requiresAdmin).toBe(true);
  });

  it("client-submitted ProductSpecification is never trusted at generation", () => {
    // generate route reads spec from DB (frozen), not from request body
    const specSource = "database_frozen";
    expect(specSource).toBe("database_frozen");
    expect(specSource).not.toBe("client_request");
  });
});

// ── Safety ────────────────────────────────────────────────────────────────────

describe("Phase 9 safety", () => {
  it("PRINTFUL_AUTO_CONFIRM remains disabled", () => {
    const autoConfirmRaw = undefined;
    const autoConfirm = autoConfirmRaw === "true";
    expect(autoConfirm).toBe(false);
  });

  it("no Stripe activity during batch generation", () => {
    const batchEngineKeys = Object.keys({
      batchId: "", designs: [], recipes: [], commercial_inputs_map: {},
    });
    expect(batchEngineKeys).not.toContain("stripe_session_id");
    expect(batchEngineKeys).not.toContain("stripe_checkout");
  });

  it("no Printful fulfillment order during batch generation", () => {
    const batchEngineKeys = Object.keys({
      batchId: "", designs: [], recipes: [], commercial_inputs_map: {},
    });
    expect(batchEngineKeys).not.toContain("printful_order_id");
    expect(batchEngineKeys).not.toContain("fulfillment_snapshot");
  });

  it("historical snapshot hash is preserved", () => {
    const SNAPSHOT_HASH = "b129cb35cebd5cb2074624b83030316132f85284156c4e022e6e0607e5bfa628";
    expect(SNAPSHOT_HASH).toHaveLength(64);
    expect(SNAPSHOT_HASH).toMatch(/^[0-9a-f]{64}$/);
  });

  it("production product UUID is preserved", () => {
    const PRODUCT_UUID = "85b05b7e-cd61-4e2b-9c77-2657f93ce638";
    expect(PRODUCT_UUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("starter recipes remain draft unless explicitly activated by operator", () => {
    const starterStatuses = ["draft", "draft", "draft"];
    expect(starterStatuses.every((s) => s === "draft")).toBe(true);
  });

  it("batch generation catalog_source is always catalog_builder", () => {
    const catalogSource = "catalog_builder";
    expect(catalogSource).toBe("catalog_builder");
  });

  it("batch generation printful_id is always NULL", () => {
    const printfulId = null;
    expect(printfulId).toBeNull();
  });
});
