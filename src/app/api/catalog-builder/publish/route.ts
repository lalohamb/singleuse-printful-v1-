import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { product_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { product_id } = body;
  if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load product with all required fields for publication validation
  const { data: product } = await sb
    .from("products")
    .select("id, title, slug, status, catalog_source, printful_catalog_id, price")
    .eq("id", product_id)
    .maybeSingle();

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (product.status === "active")
    return NextResponse.json({ error: "Product is already published" }, { status: 400 });

  // Publication validation
  const errors: string[] = [];
  if (!product.title?.trim()) errors.push("title is required");
  if (!product.slug?.trim()) errors.push("slug is required");
  if (!product.price || product.price <= 0) errors.push("valid retail price is required");
  if (!product.printful_catalog_id) errors.push("printful_catalog_id is required");

  // Require at least one available variant with provider mapping
  const { data: variants } = await sb
    .from("product_variants")
    .select("id, available, printful_variant_id")
    .eq("product_id", product_id)
    .eq("available", true);

  const sellableVariants = (variants ?? []).filter((v) => v.printful_variant_id);
  if (sellableVariants.length === 0)
    errors.push("at least one available variant with Printful mapping is required");

  // Require a design relationship
  const { data: designs } = await sb
    .from("product_designs")
    .select("id")
    .eq("product_id", product_id)
    .limit(1);

  if (!designs || designs.length === 0)
    errors.push("a product design is required");

  // Require at least one product image
  const { data: images } = await sb
    .from("product_images")
    .select("id")
    .eq("product_id", product_id)
    .limit(1);

  if (!images || images.length === 0)
    errors.push("at least one product image is required");

  if (errors.length > 0)
    return NextResponse.json({ error: "Publication validation failed", details: errors }, { status: 400 });

  // Publish
  const { error: updateError } = await sb
    .from("products")
    .update({
      status: "active",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", product_id);

  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ published: true, product_id, slug: product.slug });
}
