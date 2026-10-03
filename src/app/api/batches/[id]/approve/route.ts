import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { validateProductSpecification } from "@/lib/catalog/product-engine";
import { detectStale } from "@/lib/catalog/batch-engine";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/batches/[id]/approve
// Validates all items server-side, freezes approved_at + specs.
// FAIL items are blocked. WARNING items require acknowledged=true.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;

  let body: { acknowledged_warnings?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  const supabase = sb();

  const { data: batch } = await supabase
    .from("catalog_batches")
    .select("id, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  if (!["validated", "planning", "ready"].includes(batch.status)) {
    return NextResponse.json({ error: `Batch status '${batch.status}' cannot be approved` }, { status: 409 });
  }

  const { data: items } = await supabase
    .from("catalog_batch_items")
    .select("*")
    .eq("batch_id", batchId);

  if (!items?.length) return NextResponse.json({ error: "No items in batch" }, { status: 400 });

  // Server-side: block FAIL items
  const failItems = items.filter((i) => i.validation_class === "FAIL");
  if (failItems.length > 0) {
    return NextResponse.json({
      error: `${failItems.length} item(s) have FAIL validation — resolve before approving`,
      fail_count: failItems.length,
    }, { status: 422 });
  }

  // Require acknowledgment for WARNING items
  const warnItems = items.filter((i) => i.validation_class === "WARNING");
  if (warnItems.length > 0 && !body.acknowledged_warnings) {
    return NextResponse.json({
      error: `${warnItems.length} item(s) have warnings — set acknowledged_warnings=true to proceed`,
      warning_count: warnItems.length,
      requires_acknowledgment: true,
    }, { status: 422 });
  }

  // Server-side: re-validate frozen specs + check for stale recipe/design
  const now = new Date().toISOString();
  const staleItems: string[] = [];
  const invalidItems: string[] = [];

  // Fetch current recipe versions and design hashes
  const recipeIds = [...new Set(items.map((i) => i.recipe_id))];
  const designIds = [...new Set(items.map((i) => i.design_id))];

  const [{ data: currentRecipes }, { data: currentDesigns }] = await Promise.all([
    supabase.from("product_recipes").select("id, updated_at, status").in("id", recipeIds),
    supabase.from("designs").select("id, file_hash, status").in("id", designIds),
  ]);

  const recipeMap = new Map((currentRecipes ?? []).map((r) => [r.id, r]));
  const designMap = new Map((currentDesigns ?? []).map((d) => [d.id, d]));

  for (const item of items) {
    // Stale check
    const currentRecipe = recipeMap.get(item.recipe_id);
    const currentDesign = designMap.get(item.design_id);

    const stale = detectStale({
      approvedRecipeVersion: item.recipe_version,
      currentRecipeUpdatedAt: currentRecipe?.updated_at ?? "",
      approvedDesignHash: item.design_file_hash,
      currentDesignHash: currentDesign?.file_hash ?? null,
    });

    if (stale) {
      staleItems.push(item.id);
      await supabase
        .from("catalog_batch_items")
        .update({ status: stale === "STALE_RECIPE" ? "stale_recipe" : "stale_design", updated_at: now })
        .eq("id", item.id);
      continue;
    }

    // Re-validate frozen spec server-side
    if (item.resolved_specification) {
      const validation = validateProductSpecification(item.resolved_specification);
      if (!validation.valid) {
        invalidItems.push(item.id);
        await supabase
          .from("catalog_batch_items")
          .update({ status: "fail", validation_class: "FAIL", error_message: validation.errors.map((e) => e.message).join("; "), updated_at: now })
          .eq("id", item.id);
        continue;
      }
    }

    // Mark approved
    await supabase
      .from("catalog_batch_items")
      .update({ status: "approved", updated_at: now })
      .eq("id", item.id);
  }

  if (staleItems.length > 0 || invalidItems.length > 0) {
    return NextResponse.json({
      error: `Approval blocked: ${staleItems.length} stale item(s), ${invalidItems.length} invalid item(s). Re-resolve before approving.`,
      stale_count: staleItems.length,
      invalid_count: invalidItems.length,
    }, { status: 422 });
  }

  // Update batch
  await supabase
    .from("catalog_batches")
    .update({ status: "ready", approved_at: now, updated_at: now })
    .eq("id", batchId);

  return NextResponse.json({
    approved: items.length,
    approved_at: now,
  });
}
