import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { validateProductSpecification, type ProductSpecification } from "@/lib/catalog/product-engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>;

const sb = (): SB =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as SB;

// POST /api/batches/[id]/generate
// Generates draft products for all approved items.
// Idempotent: already-generated items are skipped.
// Partial failure: one item failing does not stop others.
// NEVER creates Stripe sessions, Printful orders, or fulfillment.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;

  let body: { retry_failed?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // optional
  }

  const supabase = sb();

  const { data: batch } = await supabase
    .from("catalog_batches")
    .select("id, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  if (!["ready", "generating", "failed"].includes(batch.status)) {
    return NextResponse.json({ error: `Batch status '${batch.status}' is not ready for generation` }, { status: 409 });
  }

  // Fetch items to generate
  const statusFilter = body.retry_failed
    ? ["approved", "fail"]
    : ["approved"];

  const { data: items } = await supabase
    .from("catalog_batch_items")
    .select("*")
    .eq("batch_id", batchId)
    .in("status", statusFilter);

  if (!items?.length) {
    return NextResponse.json({ message: "No items to generate", generated: 0, failed: 0 });
  }

  const now = new Date().toISOString();
  await supabase
    .from("catalog_batches")
    .update({ status: "generating", generation_started_at: now, updated_at: now })
    .eq("id", batchId);

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const failedItems: Array<{ id: string; error: string }> = [];

  // Sequential processing — bounded concurrency (1 at a time for safety)
  for (const item of items) {
    // Idempotency: skip if already generated
    if (item.generated_product_id) {
      skipped++;
      continue;
    }

    // Server-side: never trust client spec — use frozen DB spec
    const spec = item.resolved_specification as ProductSpecification | null;
    if (!spec) {
      const errMsg = "No resolved specification — item must be re-resolved";
      await supabase
        .from("catalog_batch_items")
        .update({ status: "fail", error_message: errMsg, updated_at: now })
        .eq("id", item.id);
      failed++;
      failedItems.push({ id: item.id, error: errMsg });
      continue;
    }

    // Re-validate frozen spec server-side
    const validation = validateProductSpecification(spec);
    if (!validation.valid) {
      const errMsg = validation.errors.map((e) => e.message).join("; ");
      await supabase
        .from("catalog_batch_items")
        .update({ status: "fail", error_message: errMsg, updated_at: now })
        .eq("id", item.id);
      failed++;
      failedItems.push({ id: item.id, error: errMsg });
      continue;
    }

    // Force draft — batch generation ALWAYS creates drafts
    const safeSpec: ProductSpecification = { ...spec, publication_mode: "draft" };

    try {
      const productId = await createProductFromSpec(supabase, safeSpec, item, batchId);

      await supabase
        .from("catalog_batch_items")
        .update({
          status: "generated",
          generated_product_id: productId,
          updated_at: now,
        })
        .eq("id", item.id);

      generated++;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Unknown generation error";
      await supabase
        .from("catalog_batch_items")
        .update({ status: "fail", error_message: errMsg, updated_at: now })
        .eq("id", item.id);
      failed++;
      failedItems.push({ id: item.id, error: errMsg });
      // Continue — partial failure does not stop the batch
    }
  }

  // Update batch status
  const finalStatus = failed > 0 && generated === 0 ? "failed" : "processing";
  await supabase
    .from("catalog_batches")
    .update({
      status: finalStatus,
      generation_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return NextResponse.json({ generated, skipped, failed, failed_items: failedItems });
}

// ── Product creation from frozen spec ────────────────────────────────────────
// Mirrors catalog-builder/route.ts but reads from frozen spec.
// NEVER creates Printful sync products. printful_id = NULL always.

async function createProductFromSpec(
  supabase: SB,
  spec: ProductSpecification,
  item: Record<string, unknown>,
  batchId: string
): Promise<string> {
  const now = new Date().toISOString();

  // Idempotency: check by idempotency_key stored in item
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("slug", spec.slug)
    .eq("catalog_source", "catalog_builder")
    .maybeSingle();

  if (existing) return existing.id;

  // Create product — DRAFT, catalog_builder, printful_id = NULL
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      title: spec.title.trim(),
      slug: spec.slug,
      description: spec.description ?? null,
      short_description: spec.short_description ?? null,
      brand: spec.brand ?? null,
      product_type: spec.product_type ?? null,
      category_id: spec.category_id ?? null,
      meta_title: spec.meta_title ?? null,
      meta_description: spec.meta_description ?? null,
      price: spec.price,
      cost: 0,
      status: "draft",                    // ALWAYS draft from batch
      catalog_source: "catalog_builder",
      printful_id: null,                  // NOT a sync product
      printful_catalog_id: spec.printful_catalog_id,
      content_locked: true,
      featured: false,
      is_new_arrival: false,
      is_trending: false,
      is_bestseller: false,
      is_on_sale: false,
      is_personalizable: false,
      display_order: 0,
      images: [],
      variants: [],
      shipping_info: {},
      recipe_id: item.recipe_id ?? null,
      recipe_version: item.recipe_version ?? null,
      batch_id: batchId,
      updated_at: now,
    })
    .select("id")
    .single();

  if (productError || !product) throw new Error(productError?.message ?? "Failed to create product");

  const productId = product.id;

  // Create variants
  const variantRows = spec.variants.map((v) => ({
    product_id: productId,
    provider: "printful",
    printful_variant_id: String(v.printful_variant_id),
    label: v.label,
    color: v.color ?? null,
    size: v.size ?? null,
    retail_price: v.retail_price,
    provider_cost: v.provider_cost ?? null,
    image_url: v.image_url ?? null,
    available: true,
    updated_at: now,
  }));

  const { error: variantError } = await supabase.from("product_variants").insert(variantRows);
  if (variantError) {
    await supabase.from("products").delete().eq("id", productId);
    throw new Error(`Failed to create variants: ${variantError.message}`);
  }

  // Create product_design
  const { error: designError } = await supabase.from("product_designs").insert({
    product_id: productId,
    design_id: spec.design_id,
    provider: "printful",
    placement: spec.placement,
    technique: spec.technique,
    printfile_id: spec.printfile_id ?? null,
    is_primary: true,
    needs_regeneration: false,
    configuration: {
      version: 1,
      catalog_product_id: spec.printful_catalog_id,
      ...spec.design_configuration,
    },
  });

  if (designError) {
    await supabase.from("product_variants").delete().eq("product_id", productId);
    await supabase.from("products").delete().eq("id", productId);
    throw new Error(`Failed to create product design: ${designError.message}`);
  }

  // Create mockup images if present in spec
  if (spec.mockups.length > 0) {
    const imageRows = spec.mockups.map((m, i) => ({
      product_id: productId,
      source: "printful_mockup",
      storage_path: m.storage_path,
      image_url: m.image_url,
      is_primary: m.is_primary || i === 0,
      display_order: m.display_order ?? i,
      mockup_task_key: m.mockup_task_key ?? null,
      alt_text: spec.title,
    }));
    await supabase.from("product_images").insert(imageRows);

    const primary = spec.mockups.find((m) => m.is_primary) ?? spec.mockups[0];
    await supabase
      .from("products")
      .update({ image_url: primary.image_url, images: spec.mockups.map((m) => m.image_url), updated_at: now })
      .eq("id", productId);
  }

  return productId;
}
