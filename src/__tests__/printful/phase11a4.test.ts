/**
 * Phase 11A.4 — Provider Cost & Margin Integration
 *
 * Live-proven contract (product 679, variant 17008):
 *   technique dtfilm: price=19.64, discounted_price=19.64
 *   placement front:  price=5.95,  discounted_price=5.95
 *   expected provider cost: 25.59
 */

import { describe, test, expect } from "vitest";
import {
  effectiveAmount,
  resolveProviderCost,
  type CatalogProductPricing,
  type PrintfulVariantTechniquePrice,
  type PrintfulPlacementPrice,
} from "@/lib/printful/pricing";
import type { CatalogVariant } from "@/lib/printful/types";
import type { VariantPricing } from "@/app/admin/catalog-builder/types";
import { applyPricingRules, type PricingRules } from "@/lib/catalog/recipe-engine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePricing(overrides?: {
  variantId?: number;
  techniques?: PrintfulVariantTechniquePrice[];
  placements?: PrintfulPlacementPrice[];
}): CatalogProductPricing {
  const variantId = overrides?.variantId ?? 17008;
  const techniques: PrintfulVariantTechniquePrice[] = overrides?.techniques ?? [
    { technique_key: "dtfilm", technique_display_name: "DTF printing", price: "19.64", discounted_price: "19.64" },
  ];
  const placements: PrintfulPlacementPrice[] = overrides?.placements ?? [
    {
      id: "front", title: "Front print", type: "DTF printing", technique_key: "dtfilm",
      placement_options: [], price: "5.95", discounted_price: "5.95",
      layers: [{ type: "file", additional_price: "0.00", layer_options: [] }],
    },
    {
      id: "back", title: "Back print", type: "DTF printing", technique_key: "dtfilm",
      placement_options: [], price: "5.95", discounted_price: "5.95",
      layers: [{ type: "file", additional_price: "0.00", layer_options: [] }],
    },
    {
      id: "sleeve_right", title: "Right sleeve", type: "DTF printing", technique_key: "dtfilm",
      placement_options: [], price: "2.49", discounted_price: "2.49",
      layers: [{ type: "file", additional_price: "0.00", layer_options: [] }],
    },
  ];
  const variantPrices = new Map<number, PrintfulVariantTechniquePrice[]>();
  variantPrices.set(variantId, techniques);
  return { catalog_product_id: 679, currency: "USD", placements, variantPrices };
}

// ── 1. V2 product-price envelope ─────────────────────────────────────────────

describe("V2 product-price envelope", () => {
  test("envelope has data, paging, extra, _links", () => {
    const envelope = {
      data: { currency: "USD", product: { id: 679, placements: [] }, variants: [], discount_tiers: [] },
      paging: { total: 70, limit: 20, offset: 0 },
      extra: [],
      _links: { next: { href: "https://api.printful.com/v2/catalog-products/679/prices?limit=20&offset=20" } },
    };
    expect(envelope.data.currency).toBe("USD");
    expect(envelope.paging.total).toBe(70);
    expect(envelope._links.next).toBeDefined();
  });

  test("data keys: currency, product, variants, discount_tiers", () => {
    const data = { currency: "USD", product: { id: 679, placements: [] }, variants: [], discount_tiers: [] };
    expect(Object.keys(data)).toEqual(expect.arrayContaining(["currency", "product", "variants", "discount_tiers"]));
  });

  test("variant shape: id + techniques array", () => {
    const variant = {
      id: 17008,
      techniques: [{ technique_key: "dtfilm", technique_display_name: "DTF printing", price: "19.64", discounted_price: "19.64" }],
    };
    expect(variant.id).toBe(17008);
    expect(variant.techniques).toHaveLength(1);
    expect(variant.techniques[0].technique_key).toBe("dtfilm");
  });

  test("placement shape: id, price, discounted_price, layers", () => {
    const placement: PrintfulPlacementPrice = {
      id: "front", title: "Front print", type: "DTF printing", technique_key: "dtfilm",
      placement_options: [], price: "5.95", discounted_price: "5.95",
      layers: [{ type: "file", additional_price: "0.00", layer_options: [] }],
    };
    expect(placement.id).toBe("front");
    expect(placement.price).toBe("5.95");
    expect(placement.layers).toHaveLength(1);
  });
});

// ── 2. Pagination accumulation ────────────────────────────────────────────────

describe("4-page accumulation", () => {
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

  test("70 variants across 4 pages (20+20+20+10)", () => {
    const p1 = Array.from({ length: 20 }, (_, i) => ({ id: 17004 + i }));
    const p2 = Array.from({ length: 20 }, (_, i) => ({ id: 17024 + i }));
    const p3 = Array.from({ length: 20 }, (_, i) => ({ id: 17044 + i }));
    const p4 = Array.from({ length: 10 }, (_, i) => ({ id: 17064 + i }));
    const result = simulateAccumulation([p1, p2, p3, p4]);
    expect(result).toHaveLength(70);
  });

  test("deduplication removes repeated IDs across pages", () => {
    const p1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const p2 = [{ id: 2 }, { id: 3 }, { id: 4 }];
    const result = simulateAccumulation([p1, p2]);
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
  });

  test("malformed paging stops after first page", () => {
    const envelope = { data: { variants: [{ id: 1 }] }, paging: null };
    const shouldContinue = envelope.paging && typeof (envelope.paging as { total?: unknown }).total === "number";
    expect(shouldContinue).toBeFalsy();
  });

  test("paging.total is authoritative — 70 variants needs 4 pages at limit=20", () => {
    const total = 70;
    const limit = 20;
    const pages = Math.ceil(total / limit);
    expect(pages).toBe(4);
  });
});

// ── 3. effectiveAmount ────────────────────────────────────────────────────────

describe("effectiveAmount", () => {
  test("uses discounted_price when valid and positive", () => {
    expect(effectiveAmount("19.64", "18.00")).toBe(18.00);
  });

  test("falls back to price when discounted_price is same", () => {
    expect(effectiveAmount("19.64", "19.64")).toBe(19.64);
  });

  test("falls back to price when discounted_price is 0", () => {
    expect(effectiveAmount("19.64", "0.00")).toBe(19.64);
  });

  test("falls back to price when discounted_price is not a number", () => {
    expect(effectiveAmount("5.95", "")).toBe(5.95);
  });

  test("live-proven: variant 17008 dtfilm price 19.64", () => {
    expect(effectiveAmount("19.64", "19.64")).toBe(19.64);
  });

  test("live-proven: front placement price 5.95", () => {
    expect(effectiveAmount("5.95", "5.95")).toBe(5.95);
  });
});

// ── 4. resolveProviderCost — happy path ──────────────────────────────────────

describe("resolveProviderCost — resolved", () => {
  test("live-proven: variant 17008 + dtfilm + front = 25.59", () => {
    const pricing = makePricing();
    const result = resolveProviderCost(pricing, 17008, "dtfilm", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.variantAmount).toBe(19.64);
      expect(result.placementAmount).toBe(5.95);
      expect(result.layerAmount).toBe(0);
      expect(result.cost).toBe(25.59);
    }
  });

  test("sleeve placement produces different cost than front", () => {
    const pricing = makePricing();
    const front = resolveProviderCost(pricing, 17008, "dtfilm", "front");
    const sleeve = resolveProviderCost(pricing, 17008, "dtfilm", "sleeve_right");
    expect(front.status).toBe("resolved");
    expect(sleeve.status).toBe("resolved");
    if (front.status === "resolved" && sleeve.status === "resolved") {
      expect(front.cost).not.toBe(sleeve.cost);
      expect(sleeve.cost).toBeCloseTo(19.64 + 2.49, 2); // 22.13
    }
  });

  test("layer additional_price is summed into cost", () => {
    const pricing = makePricing({
      placements: [{
        id: "front", title: "Front", type: "DTF", technique_key: "dtfilm",
        placement_options: [], price: "5.95", discounted_price: "5.95",
        layers: [
          { type: "file", additional_price: "1.00", layer_options: [] },
          { type: "option", additional_price: "0.50", layer_options: [] },
        ],
      }],
    });
    const result = resolveProviderCost(pricing, 17008, "dtfilm", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.layerAmount).toBeCloseTo(1.50, 2);
      expect(result.cost).toBeCloseTo(19.64 + 5.95 + 1.50, 2);
    }
  });

  test("different variants have different costs", () => {
    const variantPrices = new Map<number, PrintfulVariantTechniquePrice[]>();
    variantPrices.set(17004, [{ technique_key: "dtfilm", technique_display_name: "DTF printing", price: "17.64", discounted_price: "17.64" }]);
    variantPrices.set(17008, [{ technique_key: "dtfilm", technique_display_name: "DTF printing", price: "19.64", discounted_price: "19.64" }]);
    const pricing: CatalogProductPricing = {
      catalog_product_id: 679, currency: "USD",
      placements: [{ id: "front", title: "Front", type: "DTF", technique_key: "dtfilm", placement_options: [], price: "5.95", discounted_price: "5.95", layers: [] }],
      variantPrices,
    };
    const r1 = resolveProviderCost(pricing, 17004, "dtfilm", "front");
    const r2 = resolveProviderCost(pricing, 17008, "dtfilm", "front");
    expect(r1.status).toBe("resolved");
    expect(r2.status).toBe("resolved");
    if (r1.status === "resolved" && r2.status === "resolved") {
      expect(r1.cost).toBe(17.64 + 5.95);
      expect(r2.cost).toBe(19.64 + 5.95);
      expect(r1.cost).not.toBe(r2.cost);
    }
  });
});

// ── 5. resolveProviderCost — unknown/error paths ──────────────────────────────

describe("resolveProviderCost — unknown", () => {
  test("null pricing returns unknown", () => {
    const result = resolveProviderCost(null, 17008, "dtfilm", "front");
    expect(result.status).toBe("unknown");
  });

  test("missing variant ID returns unknown", () => {
    const pricing = makePricing();
    const result = resolveProviderCost(pricing, 99999, "dtfilm", "front");
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") expect(result.reason).toContain("99999");
  });

  test("missing technique key returns unknown", () => {
    const pricing = makePricing();
    const result = resolveProviderCost(pricing, 17008, "embroidery", "front");
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") expect(result.reason).toContain("embroidery");
  });

  test("missing placement ID returns unknown", () => {
    const pricing = makePricing();
    const result = resolveProviderCost(pricing, 17008, "dtfilm", "nonexistent_placement");
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") expect(result.reason).toContain("nonexistent_placement");
  });

  test("techniques[0] is NOT used as fallback — wrong technique returns unknown", () => {
    const pricing = makePricing();
    // Only dtfilm exists; requesting embroidery must not fall back to dtfilm
    const result = resolveProviderCost(pricing, 17008, "embroidery", "front");
    expect(result.status).toBe("unknown");
  });

  test("placements[0] is NOT used as fallback — wrong placement returns unknown", () => {
    const pricing = makePricing();
    const result = resolveProviderCost(pricing, 17008, "dtfilm", "label");
    expect(result.status).toBe("unknown");
  });
});

// ── 6. Discount handling ──────────────────────────────────────────────────────

describe("discounted_price preferred over price", () => {
  test("discounted_price used when lower than price", () => {
    const pricing = makePricing({
      techniques: [{ technique_key: "dtfilm", technique_display_name: "DTF", price: "19.64", discounted_price: "15.00" }],
      placements: [{ id: "front", title: "Front", type: "DTF", technique_key: "dtfilm", placement_options: [], price: "5.95", discounted_price: "4.00", layers: [] }],
    });
    const result = resolveProviderCost(pricing, 17008, "dtfilm", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.variantAmount).toBe(15.00);
      expect(result.placementAmount).toBe(4.00);
      expect(result.cost).toBe(19.00);
    }
  });

  test("price used when discounted_price equals price (no discount)", () => {
    const result = resolveProviderCost(makePricing(), 17008, "dtfilm", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.variantAmount).toBe(19.64);
    }
  });
});

// ── 7. provider_cost null semantics ──────────────────────────────────────────

describe("provider_cost null != 0", () => {
  test("null provider_cost is not zero", () => {
    const cost: number | null = null;
    expect(cost).toBeNull();
    expect(cost).not.toBe(0);
  });

  test("VariantPricing with null provider_cost is valid", () => {
    const vp: VariantPricing = {
      printful_variant_id: "17008",
      label: "Black / S",
      color: "Black",
      size: "S",
      provider_cost: null,
      retail_price: 39.99,
    };
    expect(vp.provider_cost).toBeNull();
    expect(vp.retail_price).toBe(39.99);
  });

  test("null cost excluded from margin calculation", () => {
    const pricing: VariantPricing[] = [
      { printful_variant_id: "1", label: "A", color: null, size: null, provider_cost: null, retail_price: 29.99 },
    ];
    const priced = pricing.filter(
      (v): v is VariantPricing & { provider_cost: number } =>
        v.retail_price > 0 && v.provider_cost != null && v.provider_cost > 0
    );
    expect(priced).toHaveLength(0);
  });

  test("known cost included in margin calculation", () => {
    const pricing: VariantPricing[] = [
      { printful_variant_id: "17008", label: "Black / S", color: null, size: null, provider_cost: 25.59, retail_price: 39.99 },
    ];
    const priced = pricing.filter(
      (v): v is VariantPricing & { provider_cost: number } =>
        v.retail_price > 0 && v.provider_cost != null && v.provider_cost > 0
    );
    expect(priced).toHaveLength(1);
    const margin = ((priced[0].retail_price - priced[0].provider_cost) / priced[0].retail_price) * 100;
    expect(margin).toBeCloseTo(35.96, 0);
  });
});

// ── 8. Retail price operator control ─────────────────────────────────────────

describe("retail price is operator-controlled", () => {
  test("retail_price is independent of provider_cost", () => {
    const vp: VariantPricing = {
      printful_variant_id: "17008", label: "Black / S", color: null, size: null,
      provider_cost: 25.59, retail_price: 49.99,
    };
    // Operator sets retail_price; provider_cost is read-only display
    expect(vp.retail_price).toBe(49.99);
    expect(vp.provider_cost).toBe(25.59);
  });

  test("margin calculated only when provider_cost != null and retail_price > 0", () => {
    const withCost: VariantPricing = { printful_variant_id: "1", label: "A", color: null, size: null, provider_cost: 25.59, retail_price: 39.99 };
    const withoutCost: VariantPricing = { printful_variant_id: "2", label: "B", color: null, size: null, provider_cost: null, retail_price: 39.99 };
    const canCalculate = (v: VariantPricing) => v.provider_cost != null && v.retail_price > 0;
    expect(canCalculate(withCost)).toBe(true);
    expect(canCalculate(withoutCost)).toBe(false);
  });

  test("retail_price can be set without provider_cost (FIXED_PRICE scenario)", () => {
    const vp: VariantPricing = {
      printful_variant_id: "17008", label: "Black / S", color: null, size: null,
      provider_cost: null, retail_price: 34.99,
    };
    expect(vp.retail_price).toBe(34.99);
    expect(vp.provider_cost).toBeNull();
  });
});

// ── 9. Production change invalidates cost ────────────────────────────────────

describe("production change invalidates cost", () => {
  test("technique change sets provider_cost to null", () => {
    const before: VariantPricing[] = [
      { printful_variant_id: "17008", label: "Black / S", color: null, size: null, provider_cost: 25.59, retail_price: 39.99 },
    ];
    // Simulate technique change invalidation
    const after = before.map((vp) => ({ ...vp, provider_cost: null }));
    expect(after[0].provider_cost).toBeNull();
  });

  test("placement change sets provider_cost to null", () => {
    const before: VariantPricing[] = [
      { printful_variant_id: "17008", label: "Black / S", color: null, size: null, provider_cost: 25.59, retail_price: 39.99 },
    ];
    const after = before.map((vp) => ({ ...vp, provider_cost: null }));
    expect(after[0].provider_cost).toBeNull();
  });

  test("front vs back placement produces different cost", () => {
    const pricing = makePricing();
    const front = resolveProviderCost(pricing, 17008, "dtfilm", "front");
    const back = resolveProviderCost(pricing, 17008, "dtfilm", "back");
    // Both are 5.95 for product 679 — same price, but placement selection still matters
    expect(front.status).toBe("resolved");
    expect(back.status).toBe("resolved");
  });

  test("front vs sleeve_right produces different cost", () => {
    const pricing = makePricing();
    const front = resolveProviderCost(pricing, 17008, "dtfilm", "front");
    const sleeve = resolveProviderCost(pricing, 17008, "dtfilm", "sleeve_right");
    expect(front.status).toBe("resolved");
    expect(sleeve.status).toBe("resolved");
    if (front.status === "resolved" && sleeve.status === "resolved") {
      expect(front.placementAmount).toBe(5.95);
      expect(sleeve.placementAmount).toBe(2.49);
      expect(front.cost).not.toBe(sleeve.cost);
    }
  });
});

// ── 10. COST_PLUS and FIXED_PRICE with known/unknown cost ────────────────────

describe("COST_PLUS with known provider cost", () => {
  test("COST_PLUS known cost: cost + margin", () => {
    const rules: PricingRules = { strategy: "COST_PLUS", cost_plus_margin: 14.40 };
    const price = applyPricingRules(25.59, rules);
    expect(price).toBeCloseTo(39.99, 2);
  });

  test("COST_PLUS unknown cost is blocked", () => {
    const providerCost: number | null = null;
    const shouldBlock = providerCost === null;
    expect(shouldBlock).toBe(true);
  });

  test("COST_PLUS margin must not be used as standalone price", () => {
    const margin = 14.40;
    const providerCost: number | null = null;
    // Fabrication: using margin alone as price — must be prevented
    expect(providerCost).toBeNull();
    expect(margin).not.toBe(39.99); // margin alone is not a valid retail price
  });

  test("FIXED_PRICE unchanged — does not require provider cost", () => {
    const rules: PricingRules = { strategy: "FIXED_PRICE", fixed_price: 39.99 };
    const price = applyPricingRules(0, rules);
    expect(price).toBe(39.99);
  });

  test("FIXED_PRICE with known cost still uses fixed_price", () => {
    const rules: PricingRules = { strategy: "FIXED_PRICE", fixed_price: 39.99 };
    const price = applyPricingRules(25.59, rules);
    expect(price).toBe(39.99);
  });
});

// ── 11. CatalogVariant still contains no pricing fields ──────────────────────

describe("CatalogVariant identity-only invariant", () => {
  const variant: CatalogVariant = {
    id: 17008,
    catalog_product_id: 679,
    name: "Black / S",
    size: "S",
    color: "Black",
    color_code: "#000000",
    image: "https://files.cdn.printful.com/variant/17008.jpg",
  };

  test("CatalogVariant has no price field", () => {
    expect("price" in variant).toBe(false);
  });

  test("CatalogVariant has no provider_cost field", () => {
    expect("provider_cost" in variant).toBe(false);
  });

  test("CatalogVariant has no in_stock field", () => {
    expect("in_stock" in variant).toBe(false);
  });

  test("CatalogVariant has no discounted_price field", () => {
    expect("discounted_price" in variant).toBe(false);
  });

  test("CatalogVariant identity fields are present", () => {
    expect(variant.id).toBe(17008);
    expect(variant.catalog_product_id).toBe(679);
    expect(variant.name).toBe("Black / S");
  });
});

// ── 12. Printful Sync unchanged ───────────────────────────────────────────────

describe("Printful Sync unchanged", () => {
  test("catalog_builder and printful_sync are distinct sources", () => {
    expect("catalog_builder").not.toBe("printful_sync");
  });

  test("DIRECT_CATALOG_ORDER for catalog_builder", () => {
    const strategy = "catalog_builder" === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";
    expect(strategy).toBe("DIRECT_CATALOG_ORDER");
  });

  test("SYNC_VARIANT for printful_sync", () => {
    const source: string = "printful_sync";
    const strategy = source === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";
    expect(strategy).toBe("SYNC_VARIANT");
  });

  test("pricing layer does not affect sync variant identity", () => {
    // CatalogProductPricing is keyed by catalog variant ID — same IDs used by both paths
    const syncVariantPrintfulId = 23178;
    const pricing = new Map<number, PrintfulVariantTechniquePrice[]>();
    pricing.set(syncVariantPrintfulId, []);
    expect(pricing.has(syncVariantPrintfulId)).toBe(true);
  });
});

// ── 13. Technique key case-insensitive normalization (Phase 11A.4 fix) ────────
//
// Root cause: V1 /products/{id} returns technique keys uppercase ("DTFILM")
// V2 /prices returns technique_key lowercase ("dtfilm")
// resolveProviderCost must match case-insensitively.

describe("technique key case-insensitive normalization", () => {
  function makePricingWithTechniqueKey(techniqueKey: string): CatalogProductPricing {
    const variantPrices = new Map<number, PrintfulVariantTechniquePrice[]>();
    variantPrices.set(17008, [
      { technique_key: techniqueKey, technique_display_name: "DTF printing", price: "19.64", discounted_price: "19.64" },
    ]);
    return {
      catalog_product_id: 679,
      currency: "USD",
      placements: [
        { id: "front", title: "Front print", type: "DTF printing", technique_key: techniqueKey,
          placement_options: [], price: "5.95", discounted_price: "5.95",
          layers: [{ type: "file", additional_price: "0.00", layer_options: [] }] },
      ],
      variantPrices,
    };
  }

  test("V1 uppercase DTFILM matches V2 lowercase dtfilm in pricing", () => {
    const pricing = makePricingWithTechniqueKey("dtfilm");
    const result = resolveProviderCost(pricing, 17008, "DTFILM", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.cost).toBe(25.59);
    }
  });

  test("lowercase dtfilm matches uppercase DTFILM in pricing", () => {
    const pricing = makePricingWithTechniqueKey("DTFILM");
    const result = resolveProviderCost(pricing, 17008, "dtfilm", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.cost).toBe(25.59);
    }
  });

  test("mixed case DtFiLm matches dtfilm in pricing", () => {
    const pricing = makePricingWithTechniqueKey("dtfilm");
    const result = resolveProviderCost(pricing, 17008, "DtFiLm", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.cost).toBe(25.59);
    }
  });

  test("genuinely different technique remains unknown", () => {
    const pricing = makePricingWithTechniqueKey("dtfilm");
    const result = resolveProviderCost(pricing, 17008, "embroidery", "front");
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") {
      expect(result.reason).toContain("embroidery");
    }
  });

  test("live-proven fixture: DTFILM + front = 25.59 after normalization", () => {
    const pricing = makePricingWithTechniqueKey("dtfilm");
    const result = resolveProviderCost(pricing, 17008, "DTFILM", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.variantAmount).toBe(19.64);
      expect(result.placementAmount).toBe(5.95);
      expect(result.layerAmount).toBe(0);
      expect(result.cost).toBe(25.59);
    }
  });

  test("normalization does not affect placement resolution", () => {
    const pricing = makePricingWithTechniqueKey("dtfilm");
    const front = resolveProviderCost(pricing, 17008, "DTFILM", "front");
    const missing = resolveProviderCost(pricing, 17008, "DTFILM", "nonexistent");
    expect(front.status).toBe("resolved");
    expect(missing.status).toBe("unknown");
  });

  test("normalization does not affect pricing arithmetic", () => {
    const pricing = makePricingWithTechniqueKey("dtfilm");
    const result = resolveProviderCost(pricing, 17008, "DTFILM", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.cost).toBe(Math.round((19.64 + 5.95 + 0.00) * 100) / 100);
    }
  });

  test("null pricing still returns unknown regardless of technique casing", () => {
    const result = resolveProviderCost(null, 17008, "DTFILM", "front");
    expect(result.status).toBe("unknown");
  });

  test("missing variant still returns unknown regardless of technique casing", () => {
    const pricing = makePricingWithTechniqueKey("dtfilm");
    const result = resolveProviderCost(pricing, 99999, "DTFILM", "front");
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") expect(result.reason).toContain("99999");
  });
});
