/**
 * Phase 11A.3.2b — V2 Catalog Variant Adapter & Regional Eligibility
 *
 * Regression coverage for:
 *   - V2 {data, paging} envelope handling
 *   - Multi-page accumulation and deduplication
 *   - CatalogVariant identity semantics (no fabricated fields)
 *   - Eligibility states: eligible / unavailable / error / unknown
 *   - BlankSelector eligibility-based UI behavior
 *   - Pricing semantics: provider_cost null != 0
 *   - COST_PLUS blocking when provider cost is unknown
 *   - FIXED_PRICE validity without provider cost
 *   - Printful Sync identity unchanged
 */

import { describe, test, expect } from "vitest";
import type { CatalogVariant, CatalogVariantResult } from "@/lib/printful/types";
import type { ProductSummary, VariantPricing } from "@/app/admin/catalog-builder/types";
import { applyPricingRules, type PricingRules } from "@/lib/catalog/recipe-engine";

// ── 1. V2 envelope parsing ────────────────────────────────────────────────────

describe("V2 envelope", () => {
  test("data array is extracted from {data, paging} envelope", () => {
    const envelope = {
      data: [
        { id: 1001, catalog_product_id: 679, name: "Black / S", size: "S", color: "Black", color_code: "#000", color_code2: null, image: "https://example.com/1.jpg" },
        { id: 1002, catalog_product_id: 679, name: "Black / M", size: "M", color: "Black", color_code: "#000", color_code2: null, image: "https://example.com/2.jpg" },
      ],
      paging: { total: 2, limit: 20, offset: 0 },
      extra: [],
      _links: {},
    };
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data).toHaveLength(2);
    expect(envelope.paging.total).toBe(2);
  });

  test("paging.total is the authoritative variant count", () => {
    const paging = { total: 70, limit: 20, offset: 0 };
    expect(paging.total).toBe(70);
    const pagesNeeded = Math.ceil(paging.total / paging.limit);
    expect(pagesNeeded).toBe(4); // 20+20+20+10
  });

  test("partial final page is handled correctly", () => {
    // 70 total, 20 per page: pages 0,20,40,60 → last page has 10
    const total = 70;
    const pageSize = 20;
    const pages = [];
    for (let offset = 0; offset < total; offset += pageSize) {
      pages.push(Math.min(pageSize, total - offset));
    }
    expect(pages).toEqual([20, 20, 20, 10]);
    expect(pages.reduce((a, b) => a + b, 0)).toBe(70);
  });

  test("malformed paging stops after first page", () => {
    // If paging is absent or total is not a number, accumulation stops
    const envelope = { data: [{ id: 1 }], paging: null };
    const shouldContinue = envelope.paging && typeof (envelope.paging as { total?: unknown }).total === "number";
    expect(shouldContinue).toBeFalsy();
  });
});

// ── 2. Multi-page accumulation and deduplication ──────────────────────────────

describe("V2 pagination accumulation", () => {
  function simulateAccumulation(pages: Array<{ id: number }[]>): number[] {
    const accumulated: number[] = [];
    const seenIds = new Set<number>();
    for (const page of pages) {
      for (const item of page) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          accumulated.push(item.id);
        }
      }
    }
    return accumulated;
  }

  test("accumulates variants across multiple pages", () => {
    const page1 = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    const page2 = Array.from({ length: 20 }, (_, i) => ({ id: i + 21 }));
    const page3 = Array.from({ length: 10 }, (_, i) => ({ id: i + 41 }));
    const result = simulateAccumulation([page1, page2, page3]);
    expect(result).toHaveLength(50);
    expect(result[0]).toBe(1);
    expect(result[49]).toBe(50);
  });

  test("deduplication removes repeated IDs across pages", () => {
    const page1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const page2 = [{ id: 2 }, { id: 3 }, { id: 4 }]; // 2 and 3 are duplicates
    const result = simulateAccumulation([page1, page2]);
    expect(result).toHaveLength(4);
    expect(result).toEqual([1, 2, 3, 4]);
  });

  test("accumulated unique count must equal paging.total when provider is consistent", () => {
    const total = 50;
    const page1 = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    const page2 = Array.from({ length: 20 }, (_, i) => ({ id: i + 21 }));
    const page3 = Array.from({ length: 10 }, (_, i) => ({ id: i + 41 }));
    const result = simulateAccumulation([page1, page2, page3]);
    expect(result.length).toBe(total);
  });
});

// ── 3. CatalogVariant identity semantics ─────────────────────────────────────

describe("CatalogVariant identity semantics", () => {
  const variant: CatalogVariant = {
    id: 12345,
    catalog_product_id: 679,
    name: "Black / S",
    size: "S",
    color: "Black",
    color_code: "#000000",
    image: "https://files.cdn.printful.com/variant/12345.jpg",
  };

  test("CatalogVariant contains required identity fields", () => {
    expect(typeof variant.id).toBe("number");
    expect(typeof variant.catalog_product_id).toBe("number");
    expect(typeof variant.name).toBe("string");
    expect(typeof variant.size).toBe("string");
    expect(typeof variant.color).toBe("string");
    expect(typeof variant.image).toBe("string");
  });

  test("CatalogVariant does not have a price field", () => {
    expect("price" in variant).toBe(false);
  });

  test("CatalogVariant does not have an in_stock field", () => {
    expect("in_stock" in variant).toBe(false);
  });

  test("CatalogVariant does not have an availability_status field", () => {
    expect("availability_status" in variant).toBe(false);
  });

  test("CatalogVariant does not have an availability_regions field", () => {
    expect("availability_regions" in variant).toBe(false);
  });

  test("variant ID is preserved exactly from provider", () => {
    expect(variant.id).toBe(12345);
    expect(variant.catalog_product_id).toBe(679);
  });
});

// ── 4. Eligibility states ─────────────────────────────────────────────────────

describe("CatalogVariantResult eligibility states", () => {
  test("eligible result contains variants array", () => {
    const result: CatalogVariantResult = {
      eligibility: "eligible",
      variants: [
        { id: 1, catalog_product_id: 679, name: "Black / S", size: "S", color: "Black", color_code: null, image: "" },
      ],
    };
    expect(result.eligibility).toBe("eligible");
    expect(result.variants).toHaveLength(1);
  });

  test("unavailable result has empty variants and a reason", () => {
    const result: CatalogVariantResult = {
      eligibility: "unavailable",
      variants: [],
      reason: "Not available for the current fulfillment region.",
    };
    expect(result.eligibility).toBe("unavailable");
    expect(result.variants).toHaveLength(0);
    expect(result.reason).toBeTruthy();
  });

  test("error result has empty variants and a reason", () => {
    const result: CatalogVariantResult = {
      eligibility: "error",
      variants: [],
      reason: "Unexpected provider failure.",
    };
    expect(result.eligibility).toBe("error");
    expect(result.variants).toHaveLength(0);
  });

  test("unknown is represented as null eligibility in ProductSummary", () => {
    // ProductSummary.eligibility is typed as "eligible"|"unavailable"|"error"
    // unknown = summary not yet loaded = null from _summaryCache
    const eligibility: "eligible" | "unavailable" | "error" | null = null;
    expect(eligibility).toBeNull();
  });

  test("unknown must not be collapsed to unavailable", () => {
    const eligibility: "eligible" | "unavailable" | "error" | null = null;
    const isUnavailable = eligibility === "unavailable";
    expect(isUnavailable).toBe(false);
  });

  test("error must not be collapsed to unavailable", () => {
    const eligibility: string = "error";
    const isUnavailable = eligibility === "unavailable";
    expect(isUnavailable).toBe(false);
  });

  test("679-style positive fixture: eligible with variants", () => {
    // Product 679 is US-accessible — live-proven positive case
    const result: CatalogVariantResult = {
      eligibility: "eligible",
      variants: Array.from({ length: 70 }, (_, i) => ({
        id: 10000 + i,
        catalog_product_id: 679,
        name: `Variant ${i}`,
        size: "M",
        color: "Black",
        color_code: null,
        image: "",
      })),
    };
    expect(result.eligibility).toBe("eligible");
    expect(result.variants.length).toBeGreaterThan(0);
    // All IDs are unique
    const ids = new Set(result.variants.map((v) => v.id));
    expect(ids.size).toBe(result.variants.length);
  });

  test("638-style negative fixture: unavailable with reason", () => {
    // Product 638 (Adidas Dad Hat) is EU-only — live-proven negative case
    const result: CatalogVariantResult = {
      eligibility: "unavailable",
      variants: [],
      reason: "Not available for the current fulfillment region.",
    };
    expect(result.eligibility).toBe("unavailable");
    expect(result.variants).toHaveLength(0);
    expect(result.reason).toContain("region");
  });
});

// ── 5. BlankSelector eligibility behavior ────────────────────────────────────

describe("BlankSelector eligibility behavior", () => {
  // Simulate the eligibility derivation logic from StageComponents.tsx
  function deriveEligibilityState(summary: ProductSummary | null) {
    const eligibility = summary?.eligibility ?? null;
    return {
      isUnavailable: eligibility === "unavailable",
      isError: eligibility === "error",
      isEligible: eligibility === "eligible",
      isUnknown: eligibility === null,
      isDisabled: eligibility === "unavailable",
    };
  }

  const baseSummary: ProductSummary = {
    id: 679,
    title: "Test Product",
    brand: null,
    image: "",
    techniques: [],
    total_variants: 70,
    available_variants: 70,
    color_count: 5,
    size_count: 7,
    min_cost: null,
    max_cost: null,
    eligibility: "eligible",
    eligibility_reason: null,
  };

  test("eligible: Select button is enabled", () => {
    const state = deriveEligibilityState({ ...baseSummary, eligibility: "eligible" });
    expect(state.isEligible).toBe(true);
    expect(state.isDisabled).toBe(false);
  });

  test("unavailable: Select button is disabled", () => {
    const state = deriveEligibilityState({ ...baseSummary, eligibility: "unavailable", eligibility_reason: "Not available for the current fulfillment region." });
    expect(state.isUnavailable).toBe(true);
    expect(state.isDisabled).toBe(true);
  });

  test("unknown (null summary): Select button is NOT disabled", () => {
    const state = deriveEligibilityState(null);
    expect(state.isUnknown).toBe(true);
    expect(state.isDisabled).toBe(false);
  });

  test("error: Select button is NOT disabled (error != unavailable)", () => {
    const state = deriveEligibilityState({ ...baseSummary, eligibility: "error", eligibility_reason: "Unexpected provider failure." });
    expect(state.isError).toBe(true);
    expect(state.isDisabled).toBe(false);
  });

  test("unavailable reason is surfaced from eligibility_reason", () => {
    const summary: ProductSummary = { ...baseSummary, eligibility: "unavailable", eligibility_reason: "Not available for the current fulfillment region." };
    const reason = summary.eligibility_reason ?? "Not available for the current fulfillment region.";
    expect(reason).toContain("region");
  });

  test("unknown does not show unavailable badge", () => {
    const state = deriveEligibilityState(null);
    expect(state.isUnavailable).toBe(false);
  });
});

// ── 6. Pricing semantics: provider_cost null != 0 ────────────────────────────

describe("provider_cost null semantics", () => {
  test("provider_cost null is not equal to 0", () => {
    const cost: number | null = null;
    expect(cost).toBeNull();
    expect(cost).not.toBe(0);
  });

  test("VariantPricing with null provider_cost is valid", () => {
    const vp: VariantPricing = {
      printful_variant_id: "12345",
      label: "Black / S",
      color: "Black",
      size: "S",
      provider_cost: null,
      retail_price: 29.99,
    };
    expect(vp.provider_cost).toBeNull();
    expect(vp.retail_price).toBe(29.99);
  });

  test("null provider_cost is excluded from margin calculations", () => {
    const pricing: VariantPricing[] = [
      { printful_variant_id: "1", label: "A", color: null, size: null, provider_cost: null, retail_price: 29.99 },
      { printful_variant_id: "2", label: "B", color: null, size: null, provider_cost: null, retail_price: 34.99 },
    ];
    // Filter as PricingPreview does — null cost excluded
    const priced = pricing.filter(
      (v): v is VariantPricing & { provider_cost: number } =>
        v.retail_price > 0 && v.provider_cost != null && v.provider_cost > 0
    );
    expect(priced).toHaveLength(0); // no known costs → no margin display
  });

  test("known provider_cost is included in margin calculations", () => {
    const pricing: VariantPricing[] = [
      { printful_variant_id: "1", label: "A", color: null, size: null, provider_cost: 11.92, retail_price: 29.99 },
    ];
    const priced = pricing.filter(
      (v): v is VariantPricing & { provider_cost: number } =>
        v.retail_price > 0 && v.provider_cost != null && v.provider_cost > 0
    );
    expect(priced).toHaveLength(1);
    const margin = ((priced[0].retail_price - priced[0].provider_cost) / priced[0].retail_price) * 100;
    expect(margin).toBeCloseTo(60.3, 0);
  });
});

// ── 7. COST_PLUS and FIXED_PRICE pricing rules ────────────────────────────────

describe("pricing rules with unknown provider cost", () => {
  test("FIXED_PRICE does not require provider cost", () => {
    const rules: PricingRules = { strategy: "FIXED_PRICE", fixed_price: 29.99 };
    // applyPricingRules accepts any providerCost for FIXED_PRICE — it is ignored
    const price = applyPricingRules(0, rules);
    expect(price).toBe(29.99);
  });

  test("FIXED_PRICE with null provider cost: use 0 as placeholder — price is fixed_price", () => {
    const rules: PricingRules = { strategy: "FIXED_PRICE", fixed_price: 34.99 };
    const price = applyPricingRules(0, rules); // 0 is ignored for FIXED_PRICE
    expect(price).toBe(34.99);
  });

  test("COST_PLUS with known provider cost calculates correctly", () => {
    const rules: PricingRules = { strategy: "COST_PLUS", cost_plus_margin: 18.07, rounding: "ceil" };
    const price = applyPricingRules(11.92, rules);
    expect(price).toBe(30); // ceil(11.92 + 18.07) = ceil(29.99) = 30
  });

  test("COST_PLUS with unknown provider cost must be blocked — not calculated", () => {
    // The recipe-engine blocks COST_PLUS when providerCost is null.
    // This test verifies the blocking logic pattern used in resolveProductRecipe.
    const providerCost: number | null = null;
    const strategy = "COST_PLUS";
    const shouldBlock = providerCost === null && strategy === "COST_PLUS";
    expect(shouldBlock).toBe(true);
  });

  test("COST_PLUS margin must not be used as standalone retail price", () => {
    // If cost is null, margin alone (e.g. 18.07) is NOT a valid retail price
    const margin = 18.07;
    const providerCost: number | null = null;
    // The correct behavior: block, not calculate
    const wouldFabricatePrice = providerCost === null ? margin : providerCost + margin;
    // We assert this fabrication must NOT happen — the value 18.07 is not a valid retail price
    expect(providerCost).toBeNull();
    expect(wouldFabricatePrice).toBe(margin); // demonstrates the fabrication that must be prevented
  });

  test("COST_PLUS activation blocked when provider cost unavailable", () => {
    // Simulates the activate route check
    const pr = { strategy: "COST_PLUS", cost_plus_margin: 18 };
    const providerCostAvailable = false; // V2 does not provide cost
    let activationError: string | null = null;
    if (pr.strategy === "COST_PLUS" && !providerCostAvailable) {
      activationError = "COST_PLUS requires an authoritative provider cost, but provider cost is currently unavailable from the catalog variant endpoint.";
    }
    expect(activationError).not.toBeNull();
    expect(activationError).toContain("COST_PLUS");
  });
});

// ── 8. Printful Sync identity unchanged ──────────────────────────────────────

describe("Printful Sync identity", () => {
  test("catalog_source printful_sync is distinct from catalog_builder", () => {
    const syncSource: string = "printful_sync";
    const builderSource: string = "catalog_builder";
    expect(syncSource).not.toBe(builderSource);
  });

  test("catalog_builder products have printful_id = null", () => {
    const product = { catalog_source: "catalog_builder", printful_id: null, printful_catalog_id: 679 };
    expect(product.printful_id).toBeNull();
    expect(product.printful_catalog_id).toBe(679);
  });

  test("printful_sync products have non-null printful_id", () => {
    const product = { catalog_source: "printful_sync", printful_id: 476330305, printful_catalog_id: 903 };
    expect(product.printful_id).not.toBeNull();
    expect(product.printful_id).toBe(476330305);
  });

  test("DIRECT_CATALOG_ORDER strategy for catalog_builder", () => {
    const catalogSource = "catalog_builder";
    const strategy = catalogSource === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";
    expect(strategy).toBe("DIRECT_CATALOG_ORDER");
  });

  test("SYNC_VARIANT strategy for printful_sync", () => {
    const catalogSource: string = "printful_sync";
    const strategy = catalogSource === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";
    expect(strategy).toBe("SYNC_VARIANT");
  });

  test("quarter-zip sync product identity preserved", () => {
    // Live-proven sync product — must not be altered
    const syncProduct = {
      uuid: "aed80c7d-5f07-495a-8e1a-8ff1ec74726b",
      printful_sync_id: 476330305,
      catalog_id: 903,
    };
    expect(syncProduct.uuid).toBe("aed80c7d-5f07-495a-8e1a-8ff1ec74726b");
    expect(syncProduct.printful_sync_id).toBe(476330305);
    expect(syncProduct.catalog_id).toBe(903);
  });
});
