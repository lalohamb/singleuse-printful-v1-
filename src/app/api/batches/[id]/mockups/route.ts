import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { createMockupTask, getMockupTask } from "@/lib/printful/mockups";
import { persistGeneratedMockups } from "@/lib/printful/persist";
import { PrintfulApiError } from "@/lib/printful/errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = ReturnType<typeof createClient<any, any, any>>;

const sb = (): SB =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as SB;

// POST /api/batches/[id]/mockups
// Submits Printful mockup tasks for generated products in this batch.
// Sequential processing — no uncontrolled concurrent Printful traffic.
// Mockup failure does NOT delete the product.
// Body: { retry_failed?: boolean }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;

  let body: { retry_failed?: boolean } = {};
  try { body = await req.json(); } catch { /* optional */ }

  const supabase = sb();

  const { data: batch } = await supabase
    .from("catalog_batches")
    .select("id, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  // Fetch items that need mockup processing
  const statusFilter = body.retry_failed
    ? ["generated", "needs_mockup_retry"]
    : ["generated"];

  const { data: items } = await supabase
    .from("catalog_batch_items")
    .select("id, generated_product_id, resolved_specification, recipe_id")
    .eq("batch_id", batchId)
    .in("status", statusFilter);

  if (!items?.length) {
    return NextResponse.json({ message: "No items need mockup processing", queued: 0 });
  }

  const now = new Date().toISOString();
  let queued = 0;
  let completed = 0;
  let failed = 0;
  const failedItems: Array<{ id: string; error: string }> = [];

  // Sequential processing — bounded concurrency
  for (const item of items) {
    if (!item.generated_product_id || !item.resolved_specification) continue;

    const spec = item.resolved_specification as {
      printful_catalog_id: number;
      variants: Array<{ printful_variant_id: string }>;
      placement: string;
      technique: string;
      design_configuration: Record<string, unknown>;
    };

    const artworkUrl = (spec.design_configuration?.artworkUrl as string) ?? null;
    // Extract persisted position from frozen design_configuration
    // This is set by the Catalog Builder / Product Designer during product creation
    const position = spec.design_configuration?.position as {
      area_width: number; area_height: number;
      width: number; height: number;
      top: number; left: number;
    } | null ?? null;

    if (!artworkUrl) {
      await supabase.from("catalog_batch_items").update({
        status: "needs_mockup_retry",
        error_message: "No artwork URL in frozen spec",
        updated_at: now,
      }).eq("id", item.id);
      failed++;
      failedItems.push({ id: item.id, error: "No artwork URL in frozen spec" });
      continue;
    }

    // Require real position — do NOT silently use zero-position placeholder
    if (!position || (position.area_width === 0 && position.area_height === 0)) {
      await supabase.from("catalog_batch_items").update({
        status: "needs_mockup_retry",
        error_message: "MOCKUP_CONFIGURATION_INCOMPLETE: no valid position in frozen spec. Repair via Product Management.",
        updated_at: now,
      }).eq("id", item.id);
      failed++;
      failedItems.push({ id: item.id, error: "MOCKUP_CONFIGURATION_INCOMPLETE" });
      continue;
    }

    // Mark as queued
    await supabase.from("catalog_batch_items").update({
      status: "mockup_queued",
      updated_at: now,
    }).eq("id", item.id);
    queued++;

    try {
      // Submit mockup task to Printful
      const variantIds = spec.variants.map((v) => parseInt(v.printful_variant_id, 10)).filter((n) => !isNaN(n));

      await supabase.from("catalog_batch_items").update({
        status: "mockup_processing",
        updated_at: now,
      }).eq("id", item.id);

      const task = await createMockupTask(spec.printful_catalog_id, {
        variant_ids: variantIds,
        files: [{ placement: spec.placement, image_url: artworkUrl, position }],
        technique: spec.technique,
      });

      // Poll for completion (max 30 attempts × 3s = 90s)
      let finalTask = task;
      for (let attempt = 0; attempt < 30; attempt++) {
        if (finalTask.status === "completed") break;
        if (finalTask.status === "failed") throw new Error("Printful mockup task failed");
        await new Promise((r) => setTimeout(r, 3000));
        finalTask = await getMockupTask(task.task_key);
      }

      if (finalTask.status !== "completed" || !finalTask.mockups?.length) {
        throw new Error(`Mockup task did not complete (status: ${finalTask.status})`);
      }

      // Persist mockups to Supabase Storage
      const persisted = await persistGeneratedMockups(finalTask.mockups, task.task_key);

      // Create product_images records
      for (let i = 0; i < persisted.length; i++) {
        const m = persisted[i];
        const storagePath = m.stored_url.split("/store-images/")[1] ?? null;
        await supabase.from("product_images").upsert({
          product_id: item.generated_product_id,
          source: "printful_mockup",
          storage_path: storagePath,
          image_url: m.stored_url,
          alt_text: null,
          is_primary: i === 0,
          display_order: i,
          mockup_task_key: task.task_key,
        }, { onConflict: "uq_product_images_mockup_storage", ignoreDuplicates: true });
      }

      // Update product primary image
      if (persisted.length > 0) {
        await supabase.from("products").update({
          image_url: persisted[0].stored_url,
          images: persisted.map((m) => m.stored_url),
          updated_at: now,
        }).eq("id", item.generated_product_id);
      }

      // Mark complete
      await supabase.from("catalog_batch_items").update({
        status: "mockup_complete",
        updated_at: now,
      }).eq("id", item.id);

      completed++;
    } catch (err) {
      const errMsg = err instanceof PrintfulApiError
        ? err.clientMessage
        : err instanceof Error ? err.message : "Unknown mockup error";

      // Mockup failure does NOT delete the product
      await supabase.from("catalog_batch_items").update({
        status: "needs_mockup_retry",
        error_message: errMsg,
        updated_at: now,
      }).eq("id", item.id);

      failed++;
      failedItems.push({ id: item.id, error: errMsg });
    }
  }

  // Update batch status
  if (completed > 0 || failed > 0) {
    await supabase.from("catalog_batches").update({
      status: "review",
      updated_at: now,
    }).eq("id", batchId);
  }

  return NextResponse.json({ queued, completed, failed, failed_items: failedItems });
}
