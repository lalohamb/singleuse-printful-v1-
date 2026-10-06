import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// GET /api/admin/catalog
// Returns all products with variant counts, image counts, design counts,
// and a has_order_history flag derived from orders.items JSONB.
// No PII exposed — only product-level metadata.
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = sb();

  // Load all products
  const { data: productsRaw, error: productsError } = await supabase
    .from("products")
    .select(
      "id, title, slug, status, catalog_source, printful_id, printful_catalog_id, " +
      "price, image_url, category_id, batch_id, recipe_id, created_at, updated_at, published_at"
    )
    .order("updated_at", { ascending: false });

  if (productsError)
    return NextResponse.json({ error: productsError.message }, { status: 500 });

  const products: any[] = productsRaw ?? [];

  if (products.length === 0)
    return NextResponse.json({ products: [] });

  const productIds: string[] = products.map((p: any) => p.id);

  // Variant counts per product
  const { data: variantRowsRaw } = await supabase
    .from("product_variants")
    .select("product_id, available")
    .in("product_id", productIds);

  const variantRows: any[] = variantRowsRaw ?? [];
  const variantCountMap = new Map<string, { total: number; active: number }>();
  for (const v of variantRows) {
    const cur = variantCountMap.get(v.product_id) ?? { total: 0, active: 0 };
    cur.total++;
    if (v.available) cur.active++;
    variantCountMap.set(v.product_id, cur);
  }

  // Image counts per product
  const { data: imageRowsRaw } = await supabase
    .from("product_images")
    .select("product_id")
    .in("product_id", productIds);

  const imageRows: any[] = imageRowsRaw ?? [];
  const imageCountMap = new Map<string, number>();
  for (const r of imageRows) {
    imageCountMap.set(r.product_id, (imageCountMap.get(r.product_id) ?? 0) + 1);
  }

  // Design counts per product
  const { data: designRowsRaw } = await supabase
    .from("product_designs")
    .select("product_id")
    .in("product_id", productIds);

  const designRows: any[] = designRowsRaw ?? [];
  const designCountMap = new Map<string, number>();
  for (const r of designRows) {
    designCountMap.set(r.product_id, (designCountMap.get(r.product_id) ?? 0) + 1);
  }

  // Order history: check orders.items JSONB for any product_id reference.
  const { data: orderRowsRaw } = await supabase
    .from("orders")
    .select("items, status")
    .in("status", ["paid", "fulfilled", "shipped"]);

  const orderRows: any[] = orderRowsRaw ?? [];
  const productsWithHistory = new Set<string>();
  for (const order of orderRows) {
    const items: { product_id?: string }[] = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (item.product_id && productIds.includes(item.product_id)) {
        productsWithHistory.add(item.product_id);
      }
    }
  }

  // Categories for display
  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id, name");

  const categories: any[] = categoriesRaw ?? [];
  const categoryMap = new Map<string, string>();
  for (const c of categories) categoryMap.set(c.id, c.name);

  const result = products.map((p: any) => ({
    ...p,
    category_name: p.category_id ? (categoryMap.get(p.category_id) ?? null) : null,
    variant_count: variantCountMap.get(p.id)?.total ?? 0,
    active_variant_count: variantCountMap.get(p.id)?.active ?? 0,
    image_count: imageCountMap.get(p.id) ?? 0,
    design_count: designCountMap.get(p.id) ?? 0,
    has_order_history: productsWithHistory.has(p.id),
  }));

  return NextResponse.json({ products: result });
}
