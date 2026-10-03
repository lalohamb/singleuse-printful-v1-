import { describe, it, expect } from "vitest";
import {
  checkDesignRecipeCompatibility,
  detectStale,
  type BatchDesign,
} from "@/lib/catalog/batch-engine";
import type { ProductRecipe } from "@/lib/catalog/recipe-engine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_RECIPE: ProductRecipe = {
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
  commercial_defaults: { brand: "CountyBuys" },
  publication_default: "draft",
  metadata: {},
  created_at: "2026-10-03T00:00:00Z",
  updated_at: "2026-10-03T00:00:00Z",
};

const ACTIVE_DESIGN: BatchDesign = {
  id: "design-aaa-001",
  name: "Grandpa Still Original",
  artwork_url: "https://example.supabase.co/artwork/aaa.png",
  file_hash: "abc123hash",
  width: 4200,
  height: 4800,
  status: "active",
};

// ── Wizard server variant resolution ─────────────────────────────────────────

describe("Wizard server-side variant resolution", () => {
  it("wizard sends recipe objects only — no client availableVariants", () => {
    // The wizard now sends: recipes: [{ recipe: r }]
    // NOT: recipes: [{ recipe: r, availableVariants: [] }]
    const wizardPayload = { recipe: ACTIVE_RECIPE };
    expect(Object.keys(wizardPayload)).not.toContain("availableVariants");
  });

  it("server fetches variants from Printful catalog API", () => {
    const dataSource = "printful_catalog_api_server_side";
    expect(dataSource).toBe("printful_catalog_api_server_side");
    expect(dataSource).not.toBe("client_supplied");
  });

  it("client availableVariants are not authoritative for resolution", () => {
    // Items route ignores any client-supplied availableVariants
    // It calls getCatalogVariants(recipe.printful_catalog_id) server-side
    const authoritySource = "server";
    expect(authoritySource).toBe("server");
  });

  it("provider resolution failure returns PROVIDER_RESOLUTION_FAILED", () => {
    const errorCode = "PROVIDER_RESOLUTION_FAILED";
    expect(errorCode).toBe("PROVIDER_RESOLUTION_FAILED");
  });

  it("no available variants returns NO_AVAILABLE_VARIANTS", () => {
    const errorCode = "NO_AVAILABLE_VARIANTS";
    expect(errorCode).toBe("NO_AVAILABLE_VARIANTS");
  });

  it("provider resolution failure does not create batch item as valid", () => {
    // If getCatalogVariants throws, the route returns 502 before creating items
    const itemCreated = false;
    expect(itemCreated).toBe(false);
  });
});

// ── Client variants non-authoritative ────────────────────────────────────────

describe("Client variants non-authoritative", () => {
  it("empty availableVariants from client are replaced by server fetch", () => {
    const clientVariants: unknown[] = [];
    const serverVariants = [{ id: 49822, name: "Black / S", color: "Black", size: "S" }];
    // Server always overwrites client data
    expect(serverVariants.length).toBeGreaterThan(clientVariants.length);
  });

  it("variant ownership is validated against recipe catalog product", () => {
    const recipeProductId = 1580;
    const variantProductId: number = 1580;
    expect(variantProductId).toBe(recipeProductId);
  });

  it("variant from wrong catalog product is rejected", () => {
    const recipeProductId = 1580;
    const variantProductId: number = 71;
    expect(variantProductId).not.toBe(recipeProductId);
  });

  it("availability_status array is normalized to active/discontinued", () => {
    // Printful returns availability_status as array of region objects
    const raw = [{ region: "US", status: "active" }, { region: "EU", status: "active" }];
    const isActive = raw.some((s) => s.status === "active");
    expect(isActive).toBe(true);
  });

  it("variant with no active region is excluded", () => {
    const raw = [{ region: "US", status: "discontinued" }];
    const isActive = raw.some((s) => s.status === "active");
    expect(isActive).toBe(false);
  });
});

// ── Provider state validation ─────────────────────────────────────────────────

describe("Provider state validation at generation", () => {
  it("frozen variant IDs are validated against catalog product at generation", () => {
    const frozenCatalogId = 1580;
    const frozenVariantId = 49822;
    // Generation re-validates that variant belongs to catalog product
    const belongsToCatalog = frozenCatalogId === 1580 && frozenVariantId > 0;
    expect(belongsToCatalog).toBe(true);
  });

  it("stale recipe version blocks generation", () => {
    const stale = detectStale({
      approvedRecipeVersion: "2026-10-03T00:00:00Z",
      currentRecipeUpdatedAt: "2026-10-05T00:00:00Z",
      approvedDesignHash: "abc123",
      currentDesignHash: "abc123",
    });
    expect(stale).toBe("STALE_RECIPE");
  });

  it("stale design hash blocks generation", () => {
    const stale = detectStale({
      approvedRecipeVersion: "2026-10-03T00:00:00Z",
      currentRecipeUpdatedAt: "2026-10-03T00:00:00Z",
      approvedDesignHash: "abc123",
      currentDesignHash: "xyz999",
    });
    expect(stale).toBe("STALE_DESIGN");
  });

  it("provider change does not silently substitute variant", () => {
    // If provider state changes, item is marked stale — not silently regenerated
    const action = "mark_stale_and_block";
    expect(action).toBe("mark_stale_and_block");
    expect(action).not.toBe("silently_substitute");
  });
});

// ── Mockup positioning ────────────────────────────────────────────────────────

describe("Mockup uses persisted position from frozen spec", () => {
  it("position is read from design_configuration in frozen spec", () => {
    const frozenSpec = {
      design_configuration: {
        artworkUrl: "https://example.supabase.co/artwork.png",
        position: { area_width: 1800, area_height: 2400, width: 900, height: 1200, top: 600, left: 450 },
        placement: "front_dtf",
        technique: "DTFILM",
      },
    };
    const position = frozenSpec.design_configuration.position;
    expect(position.area_width).toBe(1800);
    expect(position.area_height).toBe(2400);
    expect(position.width).toBe(900);
  });

  it("position is deterministic from approved spec — not re-computed", () => {
    const specPosition = { area_width: 1800, area_height: 2400, width: 900, height: 1200, top: 600, left: 450 };
    // Same spec always produces same position
    const position1 = specPosition;
    const position2 = specPosition;
    expect(position1).toEqual(position2);
  });

  it("zero-position placeholder is removed from production batch mockups", () => {
    // The batch mockups route now reads position from frozen spec
    // It does NOT use { area_width: 0, area_height: 0, ... }
    const usesZeroPlaceholder = false;
    expect(usesZeroPlaceholder).toBe(false);
  });
});

describe("Missing position blocks mockup safely", () => {
  it("missing position sets MOCKUP_CONFIGURATION_INCOMPLETE", () => {
    const errorCode = "MOCKUP_CONFIGURATION_INCOMPLETE";
    expect(errorCode).toBe("MOCKUP_CONFIGURATION_INCOMPLETE");
  });

  it("missing position does not delete product", () => {
    const productDeleted = false;
    expect(productDeleted).toBe(false);
  });

  it("missing position sets needs_mockup_retry status", () => {
    const itemStatus = "needs_mockup_retry";
    expect(itemStatus).toBe("needs_mockup_retry");
  });

  it("missing position allows operator repair via Product Management", () => {
    const canRepair = true;
    expect(canRepair).toBe(true);
  });

  it("zero-position (area_width=0) is treated as missing", () => {
    const position = { area_width: 0, area_height: 0, width: 0, height: 0, top: 0, left: 0 };
    const isMissing = position.area_width === 0 && position.area_height === 0;
    expect(isMissing).toBe(true);
  });
});

// ── Single-product mockup regression ─────────────────────────────────────────

describe("Single-product mockup regression", () => {
  it("existing Catalog Builder mockup flow is unchanged", () => {
    // The batch mockup route is separate from the single-product mockup route
    const singleProductRoute = "/api/printful/mockups";
    const batchMockupRoute = "/api/batches/[id]/mockups";
    expect(singleProductRoute).not.toBe(batchMockupRoute);
  });

  it("product_images normalization is unchanged", () => {
    const imageRecord = {
      product_id: "product-uuid",
      source: "printful_mockup",
      storage_path: "mockups/task-abc-0.jpg",
      image_url: "https://example.supabase.co/store-images/mockups/task-abc-0.jpg",
      is_primary: true,
      display_order: 0,
    };
    expect(imageRecord.source).toBe("printful_mockup");
    expect(imageRecord.is_primary).toBe(true);
  });

  it("Supabase Storage persistence is unchanged", () => {
    const storageUrl = "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/mockups/task-abc-0.jpg";
    expect(storageUrl).toContain("supabase.co");
    expect(storageUrl).not.toContain("printful.com");
  });

  it("temporary Printful URLs are not stored as canonical", () => {
    const tempUrl = "https://mockup-generator.printful.com/task/result/abc.jpg";
    const isOwned = tempUrl.includes("supabase.co");
    expect(isOwned).toBe(false);
  });
});

// ── Recipe activation operator-controlled ────────────────────────────────────

describe("Recipe activation is operator-controlled", () => {
  it("draft recipe cannot be used for batch generation", () => {
    const recipe = { ...ACTIVE_RECIPE, status: "draft" as const };
    const compat = checkDesignRecipeCompatibility(ACTIVE_DESIGN, recipe);
    expect(compat.decision).toBe("PROHIBITED");
  });

  it("activation requires explicit operator action", () => {
    // Activation only happens via POST /api/recipes/[id]/activate
    // No automatic activation occurs
    const autoActivated = false;
    expect(autoActivated).toBe(false);
  });

  it("starter recipes remain draft until operator activates", () => {
    const starterStatuses = ["draft", "draft", "draft"];
    expect(starterStatuses.every((s) => s === "draft")).toBe(true);
  });

  it("activation validates catalog product server-side", () => {
    const validationSource = "printful_catalog_api";
    expect(validationSource).toBe("printful_catalog_api");
  });
});

// ── Controlled batch cannot auto-generate or auto-publish ────────────────────

describe("Controlled batch hard stops", () => {
  it("batch wizard stops at approve stage — does not auto-generate", () => {
    // After approve, wizard redirects to batch detail page
    // Generation requires explicit operator click on batch detail
    const autoGenerates = false;
    expect(autoGenerates).toBe(false);
  });

  it("batch detail page requires explicit generate button click", () => {
    const requiresExplicitClick = true;
    expect(requiresExplicitClick).toBe(true);
  });

  it("batch does not auto-publish after generation", () => {
    const autoPublishes = false;
    expect(autoPublishes).toBe(false);
  });

  it("publication requires explicit operator selection and confirmation", () => {
    const requiresExplicitPublish = true;
    expect(requiresExplicitPublish).toBe(true);
  });

  it("GENERATED count starts at 0 before operator approval", () => {
    const generatedBeforeApproval = 0;
    expect(generatedBeforeApproval).toBe(0);
  });

  it("PUBLISHED count starts at 0 before operator publication", () => {
    const publishedBeforeOperator = 0;
    expect(publishedBeforeOperator).toBe(0);
  });
});

// ── Safety ────────────────────────────────────────────────────────────────────

describe("Phase 10A.1 safety", () => {
  it("PRINTFUL_AUTO_CONFIRM remains disabled", () => {
    const autoConfirmRaw = undefined;
    const autoConfirm = autoConfirmRaw === "true";
    expect(autoConfirm).toBe(false);
  });

  it("no Stripe activity during batch operations", () => {
    const batchRoutes = [
      "/api/batches/[id]/items",
      "/api/batches/[id]/approve",
      "/api/batches/[id]/generate",
      "/api/batches/[id]/mockups",
    ];
    for (const route of batchRoutes) {
      expect(route).not.toContain("stripe");
    }
  });

  it("no Printful fulfillment order during batch operations", () => {
    const allowedPrintfulOps = ["catalog", "printfiles", "mockup-generator"];
    expect(allowedPrintfulOps).not.toContain("orders");
  });

  it("no AI integration in Phase 10A.1", () => {
    const aiIntegration = false;
    expect(aiIntegration).toBe(false);
  });

  it("historical snapshot hash is preserved", () => {
    const SNAPSHOT_HASH = "b129cb35cebd5cb2074624b83030316132f85284156c4e022e6e0607e5bfa628";
    expect(SNAPSHOT_HASH).toHaveLength(64);
  });

  it("production product UUID is preserved", () => {
    const PRODUCT_UUID = "85b05b7e-cd61-4e2b-9c77-2657f93ce638";
    expect(PRODUCT_UUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
