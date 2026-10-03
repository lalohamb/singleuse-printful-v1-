import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { generateSlug } from "@/lib/catalog/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CatalogBuilderVariantInput {
  printful_variant_id: string; // Printful catalog variant ID
  label: string;
  color: string | null;
  size: string | null;
  retail_price: number;
  provider_cost: number | null;
  image_url: string | null;
}

export interface CatalogBuilderMockupInput {
  storage_path: string;
  image_url: string;
  mockup_task_key: string | null;
  is_primary: boolean;
  display_order: number;
  variant_ids?: number[];  // Printful catalog variant IDs this mockup covers
}

export interface CatalogBuilderCreateInput {
  // Provider identity
  printful_catalog_id: number;
  // Variants
  variants: CatalogBuilderVariantInput[];
  // Design
  design_id: string;
  placement: string;
  technique: string;
  printfile_id: string | null;
  design_configuration: Record<string, unknown>;
  // Commercial content
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  brand: string | null;
  product_type: string | null;
  category_id: string | null;
  meta_title: string | null;
  meta_description: string | null;
  // Pricing (base price = lowest variant retail_price)
  price: number;
  // Images (already persisted to Supabase Storage)
  mockups: CatalogBuilderMockupInput[];
  // Idempotency
  idempotency_key: string;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: CatalogBuilderCreateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Server-side validation ────────────────────────────────────────────────
  const {
    printful_catalog_id, variants, design_id, placement, technique,
    printfile_id, design_configuration, title, slug, description,
    short_description, brand, product_type, category_id,
    meta_title, meta_description, price, mockups, idempotency_key,
  } = body;

  if (!printful_catalog_id || typeof printful_catalog_id !== "number" || printful_catalog_id <= 0)
    return NextResponse.json({ error: "Invalid printful_catalog_id" }, { status: 400 });
  if (!Array.isArray(variants) || variants.length === 0)
    return NextResponse.json({ error: "At least one variant is required" }, { status: 400 });
  if (!design_id || typeof design_id !== "string")
    return NextResponse.json({ error: "design_id is required" }, { status: 400 });
  if (!placement || typeof placement !== "string")
    return NextResponse.json({ error: "placement is required" }, { status: 400 });
  if (!technique || typeof technique !== "string")
    return NextResponse.json({ error: "technique is required" }, { status: 400 });
  if (!title || typeof title !== "string" || title.trim() === "")
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!slug || typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json({ error: "slug must be lowercase alphanumeric with hyphens" }, { status: 400 });
  if (typeof price !== "number" || price <= 0)
    return NextResponse.json({ error: "price must be a positive number" }, { status: 400 });
  for (const v of variants) {
    if (!v.printful_variant_id || typeof v.retail_price !== "number" || v.retail_price <= 0)
      return NextResponse.json({ error: `Invalid variant: ${JSON.stringify(v)}` }, { status: 400 });
  }
  if (!idempotency_key || typeof idempotency_key !== "string")
    return NextResponse.json({ error: "idempotency_key is required" }, { status: 400 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Idempotency check ─────────────────────────────────────────────────────
  // If a product with this idempotency_key already exists, return it.
  // Stored in product metadata via a unique slug + catalog_source combination.
  // We use the slug as the idempotency anchor since it must be unique.
  const { data: existingProduct } = await sb
    .from("products")
    .select("id, slug, status")
    .eq("slug", slug)
    .eq("catalog_source", "catalog_builder")
    .maybeSingle();

  if (existingProduct) {
    return NextResponse.json({
      product_id: existingProduct.id,
      slug: existingProduct.slug,
      status: existingProduct.status,
      duplicate: true,
    });
  }

  // ── Validate design exists ────────────────────────────────────────────────
  const { data: design } = await sb
    .from("designs")
    .select("id, status, artwork_url")
    .eq("id", design_id)
    .maybeSingle();

  if (!design) return NextResponse.json({ error: "Design not found" }, { status: 400 });
  if (design.status !== "active")
    return NextResponse.json({ error: "Design is not active" }, { status: 400 });

  // ── Validate category if provided ─────────────────────────────────────────
  if (category_id) {
    const { data: cat } = await sb.from("categories").select("id").eq("id", category_id).maybeSingle();
    if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }

  // ── Atomic creation ───────────────────────────────────────────────────────
  // 1. Create product (draft, catalog_builder source, printful_id = NULL)
  const { data: product, error: productError } = await sb
    .from("products")
    .insert({
      title: title.trim(),
      slug,
      description: description || null,
      short_description: short_description || null,
      brand: brand || null,
      product_type: product_type || null,
      category_id: category_id || null,
      meta_title: meta_title || null,
      meta_description: meta_description || null,
      price,
      cost: 0,
      status: "draft",
      catalog_source: "catalog_builder",
      printful_id: null,           // NOT a sync product
      printful_catalog_id,         // Printful catalog product ID (e.g. 903)
      content_locked: true,        // catalog_builder products are always store-owned
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
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (productError || !product) {
    return NextResponse.json(
      { error: productError?.message || "Failed to create product" },
      { status: 500 }
    );
  }

  const productId = product.id;

  // 2. Create product_variants with new stable store UUIDs
  const variantRows = variants.map((v) => ({
    product_id: productId,
    provider: "printful",
    printful_variant_id: String(v.printful_variant_id),
    label: v.label,
    color: v.color || null,
    size: v.size || null,
    retail_price: v.retail_price,
    provider_cost: v.provider_cost || null,
    image_url: v.image_url || null,
    available: true,
    updated_at: new Date().toISOString(),
  }));

  const { error: variantError } = await sb.from("product_variants").insert(variantRows);
  if (variantError) {
    // Rollback: delete the product
    await sb.from("products").delete().eq("id", productId);
    return NextResponse.json(
      { error: `Failed to create variants: ${variantError.message}` },
      { status: 500 }
    );
  }

  // 3. Create product_design
  const { error: designError } = await sb.from("product_designs").insert({
    product_id: productId,
    design_id,
    provider: "printful",
    placement,
    technique,
    printfile_id: printfile_id ? String(printfile_id) : null,
    is_primary: true,
    needs_regeneration: false,
    configuration: {
      version: 1,
      catalog_product_id: printful_catalog_id, // kept for compatibility
      ...design_configuration,
    },
  });

  if (designError) {
    await sb.from("product_variants").delete().eq("product_id", productId);
    await sb.from("products").delete().eq("id", productId);
    return NextResponse.json(
      { error: `Failed to create product design: ${designError.message}` },
      { status: 500 }
    );
  }

  // 4. Create product_images for selected mockups and sync back to products.image_url
  if (mockups && mockups.length > 0) {
    const imageRows = mockups.map((m, i) => ({
      product_id: productId,
      source: "printful_mockup",
      storage_path: m.storage_path,
      image_url: m.image_url,
      is_primary: m.is_primary || i === 0,
      display_order: m.display_order ?? i,
      mockup_task_key: m.mockup_task_key || null,
      alt_text: title,
    }));

    const { error: imageError } = await sb.from("product_images").insert(imageRows);
    if (imageError) {
      console.error("[catalog-builder] product_images insert failed:", imageError.message);
    } else {
      // Sync primary mockup URL back to products.image_url and products.images
      const primaryMockup = mockups.find((m) => m.is_primary) ?? mockups[0];
      const allUrls = mockups.map((m) => m.image_url);
      await sb.from("products").update({
        image_url: primaryMockup.image_url,
        images: allUrls,
        updated_at: new Date().toISOString(),
      }).eq("id", productId);

      // Update product_variants.image_url with per-color mockup URLs.
      // Each mockup has variant_ids listing which Printful catalog variants it covers.
      // Match those to store variants by printful_variant_id and update image_url.
      for (const mockup of mockups) {
        if (!mockup.variant_ids?.length) continue;
        for (const pfVarId of mockup.variant_ids) {
          await sb.from("product_variants")
            .update({ image_url: mockup.image_url, updated_at: new Date().toISOString() })
            .eq("product_id", productId)
            .eq("printful_variant_id", String(pfVarId));
        }
      }
    }
  }

  return NextResponse.json({
    product_id: productId,
    slug,
    status: "draft",
    duplicate: false,
  });
}
