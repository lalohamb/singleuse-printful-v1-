import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { validateProductRecipe } from "@/lib/catalog/recipe-engine";
import type { ProductRecipeInput } from "@/lib/catalog/recipe-engine";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// GET /api/recipes — list all recipes
export async function GET(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  let query = sb()
    .from("product_recipes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach usage counts
  const ids = (data ?? []).map((r) => r.id);
  let usageCounts: Record<string, number> = {};
  if (ids.length) {
    const { data: products } = await sb()
      .from("products")
      .select("recipe_id")
      .in("recipe_id", ids);
    for (const p of products ?? []) {
      if (p.recipe_id) usageCounts[p.recipe_id] = (usageCounts[p.recipe_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    recipes: (data ?? []).map((r) => ({ ...r, usage_count: usageCounts[r.id] ?? 0 })),
  });
}

// POST /api/recipes — create a recipe
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: ProductRecipeInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateProductRecipe(body);
  if (!validation.valid)
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });

  const supabase = sb();

  // Slug uniqueness
  const { data: existing } = await supabase
    .from("product_recipes")
    .select("id")
    .eq("slug", body.slug)
    .maybeSingle();
  if (existing)
    return NextResponse.json({ error: `Slug "${body.slug}" already in use` }, { status: 409 });

  const { data, error } = await supabase
    .from("product_recipes")
    .insert({
      name: body.name.trim(),
      slug: body.slug,
      description: body.description ?? null,
      status: body.status ?? "draft",
      provider: body.provider ?? "printful",
      printful_catalog_id: body.printful_catalog_id,
      technique: body.technique,
      placement: body.placement,
      printfile_id: body.printfile_id ?? null,
      variant_rules: body.variant_rules ?? {},
      pricing_rules: body.pricing_rules,
      mockup_rules: body.mockup_rules ?? {},
      commercial_defaults: body.commercial_defaults ?? {},
      publication_default: body.publication_default ?? "draft",
      metadata: body.metadata ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recipe: data }, { status: 201 });
}
