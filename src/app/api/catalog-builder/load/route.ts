import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// GET /api/catalog-builder/load?product_id=<uuid>
// Returns full product state for Catalog Builder EDIT mode.
// Only works for catalog_builder products.
export async function GET(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const productId = url.searchParams.get("product_id");
  if (!productId)
    return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const supabase = sb();

  const [productRes, variantsRes, designsRes, imagesRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase.from("product_variants").select("*").eq("product_id", productId).order("color").order("size"),
    supabase.from("product_designs")
      .select("*, designs(id,name,slug,artwork_url,storage_path,file_name,width,height,status,file_size,file_hash)")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false }),
    supabase.from("product_images").select("*").eq("product_id", productId).order("display_order"),
  ]);

  if (!productRes.data)
    return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (productRes.data.catalog_source !== "catalog_builder")
    return NextResponse.json(
      { error: "Only catalog_builder products can be loaded in edit mode" },
      { status: 400 }
    );

  return NextResponse.json({
    product: productRes.data,
    variants: variantsRes.data ?? [],
    product_designs: designsRes.data ?? [],
    images: imagesRes.data ?? [],
  });
}
