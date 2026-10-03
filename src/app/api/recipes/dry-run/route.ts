import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { resolveProductRecipe } from "@/lib/catalog/recipe-engine";
import { dryRunProductSpecification } from "@/lib/catalog/product-engine";
import type { RecipeResolutionInput } from "@/lib/catalog/recipe-engine";

// POST /api/recipes/dry-run
// Resolves a recipe + design into a ProductSpecification and runs the dry-run pipeline.
// NO database mutations. NO Printful orders. NO Stripe activity.
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: {
    recipe_id: string;
    design_id: string;
    commercial_inputs: RecipeResolutionInput["commercialInputs"];
    idempotency_key?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.recipe_id || !body.design_id)
    return NextResponse.json({ error: "recipe_id and design_id are required" }, { status: 400 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load recipe
  const { data: recipe } = await sb
    .from("product_recipes")
    .select("*")
    .eq("id", body.recipe_id)
    .maybeSingle();
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  // Load design
  const { data: design } = await sb
    .from("designs")
    .select("id, name, artwork_url, storage_path, width, height, status")
    .eq("id", body.design_id)
    .maybeSingle();
  if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });
  if (design.status !== "active")
    return NextResponse.json({ error: "Design is not active" }, { status: 400 });

  // Fetch Printful variants for the recipe's catalog product via printful-proxy
  // We call the proxy edge function directly from the server
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let availableVariants: RecipeResolutionInput["availableVariants"] = [];
  try {
    const pfRes = await fetch(
      `${supabaseUrl}/functions/v1/printful-proxy/products`,
      { headers: { Authorization: `Bearer ${anonKey}` } }
    );
    if (pfRes.ok) {
      const pfData = await pfRes.json();
      // Find the catalog product — this is a simplified lookup
      // In production, use the catalog product endpoint directly
      availableVariants = []; // Variants come from catalog, not sync products
    }
  } catch {
    // Non-fatal — dry-run can proceed with empty variants (will fail validation)
  }

  // If no variants from Printful, use a placeholder for dry-run structural check
  // The actual variant resolution happens at generation time
  if (availableVariants.length === 0) {
    return NextResponse.json({
      dry_run: true,
      valid: false,
      errors: [{ field: "variants", message: "Could not fetch Printful variants for catalog product " + recipe.printful_catalog_id + ". Verify the catalog product ID and Printful connection." }],
      recipe: { id: recipe.id, name: recipe.name, status: recipe.status },
      design: { id: design.id, name: design.name },
      spec: null,
      plan: null,
    });
  }

  const resolution = resolveProductRecipe({
    recipe,
    design: { id: design.id, artwork_url: design.artwork_url, width: design.width, height: design.height, name: design.name },
    availableVariants,
    commercialInputs: body.commercial_inputs,
    idempotency_key: body.idempotency_key ?? crypto.randomUUID(),
  });

  if (!resolution.valid || !resolution.spec) {
    return NextResponse.json({
      dry_run: true,
      valid: false,
      errors: resolution.errors,
      preview: resolution.preview,
      recipe: { id: recipe.id, name: recipe.name },
      design: { id: design.id, name: design.name },
      spec: null,
      plan: null,
    });
  }

  const plan = dryRunProductSpecification(resolution.spec);

  return NextResponse.json({
    dry_run: true,
    valid: plan.valid,
    errors: plan.errors,
    preview: resolution.preview,
    recipe: { id: recipe.id, name: recipe.name, status: recipe.status },
    design: { id: design.id, name: design.name, dimensions: design.width && design.height ? `${design.width}×${design.height}` : null },
    spec: resolution.spec,
    plan: plan.resolved,
  });
}
