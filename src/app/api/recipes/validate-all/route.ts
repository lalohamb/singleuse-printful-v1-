import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { getCatalogVariants } from "@/lib/printful/catalog";
import { getLayoutTemplates, getPrintfiles } from "@/lib/printful/templates";
import { PrintfulApiError } from "@/lib/printful/errors";
import { computePositionFromTemplate } from "@/lib/catalog/positioning";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export interface RecipeValidationReport {
  recipe_id: string;
  recipe_name: string;
  recipe_status: string;
  catalog_product_id: number;
  technique: string;
  placement: string;
  // Live Printful data
  catalog_product_exists: boolean;
  total_catalog_variants: number;
  filtered_variants: number;
  available_variants: number;
  unavailable_variants: number;
  // Variant rules match
  color_rules: string[];
  size_rules: string[];
  matched_colors: string[];
  unmatched_colors: string[];  // colors in rules not found in catalog
  // Pricing
  pricing_strategy: string;
  sample_cost: number | null;
  sample_retail_price: number | null;
  // Positioning
  placement_exists: boolean;
  available_placements: string[];
  auto_position: {
    computed: boolean;
    position?: {
      area_width: number; area_height: number;
      width: number; height: number;
      top: number; left: number;
    };
    effective_dpi?: number;
    canvas_dpi?: number;
    validation?: string;
    validation_message?: string;
    artwork_used?: { width: number; height: number };
  };
  // Overall
  errors: string[];
  warnings: string[];
  activatable: boolean;
}

// POST /api/recipes/validate-all
// Validates all non-archived recipes against live Printful catalog.
// Returns structured report per recipe. Does NOT activate.
// Body: { design_width?: number; design_height?: number }
//   — optional artwork dimensions for DPI/positioning preview
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { design_width?: number; design_height?: number } = {};
  try { body = await req.json(); } catch { /* optional */ }

  const supabase = sb();

  const { data: recipes } = await supabase
    .from("product_recipes")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: true });

  if (!recipes?.length) {
    return NextResponse.json({ recipes: [], total: 0 });
  }

  const reports: RecipeValidationReport[] = [];

  for (const recipe of recipes) {
    const errors: string[] = [];
    const warnings: string[] = [];

    const report: RecipeValidationReport = {
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      recipe_status: recipe.status,
      catalog_product_id: recipe.printful_catalog_id,
      technique: recipe.technique,
      placement: recipe.placement,
      catalog_product_exists: false,
      total_catalog_variants: 0,
      filtered_variants: 0,
      available_variants: 0,
      unavailable_variants: 0,
      color_rules: recipe.variant_rules?.colors ?? [],
      size_rules: recipe.variant_rules?.sizes ?? [],
      matched_colors: [],
      unmatched_colors: [],
      pricing_strategy: recipe.pricing_rules?.strategy ?? "UNKNOWN",
      sample_cost: null,
      sample_retail_price: null,
      placement_exists: false,
      available_placements: [],
      auto_position: { computed: false },
      errors,
      warnings,
      activatable: false,
    };

    // 1. Fetch catalog variants
    try {
      const raw = await getCatalogVariants(recipe.printful_catalog_id);
      report.catalog_product_exists = true;
      report.total_catalog_variants = raw.length;

      const rules = recipe.variant_rules as { colors?: string[]; sizes?: string[]; exclude_variant_ids?: number[] };
      const excludeIds = new Set(rules.exclude_variant_ids ?? []);

      const filtered = raw.filter((v) => {
        if (excludeIds.has(v.id)) return false;
        if (rules.colors?.length && !rules.colors.includes(v.color ?? "")) return false;
        if (rules.sizes?.length && !rules.sizes.includes(v.size ?? "")) return false;
        return true;
      });

      report.filtered_variants = filtered.length;

      const available = filtered.filter((v) => {
        if (Array.isArray(v.availability_status)) {
          return v.availability_status.some((s) => s.status === "active");
        }
        return v.in_stock;
      });

      report.available_variants = available.length;
      report.unavailable_variants = filtered.length - available.length;

      // Check which rule colors actually exist in catalog
      const catalogColors = new Set(raw.map((v) => v.color ?? ""));
      if (rules.colors?.length) {
        report.matched_colors = rules.colors.filter((c) => catalogColors.has(c));
        report.unmatched_colors = rules.colors.filter((c) => !catalogColors.has(c));
        if (report.unmatched_colors.length > 0) {
          warnings.push(`${report.unmatched_colors.length} color(s) in rules not found in catalog: ${report.unmatched_colors.join(", ")}`);
        }
      }

      if (available.length === 0) {
        errors.push(`No available variants match recipe rules (${filtered.length} filtered, ${report.unavailable_variants} unavailable)`);
      } else if (report.unavailable_variants > 0) {
        warnings.push(`${report.unavailable_variants} variant(s) match rules but are currently unavailable`);
      }

      // Pricing sample
      if (available.length > 0) {
        const sampleCost = parseFloat(available[0].price ?? "0");
        report.sample_cost = sampleCost;
        const pr = recipe.pricing_rules as { strategy: string; fixed_price?: number; cost_plus_margin?: number; min_price?: number; rounding?: string };
        if (pr.strategy === "FIXED_PRICE" && pr.fixed_price) {
          report.sample_retail_price = pr.fixed_price;
        } else if (pr.strategy === "COST_PLUS" && typeof pr.cost_plus_margin === "number") {
          let price = sampleCost + pr.cost_plus_margin;
          if (pr.rounding === "nearest_99") price = Math.floor(price) + 0.99;
          else if (pr.rounding === "ceil") price = Math.ceil(price);
          if (pr.min_price) price = Math.max(price, pr.min_price);
          report.sample_retail_price = Math.round(price * 100) / 100;
        }
      }
    } catch (err) {
      if (err instanceof PrintfulApiError) {
        errors.push(`Catalog product ${recipe.printful_catalog_id} not found: ${err.clientMessage}`);
      } else {
        errors.push(`Failed to fetch catalog: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Fetch printfiles + templates for placement validation + auto-positioning
    try {
      const [printfilesResp, templatesResp] = await Promise.all([
        getPrintfiles(recipe.printful_catalog_id),
        getLayoutTemplates(recipe.printful_catalog_id, { technique: recipe.technique }),
      ]);

      report.available_placements = Object.keys(printfilesResp.available_placements);
      report.placement_exists = report.available_placements.includes(recipe.placement);

      if (!report.placement_exists) {
        errors.push(`Placement '${recipe.placement}' not available. Available: ${report.available_placements.join(", ")}`);
      }

      // Auto-position using first template + matching printfile
      const template = templatesResp.templates[0];
      if (template) {
        const pf = printfilesResp.printfiles.find((p) => p.printfile_id === template.printfile_id);
        const canvasDpi = pf?.dpi ?? 150;

        // Use provided artwork dimensions or a representative 4200×4800 (production master)
        const artW = body.design_width ?? 4200;
        const artH = body.design_height ?? 4800;

        const posResult = computePositionFromTemplate(
          { width: artW, height: artH },
          template,
          canvasDpi
        );

        report.auto_position = {
          computed: true,
          position: posResult.position,
          effective_dpi: posResult.effective_dpi,
          canvas_dpi: canvasDpi,
          validation: posResult.validation,
          validation_message: posResult.validation_message,
          artwork_used: { width: artW, height: artH },
        };

        if (posResult.validation === "FAIL") {
          errors.push(`Auto-position DPI FAIL: ${posResult.validation_message}`);
        } else if (posResult.validation === "PASS_WARNING") {
          warnings.push(`Auto-position DPI WARNING: ${posResult.validation_message}`);
        }
      }
    } catch (err) {
      warnings.push(`Could not fetch printfiles/templates: ${err instanceof Error ? err.message : String(err)}`);
    }

    report.activatable = errors.length === 0;
    reports.push(report);
  }

  return NextResponse.json({
    total: reports.length,
    activatable: reports.filter((r) => r.activatable).length,
    recipes: reports,
  });
}
