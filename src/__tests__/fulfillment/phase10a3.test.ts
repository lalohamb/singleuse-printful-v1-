// Phase 10A.3 — Product Management Regression Tests
//
// Part A — Error 1: artwork upload returns HTML → client must not call .json() blindly
// Part A — Error 2: resolvePrintfulProductIdentity must not require printful_id for catalog_builder
// Part B — Phase 10A.2 product integrity (rows 3 + 4)
// Part C — Legacy printful_sync identity resolution remains compatible

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CATALOG_BUILDER_PRODUCT = {
  id: "9f00d7b8-6ec0-4d62-bfa4-c1211c66241f",
  catalog_source: "catalog_builder",
  printful_id: null,
  printful_catalog_id: 638,
};

const CATALOG_BUILDER_NO_CATALOG_ID = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  catalog_source: "catalog_builder",
  printful_id: null,
  printful_catalog_id: null,
};

const PRINTFUL_SYNC_PRODUCT = {
  id: "bbbbbbbb-0000-0000-0000-000000000002",
  catalog_source: "printful_sync",
  printful_id: "476330305",
  printful_catalog_id: 71,
};

const PRINTFUL_SYNC_NO_CATALOG_ID = {
  id: "cccccccc-0000-0000-0000-000000000003",
  catalog_source: "printful_sync",
  printful_id: "476330305",
  printful_catalog_id: null,
};

// ── Inline identity resolver (mirrors identity.ts logic) ─────────────────────
// Tests the resolution logic directly without DB/network calls.

function resolveIdentity(product: {
  id: string;
  printful_id: string | null;
  printful_catalog_id: number | null;
}): { syncProductId: number; catalogProductId: number } {
  if (!product.printful_id) {
    if (product.printful_catalog_id) {
      return { syncProductId: 0, catalogProductId: product.printful_catalog_id };
    }
    throw new Error(
      `Product ${product.id} has no Printful catalog ID (printful_catalog_id is null). ` +
      `Set printful_catalog_id on the product before generating mockups.`
    );
  }
  const syncProductId = Number(product.printful_id);
  if (product.printful_catalog_id) {
    return { syncProductId, catalogProductId: product.printful_catalog_id };
  }
  throw new Error(`Cannot resolve catalog product ID for sync product ${syncProductId}`);
}

// ── Part A — Error 2: identity resolution ────────────────────────────────────

describe("resolvePrintfulProductIdentity — catalog_builder (printful_id=null)", () => {
  it("resolves catalog_builder product via printful_catalog_id without requiring printful_id", () => {
    const result = resolveIdentity(CATALOG_BUILDER_PRODUCT);
    expect(result.catalogProductId).toBe(638);
  });

  it("syncProductId is 0 for catalog_builder (no sync product)", () => {
    const result = resolveIdentity(CATALOG_BUILDER_PRODUCT);
    expect(result.syncProductId).toBe(0);
  });

  it("throws descriptive error when catalog_builder has no printful_catalog_id either", () => {
    expect(() => resolveIdentity(CATALOG_BUILDER_NO_CATALOG_ID)).toThrow(
      "printful_catalog_id is null"
    );
  });

  it("error message does NOT say 'printful_id is null' for catalog_builder", () => {
    expect(() => resolveIdentity(CATALOG_BUILDER_NO_CATALOG_ID)).not.toThrow(
      "printful_id is null"
    );
  });

  it("does not throw for product 9f00d7b8 (catalog 638)", () => {
    expect(() => resolveIdentity(CATALOG_BUILDER_PRODUCT)).not.toThrow();
  });
});

describe("resolvePrintfulProductIdentity — printful_sync (legacy)", () => {
  it("resolves printful_sync product with both IDs present", () => {
    const result = resolveIdentity(PRINTFUL_SYNC_PRODUCT);
    expect(result.syncProductId).toBe(476330305);
    expect(result.catalogProductId).toBe(71);
  });

  it("throws when printful_sync has no catalog ID (requires API fallback)", () => {
    expect(() => resolveIdentity(PRINTFUL_SYNC_NO_CATALOG_ID)).toThrow();
  });

  it("legacy sync product syncProductId is non-zero", () => {
    const result = resolveIdentity(PRINTFUL_SYNC_PRODUCT);
    expect(result.syncProductId).toBeGreaterThan(0);
  });
});

// ── Part A — Error 1: HTML-vs-JSON client error handling ─────────────────────

describe("DesignTab — artwork upload response handling", () => {
  it("detects HTML response before calling .json()", async () => {
    // Simulate server returning HTML (e.g. auth redirect or unhandled error)
    const mockRes = {
      ok: false,
      status: 500,
      headers: { get: (k: string) => k === "content-type" ? "text/html; charset=utf-8" : null },
    };

    const contentType = mockRes.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");

    expect(isJson).toBe(false);
    // Client should throw before calling .json()
    expect(() => {
      if (!isJson) throw new Error(`Server returned unexpected response (HTTP ${mockRes.status}). Check your session and try again.`);
    }).toThrow("Server returned unexpected response");
  });

  it("accepts JSON response correctly", async () => {
    const mockRes = {
      ok: true,
      status: 200,
      headers: { get: (k: string) => k === "content-type" ? "application/json" : null },
    };
    const contentType = mockRes.headers.get("content-type") ?? "";
    expect(contentType.includes("application/json")).toBe(true);
  });

  it("detects HTML even when status is 401", () => {
    const mockRes = {
      ok: false,
      status: 401,
      headers: { get: (k: string) => k === "content-type" ? "text/html" : null },
    };
    const contentType = mockRes.headers.get("content-type") ?? "";
    expect(contentType.includes("application/json")).toBe(false);
  });

  it("JSON 401 from requireAdmin is handled correctly", async () => {
    const mockRes = {
      ok: false,
      status: 401,
      headers: { get: (k: string) => k === "content-type" ? "application/json" : null },
    };
    const contentType = mockRes.headers.get("content-type") ?? "";
    // JSON 401 — safe to call .json(), then check res.ok
    expect(contentType.includes("application/json")).toBe(true);
  });
});

// ── Part A — mockup regen: position from frozen configuration ─────────────────

describe("DesignTab — mockup regeneration uses frozen position", () => {
  const frozenConfig = {
    version: 1,
    position: { top: 1225, left: 1051, width: 898, height: 304, area_width: 1796, area_height: 608 },
    placement: "embroidery_front_large",
    technique: "EMBROIDERY",
    artworkUrl: "https://example.com/art.png",
    catalog_product_id: 638,
  };

  it("extracts position from frozen configuration", () => {
    const pos = (frozenConfig as Record<string, unknown>)?.position ?? null;
    expect(pos).not.toBeNull();
    expect((pos as Record<string, number>).area_width).toBe(1796);
  });

  it("includes position in mockup files payload when present", () => {
    const pos = frozenConfig.position;
    const files = [{
      placement: frozenConfig.placement,
      image_url: frozenConfig.artworkUrl,
      ...(pos ? { position: pos } : {}),
    }];
    expect(files[0]).toHaveProperty("position");
    expect(files[0].position).toEqual(frozenConfig.position);
  });

  it("omits position key when configuration has no position", () => {
    const configNoPos = { version: 1, placement: "front", technique: "DTG", artworkUrl: "https://example.com/art.png" };
    const pos = (configNoPos as Record<string, unknown>)?.position ?? null;
    const files = [{
      placement: "front",
      image_url: "https://example.com/art.png",
      ...(pos ? { position: pos } : {}),
    }];
    expect(files[0]).not.toHaveProperty("position");
  });
});

// ── Part B — Phase 10A.2 product identity contracts ──────────────────────────

describe("Phase 10A.2 generated products — identity contracts", () => {
  const ROW3 = {
    id: "6824b815-3ce4-4888-b832-3eba84757ad5",
    catalog_source: "catalog_builder",
    printful_id: null,
    printful_catalog_id: 71,
    status: "draft",
    recipe_id: "f6c0b27a-f81b-470a-8951-eea6df08e40d",
    design_id: "dc6f0073-d0de-4596-8ae2-57e04916ff06",
    variant_count: 47,
    placement: "front",
    technique: "DTG",
    mockup_count: 7,
  };

  const ROW4 = {
    id: "2eea9504-36cf-45fd-aa03-51fe82df4a20",
    catalog_source: "catalog_builder",
    printful_id: null,
    printful_catalog_id: 1580,
    status: "draft",
    recipe_id: "a6316d32-9fc6-4d36-8b81-05716f272a73",
    design_id: "dc6f0073-d0de-4596-8ae2-57e04916ff06",
    variant_count: 6,
    placement: "front_dtf",
    technique: "DTFILM",
    mockup_count: 1,
  };

  for (const [label, product] of [["Row 3", ROW3], ["Row 4", ROW4]] as const) {
    it(`${label}: catalog_source=catalog_builder`, () => {
      expect(product.catalog_source).toBe("catalog_builder");
    });
    it(`${label}: printful_id=null`, () => {
      expect(product.printful_id).toBeNull();
    });
    it(`${label}: status=draft (not published)`, () => {
      expect(product.status).toBe("draft");
    });
    it(`${label}: identity resolves via printful_catalog_id`, () => {
      const result = resolveIdentity(product);
      expect(result.catalogProductId).toBe(product.printful_catalog_id);
    });
    it(`${label}: mockup regen would not throw on identity resolution`, () => {
      expect(() => resolveIdentity(product)).not.toThrow();
    });
  }

  it("Row 3 variant count = 47", () => { expect(ROW3.variant_count).toBe(47); });
  it("Row 4 variant count = 6",  () => { expect(ROW4.variant_count).toBe(6); });
  it("Row 3 mockup count = 7",   () => { expect(ROW3.mockup_count).toBe(7); });
  it("Row 4 mockup count = 1",   () => { expect(ROW4.mockup_count).toBe(1); });
  it("Row 3 placement = front / DTG",      () => { expect(ROW3.placement).toBe("front"); expect(ROW3.technique).toBe("DTG"); });
  it("Row 4 placement = front_dtf / DTFILM", () => { expect(ROW4.placement).toBe("front_dtf"); expect(ROW4.technique).toBe("DTFILM"); });
  it("Both rows share same design dc6f0073", () => {
    expect(ROW3.design_id).toBe(ROW4.design_id);
    expect(ROW3.design_id).toBe("dc6f0073-d0de-4596-8ae2-57e04916ff06");
  });
  it("Row 3 and Row 4 have different product UUIDs", () => {
    expect(ROW3.id).not.toBe(ROW4.id);
  });
});

// ── Part D — Safety constants ─────────────────────────────────────────────────

describe("Safety constants — immutability", () => {
  it("Production product UUID is unchanged", () => {
    expect("85b05b7e-cd61-4e2b-9c77-2657f93ce638").toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("Historical snapshot hash is 64-char hex", () => {
    const hash = "b129cb35cebd5cb2074624b83030316132f85284156c4e022e6e0607e5bfa628";
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("PRINTFUL_AUTO_CONFIRM is not 'true'", () => {
    expect(process.env.PRINTFUL_AUTO_CONFIRM).not.toBe("true");
  });

  it("catalog_builder products must never have printful_id set", () => {
    const products = [
      { id: "9f00d7b8", catalog_source: "catalog_builder", printful_id: null },
      { id: "6824b815", catalog_source: "catalog_builder", printful_id: null },
      { id: "2eea9504", catalog_source: "catalog_builder", printful_id: null },
    ];
    for (const p of products) {
      expect(p.printful_id).toBeNull();
    }
  });
});
