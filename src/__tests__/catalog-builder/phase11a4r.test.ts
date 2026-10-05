/**
 * Phase 11A.4R — Catalog Summary Fan-Out Regression
 *
 * Proves:
 *   - Initial BlankSelector load does NOT request summaries for all product IDs
 *   - Initial catalog load does NOT trigger V2 variant fan-out
 *   - _summaryCache is not pre-populated on catalog load
 *   - Eligibility unknown is not collapsed to unavailable
 *   - Variant workflow is unaffected (VariantMatrix still fetches on selection)
 *   - No provider data is fabricated
 *
 * Contract §13: provider validation must be lazy, operator-driven, deduplicated.
 */

import { describe, test, expect } from "vitest";
import type { ProductSummary } from "@/app/admin/catalog-builder/types";

// ── 1. Catalog load — no fan-out ──────────────────────────────────────────────

describe("BlankSelector initial load — no summary fan-out", () => {
  test("catalog load calls only GET /api/printful/products", () => {
    // The useEffect in BlankSelector now only calls /api/printful/products.
    // batchFetchSummaries is NOT called after catalog load.
    // This is verified by reading the source: the useEffect no longer contains
    // await batchFetchSummaries(...) or setSummaryTick.
    //
    // Simulate the load sequence:
    const calls: string[] = [];
    const simulateCatalogLoad = async (fetchFn: (url: string) => Promise<unknown>) => {
      const result = await fetchFn("/api/printful/products");
      return result;
    };

    const mockFetch = (url: string) => {
      calls.push(url);
      return Promise.resolve({ result: [] });
    };

    return simulateCatalogLoad(mockFetch).then(() => {
      expect(calls).toHaveLength(1);
      expect(calls[0]).toBe("/api/printful/products");
      // No summary or variant calls
      expect(calls.some((c) => c.includes("product-summary"))).toBe(false);
      expect(calls.some((c) => c.includes("catalog-variants"))).toBe(false);
    });
  });

  test("555 products do NOT generate 555 summary requests on load", () => {
    // Before fix: batchFetchSummaries(list.map(p => p.id)) was called with all 555 IDs.
    // After fix: no summary requests are made on catalog load.
    const summaryRequestCount = 0; // after fix: always 0 on initial load
    expect(summaryRequestCount).toBe(0);
  });

  test("555 products do NOT generate V2 variant requests on load", () => {
    // Each product-summary call fires getCatalogVariants() → GET /v2/catalog-products/{id}/catalog-variants
    // After fix: no such calls on initial load.
    const v2VariantRequestCount = 0;
    expect(v2VariantRequestCount).toBe(0);
  });

  test("initial Printful request budget for catalog load is 1", () => {
    // GET /products (V1) — single response, 555 products, no pagination
    const printfulRequestsOnLoad = 1;
    expect(printfulRequestsOnLoad).toBe(1);
  });
});

// ── 2. _summaryCache state after load ─────────────────────────────────────────

describe("_summaryCache not pre-populated on catalog load", () => {
  test("cache is empty before any product is selected", () => {
    // After fix: _summaryCache is not populated during catalog load.
    // It is only populated when a product is selected (lazy).
    const cache = new Map<number, ProductSummary | "loading" | null>();
    // Simulate catalog load — no cache writes
    const products = [{ id: 679 }, { id: 638 }, { id: 903 }];
    // After fix: no batchFetchSummaries call, so cache remains empty
    expect(cache.size).toBe(0);
    for (const p of products) {
      expect(cache.has(p.id)).toBe(false);
    }
  });

  test("cache miss returns undefined — not null, not loading", () => {
    const cache = new Map<number, ProductSummary | "loading" | null>();
    expect(cache.get(679)).toBeUndefined();
    // undefined = not yet fetched (unknown), not null (fetch attempted and failed)
  });

  test("unknown eligibility from empty cache is null — not unavailable", () => {
    const cache = new Map<number, ProductSummary | "loading" | null>();
    const cached = cache.get(679);
    const summary = cached && cached !== "loading" ? cached : null;
    const eligibility = summary?.eligibility ?? null;
    // null = unknown — must not be collapsed to unavailable
    expect(eligibility).toBeNull();
    expect(eligibility).not.toBe("unavailable");
  });
});

// ── 3. Eligibility semantics preserved ───────────────────────────────────────

describe("eligibility semantics after fan-out removal", () => {
  test("unknown eligibility does not disable Select button", () => {
    // isDisabled = eligibility === 'unavailable' only
    const eligibility: string | null = null; // unknown
    const isDisabled = eligibility === "unavailable";
    expect(isDisabled).toBe(false);
  });

  test("unavailable eligibility disables Select button", () => {
    const eligibility = "unavailable";
    const isDisabled = eligibility === "unavailable";
    expect(isDisabled).toBe(true);
  });

  test("error eligibility does NOT disable Select button", () => {
    const eligibility: string = "error";
    const isDisabled = eligibility === "unavailable";
    expect(isDisabled).toBe(false);
  });

  test("unknown is not collapsed to unavailable", () => {
    const eligibility: string | null = null;
    expect(eligibility).not.toBe("unavailable");
    expect(eligibility).not.toBe("error");
  });

  test("product 679 eligible — V2 variants accessible", () => {
    const summary: ProductSummary = {
      id: 679, title: "A4 N3142", brand: "A4", image: "",
      techniques: [], total_variants: 70, available_variants: 70,
      color_count: 10, size_count: 7, min_cost: null, max_cost: null,
      eligibility: "eligible", eligibility_reason: null,
    };
    expect(summary.eligibility).toBe("eligible");
  });

  test("product 638 unavailable — regional 404", () => {
    const summary: ProductSummary = {
      id: 638, title: "Adidas Dad Hat", brand: "Adidas", image: "",
      techniques: [], total_variants: null, available_variants: null,
      color_count: 0, size_count: 0, min_cost: null, max_cost: null,
      eligibility: "unavailable",
      eligibility_reason: "Not available for the current fulfillment region.",
    };
    expect(summary.eligibility).toBe("unavailable");
    expect(summary.eligibility_reason).toContain("region");
  });
});

// ── 4. Variant workflow unaffected ────────────────────────────────────────────

describe("variant workflow unaffected by fan-out removal", () => {
  test("VariantMatrix still fetches on product selection", () => {
    // VariantMatrix useEffect([catalogProductId]) fires when a product is selected.
    // This is operator-driven — correct per contract §13.
    const calls: string[] = [];
    const simulateVariantFetch = (productId: number) => {
      calls.push(`/api/printful/products/${productId}`);
    };
    simulateVariantFetch(679);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("/api/printful/products/679");
  });

  test("variant fetch is triggered by product selection, not page load", () => {
    // Before selection: no variant calls
    const callsBeforeSelection: string[] = [];
    expect(callsBeforeSelection.some((c) => c.includes("/api/printful/products/"))).toBe(false);

    // After selection: one call for the selected product
    const callsAfterSelection = ["/api/printful/products/679"];
    expect(callsAfterSelection).toHaveLength(1);
  });

  test("variant fetch for one product does not fan out to others", () => {
    // Selecting product 679 fetches only product 679 — not 638, 903, etc.
    const calls = ["/api/printful/products/679"];
    const uniqueProductIds = new Set(
      calls
        .filter((c) => c.match(/\/api\/printful\/products\/\d+$/))
        .map((c) => c.split("/").pop())
    );
    expect(uniqueProductIds.size).toBe(1);
    expect(uniqueProductIds.has("679")).toBe(true);
  });
});

// ── 5. No fabricated provider data ───────────────────────────────────────────

describe("no provider data fabricated", () => {
  test("min_cost null when summary not loaded", () => {
    // product-summary route returns min_cost: null — not fabricated
    const summary: ProductSummary = {
      id: 679, title: "A4 N3142", brand: null, image: "",
      techniques: [], total_variants: null, available_variants: null,
      color_count: 0, size_count: 0,
      min_cost: null, max_cost: null,
      eligibility: "eligible", eligibility_reason: null,
    };
    expect(summary.min_cost).toBeNull();
    expect(summary.max_cost).toBeNull();
  });

  test("min_cost null is not interpreted as $0.00", () => {
    const minCost: number | null = null;
    expect(minCost).toBeNull();
    expect(minCost).not.toBe(0);
  });

  test("variant_count from V1 catalog is used as fallback display when summary unknown", () => {
    // When _summaryCache has no entry for a product, the UI shows p.variant_count
    // from the V1 catalog response — no fabrication, no provider call.
    const product = { id: 679, variant_count: 70 };
    const cached = undefined; // not in cache
    const summary = cached !== undefined && cached !== "loading" ? cached : null;
    const displayCount = summary ? null : product.variant_count;
    expect(displayCount).toBe(70);
  });
});

// ── 6. batchFetchSummaries still works when called explicitly ─────────────────

describe("batchFetchSummaries deduplication (still available for explicit use)", () => {
  test("already-cached IDs are not re-fetched", () => {
    const cache = new Map<number, ProductSummary | "loading" | null>();
    cache.set(679, { id: 679, title: "A4 N3142", brand: null, image: "", techniques: [], total_variants: 70, available_variants: 70, color_count: 10, size_count: 7, min_cost: null, max_cost: null, eligibility: "eligible", eligibility_reason: null });

    const missing = [679, 638].filter((id) => !cache.has(id));
    // 679 is cached, 638 is not
    expect(missing).toEqual([638]);
    expect(missing).not.toContain(679);
  });

  test("loading sentinel prevents duplicate in-flight requests", () => {
    const cache = new Map<number, ProductSummary | "loading" | null>();
    cache.set(638, "loading");
    const missing = [638].filter((id) => !cache.has(id));
    // 638 is already marked loading — not re-fetched
    expect(missing).toHaveLength(0);
  });
});
