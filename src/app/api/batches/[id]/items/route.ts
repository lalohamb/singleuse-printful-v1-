import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import {
  generateBatchMatrix,
  resolveBatchItem,
  detectSlugCollisions,
  buildDuplicateKey,
  type BatchDesign,
  type BatchRecipe,
} from "@/lib/catalog/batch-engine";
import { getCatalogVariants } from "@/lib/printful/catalog";
import { getLayoutTemplates, getPrintfiles } from "@/lib/printful/templates";
import { PrintfulApiError } from "@/lib/printful/errors";
import type { RecipeLayoutTemplate } from "@/lib/catalog/recipe-engine";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/batches/[id]/items
// Body: { designs: BatchDesign[], recipes: { recipe: Recipe }[], commercial_inputs_map }
// Server fetches Printful variants authoritatively — client availableVariants are ignored.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;

  let body: {
    designs: BatchDesign[];
    recipes: Array<{ recipe: { id: string; name: string; slug: string; status: string; printful_catalog_id: number; technique: string; placement: string; printfile_id: number | null; variant_rules: Record<string, unknown>; pricing_rules: Record<string, unknown>; mockup_rules: Record<string, unknown>; commercial_defaults: Record<string, unknown>; publication_default: string; metadata: Record<string, unknown>; created_at: string; updated_at: string; description: string | null; provider: string } }>;
    commercial_inputs_map: Record<string, {
      title: string;
      slug: string;
      description?: string;
      short_description?: string;
      brand?: string;
      product_type?: string;
      category_id?: string;
      meta_title?: string;
      meta_description?: string;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = sb();

  // Verify batch exists and is in a mutable state
  const { data: batch } = await supabase
    .from("catalog_batches")
    .select("id, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  if (!["draft", "planning", "validated"].includes(batch.status)) {
    return NextResponse.json({ error: `Batch in status '${batch.status}' cannot be re-planned` }, { status: 409 });
  }

  // Validate designs are active
  const designIds = body.designs.map((d) => d.id);
  const { data: dbDesigns } = await supabase
    .from("designs")
    .select("id, status, file_hash, artwork_url")
    .in("id", designIds);

  const designMap = new Map((dbDesigns ?? []).map((d) => [d.id, d]));
  for (const d of body.designs) {
    const db = designMap.get(d.id);
    if (!db) return NextResponse.json({ error: `Design ${d.id} not found` }, { status: 400 });
    if (db.status !== "active") return NextResponse.json({ error: `Design ${d.id} is not active` }, { status: 400 });
    d.file_hash = db.file_hash ?? d.file_hash;
  }

  // Validate recipes are active + fetch Printful variants SERVER-SIDE (authoritative)
  const recipeIds = body.recipes.map((r) => r.recipe.id);
  const { data: dbRecipes } = await supabase
    .from("product_recipes")
    .select("*")
    .in("id", recipeIds);

  const recipeMap = new Map((dbRecipes ?? []).map((r) => [r.id, r]));

  // Build BatchRecipe array with server-resolved variants
  const batchRecipes: BatchRecipe[] = [];
  for (const br of body.recipes) {
    const db = recipeMap.get(br.recipe.id);
    if (!db) return NextResponse.json({ error: `Recipe ${br.recipe.id} not found` }, { status: 400 });
    if (db.status !== "active") {
      return NextResponse.json({ error: `Recipe '${db.name}' is not active. Activate it before batch generation.` }, { status: 400 });
    }

    // Fetch variants from Printful server-side — client data is NOT used
    let availableVariants: BatchRecipe["availableVariants"] = [];
    try {
      const raw = await getCatalogVariants(db.printful_catalog_id);
      const rules = db.variant_rules as { colors?: string[]; sizes?: string[]; exclude_variant_ids?: number[] };
      const excludeIds = new Set(rules.exclude_variant_ids ?? []);

      availableVariants = raw
        .filter((v) => {
          if (excludeIds.has(v.id)) return false;
          if (rules.colors?.length && !rules.colors.includes(v.color ?? "")) return false;
          if (rules.sizes?.length && !rules.sizes.includes(v.size ?? "")) return false;
          return true;
        })
        .filter((v) => {
          // availability_status is array of region objects
          if (Array.isArray(v.availability_status)) {
            return v.availability_status.some((s) => s.status === "active");
          }
          return true;
        })
        .map((v) => ({
          id: v.id,
          name: v.name,
          color: v.color ?? "",
          size: v.size ?? "",
          price: String(v.price ?? "0"),
          availability_status: "active" as const,
        }));

      if (availableVariants.length === 0) {
        return NextResponse.json({
          error: `Recipe '${db.name}': no available variants match rules for catalog ${db.printful_catalog_id}`,
          code: "NO_AVAILABLE_VARIANTS",
        }, { status: 422 });
      }
    } catch (err) {
      if (err instanceof PrintfulApiError) {
        return NextResponse.json({
          error: `Provider resolution failed for recipe '${db.name}': ${err.clientMessage}`,
          code: "PROVIDER_RESOLUTION_FAILED",
        }, { status: 502 });
      }
      return NextResponse.json({
        error: `Provider resolution failed for recipe '${db.name}': ${err instanceof Error ? err.message : String(err)}`,
        code: "PROVIDER_RESOLUTION_FAILED",
      }, { status: 502 });
    }

    // Fetch layout template for auto-positioning (best-effort — does not block batch)
    let layoutTemplate: RecipeLayoutTemplate | undefined;
    try {
      const [templatesResp, printfilesResp] = await Promise.all([
        getLayoutTemplates(db.printful_catalog_id, { technique: db.technique }),
        getPrintfiles(db.printful_catalog_id, db.technique),
      ]);
      // Use first template matching the recipe placement
      const template = templatesResp.templates[0];
      if (template) {
        // Find canvas DPI from matching printfile
        const pf = printfilesResp.printfiles.find((p) => p.printfile_id === template.printfile_id);
        layoutTemplate = {
          print_area_width: template.print_area_width,
          print_area_height: template.print_area_height,
          canvas_dpi: pf?.dpi ?? 150,
        };
      }
    } catch {
      // Non-fatal — position will be MOCKUP_CONFIGURATION_INCOMPLETE if missing
    }

    batchRecipes.push({ recipe: db as BatchRecipe["recipe"], availableVariants, layoutTemplate });
  }

  // Generate matrix using server-resolved variants
  const matrixResult = generateBatchMatrix({ batchId, designs: body.designs, recipes: batchRecipes });

  // Resolve each included cell
  const resolutions = matrixResult.cells.map((cell) => {
    const cellKey = `${cell.design.id}:${cell.recipe.recipe.id}`;
    const commercialInputs = body.commercial_inputs_map[cellKey] ?? {
      title: `${cell.design.name} — ${cell.recipe.recipe.name}`,
      slug: `${cell.design.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${cell.recipe.recipe.slug}`,
    };
    return resolveBatchItem(cell, commercialInputs);
  });

  // Detect slug collisions
  const slugItems = resolutions
    .filter((r) => r.spec)
    .map((r) => ({ slug: r.spec!.slug, idempotency_key: r.cell.idempotency_key }));
  const collisions = detectSlugCollisions(slugItems);

  for (const resolution of resolutions) {
    if (resolution.spec && collisions.has(resolution.spec.slug)) {
      resolution.valid = false;
      resolution.validation_class = "FAIL";
      resolution.errors.push({ field: "slug", message: `Slug '${resolution.spec.slug}' collides with another item in this batch` });
      resolution.spec = null;
    }
  }

  const duplicateKeys = resolutions
    .filter((r) => r.spec)
    .map((r) => buildDuplicateKey({
      designId: r.cell.design.id,
      recipeId: r.cell.recipe.recipe.id,
      printfulCatalogId: r.spec!.printful_catalog_id,
      placement: r.spec!.placement,
      technique: r.spec!.technique,
    }));

  const slugsToCheck = resolutions.filter((r) => r.spec).map((r) => r.spec!.slug);
  let existingSlugs = new Set<string>();
  if (slugsToCheck.length) {
    const { data: existing } = await supabase
      .from("products")
      .select("slug")
      .in("slug", slugsToCheck);
    existingSlugs = new Set((existing ?? []).map((p) => p.slug));
  }

  for (const resolution of resolutions) {
    if (resolution.spec && existingSlugs.has(resolution.spec.slug)) {
      resolution.warnings.push(`Product with slug '${resolution.spec.slug}' already exists`);
      if (resolution.validation_class === "PASS") resolution.validation_class = "WARNING";
    }
  }

  await supabase.from("catalog_batch_items").delete().eq("batch_id", batchId);

  const now = new Date().toISOString();
  const itemRows = resolutions.map((r) => {
    const dbRecipe = recipeMap.get(r.cell.recipe.recipe.id);
    return {
      batch_id: batchId,
      design_id: r.cell.design.id,
      recipe_id: r.cell.recipe.recipe.id,
      recipe_version: dbRecipe?.updated_at ?? null,
      design_file_hash: r.cell.design.file_hash ?? null,
      design_artwork_url: r.cell.design.artwork_url,
      status: r.valid ? "resolved" : "fail",
      validation_class: r.validation_class,
      commercial_inputs: body.commercial_inputs_map[`${r.cell.design.id}:${r.cell.recipe.recipe.id}`] ?? {},
      resolved_specification: r.spec ?? null,
      validation_result: { errors: r.errors, warnings: r.warnings },
      dry_run_result: r.dry_run ?? null,
      idempotency_key: r.cell.idempotency_key,
      error_message: r.errors.length > 0 ? r.errors.map((e) => e.message).join("; ") : null,
      updated_at: now,
    };
  });

  const { error: insertError } = await supabase.from("catalog_batch_items").insert(itemRows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const hasAnyFail = resolutions.some((r) => r.validation_class === "FAIL");
  const newStatus = hasAnyFail ? "planning" : "validated";
  await supabase
    .from("catalog_batches")
    .update({ status: newStatus, updated_at: now })
    .eq("id", batchId);

  const summary = {
    total: resolutions.length,
    included: resolutions.filter((r) => r.cell.included).length,
    pass: resolutions.filter((r) => r.validation_class === "PASS").length,
    warning: resolutions.filter((r) => r.validation_class === "WARNING").length,
    fail: resolutions.filter((r) => r.validation_class === "FAIL").length,
    slug_collisions: collisions.size,
    duplicate_keys: duplicateKeys.length,
  };

  return NextResponse.json({ summary, batch_status: newStatus }, { status: 201 });
}

// GET /api/batches/[id]/items
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;

  const { data, error } = await sb()
    .from("catalog_batch_items")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
