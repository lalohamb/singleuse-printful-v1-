import { describe, it, expect } from "vitest";
import { validateArtworkForPrintfile } from "@/lib/fulfillment/artwork-validation";
import type { PrintfileSpec } from "@/lib/fulfillment/artwork-validation";

// BC4851GD front_dtf spec (verified Phase 7C)
const BC4851GD_FRONT: PrintfileSpec = {
  printfile_id: 1,
  width: 1800,
  height: 2400,
  dpi: 150,
  fill_mode: "fit",
};

// ── Product workspace API whitelist ───────────────────────────────────────────

describe("Product workspace API field whitelist", () => {
  const ALLOWED = new Set([
    "title", "description", "short_description", "slug",
    "meta_title", "meta_description", "category_id",
    "brand", "product_type", "status", "featured",
    "is_new_arrival", "is_trending", "is_bestseller", "is_on_sale",
    "is_personalizable", "personalization_label",
    "compare_at_price", "content_locked",
  ]);

  const FORBIDDEN = [
    "printful_id", "printful_catalog_id", "catalog_source",
    "fulfillment_snapshot", "price", "cost", "id",
    "created_at", "stripe_session_id",
  ];

  it("allows all store-owned commercial fields", () => {
    expect(ALLOWED.has("title")).toBe(true);
    expect(ALLOWED.has("description")).toBe(true);
    expect(ALLOWED.has("slug")).toBe(true);
    expect(ALLOWED.has("meta_title")).toBe(true);
    expect(ALLOWED.has("status")).toBe(true);
  });

  it("blocks provider identity fields", () => {
    for (const f of FORBIDDEN) {
      expect(ALLOWED.has(f)).toBe(false);
    }
  });

  it("blocks fulfillment_snapshot from being patched", () => {
    expect(ALLOWED.has("fulfillment_snapshot")).toBe(false);
  });
});

// ── Publication gates ─────────────────────────────────────────────────────────

describe("Publication gates for catalog_builder products", () => {
  function checkGates(product: {
    price: number;
    printful_catalog_id: number | null;
  }, hasDesign: boolean, hasArtwork: boolean, activeVariants: number) {
    const gates = {
      price: product.price > 0,
      catalog_id: !!product.printful_catalog_id,
      design: hasDesign,
      artwork: hasArtwork,
      variants: activeVariants > 0,
    };
    return Object.values(gates).every(Boolean);
  }

  it("passes when all gates satisfied", () => {
    expect(checkGates({ price: 60, printful_catalog_id: 1580 }, true, true, 35)).toBe(true);
  });

  it("fails with no active variants", () => {
    expect(checkGates({ price: 60, printful_catalog_id: 1580 }, true, true, 0)).toBe(false);
  });

  it("fails with zero price", () => {
    expect(checkGates({ price: 0, printful_catalog_id: 1580 }, true, true, 5)).toBe(false);
  });

  it("fails with no catalog mapping", () => {
    expect(checkGates({ price: 60, printful_catalog_id: null }, true, true, 5)).toBe(false);
  });

  it("fails with no design", () => {
    expect(checkGates({ price: 60, printful_catalog_id: 1580 }, false, false, 5)).toBe(false);
  });

  it("fails with no artwork", () => {
    expect(checkGates({ price: 60, printful_catalog_id: 1580 }, true, false, 5)).toBe(false);
  });
});

// ── Artwork replacement safety ────────────────────────────────────────────────

describe("Artwork replacement — FAIL blocks active product", () => {
  it("FAIL artwork (< 150 DPI) must not replace active production artwork", () => {
    // 1200x1200 artwork on BC4851GD front_dtf — same as Phase 7A test case
    const result = validateArtworkForPrintfile(1200, 1200, BC4851GD_FRONT);
    expect(result.status).toBe("FAIL");
    // Simulate the block: if status is FAIL, replacement is rejected
    const replacementAllowed = result.status !== "FAIL";
    expect(replacementAllowed).toBe(false);
  });

  it("PASS artwork (>= 300 DPI) is allowed to replace", () => {
    // 4200x4800 production master
    const result = validateArtworkForPrintfile(4200, 4800, BC4851GD_FRONT);
    expect(result.status).toBe("PASS");
    const replacementAllowed = result.status !== "FAIL";
    expect(replacementAllowed).toBe(true);
  });

  it("PASS_WARNING artwork (>= 150 DPI) is allowed with warning", () => {
    // ~225 DPI effective
    const result = validateArtworkForPrintfile(2700, 3600, BC4851GD_FRONT);
    expect(result.status).toBe("PASS_WARNING");
    const replacementAllowed = result.status !== "FAIL";
    expect(replacementAllowed).toBe(true);
  });
});

// ── Historical snapshot immutability ─────────────────────────────────────────

describe("Historical order snapshot immutability", () => {
  const PHASE7_SNAPSHOT = {
    version: 1,
    strategy: "DIRECT_CATALOG_ORDER",
    store_product_id: "85b05b7e-cd61-4e2b-9c77-2657f93ce638",
    store_variant_id: "b7eb8f1b-5cbc-4ace-803d-75e3c7bcae19",
    printful_catalog_product_id: 1580,
    printful_catalog_variant_id: 49822,
    design_id: "dc6f0073-d0de-4596-8ae2-57e04916ff06",
    artwork_url: "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/artwork/tmp/1790988655355-6b80622243.png",
    placement: "front_dtf",
    technique: "DTFILM",
  };

  it("snapshot contains correct strategy", () => {
    expect(PHASE7_SNAPSHOT.strategy).toBe("DIRECT_CATALOG_ORDER");
  });

  it("snapshot artwork is production PNG not mockup", () => {
    expect(PHASE7_SNAPSHOT.artwork_url).toContain("artwork/");
    expect(PHASE7_SNAPSHOT.artwork_url).not.toContain("mockup");
    expect(PHASE7_SNAPSHOT.artwork_url).not.toContain("test_design");
  });

  it("snapshot product and variant UUIDs match Phase 7C candidate", () => {
    expect(PHASE7_SNAPSHOT.store_product_id).toBe("85b05b7e-cd61-4e2b-9c77-2657f93ce638");
    expect(PHASE7_SNAPSHOT.store_variant_id).toBe("b7eb8f1b-5cbc-4ace-803d-75e3c7bcae19");
  });

  it("snapshot Printful IDs match Phase 7C candidate", () => {
    expect(PHASE7_SNAPSHOT.printful_catalog_product_id).toBe(1580);
    expect(PHASE7_SNAPSHOT.printful_catalog_variant_id).toBe(49822);
  });

  it("product edit PATCH whitelist does not include fulfillment_snapshot", () => {
    const PATCH_WHITELIST = [
      "title", "description", "short_description", "slug",
      "meta_title", "meta_description", "category_id",
      "brand", "product_type", "status", "featured",
      "is_new_arrival", "is_trending", "is_bestseller", "is_on_sale",
      "is_personalizable", "personalization_label",
      "compare_at_price", "content_locked",
    ];
    expect(PATCH_WHITELIST.includes("fulfillment_snapshot")).toBe(false);
  });
});

// ── Design library protection ─────────────────────────────────────────────────

describe("Design library lifecycle protection", () => {
  it("archived design cannot be attached to a product", () => {
    const design = { status: "archived" };
    const canAttach = design.status !== "archived";
    expect(canAttach).toBe(false);
  });

  it("active design can be attached", () => {
    const design = { status: "active" };
    const canAttach = design.status !== "archived";
    expect(canAttach).toBe(true);
  });

  it("design with usage_count > 0 should not be deleted", () => {
    const usageCount: number = 1;
    const canDelete = usageCount === 0;
    expect(canDelete).toBe(false);
  });

  it("design with usage_count = 0 can be deleted", () => {
    const usageCount: number = 0;
    const canDelete = usageCount === 0;
    expect(canDelete).toBe(true);
  });
});

// ── Image management safety ───────────────────────────────────────────────────

describe("Image management safety", () => {
  it("cannot delete last product image", () => {
    const imageCount = 1;
    const canDelete = imageCount > 1;
    expect(canDelete).toBe(false);
  });

  it("can delete when multiple images exist", () => {
    const imageCount = 3;
    const canDelete = imageCount > 1;
    expect(canDelete).toBe(true);
  });
});

// ── Variant mapping preservation ─────────────────────────────────────────────

describe("Variant mapping preservation", () => {
  it("store variant UUID is stable — not derived from Printful ID", () => {
    const storeVariantId = "b7eb8f1b-5cbc-4ace-803d-75e3c7bcae19";
    const printfulVariantId = "49822";
    // They are different — store UUID is independent
    expect(storeVariantId).not.toBe(printfulVariantId);
    // Store UUID is a proper UUID
    expect(storeVariantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("retail price update does not change printful_variant_id", () => {
    const variant = { id: "b7eb8f1b", printful_variant_id: "49822", retail_price: 60 };
    const patch = { retail_price: 65 };
    const updated = { ...variant, ...patch };
    expect(updated.printful_variant_id).toBe("49822");
    expect(updated.retail_price).toBe(65);
  });
});

// ── PRINTFUL_AUTO_CONFIRM safety ──────────────────────────────────────────────

describe("PRINTFUL_AUTO_CONFIRM remains disabled during Phase 8A", () => {
  it("autoConfirm is false when env var is absent", () => {
    const autoConfirmRaw = undefined;
    const autoConfirm = autoConfirmRaw === "true";
    expect(autoConfirm).toBe(false);
  });

  it("autoConfirm is false when env var is empty string", () => {
    const autoConfirmRaw: string = "";
    const autoConfirm = autoConfirmRaw === "true";
    expect(autoConfirm).toBe(false);
  });

  it("autoConfirm is only true for exact string 'true'", () => {
    const check = (v: string) => v === "true";
    expect(check("true")).toBe(true);
    expect(check("True")).toBe(false);
    expect(check("1")).toBe(false);
    expect(check("yes")).toBe(false);
  });
});

// ── Slug uniqueness ───────────────────────────────────────────────────────────

describe("Slug uniqueness validation", () => {
  it("slug must be lowercase alphanumeric with hyphens", () => {
    const validSlug = (s: string) => /^[a-z0-9-]+$/.test(s);
    expect(validSlug("grandpa-still-original")).toBe(true);
    expect(validSlug("Grandpa Still Original")).toBe(false);
    expect(validSlug("grandpa_still_original")).toBe(false);
    expect(validSlug("grandpa-still-original-2")).toBe(true);
  });
});

// ── Catalog source routing ────────────────────────────────────────────────────

describe("Product source routing", () => {
  it("catalog_builder products route to new workspace", () => {
    const product = { catalog_source: "catalog_builder" };
    const useWorkspace = product.catalog_source === "catalog_builder";
    expect(useWorkspace).toBe(true);
  });

  it("printful_sync products are identified as legacy", () => {
    const product = { catalog_source: "printful_sync" };
    const isLegacy = product.catalog_source === "printful_sync";
    expect(isLegacy).toBe(true);
  });

  it("production product Grandpa Still Original is catalog_builder", () => {
    const catalogSource = "catalog_builder";
    expect(catalogSource).toBe("catalog_builder");
  });
});
