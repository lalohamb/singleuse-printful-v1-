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

type Params = { params: Promise<{ id: string }> };

// GET /api/recipes/[id]
export async function GET(_req: Request, { params }: Params) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  const { data, error } = await supabase
    .from("product_recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", id);

  return NextResponse.json({ recipe: { ...data, usage_count: count ?? 0 } });
}

// PATCH /api/recipes/[id]
export async function PATCH(req: Request, { params }: Params) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  let body: Partial<ProductRecipeInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("product_recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  // Merge and validate
  const merged = { ...existing, ...body } as ProductRecipeInput;
  const validation = validateProductRecipe(merged);
  if (!validation.valid)
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });

  // Slug uniqueness (allow same slug for same recipe)
  if (body.slug && body.slug !== existing.slug) {
    const { data: slugConflict } = await supabase
      .from("product_recipes")
      .select("id")
      .eq("slug", body.slug)
      .neq("id", id)
      .maybeSingle();
    if (slugConflict)
      return NextResponse.json({ error: `Slug "${body.slug}" already in use` }, { status: 409 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const ALLOWED_FIELDS = [
    "name", "slug", "description", "status", "provider",
    "printful_catalog_id", "technique", "placement", "printfile_id",
    "variant_rules", "pricing_rules", "mockup_rules",
    "commercial_defaults", "publication_default", "metadata",
  ];
  for (const f of ALLOWED_FIELDS) {
    if (f in body) patch[f] = (body as Record<string, unknown>)[f];
  }

  const { data, error } = await supabase
    .from("product_recipes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recipe: data });
}

// DELETE /api/recipes/[id] — archive only if used by products; hard delete if unused
export async function DELETE(_req: Request, { params }: Params) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", id);

  if ((count ?? 0) > 0) {
    // Archive instead of delete — products reference this recipe
    const { data, error } = await supabase
      .from("product_recipes")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, archived: true, recipe: data });
  }

  const { error } = await supabase.from("product_recipes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: true });
}
