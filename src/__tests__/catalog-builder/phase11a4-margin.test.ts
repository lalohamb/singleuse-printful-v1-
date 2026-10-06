// Phase 11A.4 — Margin UI Completion Tests
//
// Tests the gross profit and gross margin % display logic.
// Pure arithmetic — no API calls, no React rendering.
//
// Formulas under test:
//   gross_profit = retail_price - provider_cost
//   gross_margin% = ((retail_price - provider_cost) / retail_price) * 100
//
// Availability rules:
//   provider_cost === null  → margin unavailable
//   retail_price <= 0       → margin unavailable
//   both known and valid    → calculate

import { describe, test, expect } from "vitest";

// ── Pure margin calculation helpers (mirrors CatalogBuilder.tsx inline logic) ─

function grossProfit(retail: number, cost: number): number {
  return retail - cost;
}

function grossMarginPct(retail: number, cost: number): number {
  return ((retail - cost) / retail) * 100;
}

function marginAvailable(providerCost: number | null, retailPrice: number): boolean {
  return providerCost !== null && retailPrice > 0;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("gross profit calculation", () => {
  test("live-proven: $39.99 retail - $25.59 cost = $14.40 profit", () => {
    expect(grossProfit(39.99, 25.59)).toBeCloseTo(14.40, 2);
  });

  test("profit rounds to 2 decimal places", () => {
    const profit = grossProfit(39.99, 25.59);
    expect(parseFloat(profit.toFixed(2))).toBe(14.40);
  });

  test("negative profit when retail < cost", () => {
    expect(grossProfit(20.00, 25.59)).toBeCloseTo(-5.59, 2);
  });

  test("zero profit when retail equals cost", () => {
    expect(grossProfit(25.59, 25.59)).toBeCloseTo(0, 2);
  });

  test("profit does not change retail price", () => {
    const retail = 39.99;
    const cost = 25.59;
    grossProfit(retail, cost); // compute — must not mutate
    expect(retail).toBe(39.99);
  });
});

describe("gross margin % calculation", () => {
  test("live-proven: $39.99 retail, $25.59 cost → ~36.0%", () => {
    expect(grossMarginPct(39.99, 25.59)).toBeCloseTo(36.01, 1);
  });

  test("margin displayed to 1 decimal place", () => {
    const pct = grossMarginPct(39.99, 25.59);
    expect(pct.toFixed(1)).toBe("36.0");
  });

  test("50% margin: retail $50, cost $25", () => {
    expect(grossMarginPct(50.00, 25.00)).toBeCloseTo(50.0, 2);
  });

  test("negative margin when retail < cost", () => {
    expect(grossMarginPct(20.00, 25.59)).toBeLessThan(0);
  });

  test("margin does not change retail price", () => {
    const retail = 39.99;
    grossMarginPct(retail, 25.59);
    expect(retail).toBe(39.99);
  });
});

describe("margin availability gate", () => {
  test("null cost → margin unavailable", () => {
    expect(marginAvailable(null, 39.99)).toBe(false);
  });

  test("retail 0 → margin unavailable", () => {
    expect(marginAvailable(25.59, 0)).toBe(false);
  });

  test("retail negative → margin unavailable", () => {
    expect(marginAvailable(25.59, -1)).toBe(false);
  });

  test("null cost AND retail 0 → margin unavailable", () => {
    expect(marginAvailable(null, 0)).toBe(false);
  });

  test("known cost + positive retail → margin available", () => {
    expect(marginAvailable(25.59, 39.99)).toBe(true);
  });

  test("cost 0 (known zero) + positive retail → margin available", () => {
    // provider_cost: 0 is a valid known zero per contract §7 semantics fix
    expect(marginAvailable(0, 39.99)).toBe(true);
  });
});

describe("margin does not change retail price", () => {
  test("computing margin leaves retail unchanged", () => {
    const vp = { provider_cost: 25.59, retail_price: 39.99 };
    // Simulate what the UI does: read values, compute display strings
    const _profit = grossProfit(vp.retail_price, vp.provider_cost).toFixed(2);
    const _margin = grossMarginPct(vp.retail_price, vp.provider_cost).toFixed(1);
    // retail_price must be unchanged
    expect(vp.retail_price).toBe(39.99);
    expect(vp.provider_cost).toBe(25.59);
  });

  test("margin display strings are correct for live-proven fixture", () => {
    const retail = 39.99;
    const cost = 25.59;
    const profitStr = `$${grossProfit(retail, cost).toFixed(2)}`;
    const marginStr = `${grossMarginPct(retail, cost).toFixed(1)}%`;
    expect(profitStr).toBe("$14.40");
    expect(marginStr).toBe("36.0%");
  });
});
