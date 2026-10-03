import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/products/[id]
// Returns product + product_variants + product_designs (with design) + product_images
export async function GET(_req: Request, { params }: Params) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  const [productRes, variantsRes, designsRes, imagesRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("color")
      .order("size"),
    supabase
      .from("product_designs")
      .select("*, designs(id,name,slug,artwork_url,storage_path,file_name,width,height,status,file_size)")
      .eq("product_id", id)
      .order("is_primary", { ascending: false }),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", id)
      .order("display_order"),
  ]);

  if (!productRes.data)
    return NextResponse.json({ error: "Product not found" }, { status: 404 });

  return NextResponse.json({
    product: productRes.data,
    variants: variantsRes.data ?? [],
    product_designs: designsRes.data ?? [],
    images: imagesRes.data ?? [],
  });
}

// PATCH /api/admin/products/[id]
// Updates store-owned commercial fields only. Never touches fulfillment snapshots.
export async function PATCH(req: Request, { params }: Params) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Whitelist of editable store-owned fields
  const ALLOWED = new Set([
    "title", "description", "short_description", "slug",
    "meta_title", "meta_description", "category_id",
    "brand", "product_type", "status", "featured",
    "is_new_arrival", "is_trending", "is_bestseller", "is_on_sale",
    "is_personalizable", "personalization_label",
    "compare_at_price", "content_locked",
  ]);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) patch[k] = v;
  }

  // Optimistic concurrency — reject stale edits
  if (body.updated_at_check) {
    const { data: current } = await supabase
      .from("products")
      .select("updated_at")
      .eq("id", id)
      .maybeSingle();
    if (current && current.updated_at !== body.updated_at_check) {
      return NextResponse.json(
        { error: "This product changed after you opened it. Reload before saving.", conflict: true },
        { status: 409 }
      );
    }
  }

  // Slug uniqueness check
  if (patch.slug) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("slug", patch.slug as string)
      .neq("id", id)
      .maybeSingle();
    if (existing)
      return NextResponse.json({ error: "Slug already in use by another product" }, { status: 409 });
  }

  // Publication gate for catalog_builder products
  if (patch.status === "active") {
    const { data: product } = await supabase
      .from("products")
      .select("catalog_source, printful_catalog_id")
      .eq("id", id)
      .maybeSingle();

    if (product?.catalog_source === "catalog_builder") {
      const { data: pd } = await supabase
        .from("product_designs")
        .select("id, placement, technique, design_id")
        .eq("product_id", id)
        .eq("is_primary", true)
        .maybeSingle();

      if (!pd)
        return NextResponse.json(
          { error: "Cannot publish: no primary design attached" },
          { status: 400 }
        );
      if (!pd.placement || !pd.technique)
        return NextResponse.json(
          { error: "Cannot publish: design missing placement or technique" },
          { status: 400 }
        );

      const { data: design } = await supabase
        .from("designs")
        .select("status, artwork_url")
        .eq("id", pd.design_id)
        .maybeSingle();

      if (!design || design.status !== "active" || !design.artwork_url)
        return NextResponse.json(
          { error: "Cannot publish: design artwork is missing or inactive" },
          { status: 400 }
        );

      const { count: variantCount } = await supabase
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id)
        .eq("available", true);

      if (!variantCount || variantCount === 0)
        return NextResponse.json(
          { error: "Cannot publish: no active variants" },
          { status: 400 }
        );
    }

    if (!patch.published_at) {
      const { data: existing } = await supabase
        .from("products")
        .select("published_at")
        .eq("id", id)
        .maybeSingle();
      if (!existing?.published_at)
        patch.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}
