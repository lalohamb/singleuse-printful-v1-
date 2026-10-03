import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import type { CatalogBuilderCreateInput, CatalogBuilderMockupInput } from "@/app/api/catalog-builder/route";

// POST /api/catalog-builder/update
// Updates an existing catalog_builder product.
// Preserves: products.id, product_variants.id, all store UUIDs.
// Never touches: fulfillment_snapshot on any order.
// Only updates: commercial fields, design config, pricing, images.
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: CatalogBuilderCreateInput & { product_id: string; updated_at_check?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { product_id, updated_at_check } = body;
  if (!product_id)
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load existing product — verify it exists and is catalog_builder
  const { data: existing } = await sb
    .from("products")
    .select("id, catalog_source, updated_at, slug")
    .eq("id", product_id)
    .maybeSingle();

  if (!existing)
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (existing.catalog_source !== "catalog_builder")
    return NextResponse.json({ error: "Only catalog_builder products can be updated via this route" }, { status: 400 });

  // Optimistic concurrency check
  if (updated_at_check && existing.updated_at !== updated_at_check) {
    return NextResponse.json(
      { error: "This product changed after you opened it. Reload before saving.", conflict: true },
      { status: 409 }
    );
  }

  const {
    design_id, placement, technique, printfile_id, design_configuration,
    title, slug, description, short_description, brand, product_type,
    category_id, meta_title, meta_description, price, mockups,
    variants,
  } = body;

  // Slug uniqueness check (allow same slug for same product)
  if (slug && slug !== existing.slug) {
    const { data: slugConflict } = await sb
      .from("products")
      .select("id")
      .eq("slug", slug)
      .neq("id", product_id)
      .maybeSingle();
    if (slugConflict)
      return NextResponse.json({ error: `Slug "${slug}" is already in use` }, { status: 409 });
  }

  const now = new Date().toISOString();

  // 1. Update commercial fields (store-owned only — never provider identity)
  const { error: productError } = await sb.from("products").update({
    title: title?.trim(),
    slug,
    description: description || null,
    short_description: short_description || null,
    brand: brand || null,
    product_type: product_type || null,
    category_id: category_id || null,
    meta_title: meta_title || null,
    meta_description: meta_description || null,
    price,
    updated_at: now,
  }).eq("id", product_id);

  if (productError)
    return NextResponse.json({ error: productError.message }, { status: 500 });

  // 2. Variant add/remove with UUID preservation
  // - Existing retained variant: preserve store UUID, update retail_price
  // - New provider variant: create new store variant UUID
  // - Removed variant with historical use: deactivate (never delete)
  // - Removed unused variant: deactivate
  if (variants?.length) {
    const { data: existingVariants } = await sb
      .from("product_variants")
      .select("id, printful_variant_id, available")
      .eq("product_id", product_id);

    const existingMap = new Map(
      (existingVariants ?? []).map((v) => [String(v.printful_variant_id), v])
    );
    const incomingIds = new Set(variants.map((v) => String(v.printful_variant_id)));

    for (const v of variants) {
      const pfId = String(v.printful_variant_id);
      const existing = existingMap.get(pfId);
      if (existing) {
        // Retained: update price, ensure active
        await sb.from("product_variants")
          .update({ retail_price: v.retail_price, available: true, updated_at: now })
          .eq("id", existing.id);
      } else {
        // New variant: create with new store UUID
        await sb.from("product_variants").insert({
          product_id,
          provider: "printful",
          printful_variant_id: pfId,
          label: v.label ?? pfId,
          color: v.color ?? null,
          size: v.size ?? null,
          retail_price: v.retail_price,
          provider_cost: v.provider_cost ?? null,
          image_url: v.image_url ?? null,
          available: true,
          updated_at: now,
        });
      }
    }

    // Deactivate removed variants (prefer deactivation over deletion)
    for (const [pfId, existing] of existingMap) {
      if (!incomingIds.has(pfId)) {
        await sb.from("product_variants")
          .update({ available: false, updated_at: now })
          .eq("id", existing.id);
      }
    }
  }

  // 3. Update primary product_design configuration
  if (design_id || placement || technique || design_configuration) {
    const { data: pd } = await sb
      .from("product_designs")
      .select("id, configuration")
      .eq("product_id", product_id)
      .eq("is_primary", true)
      .maybeSingle();

    if (pd) {
      const patch: Record<string, unknown> = { updated_at: now };
      if (design_id) patch.design_id = design_id;
      if (placement) patch.placement = placement;
      if (technique) patch.technique = technique;
      if (printfile_id !== undefined) patch.printfile_id = printfile_id;
      if (design_configuration) {
        patch.configuration = {
          ...(pd.configuration as Record<string, unknown> ?? {}),
          ...design_configuration,
        };
      }
      await sb.from("product_designs").update(patch).eq("id", pd.id);
    }
  }

  // 4. Add new mockups if provided (do not delete existing — safe replacement)
  if (mockups?.length) {
    const imageRows = (mockups as CatalogBuilderMockupInput[]).map((m, i) => ({
      product_id,
      source: "printful_mockup",
      storage_path: m.storage_path,
      image_url: m.image_url,
      is_primary: m.is_primary || i === 0,
      display_order: m.display_order ?? i,
      mockup_task_key: m.mockup_task_key || null,
      alt_text: title,
    }));

    await sb.from("product_images").upsert(imageRows, {
      onConflict: "uq_product_images_mockup_storage",
      ignoreDuplicates: true,
    });

    // Sync primary image
    const primary = mockups.find((m) => m.is_primary) ?? mockups[0];
    if (primary) {
      await sb.from("products").update({
        image_url: primary.image_url,
        images: mockups.map((m) => m.image_url),
        updated_at: now,
      }).eq("id", product_id);
    }
  }

  return NextResponse.json({ ok: true, product_id, updated_at: now });
}
