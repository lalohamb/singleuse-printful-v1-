import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/catalog/[id]
// Returns dependency summary for the delete confirmation dialog.
export async function GET(_req: Request, { params }: Params) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  const deps = await checkDependencies(id);
  if ("error" in deps) return NextResponse.json({ error: deps.error }, { status: deps.status });

  return NextResponse.json(deps);
}

// DELETE /api/admin/catalog/[id]
// Permanently deletes a catalog_builder product with zero order history.
// Blocked for: printful_sync products, products with order history.
// Deletes in FK-safe order:
//   mockup_tasks → product_images → product_designs → product_variants → products
// mockup_tasks must precede product_designs (mockup_tasks.product_design_id SET NULL is harmless
// but deleting tasks first is cleaner and avoids any ordering ambiguity).
// Does NOT delete shared designs, artwork, or Supabase Storage objects.
// No Stripe calls. No Printful calls.
export async function DELETE(_req: Request, { params }: Params) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const supabase = sb();

  const deps = await checkDependencies(id);
  if ("error" in deps) return NextResponse.json({ error: deps.error }, { status: deps.status });

  if (!deps.deletion_permitted) {
    return NextResponse.json(
      { error: deps.block_reason ?? "Deletion not permitted", deps },
      { status: 409 }
    );
  }

  // Delete in FK-safe order. All four child tables have ON DELETE RESTRICT on products(id).
  // mockup_tasks.product_design_id → product_designs(id) ON DELETE SET NULL — delete tasks first.
  // product_images.product_variant_id → product_variants(id) ON DELETE SET NULL — images before variants.

  // 1. mockup_tasks (RESTRICT on product_id; must precede product_designs and product row)
  const { error: mtErr } = await supabase
    .from("mockup_tasks")
    .delete()
    .eq("product_id", id);
  if (mtErr)
    return NextResponse.json({ error: `Failed to delete mockup tasks: ${mtErr.message}` }, { status: 500 });

  // 2. product_images (RESTRICT on product_id; must precede product_variants and product row)
  const { error: imgErr } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", id);
  if (imgErr)
    return NextResponse.json({ error: `Failed to delete product images: ${imgErr.message}` }, { status: 500 });

  // 3. product_designs (RESTRICT on product_id; does NOT delete the shared designs record)
  const { error: pdErr } = await supabase
    .from("product_designs")
    .delete()
    .eq("product_id", id);
  if (pdErr)
    return NextResponse.json({ error: `Failed to delete product designs: ${pdErr.message}` }, { status: 500 });

  // 4. product_variants (RESTRICT on product_id)
  const { error: pvErr } = await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", id);
  if (pvErr)
    return NextResponse.json({ error: `Failed to delete product variants: ${pvErr.message}` }, { status: 500 });

  // 5. product itself
  const { error: prodErr } = await supabase
    .from("products")
    .delete()
    .eq("id", id);
  if (prodErr)
    return NextResponse.json({ error: `Failed to delete product: ${prodErr.message}` }, { status: 500 });

  return NextResponse.json({ deleted: true, id });
}

// ── Dependency check ──────────────────────────────────────────────────────────
// Returns a structured summary of all dependencies.
// deletion_permitted = true only when:
//   - catalog_source = catalog_builder
//   - order_references = 0 (paid/fulfilled/shipped)
//   - all_order_references = 0 (any status)
// printful_sync products are always blocked.

type DepsResult =
  | {
      product_id: string;
      title: string;
      catalog_source: string | null;
      variant_count: number;
      image_count: number;
      design_count: number;
      mockup_task_count: number;
      order_references: number;
      all_order_references: number;
      deletion_permitted: boolean;
      block_reason: string | null;
    }
  | { error: string; status: number };

async function checkDependencies(id: string): Promise<DepsResult> {
  const supabase = sb();

  const { data: productRaw } = await supabase
    .from("products")
    .select("id, title, catalog_source")
    .eq("id", id)
    .maybeSingle();

  const product = productRaw as { id: string; title: string; catalog_source: string | null } | null;
  if (!product) return { error: "Product not found", status: 404 };

  const [variantRes, imageRes, designRes, mockupRes, allOrderRes] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id),
    supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id),
    supabase
      .from("product_designs")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id),
    supabase
      .from("mockup_tasks")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id),
    supabase
      .from("orders")
      .select("id, items, status"),
  ]);

  // Count orders that reference this product_id in items JSONB
  let paidRefs = 0;
  let allRefs = 0;
  for (const order of (allOrderRes.data as any[]) ?? []) {
    const items: { product_id?: string }[] = Array.isArray(order.items) ? order.items : [];
    const hasProduct = items.some((i) => i.product_id === id);
    if (!hasProduct) continue;
    allRefs++;
    if (["paid", "fulfilled", "shipped"].includes(order.status)) paidRefs++;
  }

  const isCatalogBuilder = product.catalog_source === "catalog_builder";
  const isPrintfulSync = product.catalog_source === "printful_sync";

  let block_reason: string | null = null;
  if (isPrintfulSync) {
    block_reason =
      "Legacy Printful Sync product — permanent removal requires separate legacy retirement action.";
  } else if (!isCatalogBuilder) {
    block_reason = "Only catalog_builder products can be permanently deleted via this action.";
  } else if (paidRefs > 0) {
    block_reason = `This product has ${paidRefs} paid/fulfilled order reference${paidRefs !== 1 ? "s" : ""}. Archive or deactivate instead.`;
  } else if (allRefs > 0) {
    block_reason = `This product has ${allRefs} order reference${allRefs !== 1 ? "s" : ""} (including pending). Archive or deactivate instead.`;
  }

  return {
    product_id: id,
    title: product.title,
    catalog_source: product.catalog_source,
    variant_count: variantRes.count ?? 0,
    image_count: imageRes.count ?? 0,
    design_count: designRes.count ?? 0,
    mockup_task_count: mockupRes.count ?? 0,
    order_references: paidRefs,
    all_order_references: allRefs,
    deletion_permitted: block_reason === null,
    block_reason,
  };
}
