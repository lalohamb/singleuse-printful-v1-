import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getCatalogProduct, getCatalogVariants } from "@/lib/printful/catalog";
import { PrintfulApiError } from "@/lib/printful/errors";

// GET /api/catalog-builder/product-summary?id=<id>
// GET /api/catalog-builder/product-summary?ids=1,2,3   ← batch (max 20)
// Server-authoritative.
//
// V2 catalog-variant objects do NOT include price or in_stock.
// min_cost/max_cost are reported as null (unknown) — not fabricated.
// available_variants is reported as null when eligibility is not "eligible".
export async function GET(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const single = url.searchParams.get("id");
  const batch  = url.searchParams.get("ids");

  if (!single && !batch)
    return NextResponse.json({ error: "id or ids is required" }, { status: 400 });

  const ids: number[] = single
    ? [parseInt(single, 10)]
    : (batch ?? "").split(",").slice(0, 20).map((s) => parseInt(s.trim(), 10));

  if (ids.some((n) => isNaN(n) || n <= 0))
    return NextResponse.json({ error: "invalid id" }, { status: 400 });

  async function summarise(id: number) {
    // getCatalogProduct: V1 /products/{id} — flat product object
    // getCatalogVariants: V2 /v2/catalog-products/{id}/catalog-variants — never throws
    const [product, variantResult] = await Promise.all([
      getCatalogProduct(id),
      getCatalogVariants(id),
    ]);

    const eligible = variantResult.eligibility === "eligible";
    const variants = variantResult.variants;

    const colors = eligible ? [...new Set(variants.map((v) => v.color).filter(Boolean))] : [];
    const sizes  = eligible ? [...new Set(variants.map((v) => v.size).filter(Boolean))] : [];

    return {
      id: product.id,
      title: product.title,
      brand: product.brand,
      image: product.image,
      techniques: product.techniques,
      // Variant counts: null when not eligible (unavailable/error)
      total_variants: eligible ? variants.length : null,
      // available_variants: null — V2 does not provide in_stock per variant
      // Callers must not treat null as 0 (unavailable)
      available_variants: eligible ? variants.length : null,
      color_count: colors.length,
      size_count: sizes.length,
      // Commercial data not available from V2 catalog-variant endpoint
      min_cost: null,
      max_cost: null,
      // Eligibility
      eligibility: variantResult.eligibility,
      eligibility_reason: variantResult.reason ?? null,
    };
  }

  try {
    if (ids.length === 1) {
      return NextResponse.json(await summarise(ids[0]));
    }
    const results = await Promise.allSettled(ids.map(summarise));
    const out: Record<number, unknown> = {};
    for (let i = 0; i < ids.length; i++) {
      const r = results[i];
      out[ids[i]] = r.status === "fulfilled" ? r.value : { error: (r.reason as Error).message ?? "failed" };
    }
    return NextResponse.json(out);
  } catch (err) {
    if (err instanceof PrintfulApiError)
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    return NextResponse.json({ error: "Failed to load product summary" }, { status: 500 });
  }
}
