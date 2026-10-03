import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/product-images?product_id=<uuid>
export async function GET(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const productId = url.searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const { data, error } = await sb()
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("display_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ images: data });
}

// POST /api/product-images — create a product image record
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: {
    product_id: string;
    image_url: string;
    storage_path?: string;
    source?: string;
    alt_text?: string;
    is_primary?: boolean;
    display_order?: number;
    product_variant_id?: string;
    mockup_task_key?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });
  if (!body.image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });

  const supabase = sb();

  // If setting as primary, clear existing primary for this product
  if (body.is_primary) {
    await supabase.from("product_images")
      .update({ is_primary: false })
      .eq("product_id", body.product_id)
      .eq("is_primary", true);
  }

  const { data, error } = await supabase.from("product_images").insert({
    product_id: body.product_id,
    product_variant_id: body.product_variant_id || null,
    source: body.source || "manual",
    storage_path: body.storage_path || null,
    image_url: body.image_url,
    alt_text: body.alt_text || null,
    is_primary: body.is_primary ?? false,
    display_order: body.display_order ?? 0,
    mockup_task_key: body.mockup_task_key || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ image: data }, { status: 201 });
}

// DELETE /api/product-images — delete an image (safety: cannot delete last image)
export async function DELETE(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const imageId = url.searchParams.get("image_id");
  const productId = url.searchParams.get("product_id");
  if (!imageId || !productId)
    return NextResponse.json({ error: "image_id and product_id required" }, { status: 400 });

  const supabase = sb();

  // Safety: don't delete the last image
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((count ?? 0) <= 1)
    return NextResponse.json({ error: "Cannot delete the last product image" }, { status: 400 });

  const { data: img } = await supabase
    .from("product_images")
    .select("is_primary")
    .eq("id", imageId)
    .maybeSingle();

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If deleted image was primary, promote the next one
  if (img?.is_primary) {
    const { data: next } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", productId)
      .order("display_order")
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase.from("product_images").update({ is_primary: true }).eq("id", next.id);
      await supabase.from("products").update({ image_url: next.id, updated_at: new Date().toISOString() }).eq("id", productId);
    }
  }

  return NextResponse.json({ ok: true });
}

// PATCH /api/product-images — set primary image
export async function PATCH(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { image_id: string; product_id: string; is_primary?: boolean; display_order?: number; alt_text?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.image_id || !body.product_id) {
    return NextResponse.json({ error: "image_id and product_id required" }, { status: 400 });
  }

  const supabase = sb();

  if (body.is_primary) {
    // Clear existing primary
    await supabase.from("product_images")
      .update({ is_primary: false })
      .eq("product_id", body.product_id)
      .eq("is_primary", true);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.is_primary !== undefined) patch.is_primary = body.is_primary;
  if (body.display_order !== undefined) patch.display_order = body.display_order;
  if (body.alt_text !== undefined) patch.alt_text = body.alt_text;

  const { data, error } = await supabase.from("product_images")
    .update(patch)
    .eq("id", body.image_id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ image: data });
}
