import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getCatalogVariants } from "@/lib/printful/catalog";
import { PrintfulApiError } from "@/lib/printful/errors";

// POST /api/batches/[id]/resolve-variants
// Body: { recipe_id: string }
// Fetches Printful catalog variants server-side for a recipe's catalog product.
// Client-supplied availableVariants are NEVER trusted for approval/generation.
// This endpoint is the authoritative source.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;

  let body: { recipe_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.recipe_id) {
    return NextResponse.json({ error: "recipe_id is required" }, { status: 400 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify batch exists
  const { data: batch } = await supabase
    .from("catalog_batches")
    .select("id")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  // Load recipe
  const { data: recipe } = await supabase
    .from("product_recipes")
    .select("id, printful_catalog_id, technique, placement, variant_rules, status")
    .eq("id", body.recipe_id)
    .maybeSingle();

  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  if (recipe.status !== "active") {
    return NextResponse.json({ error: `Recipe is not active (status: ${recipe.status})` }, { status: 400 });
  }

  // Fetch variants from Printful — server-side, authoritative
  let allVariants: Array<{
    id: number;
    name: string;
    color: string;
    size: string;
  }>;

  try {
    const result = await getCatalogVariants(recipe.printful_catalog_id);
    if (result.eligibility !== "eligible") {
      return NextResponse.json({ error: `Catalog product not eligible (${result.eligibility}): ${result.reason ?? ""}` }, { status: 502 });
    }
    allVariants = result.variants.map((v) => ({
      id: v.id,
      name: v.name,
      color: v.color ?? "",
      size: v.size ?? "",
    }));
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: `Printful catalog error: ${err.clientMessage}` }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to fetch Printful catalog variants" }, { status: 502 });
  }

  // Apply recipe variant_rules filter
  const rules = recipe.variant_rules as {
    colors?: string[];
    sizes?: string[];
    exclude_variant_ids?: number[];
  };
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

  // Validate: must have at least one available variant
  if (available.length === 0) {
    return NextResponse.json({
      error: "No available variants match recipe rules",
      total_catalog_variants: allVariants.length,
      filtered: filtered.length,
      available: 0,
      unavailable: unavailable.length,
    }, { status: 422 });
  }

  return NextResponse.json({
    recipe_id: recipe.id,
    printful_catalog_id: recipe.printful_catalog_id,
    total_catalog_variants: allVariants.length,
    filtered: filtered.length,
    available: available.length,
    unavailable: unavailable.length,
    variants: available,
    unavailable_variants: unavailable.map((v) => v.name),
  });
}
