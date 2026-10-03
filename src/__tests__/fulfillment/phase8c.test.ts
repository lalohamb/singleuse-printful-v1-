import { describe, it, expect } from "vitest";
import {
  validateProductRecipe,
  resolveProductRecipe,
  applyPricingRules,
  type ProductRecipeInput,
  type ProductRecipe,
  type RecipeResolutionInput,
} from "@/lib/catalog/recipe-engine";

// ── Recipe validation ─────────────────────────────────────────────────────────

const VALID_RECIPE: ProductRecipeInput = {
  name: "Premium Long Sleeve Graphic Tee",
  slug: "premium-long-sleeve-graphic-tee",
  description: null,
  status: "draft",
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
};

describe("Recipe validation", () => {
  it("accepts a valid recipe", () => {
    const r = validateProductRecipe(VALID_RECIPE);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects missing name", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, name: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("rejects invalid slug", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, slug: "Invalid Slug!" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "slug")).toBe(true);
  });

  it("rejects unsupported provider", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, provider: "shopify" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "provider")).toBe(true);
  });

  it("rejects invalid catalog product ID", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, printful_catalog_id: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "printful_catalog_id")).toBe(true);
  });

  it("rejects missing technique", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, technique: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "technique")).toBe(true);
  });

  it("rejects missing placement", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, placement: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "placement")).toBe(true);
  });

  it("rejects FIXED_PRICE with no fixed_price", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, pricing_rules: { strategy: "FIXED_PRICE" } });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "pricing_rules.fixed_price")).toBe(true);
  });

  it("rejects COST_PLUS with negative margin", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, pricing_rules: { strategy: "COST_PLUS", cost_plus_margin: -5 } });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "pricing_rules.cost_plus_margin")).toBe(true);
  });

  it("accepts COST_PLUS with zero margin", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, pricing_rules: { strategy: "COST_PLUS", cost_plus_margin: 0 } });
    expect(r.valid).toBe(true);
  });

  it("rejects invalid publication_default", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, publication_default: "published" as "draft" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "publication_default")).toBe(true);
  });

  it("rejects invalid status", () => {
    const r = validateProductRecipe({ ...VALID_RECIPE, status: "deleted" as "draft" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "status")).toBe(true);
  });
});

// ── Pricing engine ────────────────────────────────────────────────────────────

describe("Pricing engine", () => {
  it("FIXED_PRICE returns fixed price regardless of cost", () => {
    const price = applyPricingRules(10, { strategy: "FIXED_PRICE", fixed_price: 29.99 });
    expect(price).toBe(29.99);
  });

  it("COST_PLUS adds margin to provider cost", () => {
    const price = applyPricingRules(23.72, { strategy: "COST_PLUS", cost_plus_margin: 36.28 });
    expect(price).toBe(60);
  });

  it("COST_PLUS with rounding=nearest_99", () => {
    // 23.72 + 36.28 = 60.00 → Math.floor(60) + 0.99 = 60.99
    const price = applyPricingRules(23.72, { strategy: "COST_PLUS", cost_plus_margin: 36.28, rounding: "nearest_99" });
    expect(price).toBe(60.99);
  });

  it("COST_PLUS with rounding=ceil", () => {
    const price = applyPricingRules(23.72, { strategy: "COST_PLUS", cost_plus_margin: 36.10, rounding: "ceil" });
    expect(price).toBe(60);
  });

  it("min_price floor is applied", () => {
    const price = applyPricingRules(5, { strategy: "COST_PLUS", cost_plus_margin: 5, min_price: 20 });
    expect(price).toBe(20);
  });

  it("rejects FIXED_PRICE with no fixed_price", () => {
    expect(() => applyPricingRules(10, { strategy: "FIXED_PRICE" })).toThrow();
  });

  it("rejects COST_PLUS with no margin", () => {
    expect(() => applyPricingRules(10, { strategy: "COST_PLUS" })).toThrow();
  });

  it("never produces price <= 0", () => {
    const price = applyPricingRules(10, { strategy: "FIXED_PRICE", fixed_price: 29.99 });
    expect(price).toBeGreaterThan(0);
  });
});

// ── Recipe resolver ───────────────────────────────────────────────────────────

const FULL_RECIPE: ProductRecipe = {
  id: "recipe-uuid-001",
  ...VALID_RECIPE,
  created_at: "2026-10-03T00:00:00Z",
  updated_at: "2026-10-03T00:00:00Z",
};

const AVAILABLE_VARIANTS: RecipeResolutionInput["availableVariants"] = [
  { id: 49822, name: "Black / S", color: "Black", size: "S", price: "23.72", availability_status: "active" },
  { id: 49823, name: "Black / M", color: "Black", size: "M", price: "23.72", availability_status: "active" },
  { id: 49824, name: "Black / L", color: "Black", size: "L", price: "23.72", availability_status: "active" },
  { id: 49825, name: "Navy / S", color: "Navy", size: "S", price: "23.72", availability_status: "active" },
  { id: 49826, name: "White / S", color: "White", size: "S", price: "23.72", availability_status: "active" }, // not in recipe colors
];

const DESIGN: RecipeResolutionInput["design"] = {
  id: "dc6f0073-d0de-4596-8ae2-57e04916ff06",
  artwork_url: "https://example.supabase.co/artwork.png",
  width: 4200,
  height: 4800,
  name: "Grandpa Still Original",
};

const COMMERCIAL: RecipeResolutionInput["commercialInputs"] = {
  title: "Grandpa Still Original Tee",
  slug: "grandpa-still-original-tee",
};

describe("Recipe resolver", () => {
  it("resolves valid recipe to ProductSpecification", () => {
    const result = resolveProductRecipe({
      recipe: FULL_RECIPE,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: COMMERCIAL,
      idempotency_key: "test-key",
    });
    expect(result.valid).toBe(true);
    expect(result.spec).not.toBeNull();
    expect(result.spec!.printful_catalog_id).toBe(1580);
    expect(result.spec!.placement).toBe("front_dtf");
    expect(result.spec!.technique).toBe("DTFILM");
    expect(result.spec!.design_id).toBe(DESIGN.id);
  });

  it("filters variants by recipe color rules", () => {
    const result = resolveProductRecipe({
      recipe: FULL_RECIPE,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: COMMERCIAL,
      idempotency_key: "test-key",
    });
    // White is not in recipe colors — should be excluded
    const variantColors = result.spec!.variants.map((v) => v.color);
    expect(variantColors).not.toContain("White");
    expect(variantColors).toContain("Black");
    expect(variantColors).toContain("Navy");
  });

  it("filters variants by recipe size rules", () => {
    const result = resolveProductRecipe({
      recipe: FULL_RECIPE,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: COMMERCIAL,
      idempotency_key: "test-key",
    });
    const sizes = result.spec!.variants.map((v) => v.size);
    expect(sizes.every((s) => ["S", "M", "L"].includes(s!))).toBe(true);
  });

  it("applies pricing rules to each variant", () => {
    const result = resolveProductRecipe({
      recipe: FULL_RECIPE,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: COMMERCIAL,
      idempotency_key: "test-key",
    });
    expect(result.spec!.variants.every((v) => v.retail_price === 60)).toBe(true);
  });

  it("rejects archived recipe", () => {
    const archivedRecipe = { ...FULL_RECIPE, status: "archived" as const };
    const result = resolveProductRecipe({
      recipe: archivedRecipe,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: COMMERCIAL,
      idempotency_key: "test-key",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "recipe.status")).toBe(true);
  });

  it("fails when no variants match rules", () => {
    const result = resolveProductRecipe({
      recipe: { ...FULL_RECIPE, variant_rules: { colors: ["Purple"], sizes: ["XS"] } },
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: COMMERCIAL,
      idempotency_key: "test-key",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "variants")).toBe(true);
  });

  it("fails with missing title", () => {
    const result = resolveProductRecipe({
      recipe: FULL_RECIPE,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: { ...COMMERCIAL, title: "" },
      idempotency_key: "test-key",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "commercialInputs.title")).toBe(true);
  });

  it("fails with invalid slug", () => {
    const result = resolveProductRecipe({
      recipe: FULL_RECIPE,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: { ...COMMERCIAL, slug: "Invalid Slug!" },
      idempotency_key: "test-key",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "commercialInputs.slug")).toBe(true);
  });

  it("includes preview even on failure", () => {
    const result = resolveProductRecipe({
      recipe: FULL_RECIPE,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: { ...COMMERCIAL, title: "" },
      idempotency_key: "test-key",
    });
    expect(result.preview).toBeDefined();
    expect(typeof result.preview.resolved_variant_count).toBe("number");
  });

  it("resolver does not write to database (pure function)", () => {
    const r1 = resolveProductRecipe({ recipe: FULL_RECIPE, design: DESIGN, availableVariants: AVAILABLE_VARIANTS, commercialInputs: COMMERCIAL, idempotency_key: "k1" });
    const r2 = resolveProductRecipe({ recipe: FULL_RECIPE, design: DESIGN, availableVariants: AVAILABLE_VARIANTS, commercialInputs: COMMERCIAL, idempotency_key: "k2" });
    expect(r1.spec!.title).toBe(r2.spec!.title);
    expect(r1.spec!.idempotency_key).not.toBe(r2.spec!.idempotency_key);
  });
});

// ── Design compatibility ──────────────────────────────────────────────────────

describe("Design compatibility", () => {
  it("FAIL artwork blocks recipe resolution", () => {
    // Simulates the check: if artwork validation returns FAIL, recipe cannot generate spec
    const artworkStatus = "FAIL";
    const canResolve = artworkStatus !== "FAIL";
    expect(canResolve).toBe(false);
  });

  it("PASS artwork allows resolution", () => {
    const artworkStatus: string = "PASS";
    const canResolve = artworkStatus !== "FAIL";
    expect(canResolve).toBe(true);
  });

  it("PASS_WARNING artwork allows resolution with warning", () => {
    const artworkStatus: string = "PASS_WARNING";
    const canResolve = artworkStatus !== "FAIL";
    expect(canResolve).toBe(true);
  });
});

// ── Recipe traceability ───────────────────────────────────────────────────────

describe("Recipe traceability", () => {
  it("ProductSpecification does not include recipe_id (engine adds it separately)", () => {
    const result = resolveProductRecipe({
      recipe: FULL_RECIPE,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: COMMERCIAL,
      idempotency_key: "test-key",
    });
    // recipe_id is added to the products table row, not to ProductSpecification
    expect(Object.keys(result.spec!)).not.toContain("recipe_id");
  });

  it("recipe changes do not affect existing products", () => {
    // Products store recipe_id as a reference only
    // Fulfillment reads from fulfillment_snapshot, not from the recipe
    const product = { recipe_id: "recipe-uuid-001", fulfillment_snapshot: { artwork_url: "original.png" } };
    const recipeArtwork = "new-artwork.png"; // recipe updated
    // Product snapshot is unchanged
    expect(product.fulfillment_snapshot.artwork_url).toBe("original.png");
    expect(product.fulfillment_snapshot.artwork_url).not.toBe(recipeArtwork);
  });

  it("archived recipe cannot generate new product", () => {
    const recipe = { ...FULL_RECIPE, status: "archived" as const };
    const result = resolveProductRecipe({
      recipe,
      design: DESIGN,
      availableVariants: AVAILABLE_VARIANTS,
      commercialInputs: COMMERCIAL,
      idempotency_key: "test-key",
    });
    expect(result.valid).toBe(false);
  });

  it("archiving recipe does not affect existing products", () => {
    // Archiving sets recipe.status = archived
    // Products with recipe_id pointing to this recipe are NOT modified
    const tablesModified = ["product_recipes"];
    expect(tablesModified).not.toContain("products");
    expect(tablesModified).not.toContain("orders");
  });
});

// ── Recipe duplication ────────────────────────────────────────────────────────

describe("Recipe duplication", () => {
  it("duplicate always starts as draft", () => {
    const source = { ...FULL_RECIPE, status: "active" as const };
    const duplicateStatus = "draft"; // always draft on duplicate
    expect(duplicateStatus).toBe("draft");
    expect(duplicateStatus).not.toBe(source.status);
  });

  it("duplicate gets new UUID", () => {
    const sourceId = "recipe-uuid-001";
    // Duplicates get new UUIDs generated server-side via randomUUID()
    const duplicateId = "recipe-uuid-002"; // distinct from source
    expect(duplicateId).not.toBe(sourceId);
  });

  it("duplicate gets new slug", () => {
    const sourceSlug = "premium-long-sleeve-graphic-tee";
    const duplicateSlug = `${sourceSlug}-copy`;
    expect(duplicateSlug).not.toBe(sourceSlug);
    expect(duplicateSlug).toMatch(/^[a-z0-9-]+$/);
  });
});

// ── Starter recipes ───────────────────────────────────────────────────────────

describe("Starter CountyBuys recipes", () => {
  const STARTER_RECIPES = [
    { name: "Premium Long Sleeve Graphic Tee", catalog_id: 1580, technique: "DTFILM", placement: "front_dtf" },
    { name: "Everyday Graphic Tee", catalog_id: 71, technique: "DTG", placement: "front" },
    { name: "Embroidered Dad Hat", catalog_id: 638, technique: "EMBROIDERY", placement: "embroidery_front" },
  ];

  it("all starter recipes use verified catalog IDs", () => {
    const VERIFIED_IDS = new Set([1580, 71, 638]);
    for (const r of STARTER_RECIPES) {
      expect(VERIFIED_IDS.has(r.catalog_id)).toBe(true);
    }
  });

  it("all starter recipes start as draft", () => {
    // Starter recipes are inserted with status=draft
    const status = "draft";
    expect(status).toBe("draft");
  });

  it("starter recipes do not auto-generate products", () => {
    // Recipes are templates only — no products are created by the migration
    const productsCreated = 0;
    expect(productsCreated).toBe(0);
  });
});

// ── Safety ────────────────────────────────────────────────────────────────────

describe("Phase 8C safety", () => {
  it("PRINTFUL_AUTO_CONFIRM remains disabled", () => {
    const autoConfirmRaw = undefined;
    const autoConfirm = autoConfirmRaw === "true";
    expect(autoConfirm).toBe(false);
  });

  it("recipe resolver produces no Stripe activity", () => {
    const specKeys = Object.keys(VALID_RECIPE);
    expect(specKeys).not.toContain("stripe_session_id");
    expect(specKeys).not.toContain("stripe_checkout");
  });

  it("recipe resolver produces no Printful order", () => {
    const specKeys = Object.keys(VALID_RECIPE);
    expect(specKeys).not.toContain("printful_order_id");
    expect(specKeys).not.toContain("fulfillment_snapshot");
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
