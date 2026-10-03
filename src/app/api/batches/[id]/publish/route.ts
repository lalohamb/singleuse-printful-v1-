import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/batches/[id]/publish
// Body: { product_ids: string[] }
// Publishes selected draft products from this batch.
// Reuses existing publication gates — blocked products remain draft.
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

  // Verify products belong to this batch
  const { data: products } = await supabase
    .from("products")
    .select("id, title, slug, price, printful_catalog_id, status, batch_id")
    .in("id", body.product_ids)
    .eq("batch_id", batchId);

  if (!products?.length) return NextResponse.json({ error: "No matching products found in this batch" }, { status: 404 });

  const now = new Date().toISOString();
  const published: string[] = [];
  const blocked: Array<{ id: string; reason: string }> = [];

  for (const product of products) {
    // Publication gate: price > 0, catalog_id, design, variants
    if (!product.price || product.price <= 0) {
      blocked.push({ id: product.id, reason: "Price is zero" });
      continue;
    }
    if (!product.printful_catalog_id) {
      blocked.push({ id: product.id, reason: "No catalog mapping" });
      continue;
    }

    // Check design exists
    const { data: design } = await supabase
      .from("product_designs")
      .select("id")
      .eq("product_id", product.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (!design) {
      blocked.push({ id: product.id, reason: "No primary design" });
      continue;
    }

    // Check variants
    const { count: variantCount } = await supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id)
      .eq("available", true);

    if (!variantCount || variantCount === 0) {
      blocked.push({ id: product.id, reason: "No active variants" });
      continue;
    }

    // Publish
    await supabase
      .from("products")
      .update({ status: "active", published_at: now, updated_at: now })
      .eq("id", product.id);

    // Update batch item
    await supabase
      .from("catalog_batch_items")
      .update({ status: "published", updated_at: now })
      .eq("batch_id", batchId)
      .eq("generated_product_id", product.id);

    published.push(product.id);
  }

  // Update batch status if all generated products are published
  if (blocked.length === 0) {
    await supabase
      .from("catalog_batches")
      .update({ status: "completed", updated_at: now })
      .eq("id", batchId);
  } else {
    await supabase
      .from("catalog_batches")
      .update({ status: "review", updated_at: now })
      .eq("id", batchId);
  }

  return NextResponse.json({ published: published.length, blocked: blocked.length, blocked_items: blocked });
}
