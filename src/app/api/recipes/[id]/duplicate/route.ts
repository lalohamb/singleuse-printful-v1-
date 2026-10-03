import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/recipes/[id]/duplicate
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  const { data: source } = await supabase
    .from("product_recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!source) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  // Generate unique slug
  let slug = `${source.slug}-copy`;
  let counter = 2;
  while (true) {
    const { data: conflict } = await supabase
      .from("product_recipes")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!conflict) break;
    slug = `${source.slug}-copy-${counter++}`;
  }

  const { id: _id, created_at, updated_at, ...rest } = source;
  const { data, error } = await supabase
    .from("product_recipes")
    .insert({
      ...rest,
      name: `${source.name} (Copy)`,
      slug,
      status: "draft", // always draft on duplicate
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recipe: data }, { status: 201 });
}
