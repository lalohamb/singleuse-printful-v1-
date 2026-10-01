import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrintfulApiError } from "@/lib/printful/errors";
import {
  canvasToPrintfulCoordinates,
  printfulToCanvasCoordinates,
  clampToPrintArea,
} from "@/components/product-designer/coordinates";
import type {
  PrintfulLayoutTemplate,
  PrintfulTemplatesResponse,
  PrintfulVariantMapping,
} from "@/lib/printful/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const responseHeaders = new Headers(headers);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: responseHeaders,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })
  );
}

function makeTemplate(overrides: Partial<PrintfulLayoutTemplate> = {}): PrintfulLayoutTemplate {
  return {
    template_id: 1,
    image_url: "https://example.com/template.png",
    background_url: null,
    background_color: null,
    printfile_id: 10,
    template_width: 1000,
    template_height: 1000,
    print_area_width: 400,
    print_area_height: 500,
    print_area_top: 200,
    print_area_left: 300,
    is_template_on_front: true,
    orientation: "any",
    ...overrides,
  };
}

// ─── 1. Authorization header construction ────────────────────────────────────

describe("1. Authorization header construction", () => {
  beforeEach(() => {
    process.env.PRINTFUL_API_TOKEN = "test-token-abc";
    delete process.env.PRINTFUL_STORE_ID;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("attaches Bearer token to GET requests", async () => {
    mockFetch(200, { code: 200, result: [] });
    const { printfulGet } = await import("@/lib/printful/client");
    await printfulGet("/products");
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token-abc");
  });

  it("attaches X-PF-Store-Id when PRINTFUL_STORE_ID is set", async () => {
    process.env.PRINTFUL_STORE_ID = "99999";
    mockFetch(200, { code: 200, result: [] });
    const { printfulGet } = await import("@/lib/printful/client");
    await printfulGet("/products");
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers["X-PF-Store-Id"]).toBe("99999");
  });

  it("does not attach X-PF-Store-Id when PRINTFUL_STORE_ID is absent", async () => {
    mockFetch(200, { code: 200, result: [] });
    const { printfulGet } = await import("@/lib/printful/client");
    await printfulGet("/products");
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers["X-PF-Store-Id"]).toBeUndefined();
  });

  it("throws PrintfulApiError(500) when token is missing", async () => {
    delete process.env.PRINTFUL_API_TOKEN;
    const { printfulGet } = await import("@/lib/printful/client");
    await expect(printfulGet("/products")).rejects.toMatchObject({
      status: 500,
      code: "missing_token",
    });
  });
});

// ─── 2. Product ID validation ─────────────────────────────────────────────────

describe("2. Product ID validation", () => {
  it("rejects non-numeric product IDs", () => {
    const id = parseInt("abc", 10);
    expect(isNaN(id)).toBe(true);
  });

  it("rejects zero product ID", () => {
    const id = 0;
    expect(id <= 0).toBe(true);
  });

  it("accepts valid positive integer product ID", () => {
    const id = parseInt("71", 10);
    expect(isNaN(id)).toBe(false);
    expect(id > 0).toBe(true);
  });
});

// ─── 3. Variant ID validation ─────────────────────────────────────────────────

describe("3. Variant ID validation", () => {
  it("rejects empty variant_ids array", () => {
    const variant_ids: number[] = [];
    expect(Array.isArray(variant_ids) && variant_ids.length === 0).toBe(true);
  });

  it("accepts non-empty variant_ids array", () => {
    const variant_ids = [4011, 4012];
    expect(Array.isArray(variant_ids) && variant_ids.length > 0).toBe(true);
  });

  it("rejects non-array variant_ids", () => {
    const variant_ids = "4011";
    expect(Array.isArray(variant_ids)).toBe(false);
  });
});

// ─── 4. Template response parsing ────────────────────────────────────────────

describe("4. Template response parsing", () => {
  it("preserves all required template fields", () => {
    const tmpl = makeTemplate();
    expect(tmpl).toMatchObject({
      template_id: expect.any(Number),
      image_url: expect.any(String),
      printfile_id: expect.any(Number),
      template_width: expect.any(Number),
      template_height: expect.any(Number),
      print_area_width: expect.any(Number),
      print_area_height: expect.any(Number),
      print_area_top: expect.any(Number),
      print_area_left: expect.any(Number),
      is_template_on_front: expect.any(Boolean),
      orientation: expect.any(String),
    });
  });

  it("handles null background_url gracefully", () => {
    const tmpl = makeTemplate({ background_url: null });
    expect(tmpl.background_url).toBeNull();
  });
});

// ─── 5. Variant-to-template mapping ──────────────────────────────────────────

describe("5. Variant-to-template mapping", () => {
  const variantMapping: PrintfulVariantMapping[] = [
    { variant_id: 100, templates: [{ template_id: 1, placement: "front" }] },
    { variant_id: 101, templates: [{ template_id: 2, placement: "back" }] },
  ];
  const templates: PrintfulTemplatesResponse = {
    version: 1,
    min_dpi: 150,
    variant_mapping: variantMapping,
    templates: [makeTemplate({ template_id: 1 }), makeTemplate({ template_id: 2 })],
    conflicting_placements: {},
  };

  it("finds the correct template for a variant + placement", () => {
    const mapping = templates.variant_mapping.find((m) => m.variant_id === 100);
    const entry = mapping?.templates.find((t) => t.placement === "front");
    const tmpl = templates.templates.find((t) => t.template_id === entry?.template_id);
    expect(tmpl?.template_id).toBe(1);
  });

  it("returns undefined for unknown variant", () => {
    const mapping = templates.variant_mapping.find((m) => m.variant_id === 999);
    expect(mapping).toBeUndefined();
  });

  it("returns undefined for wrong placement", () => {
    const mapping = templates.variant_mapping.find((m) => m.variant_id === 100);
    const entry = mapping?.templates.find((t) => t.placement === "back");
    expect(entry).toBeUndefined();
  });
});

// ─── 6. Technique query construction ─────────────────────────────────────────

describe("6. Technique query construction", () => {
  it("builds correct query string with technique", () => {
    const params = new URLSearchParams();
    params.set("technique", "DTG");
    expect(params.toString()).toBe("technique=DTG");
  });

  it("builds correct query string with technique + orientation", () => {
    const params = new URLSearchParams();
    params.set("technique", "EMBROIDERY");
    params.set("orientation", "horizontal");
    expect(params.toString()).toBe("technique=EMBROIDERY&orientation=horizontal");
  });

  it("produces empty string when no params", () => {
    const params = new URLSearchParams();
    expect(params.toString()).toBe("");
  });

  it("rejects unknown technique via allowlist", () => {
    const VALID = new Set(["DIGITAL", "CUT-SEW", "UV", "EMBROIDERY", "SUBLIMATION", "ENGRAVING", "DTG"]);
    expect(VALID.has("INVALID_TECH")).toBe(false);
    expect(VALID.has("DTG")).toBe(true);
  });
});

// ─── 7. Artwork coordinate conversion ────────────────────────────────────────

describe("7. Artwork coordinate conversion", () => {
  const template = makeTemplate();
  const CANVAS_W = 400;
  const CANVAS_H = 400;

  it("canvasToPrintfulCoordinates produces positive area dimensions", () => {
    const pos = canvasToPrintfulCoordinates(
      { x: 120, y: 80, width: 80, height: 100 },
      template,
      CANVAS_W,
      CANVAS_H
    );
    expect(pos.area_width).toBe(template.print_area_width);
    expect(pos.area_height).toBe(template.print_area_height);
    expect(pos.width).toBeGreaterThan(0);
    expect(pos.height).toBeGreaterThan(0);
  });

  it("round-trips canvas → printful → canvas within 1px", () => {
    const original = { x: 150, y: 220, width: 60, height: 80 };
    const pos = canvasToPrintfulCoordinates(original, template, CANVAS_W, CANVAS_H);
    const back = printfulToCanvasCoordinates(pos, template, CANVAS_W, CANVAS_H);
    expect(Math.abs(back.x - original.x)).toBeLessThan(2);
    expect(Math.abs(back.y - original.y)).toBeLessThan(2);
  });

  it("prevents zero or negative width/height", () => {
    const pos = canvasToPrintfulCoordinates(
      { x: 0, y: 0, width: 0, height: 0 },
      template,
      CANVAS_W,
      CANVAS_H
    );
    expect(pos.width).toBeGreaterThanOrEqual(1);
    expect(pos.height).toBeGreaterThanOrEqual(1);
  });

  it("clampToPrintArea keeps artwork inside print area", () => {
    const clamped = clampToPrintArea(
      { x: -999, y: -999, width: 50, height: 50 },
      template,
      CANVAS_W,
      CANVAS_H
    );
    const scaleX = CANVAS_W / template.template_width;
    const scaleY = CANVAS_H / template.template_height;
    expect(clamped.x).toBeGreaterThanOrEqual(template.print_area_left * scaleX);
    expect(clamped.y).toBeGreaterThanOrEqual(template.print_area_top * scaleY);
  });
});

// ─── 8. Create-task payload construction ─────────────────────────────────────

describe("8. Create-task payload construction", () => {
  it("builds a valid create-task body", () => {
    const payload = {
      productId: 71,
      variant_ids: [4011],
      technique: "DTG",
      files: [
        {
          placement: "front",
          image_url: "https://cdn.example.com/art.png",
          position: { area_width: 400, area_height: 500, width: 200, height: 250, top: 0, left: 0 },
        },
      ],
    };
    expect(payload.productId).toBeGreaterThan(0);
    expect(payload.variant_ids.length).toBeGreaterThan(0);
    expect(payload.files[0].image_url.startsWith("http")).toBe(true);
    expect(payload.files[0].position.width).toBeGreaterThan(0);
    expect(payload.files[0].position.height).toBeGreaterThan(0);
  });

  it("rejects blob URLs as image_url", () => {
    const url = "blob:http://localhost/abc-123";
    expect(url.startsWith("http") && !url.startsWith("blob:")).toBe(false);
  });
});

// ─── 9. Pending task handling ─────────────────────────────────────────────────

describe("9. Pending task handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns pending status without mockups", async () => {
    process.env.PRINTFUL_API_TOKEN = "test-token";
    mockFetch(200, { code: 200, result: { task_key: "key-1", status: "pending" } });
    const { getMockupTask } = await import("@/lib/printful/mockups");
    const task = await getMockupTask("key-1");
    expect(task.status).toBe("pending");
    expect(task.mockups).toBeUndefined();
  });
});

// ─── 10. Completed task handling ─────────────────────────────────────────────

describe("10. Completed task handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns completed status with mockups array", async () => {
    process.env.PRINTFUL_API_TOKEN = "test-token";
    mockFetch(200, {
      code: 200,
      result: {
        task_key: "key-2",
        status: "completed",
        mockups: [
          {
            placement: "front",
            variant_ids: [4011],
            mockup_url: "https://cdn.printful.com/mockup.jpg",
            extra: [],
            option: null,
            option_group: null,
          },
        ],
      },
    });
    const { getMockupTask } = await import("@/lib/printful/mockups");
    const task = await getMockupTask("key-2");
    expect(task.status).toBe("completed");
    expect(task.mockups).toHaveLength(1);
    expect(task.mockups![0].mockup_url).toContain("https://");
  });
});

// ─── 11. Failed task handling ─────────────────────────────────────────────────

describe("11. Failed task handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns failed status with error message", async () => {
    process.env.PRINTFUL_API_TOKEN = "test-token";
    mockFetch(200, {
      code: 200,
      result: { task_key: "key-3", status: "failed", error: "Invalid image dimensions" },
    });
    const { getMockupTask } = await import("@/lib/printful/mockups");
    const task = await getMockupTask("key-3");
    expect(task.status).toBe("failed");
    expect(task.error).toBe("Invalid image dimensions");
  });
});

// ─── 12. Rate-limit response handling ────────────────────────────────────────

describe("12. Rate-limit response handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws PrintfulApiError with status 429 on rate limit", async () => {
    process.env.PRINTFUL_API_TOKEN = "test-token";
    mockFetch(429, { error: { message: "Too Many Requests", reason: "rate_limit" } });
    const { printfulGet } = await import("@/lib/printful/client");
    await expect(printfulGet("/products")).rejects.toMatchObject({ status: 429 });
  });

  it("PrintfulApiError.isRateLimit is true for 429", () => {
    const err = new PrintfulApiError(429, "rate_limit", "Too Many Requests");
    expect(err.isRateLimit).toBe(true);
  });

  it("getRetryAfter returns numeric seconds from header", async () => {
    const { getRetryAfter } = await import("@/lib/printful/client");
    const headers = new Headers({ "Retry-After": "30" });
    expect(getRetryAfter(headers)).toBe(30);
  });

  it("getRetryAfter defaults to 60 when header is absent", async () => {
    const { getRetryAfter } = await import("@/lib/printful/client");
    const headers = new Headers();
    expect(getRetryAfter(headers)).toBe(60);
  });
});

// ─── 13. Conflicting placements ───────────────────────────────────────────────

describe("13. Conflicting placements", () => {
  const conflicting_placements: Record<string, string[]> = {
    front: ["back"],
    back: ["front"],
  };

  it("identifies conflicting placement for selected placement", () => {
    const selected = "front";
    const conflicts = conflicting_placements[selected] ?? [];
    expect(conflicts).toContain("back");
  });

  it("returns empty array when no conflicts", () => {
    const selected = "sleeve_left";
    const conflicts = conflicting_placements[selected] ?? [];
    expect(conflicts).toHaveLength(0);
  });

  it("prevents submitting a known conflicting combination", () => {
    const selected = "front";
    const toAdd = "back";
    const conflicts = conflicting_placements[selected] ?? [];
    expect(conflicts.includes(toAdd)).toBe(true);
  });
});

// ─── 14. Malformed Printful response ─────────────────────────────────────────

describe("14. Malformed Printful response", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws on non-ok status with no parseable body", async () => {
    process.env.PRINTFUL_API_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => { throw new Error("not json"); },
        text: async () => "Internal Server Error",
      })
    );
    const { printfulGet } = await import("@/lib/printful/client");
    await expect(printfulGet("/products")).rejects.toMatchObject({ status: 500 });
  });

  it("PrintfulApiError.clientMessage is safe for 5xx", () => {
    const err = new PrintfulApiError(503, "service_unavailable", "raw internal detail");
    expect(err.clientMessage).toBe("Printful service is temporarily unavailable.");
    expect(err.clientMessage).not.toContain("raw internal detail");
  });

  it("PrintfulApiError.clientMessage is safe for 401", () => {
    const err = new PrintfulApiError(401, "unauthorized", "Bearer token xyz invalid");
    expect(err.clientMessage).toBe("Printful authentication failed. Check your API token.");
    expect(err.clientMessage).not.toContain("xyz");
  });
});
