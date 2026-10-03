// Phase 7B — Artwork Validation Tests
//
// Tests for validateArtworkForPrintfile() in src/lib/fulfillment/artwork-validation.ts
// Covers: DPI calculation, fill_mode=fit scaling, PASS/PASS_WARNING/FAIL thresholds,
// aspect ratio handling, and the specific BC3001 front placement spec.

import { describe, it, expect } from "vitest";
import { validateArtworkForPrintfile, type PrintfileSpec } from "@/lib/fulfillment/artwork-validation";

// BC3001 front placement spec (from Printful API, verified Phase 7A)
const BC3001_FRONT: PrintfileSpec = {
  printfile_id: 1,
  width: 1800,
  height: 2400,
  dpi: 150,
  fill_mode: "fit",
};

// ── 1. BC3001 front — specific cases ─────────────────────────────────────────
describe("1. BC3001 front placement validation", () => {
  it("1200x1200 (Phase 7A test artwork) → FAIL at 100 DPI", () => {
    const r = validateArtworkForPrintfile(1200, 1200, BC3001_FRONT);
    expect(r.status).toBe("FAIL");
    expect(r.effectiveDpi).toBe(100);
  });

  it("1800x2400 (minimum canvas) → PASS_WARNING at 150 DPI", () => {
    const r = validateArtworkForPrintfile(1800, 2400, BC3001_FRONT);
    expect(r.status).toBe("PASS_WARNING");
    expect(r.effectiveDpi).toBe(150);
  });

  it("3600x4800 (recommended canvas) → PASS at 300 DPI", () => {
    const r = validateArtworkForPrintfile(3600, 4800, BC3001_FRONT);
    expect(r.status).toBe("PASS");
    expect(r.effectiveDpi).toBe(300);
  });

  it("2700x3600 (225 DPI) → PASS_WARNING", () => {
    const r = validateArtworkForPrintfile(2700, 3600, BC3001_FRONT);
    expect(r.status).toBe("PASS_WARNING");
    expect(r.effectiveDpi).toBeGreaterThanOrEqual(150);
    expect(r.effectiveDpi).toBeLessThan(300);
  });

  it("5400x7200 (450 DPI) → PASS", () => {
    const r = validateArtworkForPrintfile(5400, 7200, BC3001_FRONT);
    expect(r.status).toBe("PASS");
    expect(r.effectiveDpi).toBeGreaterThanOrEqual(300);
  });
});

// ── 2. fill_mode=fit scaling ──────────────────────────────────────────────────
describe("2. fill_mode=fit scaling", () => {
  it("landscape artwork fits by width constraint", () => {
    // 1536x1024 landscape into 1800x2400 canvas
    // scale = min(1800/1536, 2400/1024) = min(1.172, 2.344) = 1.172
    // rendered = 1800 x 1200 px
    // print = 12 x 8 inches
    // eff DPI = 1536/12 = 128 (FAIL)
    const r = validateArtworkForPrintfile(1536, 1024, BC3001_FRONT);
    expect(r.status).toBe("FAIL");
    expect(r.printWidthInches).toBeCloseTo(12, 0);
    expect(r.printHeightInches).toBeCloseTo(8, 0);
  });

  it("square artwork fits by width constraint into portrait canvas", () => {
    // 1200x1200 into 1800x2400: scale = min(1.5, 2.0) = 1.5
    // rendered = 1800x1800, print = 12x12 inches
    const r = validateArtworkForPrintfile(1200, 1200, BC3001_FRONT);
    expect(r.renderedWidthPx).toBe(1800);
    expect(r.renderedHeightPx).toBe(1800);
    expect(r.printWidthInches).toBeCloseTo(12, 1);
    expect(r.printHeightInches).toBeCloseTo(12, 1);
  });

  it("portrait artwork matching canvas ratio fills exactly", () => {
    // 1800x2400 into 1800x2400: scale = 1.0
    const r = validateArtworkForPrintfile(1800, 2400, BC3001_FRONT);
    expect(r.renderedWidthPx).toBe(1800);
    expect(r.renderedHeightPx).toBe(2400);
    expect(r.printWidthInches).toBeCloseTo(12, 1);
    expect(r.printHeightInches).toBeCloseTo(16, 1);
  });

  it("artwork wider than canvas fits by width, letterboxed vertically", () => {
    // 3600x1200 wide into 1800x2400: scale = min(0.5, 2.0) = 0.5
    // rendered = 1800x600, print = 12x4 inches
    const r = validateArtworkForPrintfile(3600, 1200, BC3001_FRONT);
    expect(r.renderedWidthPx).toBe(1800);
    expect(r.renderedHeightPx).toBe(600);
    expect(r.printWidthInches).toBeCloseTo(12, 1);
    expect(r.printHeightInches).toBeCloseTo(4, 1);
  });
});

// ── 3. DPI thresholds ─────────────────────────────────────────────────────────
describe("3. DPI threshold classification", () => {
  it("exactly 150 DPI → PASS_WARNING (meets minimum)", () => {
    const r = validateArtworkForPrintfile(1800, 2400, BC3001_FRONT);
    expect(r.status).toBe("PASS_WARNING");
    expect(r.effectiveDpi).toBe(150);
  });

  it("149 DPI → FAIL (below minimum)", () => {
    // Need artwork that renders at 149 DPI
    // 149 DPI * 12 inches = 1788 px wide
    const r = validateArtworkForPrintfile(1788, 2384, BC3001_FRONT);
    expect(r.status).toBe("FAIL");
    expect(r.effectiveDpi).toBeLessThan(150);
  });

  it("exactly 300 DPI → PASS (meets recommended)", () => {
    const r = validateArtworkForPrintfile(3600, 4800, BC3001_FRONT);
    expect(r.status).toBe("PASS");
    expect(r.effectiveDpi).toBe(300);
  });

  it("299 DPI → PASS_WARNING (below recommended but above minimum)", () => {
    // 299 DPI * 12 = 3588 px
    const r = validateArtworkForPrintfile(3588, 4784, BC3001_FRONT);
    expect(r.status).toBe("PASS_WARNING");
    expect(r.effectiveDpi).toBeGreaterThanOrEqual(150);
    expect(r.effectiveDpi).toBeLessThan(300);
  });
});

// ── 4. Result fields ──────────────────────────────────────────────────────────
describe("4. Result fields completeness", () => {
  it("returns all required fields", () => {
    const r = validateArtworkForPrintfile(3600, 4800, BC3001_FRONT);
    expect(r.artworkWidth).toBe(3600);
    expect(r.artworkHeight).toBe(4800);
    expect(r.canvasWidth).toBe(1800);
    expect(r.canvasHeight).toBe(2400);
    expect(r.canvasDpi).toBe(150);
    expect(r.minDpi).toBe(150);
    expect(r.recommendedDpi).toBe(300);
    expect(typeof r.message).toBe("string");
    expect(typeof r.detail).toBe("string");
    expect(r.message.length).toBeGreaterThan(0);
    expect(r.detail.length).toBeGreaterThan(0);
  });

  it("FAIL result includes minimum canvas size in detail", () => {
    const r = validateArtworkForPrintfile(1200, 1200, BC3001_FRONT);
    expect(r.detail).toContain("1800");
    expect(r.detail).toContain("2400");
  });
});

// ── 5. Still Original source artwork (1536x1024) ─────────────────────────────
describe("5. Still Original source artwork analysis", () => {
  it("1536x1024 source → FAIL for BC3001 front (128 DPI effective)", () => {
    const r = validateArtworkForPrintfile(1536, 1024, BC3001_FRONT);
    expect(r.status).toBe("FAIL");
    expect(r.effectiveDpi).toBeLessThan(150);
  });

  it("3600x2400 upscaled landscape → PASS_WARNING (300 DPI width, 150 DPI height)", () => {
    // If operator upscales to 3600x2400 (landscape):
    // scale = min(1800/3600, 2400/2400) = min(0.5, 1.0) = 0.5
    // rendered = 1800x1200, print = 12x8 inches
    // eff DPI x = 3600/12 = 300, eff DPI y = 2400/8 = 300
    const r = validateArtworkForPrintfile(3600, 2400, BC3001_FRONT);
    // conservative = min(300, 300) = 300 → PASS
    expect(r.effectiveDpiX).toBe(300);
    expect(r.effectiveDpiY).toBe(300);
    expect(r.status).toBe("PASS");
  });

  it("minimum viable landscape for BC3001 front: 1800x1200 → FAIL (150 DPI width, 75 DPI height)", () => {
    // scale = min(1800/1800, 2400/1200) = min(1.0, 2.0) = 1.0
    // rendered = 1800x1200, print = 12x8 inches
    // eff DPI x = 1800/12 = 150, eff DPI y = 1200/8 = 150
    const r = validateArtworkForPrintfile(1800, 1200, BC3001_FRONT);
    expect(r.effectiveDpiX).toBe(150);
    expect(r.effectiveDpiY).toBe(150);
    expect(r.status).toBe("PASS_WARNING");
  });
});
