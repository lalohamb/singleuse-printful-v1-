import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { getCatalogVariants } from "@/lib/printful/catalog";
import { PrintfulApiError } from "@/lib/printful/errors";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export interface RecipeActivationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  catalog_product_id: number;
  total_variants: number;
  available_variants: number;
  filtered_variants: number;
}

// POST /api/recipes/[id]/activate
// Validates recipe against live Printful catalog data, then activates if valid.
// Draft recipe cannot be used for batch generation until this passes.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  const { data: recipe } = await supabase
    .from("product_recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  if (recipe.status === "archived") {
    return NextResponse.json({ error: "Archived recipe cannot be activated" }, { status: 400 });
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate catalog product exists + fetch variants
  let allVariants: Array<{ id: number; name: string; color: string; size: string }> = [];

  try {
    const result = await getCatalogVariants(recipe.printful_catalog_id);
    if (result.eligibility !== "eligible") {
      errors.push(`Catalog product ${recipe.printful_catalog_id} not eligible (${result.eligibility}): ${result.reason ?? ""}`);
    } else {
      allVariants = result.variants.map((v) => ({
        id: v.id,
        name: v.name,
        color: v.color ?? "",
        size: v.size ?? "",
      }));
    }
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      errors.push(`Catalog product ${recipe.printful_catalog_id} not found or inaccessible: ${err.clientMessage}`);
    } else {
      errors.push(`Failed to fetch Printful catalog: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Validate technique
  if (!recipe.technique?.trim()) {
    errors.push("technique is required");
  }

  // 3. Validate placement
  if (!recipe.placement?.trim()) {
    errors.push("placement is required");
  }

  // 4. Validate variant rules produce at least one available variant
  if (allVariants.length > 0) {
    const rules = recipe.variant_rules as { colors?: string[]; sizes?: string[]; exclude_variant_ids?: number[] };
    const excludeIds = new Set(rules.exclude_variant_ids ?? []);

    const filtered = allVariants.filter((v) => {
      if (excludeIds.has(v.id)) return false;
      if (rules.colors?.length && !rules.colors.includes(v.color)) return false;
      if (rules.sizes?.length && !rules.sizes.includes(v.size)) return false;
      return true;
    });

    // V2 catalog variants carry no availability_status — all identity records are eligible
    const available = filtered;
    const unavailable: typeof filtered = [];

    if (available.length === 0) {
      errors.push(`No available variants match recipe rules (${filtered.length} filtered)`);
    }

    // 5. Validate pricing rules
    const pr = recipe.pricing_rules as { strategy: string; fixed_price?: number; cost_plus_margin?: number; min_price?: number };
    if (pr.strategy === "FIXED_PRICE") {
      if (!pr.fixed_price || pr.fixed_price <= 0) {
        errors.push("FIXED_PRICE strategy requires fixed_price > 0");
      }
    } else if (pr.strategy === "COST_PLUS") {
      if (typeof pr.cost_plus_margin !== "number" || pr.cost_plus_margin < 0) {
        errors.push("COST_PLUS strategy requires cost_plus_margin >= 0");
      } else {
        // Provider cost is not available from the V2 catalog-variant endpoint.
        // COST_PLUS cannot be validated or activated without an authoritative provider cost.
        errors.push("COST_PLUS requires an authoritative provider cost, but provider cost is currently unavailable from the catalog variant endpoint.");
      }
    }

    if (errors.length === 0) {
      // Activate the recipe
      const now = new Date().toISOString();
      await supabase
        .from("product_recipes")
        .update({ status: "active", updated_at: now })
        .eq("id", id);

      return NextResponse.json({
        activated: true,
        validation: {
          valid: true,
          errors: [],
          warnings,
          catalog_product_id: recipe.printful_catalog_id,
          total_variants: allVariants.length,
          available_variants: available.length,
          filtered_variants: filtered.length,
        },
      });
    }
  }

  // Validation failed — recipe remains draft
  return NextResponse.json({
    activated: false,
    validation: {
      valid: false,
      errors,
      warnings,
      catalog_product_id: recipe.printful_catalog_id,
      total_variants: allVariants.length,
      available_variants: 0,
      filtered_variants: 0,
    },
  }, { status: 422 });
}
