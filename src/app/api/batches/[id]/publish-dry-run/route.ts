import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/batches/[id]/publish-dry-run
// Body: { product_ids: string[] }
// Returns publishable vs blocked products WITHOUT publishing.
// Operator must call /publish to actually publish.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;

  let body: { product_ids: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.product_ids) || body.product_ids.length === 0) {
    return NextResponse.json({ error: "product_ids array is required" }, { status: 400 });
  }

  const supabase = sb();

  const { data: products } = await supabase
    .from("products")
    .select("id, title, slug, price, printful_catalog_id, status, batch_id")
    .in("id", body.product_ids)
    .eq("batch_id", batchId);

  if (!products?.length) {
    return NextResponse.json({ error: "No matching products found in this batch" }, { status: 404 });
  }

  const publishable: Array<{ id: string; title: string; slug: string }> = [];
  const blocked: Array<{ id: string; title: string; reason: string }> = [];

  for (const product of products) {
    const reasons: string[] = [];

    if (!product.price || product.price <= 0) reasons.push("Price is zero");
    if (!product.printful_catalog_id) reasons.push("No catalog mapping");

    if (reasons.length === 0) {
      const { data: design } = await supabase
        .from("product_designs")
        .select("id")
        .eq("product_id", product.id)
        .eq("is_primary", true)
        .maybeSingle();
      if (!design) reasons.push("No primary design");
    }

    if (reasons.length === 0) {
      const { count: variantCount } = await supabase
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id)
        .eq("available", true);
      if (!variantCount || variantCount === 0) reasons.push("No active variants");
    }

    if (reasons.length === 0) {
      const { count: imageCount } = await supabase
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id);
      if (!imageCount || imageCount === 0) reasons.push("No product images");
    }

    if (reasons.length === 0) {
      publishable.push({ id: product.id, title: product.title, slug: product.slug });
    } else {
      blocked.push({ id: product.id, title: product.title, reason: reasons.join("; ") });
    }
  }

  return NextResponse.json({
    selected: products.length,
    publishable: publishable.length,
    blocked: blocked.length,
    publishable_products: publishable,
    blocked_products: blocked,
    dry_run: true,
  });
}
