import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getCatalogProduct } from "@/lib/printful/catalog";
import { PrintfulApiError } from "@/lib/printful/errors";

// GET /api/catalog-builder/product-summary?id=<id>
// GET /api/catalog-builder/product-summary?ids=1,2,3   ← batch (max 20)
// Server-authoritative — never trusts client-supplied costs.
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
    const product = await getCatalogProduct(id);
    const variants = (product as unknown as {
      variants?: Array<{ id: number; price: string; in_stock: boolean; color: string; size: string }>;
    }).variants ?? [];

    const available = variants.filter((v) => v.in_stock);
    const costs = available.map((v) => parseFloat(v.price)).filter((c) => !isNaN(c) && c > 0);

    const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
    const sizes  = [...new Set(variants.map((v) => v.size).filter(Boolean))];

    return {
      id: product.id,
      title: product.title,
      brand: product.brand,
      image: product.image,
      techniques: product.techniques,
      total_variants: variants.length,
      available_variants: available.length,
      color_count: colors.length,
      size_count: sizes.length,
      min_cost: costs.length > 0 ? Math.min(...costs) : null,
      max_cost: costs.length > 0 ? Math.max(...costs) : null,
    };
  }

  try {
    if (ids.length === 1) {
      return NextResponse.json(await summarise(ids[0]));
    }
    // Batch: resolve concurrently, return map keyed by id
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
