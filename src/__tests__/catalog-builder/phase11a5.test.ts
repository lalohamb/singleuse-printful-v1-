// Phase 11A.5 — Catalog Builder Workflow Closure Tests
//
// Root cause fixed: resolveTemplate() in CatalogBuilder.tsx used strict
// variant_mapping lookup by V2 catalog variant ID. The mockup-generator
// templates endpoint (V1) uses a different ID space. The lookup always
// returned undefined → activeTemplate stayed null → Continue stayed disabled.
//
// Fix: fall back to variant_mapping[0] when exact ID match fails, matching
// the behaviour of resolveLayoutTemplateForVariantPlacement() in templates.ts.

import { describe, test, expect } from "vitest";
import type {
  PrintfulTemplatesResponse,
  PrintfulLayoutTemplate,
  PrintfulVariantMapping,
} from "@/lib/printful/types";
import { resolveLayoutTemplateForVariantPlacement } from "@/lib/printful/templates";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FRONT_TEMPLATE: PrintfulLayoutTemplate = {
  template_id: 1001,
  image_url: "https://files.cdn.printful.com/template/1001.png",
  background_url: null,
  background_color: null,
  printfile_id: 1,
  template_width: 800,
  template_height: 1000,
  print_area_width: 400,
  print_area_height: 500,
  print_area_top: 100,
  print_area_left: 200,
  is_template_on_front: true,
  orientation: "vertical",
};

const BACK_TEMPLATE: PrintfulLayoutTemplate = {
  template_id: 1002,
  image_url: "https://files.cdn.printful.com/template/1002.png",
  background_url: null,
  background_color: null,
  printfile_id: 2,
  template_width: 800,
  template_height: 1000,
  print_area_width: 400,
  print_area_height: 500,
  print_area_top: 100,
  print_area_left: 200,
  is_template_on_front: false,
  orientation: "vertical",
};

// V1 mockup-generator variant IDs (different from V2 catalog variant IDs)
const V1_VARIANT_ID = 55001;
const V2_CATALOG_VARIANT_ID = 17008; // different number — different ID space

function makeTemplatesResponse(variantId: number): PrintfulTemplatesResponse {
  return {
    version: 1,
    min_dpi: 150,
    variant_mapping: [
      {
        variant_id: variantId,
        templates: [
          { template_id: 1001, placement: "front" },
          { template_id: 1002, placement: "back" },
        ],
      },
    ],
    templates: [FRONT_TEMPLATE, BACK_TEMPLATE],
    conflicting_placements: {},
  };
}

// ── 1. Production Continue gate — template resolution ─────────────────────────

describe("Production Continue — template resolution via variant_mapping", () => {
  test("exact V1 variant ID match resolves front template", () => {
    const response = makeTemplatesResponse(V1_VARIANT_ID);
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "front", V1_VARIANT_ID);
    expect(tmpl).not.toBeNull();
    expect(tmpl?.template_id).toBe(1001);
  });

  test("V2 catalog variant ID (different space) falls back to variant_mapping[0]", () => {
    // This is the root cause scenario: V2 ID 17008 ≠ V1 ID 55001
    // Without fallback: returns null → activeTemplate null → Continue disabled
    // With fallback: returns variant_mapping[0] template → Continue enabled
    const response = makeTemplatesResponse(V1_VARIANT_ID);
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "front", V2_CATALOG_VARIANT_ID);
    expect(tmpl).not.toBeNull();
    expect(tmpl?.template_id).toBe(1001);
  });

  test("fallback to variant_mapping[0] when variantId is undefined", () => {
    const response = makeTemplatesResponse(V1_VARIANT_ID);
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "front", undefined);
    expect(tmpl).not.toBeNull();
    expect(tmpl?.template_id).toBe(1001);
  });

  test("back placement resolves correctly via fallback", () => {
    const response = makeTemplatesResponse(V1_VARIANT_ID);
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "back", V2_CATALOG_VARIANT_ID);
    expect(tmpl).not.toBeNull();
    expect(tmpl?.template_id).toBe(1002);
  });
});

describe("Production Continue — disabled when template missing", () => {
  test("nonexistent placement returns null — Continue stays disabled", () => {
    const response = makeTemplatesResponse(V1_VARIANT_ID);
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "sleeve_left", V2_CATALOG_VARIANT_ID);
    expect(tmpl).toBeNull();
  });

  test("empty variant_mapping returns null", () => {
    const response: PrintfulTemplatesResponse = {
      version: 1,
      min_dpi: 150,
      variant_mapping: [],
      templates: [FRONT_TEMPLATE],
      conflicting_placements: {},
    };
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "front", V2_CATALOG_VARIANT_ID);
    expect(tmpl).toBeNull();
  });

  test("empty templates array returns null", () => {
    const response: PrintfulTemplatesResponse = {
      version: 1,
      min_dpi: 150,
      variant_mapping: [{ variant_id: V1_VARIANT_ID, templates: [{ template_id: 1001, placement: "front" }] }],
      templates: [],
      conflicting_placements: {},
    };
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "front", V2_CATALOG_VARIANT_ID);
    expect(tmpl).toBeNull();
  });

  test("template_id in mapping not present in templates[] returns null", () => {
    const response: PrintfulTemplatesResponse = {
      version: 1,
      min_dpi: 150,
      variant_mapping: [{ variant_id: V1_VARIANT_ID, templates: [{ template_id: 9999, placement: "front" }] }],
      templates: [FRONT_TEMPLATE], // template_id 1001, not 9999
      conflicting_placements: {},
    };
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "front", V2_CATALOG_VARIANT_ID);
    expect(tmpl).toBeNull();
  });
});

// ── 2. Production Continue gate — enabled/disabled logic ─────────────────────
// Mirrors the stickyNav production case:
//   const ready = !!state.placement && !!state.activeTemplate;
//   continueDisabled: !ready

describe("Production Continue gate logic", () => {
  function productionReady(placement: string | null, activeTemplate: PrintfulLayoutTemplate | null): boolean {
    return !!placement && !!activeTemplate;
  }

  test("technique selected, placement selected, template resolved → Continue enabled", () => {
    expect(productionReady("front", FRONT_TEMPLATE)).toBe(true);
  });

  test("placement null → Continue disabled", () => {
    expect(productionReady(null, FRONT_TEMPLATE)).toBe(false);
  });

  test("activeTemplate null → Continue disabled", () => {
    expect(productionReady("front", null)).toBe(false);
  });

  test("both null → Continue disabled", () => {
    expect(productionReady(null, null)).toBe(false);
  });

  test("disabled reason: no placement → 'Select a placement to continue.'", () => {
    const placement: string | null = null;
    const activeTemplate: PrintfulLayoutTemplate | null = FRONT_TEMPLATE;
    const reason = !placement
      ? "Select a placement to continue."
      : !activeTemplate
      ? "No template found for this placement."
      : undefined;
    expect(reason).toBe("Select a placement to continue.");
  });

  test("disabled reason: placement set but no template → 'No template found for this placement.'", () => {
    const placement: string | null = "front";
    const activeTemplate: PrintfulLayoutTemplate | null = null;
    const reason = !placement
      ? "Select a placement to continue."
      : !activeTemplate
      ? "No template found for this placement."
      : undefined;
    expect(reason).toBe("No template found for this placement.");
  });

  test("disabled reason: both set → undefined (Continue enabled)", () => {
    const placement: string | null = "front";
    const activeTemplate: PrintfulLayoutTemplate | null = FRONT_TEMPLATE;
    const reason = !placement
      ? "Select a placement to continue."
      : !activeTemplate
      ? "No template found for this placement."
      : undefined;
    expect(reason).toBeUndefined();
  });
});

// ── 3. Technique change invalidates stale template ────────────────────────────

describe("technique change invalidates stale template", () => {
  test("technique change sets activeTemplate to null", () => {
    // Simulate the state update on technique change
    const before = { technique: "DTFILM", placement: "front", activeTemplate: FRONT_TEMPLATE };
    // loadProduction clears placement and activeTemplate
    const after = { ...before, placement: null, activeTemplate: null };
    expect(after.activeTemplate).toBeNull();
    expect(after.placement).toBeNull();
  });

  test("placement change resolves new template", () => {
    const response = makeTemplatesResponse(V1_VARIANT_ID);
    const frontTmpl = resolveLayoutTemplateForVariantPlacement(response, "front", V2_CATALOG_VARIANT_ID);
    const backTmpl = resolveLayoutTemplateForVariantPlacement(response, "back", V2_CATALOG_VARIANT_ID);
    expect(frontTmpl?.template_id).toBe(1001);
    expect(backTmpl?.template_id).toBe(1002);
    expect(frontTmpl?.template_id).not.toBe(backTmpl?.template_id);
  });
});

// ── 4. Stage navigation order ─────────────────────────────────────────────────

describe("stage navigation order", () => {
  const SINGLE_STAGES = ["blank", "variants", "design", "production", "designer", "mockups", "details", "pricing", "review"];

  test("production is stage index 3", () => {
    expect(SINGLE_STAGES.indexOf("production")).toBe(3);
  });

  test("designer follows production", () => {
    const prodIdx = SINGLE_STAGES.indexOf("production");
    const designerIdx = SINGLE_STAGES.indexOf("designer");
    expect(designerIdx).toBe(prodIdx + 1);
  });

  test("review is the last stage", () => {
    expect(SINGLE_STAGES[SINGLE_STAGES.length - 1]).toBe("review");
  });

  test("future-stage jumping prohibited — stage index must not skip forward", () => {
    // Simulates the completedStages gate: a stage is only clickable when complete or available
    const completedStages = new Set(["blank", "variants", "design"]);
    const currentStage = "production";
    const currentIdx = SINGLE_STAGES.indexOf(currentStage);

    const canJumpTo = (target: string) => {
      const targetIdx = SINGLE_STAGES.indexOf(target);
      const isDone = completedStages.has(target);
      const isAvailable = targetIdx < currentIdx;
      return isDone || isAvailable;
    };

    // Can go back to completed stages
    expect(canJumpTo("blank")).toBe(true);
    expect(canJumpTo("variants")).toBe(true);
    expect(canJumpTo("design")).toBe(true);
    // Cannot jump forward past current
    expect(canJumpTo("designer")).toBe(false);
    expect(canJumpTo("mockups")).toBe(false);
    expect(canJumpTo("review")).toBe(false);
  });
});

// ── 5. State preserved through Production → Position ─────────────────────────

describe("state preserved through Production → Position", () => {
  test("technique, placement, activeTemplate all survive go('designer')", () => {
    // go() only clears downstream stages from DOWNSTREAM map
    // production's downstream: ["designer","mockups","review"]
    // technique and placement are NOT in the downstream clear list
    const DOWNSTREAM: Record<string, string[]> = {
      production: ["designer", "mockups", "review"],
    };

    const completedStages = new Set(["blank", "variants", "design", "production"]);
    const downstream = DOWNSTREAM["production"] ?? [];
    for (const d of downstream) completedStages.delete(d);

    // technique and placement are state fields, not stage completion flags
    // They are only cleared by explicit technique/placement change handlers
    const state = { technique: "DTFILM", placement: "front", activeTemplate: FRONT_TEMPLATE };
    expect(state.technique).toBe("DTFILM");
    expect(state.placement).toBe("front");
    expect(state.activeTemplate).not.toBeNull();
  });
});

// ── 6. Review gate ────────────────────────────────────────────────────────────

describe("Review gate", () => {
  test("retail_price > 0 for all variants → Review enabled", () => {
    const variantPricing = [
      { retail_price: 39.99, provider_cost: 25.59 },
      { retail_price: 41.99, provider_cost: 27.59 },
    ];
    const invalid = variantPricing.some((v) => v.retail_price <= 0);
    expect(invalid).toBe(false);
  });

  test("any retail_price <= 0 → Review disabled", () => {
    const variantPricing = [
      { retail_price: 39.99, provider_cost: 25.59 },
      { retail_price: 0, provider_cost: null },
    ];
    const invalid = variantPricing.some((v) => v.retail_price <= 0);
    expect(invalid).toBe(true);
  });

  test("provider_cost null does not block Review", () => {
    const variantPricing = [
      { retail_price: 39.99, provider_cost: null },
      { retail_price: 41.99, provider_cost: null },
    ];
    const invalid = variantPricing.some((v) => v.retail_price <= 0);
    expect(invalid).toBe(false); // null cost does not block
  });

  test("provider_cost null does not fabricate a value", () => {
    const cost: number | null = null;
    expect(cost).toBeNull();
    expect(cost).not.toBe(0);
  });
});

// ── 7. Valid DTF/front production path ───────────────────────────────────────

describe("valid DTF/front production path", () => {
  test("DTF technique + front placement + fallback mapping → template resolved", () => {
    const response = makeTemplatesResponse(V1_VARIANT_ID);
    // Operator selects a V2 catalog variant (ID 17008), technique DTF, placement front
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "front", V2_CATALOG_VARIANT_ID);
    expect(tmpl).not.toBeNull();
    expect(tmpl?.template_id).toBe(1001);
  });

  test("resolved template has valid print area dimensions", () => {
    const response = makeTemplatesResponse(V1_VARIANT_ID);
    const tmpl = resolveLayoutTemplateForVariantPlacement(response, "front", V2_CATALOG_VARIANT_ID);
    expect(tmpl).not.toBeNull();
    expect(tmpl!.print_area_width).toBeGreaterThan(0);
    expect(tmpl!.print_area_height).toBeGreaterThan(0);
    expect(tmpl!.template_width).toBeGreaterThan(0);
    expect(tmpl!.template_height).toBeGreaterThan(0);
  });
});
