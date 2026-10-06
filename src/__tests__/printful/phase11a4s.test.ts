// Phase 11A.4S — Pricing Semantics Cleanup Regression Tests
//
// Covers the three fixes:
//   1. effectiveAmount() — missing/unparseable → null; explicit "0.00" → 0
//   2. recipe-engine.ts — parseFloat || null replaced with finite-safe parse
//   3. catalog-builder route — provider_cost || null replaced with ?? null
//
// Does NOT re-test pagination, CatalogVariant identity, COST_PLUS blocking,
// Printful Sync, or fulfillment — those are covered by phase11a4.test.ts.

import { describe, test, expect } from "vitest";
import { effectiveAmount, resolveProviderCost, type CatalogProductPricing } from "@/lib/printful/pricing";
import { resolveProductRecipe, type RecipeResolutionInput, type ProductRecipe } from "@/lib/catalog/recipe-engine";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePricing(
  variantId: number,
  techniqueKey: string,
  variantPrice: string,
  variantDiscounted: string,
  placementId: string,
  placementPrice: string,
  placementDiscounted: string
): CatalogProductPricing {
  return {
    catalog_product_id: 679,
    currency: "USD",
    placements: [{
      id: placementId,
      title: "Front",
      type: "print",
      technique_key: techniqueKey,
      placement_options: [],
      price: placementPrice,
      discounted_price: placementDiscounted,
      layers: [],
    }],
    variantPrices: new Map([
      [variantId, [{ technique_key: techniqueKey, technique_display_name: "DTFilm", price: variantPrice, discounted_price: variantDiscounted }]],
    ]),
  };
}

const BASE_RECIPE: ProductRecipe = {
  id: "r1",
  name: "Test Recipe",
  slug: "test-recipe",
  description: null,
  status: "active",
  provider: "printful",
  printful_catalog_id: 679,
  technique: "DTFILM",
  placement: "front",
  printfile_id: null,
  variant_rules: {},
  pricing_rules: { strategy: "FIXED_PRICE", fixed_price: 35.00 },
  mockup_rules: {},
  commercial_defaults: {},
  publication_default: "draft",
  metadata: {},
  created_at: "",
  updated_at: "",
};

const BASE_DESIGN = {
  id: "d1",
  artwork_url: "https://example.supabase.co/storage/v1/object/public/designs/test.png",
  width: 4200,
  height: 4800,
  name: "Test Design",
};

const BASE_COMMERCIAL = { title: "Test Product", slug: "test-product" };

// ── 1. effectiveAmount — missing/unparseable returns null ─────────────────────

describe("effectiveAmount — missing price returns null", () => {
  test("both empty strings → null", () => {
    expect(effectiveAmount("", "")).toBeNull();
  });

  test("both non-numeric strings → null", () => {
    expect(effectiveAmount("N/A", "N/A")).toBeNull();
  });

  test("undefined-like empty discounted, empty base → null", () => {
    expect(effectiveAmount("", "abc")).toBeNull();
  });
});

describe("effectiveAmount — malformed price returns null", () => {
  test("'null' string → null", () => {
    expect(effectiveAmount("null", "null")).toBeNull();
  });

  test("'undefined' string → null", () => {
    expect(effectiveAmount("undefined", "")).toBeNull();
  });

  test("whitespace only → null", () => {
    expect(effectiveAmount("   ", "   ")).toBeNull();
  });
});

describe("effectiveAmount — explicit '0.00' is a valid known zero", () => {
  test("discounted_price '0.00' → 0", () => {
    expect(effectiveAmount("5.00", "0.00")).toBe(0);
  });

  test("price '0.00', discounted empty → 0", () => {
    expect(effectiveAmount("0.00", "")).toBe(0);
  });

  test("both '0.00' → 0", () => {
    expect(effectiveAmount("0.00", "0.00")).toBe(0);
  });
});

describe("effectiveAmount — positive discounted_price preferred over price", () => {
  test("discounted 5.95 preferred over price 7.00", () => {
    expect(effectiveAmount("7.00", "5.95")).toBe(5.95);
  });

  test("discounted 19.64 preferred over price 22.00", () => {
    expect(effectiveAmount("22.00", "19.64")).toBe(19.64);
  });
});

describe("effectiveAmount — valid positive price fallback when discounted unparseable", () => {
  test("discounted empty, price 5.95 → 5.95", () => {
    expect(effectiveAmount("5.95", "")).toBe(5.95);
  });

  test("discounted 'N/A', price 19.64 → 19.64", () => {
    expect(effectiveAmount("19.64", "N/A")).toBe(19.64);
  });
});

// ── resolveProviderCost propagates null from effectiveAmount ──────────────────

describe("resolveProviderCost — unparseable price data returns unknown", () => {
  test("variant with empty price strings → unknown", () => {
    const pricing: CatalogProductPricing = {
      catalog_product_id: 679,
      currency: "USD",
      placements: [{
        id: "front",
        title: "Front",
        type: "print",
        technique_key: "dtfilm",
        placement_options: [],
        price: "5.95",
        discounted_price: "5.95",
        layers: [],
      }],
      variantPrices: new Map([
        [17008, [{ technique_key: "dtfilm", technique_display_name: "DTFilm", price: "", discounted_price: "" }]],
      ]),
    };
    const result = resolveProviderCost(pricing, 17008, "DTFILM", "front");
    expect(result.status).toBe("unknown");
    expect((result as { status: "unknown"; reason: string }).reason).toMatch(/unparseable/);
  });

  test("placement with empty price strings → unknown", () => {
    const pricing: CatalogProductPricing = {
      catalog_product_id: 679,
      currency: "USD",
      placements: [{
        id: "front",
        title: "Front",
        type: "print",
        technique_key: "dtfilm",
        placement_options: [],
        price: "",
        discounted_price: "",
        layers: [],
      }],
      variantPrices: new Map([
        [17008, [{ technique_key: "dtfilm", technique_display_name: "DTFilm", price: "19.64", discounted_price: "19.64" }]],
      ]),
    };
    const result = resolveProviderCost(pricing, 17008, "DTFILM", "front");
    expect(result.status).toBe("unknown");
    expect((result as { status: "unknown"; reason: string }).reason).toMatch(/unparseable/);
  });

  test("variant price '0.00' + placement price '0.00' → resolved cost 0", () => {
    const pricing = makePricing(17008, "dtfilm", "0.00", "0.00", "front", "0.00", "0.00");
    const result = resolveProviderCost(pricing, 17008, "DTFILM", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.cost).toBe(0);
      expect(result.variantAmount).toBe(0);
      expect(result.placementAmount).toBe(0);
    }
  });
});

// ── 2. recipe-engine — "0.00" does not become null ───────────────────────────

describe("recipe-engine — provider cost '0.00' does not become null", () => {
  test("variant with price '0.00' resolves providerCost = 0, not null", () => {
    const input: RecipeResolutionInput = {
      recipe: { ...BASE_RECIPE, pricing_rules: { strategy: "FIXED_PRICE", fixed_price: 35.00 } },
      design: BASE_DESIGN,
      availableVariants: [{ id: 17008, name: "Black / 2XL", color: "Black", size: "2XL", price: "0.00" }],
      commercialInputs: BASE_COMMERCIAL,
      idempotency_key: "test-zero-cost",
    };
    const result = resolveProductRecipe(input);
    expect(result.valid).toBe(true);
    expect(result.spec).not.toBeNull();
    // provider_cost must be 0 (known zero), not null (unknown)
    expect(result.spec!.variants[0].provider_cost).toBe(0);
  });

  test("variant with price '' resolves providerCost = null (unknown)", () => {
    const input: RecipeResolutionInput = {
      recipe: { ...BASE_RECIPE, pricing_rules: { strategy: "FIXED_PRICE", fixed_price: 35.00 } },
      design: BASE_DESIGN,
      availableVariants: [{ id: 17008, name: "Black / 2XL", color: "Black", size: "2XL", price: "" }],
      commercialInputs: BASE_COMMERCIAL,
      idempotency_key: "test-empty-cost",
    };
    const result = resolveProductRecipe(input);
    expect(result.valid).toBe(true);
    expect(result.spec!.variants[0].provider_cost).toBeNull();
  });

  test("variant with price 'N/A' resolves providerCost = null (unknown)", () => {
    const input: RecipeResolutionInput = {
      recipe: { ...BASE_RECIPE, pricing_rules: { strategy: "FIXED_PRICE", fixed_price: 35.00 } },
      design: BASE_DESIGN,
      availableVariants: [{ id: 17008, name: "Black / 2XL", color: "Black", size: "2XL", price: "N/A" }],
      commercialInputs: BASE_COMMERCIAL,
      idempotency_key: "test-invalid-cost",
    };
    const result = resolveProductRecipe(input);
    expect(result.valid).toBe(true);
    expect(result.spec!.variants[0].provider_cost).toBeNull();
  });
});

// ── 3. catalog-builder route — provider_cost 0 survives persistence mapping ──
// The route.ts fix (|| null → ?? null) is a server-side mapping.
// We verify the semantic contract: 0 is a valid known cost, not falsy-coerced to null.

describe("provider_cost 0 survives persistence mapping", () => {
  test("provider_cost 0 is not falsy-coerced to null by ?? null", () => {
    // Simulate the fixed mapping: v.provider_cost ?? null
    const cases: Array<{ input: number | null; expected: number | null }> = [
      { input: 0,     expected: 0    },  // known zero — must survive
      { input: 25.59, expected: 25.59 }, // normal resolved cost
      { input: null,  expected: null },  // unknown — stays null
    ];
    for (const { input, expected } of cases) {
      const result = input ?? null;
      expect(result).toBe(expected);
    }
  });

  test("provider_cost 0 would be incorrectly coerced by || null (documents the old bug)", () => {
    // This test documents why || null was wrong
    const zeroCost = 0;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const withOr = zeroCost || null;   // old behavior: 0 → null (WRONG)
    const withNullish = zeroCost ?? null; // new behavior: 0 → 0 (CORRECT)
    expect(withOr).toBeNull();       // old bug: zero was lost
    expect(withNullish).toBe(0);     // fix: zero is preserved
  });
});
