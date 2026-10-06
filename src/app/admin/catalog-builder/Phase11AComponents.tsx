"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Package, Layers, AlertCircle } from "lucide-react";
import type { V2CatalogProduct, CatalogVariant } from "@/lib/printful/types";
import type { CreationMode, ProductSummary, VariantPricing } from "./types";

// ── Batch summary cache (module-level, lives for the page session) ────────────
// Prevents N+1: when MultiBlankSelector mounts, it fetches all IDs at once.
// Individual ProductCards read from this cache; no per-card fetch in multi mode.
const summaryCache = new Map<number, ProductSummary | null>();

export async function prefetchSummaries(ids: number[]): Promise<void> {
  const missing = ids.filter((id) => !summaryCache.has(id));
  if (missing.length === 0) return;
  try {
    const res = await fetch(`/api/catalog-builder/product-summary?ids=${missing.join(",")}`);
    const data = await res.json();
    for (const id of missing) {
      const entry = data[id];
      summaryCache.set(id, entry?.error ? null : (entry as ProductSummary));
    }
  } catch {
    for (const id of missing) summaryCache.set(id, null);
  }
}

// ── CreationModeSelector ──────────────────────────────────────────────────────

export function CreationModeSelector({ onSelect }: { onSelect: (mode: CreationMode) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">What would you like to create?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onSelect("single")}
          className="rounded-xl border-2 border-secondary-200 p-6 text-left hover:border-secondary-900 hover:shadow-sm transition-all group"
        >
          <Package size={28} className="text-secondary-400 group-hover:text-secondary-900 mb-3 transition-colors" />
          <p className="font-semibold text-secondary-900">Single Product</p>
          <p className="text-sm text-secondary-500 mt-1">Build one product with full control over variants, design, mockups, and pricing.</p>
        </button>
        <button
          onClick={() => onSelect("multi")}
          className="rounded-xl border-2 border-secondary-200 p-6 text-left hover:border-secondary-900 hover:shadow-sm transition-all group"
        >
          <Layers size={28} className="text-secondary-400 group-hover:text-secondary-900 mb-3 transition-colors" />
          <p className="font-semibold text-secondary-900">Multiple Products</p>
          <p className="text-sm text-secondary-500 mt-1">Select several blanks and apply the same design across all of them in one flow.</p>
        </button>
      </div>
    </div>
  );
}

// ── ProductCard with batch-cached cost summary ────────────────────────────────

export function ProductCard({
  product,
  selected,
  onSelect,
  prefetched,
}: {
  product: V2CatalogProduct;
  selected: boolean;
  onSelect: (p: V2CatalogProduct) => void;
  prefetched?: boolean; // true = read from cache, don't fire own fetch
}) {
  const [summary, setSummary] = useState<ProductSummary | null>(
    summaryCache.get(product.id) ?? null
  );

  useEffect(() => {
    if (prefetched) {
      // Cache was populated by prefetchSummaries — just read it
      setSummary(summaryCache.get(product.id) ?? null);
      return;
    }
    if (summaryCache.has(product.id)) {
      setSummary(summaryCache.get(product.id) ?? null);
      return;
    }
    // Single-product mode: fetch individually
    fetch(`/api/catalog-builder/product-summary?id=${product.id}`)
      .then((r) => r.json())
      .then((d) => {
        const s = d.error ? null : (d as ProductSummary);
        summaryCache.set(product.id, s);
        setSummary(s);
      })
      .catch(() => summaryCache.set(product.id, null));
  }, [product.id, prefetched]);

  return (
    <button
      onClick={() => onSelect(product)}
      className={`rounded-xl border-2 p-3 text-left transition-all group w-full ${
        selected
          ? "border-secondary-900 ring-2 ring-secondary-900 ring-offset-1"
          : "border-secondary-200 hover:border-secondary-400 hover:shadow-sm"
      }`}
    >
      <div className="aspect-square bg-secondary-50 rounded-lg overflow-hidden mb-2 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.title} className="w-full h-full object-contain p-1" />
        {selected && (
          <div className="absolute top-1 right-1 bg-secondary-900 rounded-full p-0.5">
            <Check size={10} className="text-white" />
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-secondary-900 line-clamp-2 leading-tight">{product.title}</p>
      {product.brand && <p className="text-[10px] text-secondary-400 mt-0.5">{product.brand}</p>}
      {summary ? (
        <div className="mt-1 space-y-0.5">
          <p className="text-[10px] text-secondary-500">
            {summary.color_count} colors · {summary.size_count} sizes
          </p>
          {summary.min_cost !== null && (
            <p className="text-[10px] font-medium text-secondary-700">
              From ${summary.min_cost.toFixed(2)}
              {summary.max_cost !== null && summary.max_cost !== summary.min_cost
                ? `–$${summary.max_cost.toFixed(2)}`
                : ""}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-secondary-400 mt-0.5">{product.variant_count} variants</p>
      )}
    </button>
  );
}

// ── VariantMatrix: color × size grid, color-only, size-only, flat ────────────
// Issue A fix: hats have color but one shared size — previously rendered as a
// confusing single-column matrix. Now detects dimension shape and renders the
// appropriate selector. Also fixes empty-string color (falsy) on some products.

function variantLabel(v: CatalogVariant): string {
  const parts = [v.color, v.size].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : v.name;
}

export function VariantMatrix({
  catalogProductId,
  selected,
  onChange,
}: {
  catalogProductId: number;
  selected: CatalogVariant[];
  onChange: (v: CatalogVariant[]) => void;
}) {
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<"eligible" | "unavailable" | "error" | null>(null);
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/printful/products/${catalogProductId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const vs: CatalogVariant[] = d.result?.variants ?? [];
        setVariants(vs);
        setEligibility(d.result?.eligibility ?? null);
        setEligibilityReason(d.result?.eligibility_reason ?? null);
        if (vs.length === 1) onChange([vs[0]]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogProductId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-secondary-300" /></div>;
  if (error) return <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>;

  if (eligibility === "unavailable") {
    return (
      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <AlertCircle size={15} className="text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800">Not available in your region</p>
          {eligibilityReason && <p className="text-xs text-yellow-700 mt-0.5">{eligibilityReason}</p>}
        </div>
      </div>
    );
  }

  if (eligibility === "error") {
    return (
      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
        <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-700">Could not load variants</p>
          {eligibilityReason && <p className="text-xs text-red-600 mt-0.5">{eligibilityReason}</p>}
        </div>
      </div>
    );
  }

  const selectedIds = new Set(selected.map((v) => v.id));

  const toggle = (v: CatalogVariant) => {
    if (selectedIds.has(v.id)) onChange(selected.filter((s) => s.id !== v.id));
    else onChange([...selected, v]);
  };

  const distinctColors = [...new Set(variants.map((v) => v.color?.trim()).filter(Boolean))];
  const distinctSizes  = [...new Set(variants.map((v) => v.size?.trim()).filter(Boolean))];
  const hasMultipleColors = distinctColors.length > 1;
  const hasMultipleSizes  = distinctSizes.length > 1;
  const isFullMatrix = hasMultipleColors && hasMultipleSizes;
  const isColorOnly  = hasMultipleColors && !hasMultipleSizes;
  const isSizeOnly   = !hasMultipleColors && hasMultipleSizes;

  // ── Single variant: auto-selected ────────────────────────────────────────
  if (variants.length === 1) {
    const v = variants[0];
    return (
      <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
        <div className="w-5 h-5 rounded-full border-2 border-secondary-900 bg-secondary-900 flex items-center justify-center flex-shrink-0">
          <Check size={11} className="text-white" />
        </div>
        <p className="text-sm font-medium text-secondary-900">{variantLabel(v)} — auto-selected</p>
      </div>
    );
  }

  const btnClass = (isSel: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
      isSel ? "border-secondary-900 bg-secondary-900 text-white" : "border-secondary-200 text-secondary-700 hover:border-secondary-400"
    }`;

  // ── Color-only (hats) ─────────────────────────────────────────────────────
  if (isColorOnly) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => onChange([...variants])} className="text-xs text-primary-600 underline">Select all ({variants.length})</button>
          <button onClick={() => onChange([])} className="text-xs text-secondary-400 underline">Clear</button>
          <span className="text-xs text-secondary-500 ml-auto">{selected.length} selected</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <button key={v.id} onClick={() => toggle(v)} className={btnClass(selectedIds.has(v.id))}>
              {selectedIds.has(v.id) && <Check size={11} />}
              {v.color?.trim() || v.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Size-only ─────────────────────────────────────────────────────────────
  if (isSizeOnly) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => onChange([...variants])} className="text-xs text-primary-600 underline">Select all ({variants.length})</button>
          <button onClick={() => onChange([])} className="text-xs text-secondary-400 underline">Clear</button>
          <span className="text-xs text-secondary-500 ml-auto">{selected.length} selected</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <button key={v.id} onClick={() => toggle(v)} className={btnClass(selectedIds.has(v.id))}>
              {selectedIds.has(v.id) && <Check size={11} />}
              {v.size}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Full color × size matrix ──────────────────────────────────────────────
  if (isFullMatrix) {
    const colors = distinctColors;
    const sizes  = distinctSizes;
    const matrix = new Map<string, CatalogVariant>();
    for (const v of variants) {
      matrix.set(`${v.color?.trim() || "Default"}|${v.size?.trim() || "One Size"}`, v);
    }

    const toggleColor = (color: string) => {
      const cv = variants.filter((v) => (v.color?.trim() || "Default") === color);
      const allSel = cv.every((v) => selectedIds.has(v.id));
      if (allSel) onChange(selected.filter((s) => (s.color?.trim() || "Default") !== color));
      else onChange([...selected, ...cv.filter((v) => !selectedIds.has(v.id))]);
    };

    const toggleSize = (size: string) => {
      const sv = variants.filter((v) => (v.size?.trim() || "One Size") === size);
      const allSel = sv.every((v) => selectedIds.has(v.id));
      if (allSel) onChange(selected.filter((s) => (s.size?.trim() || "One Size") !== size));
      else onChange([...selected, ...sv.filter((v) => !selectedIds.has(v.id))]);
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => onChange([...variants])} className="text-xs text-primary-600 underline">Select all ({variants.length})</button>
          <button onClick={() => onChange([])} className="text-xs text-secondary-400 underline">Clear</button>
          <span className="text-xs text-secondary-500 ml-auto">{selected.length} selected</span>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr>
                <th className="text-left p-1.5 text-secondary-500 font-medium w-28">Color</th>
                {sizes.map((s) => {
                  const sv = variants.filter((v) => (v.size?.trim() || "One Size") === s);
                  const allSel = sv.length > 0 && sv.every((v) => selectedIds.has(v.id));
                  return (
                    <th key={s} className="p-1.5 text-center min-w-[48px]">
                      <button onClick={() => toggleSize(s)}
                        className={`text-[10px] font-semibold transition-colors ${allSel ? "text-secondary-900" : "text-secondary-400 hover:text-secondary-700"}`}>
                        {s}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => {
                const cv = variants.filter((v) => (v.color?.trim() || "Default") === color);
                const allSel = cv.length > 0 && cv.every((v) => selectedIds.has(v.id));
                const someSel = cv.some((v) => selectedIds.has(v.id));
                return (
                  <tr key={color} className="border-t border-secondary-100">
                    <td className="p-1.5">
                      <button onClick={() => toggleColor(color)}
                        className={`text-left font-medium transition-colors ${
                          allSel ? "text-secondary-900" : someSel ? "text-secondary-600" : "text-secondary-400"
                        }`}>
                        {color}
                      </button>
                    </td>
                    {sizes.map((size) => {
                      const v = matrix.get(`${color}|${size}`);
                      if (!v) return <td key={size} className="p-1.5 text-center text-secondary-200 text-[10px]">—</td>;
                      const isSel = selectedIds.has(v.id);
                      return (
                        <td key={size} className="p-1.5 text-center">
                          <button onClick={() => toggle(v)}
                            className={`w-9 h-7 rounded border text-[10px] font-medium transition-all ${
                              isSel ? "border-secondary-900 bg-secondary-900 text-white" : "border-secondary-200 text-secondary-600 hover:border-secondary-500"
                            }`}>
                            {isSel ? <Check size={10} className="mx-auto" /> : "✓"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Flat fallback ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => onChange([...variants])} className="text-xs text-primary-600 underline">Select all ({variants.length})</button>
        <button onClick={() => onChange([])} className="text-xs text-secondary-400 underline">Clear</button>
        <span className="text-xs text-secondary-500 ml-auto">{selected.length} selected</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => (
          <button key={v.id} onClick={() => toggle(v)} className={btnClass(selectedIds.has(v.id))}>
            {selectedIds.has(v.id) && <Check size={11} />}
            {variantLabel(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── PricingPreview: full cost/retail/profit/margin breakdown ─────────────────

export function PricingPreview({ variantPricing }: { variantPricing: VariantPricing[] }) {
  const priced = variantPricing.filter(
    (v): v is VariantPricing & { provider_cost: number } =>
      v.retail_price > 0 && v.provider_cost != null && v.provider_cost > 0
  );
  if (priced.length === 0) return null;

  const minCost   = Math.min(...priced.map((v) => v.provider_cost));
  const maxCost   = Math.max(...priced.map((v) => v.provider_cost));
  const minRetail = Math.min(...priced.map((v) => v.retail_price));
  const maxRetail = Math.max(...priced.map((v) => v.retail_price));
  const minProfit = Math.min(...priced.map((v) => v.retail_price - v.provider_cost));
  const maxProfit = Math.max(...priced.map((v) => v.retail_price - v.provider_cost));
  const margins   = priced.map((v) => ((v.retail_price - v.provider_cost) / v.retail_price) * 100);
  const minMargin = Math.min(...margins);
  const maxMargin = Math.max(...margins);

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const pct = (n: number) => `${n.toFixed(0)}%`;
  const rng = (a: number, b: number, fn: (n: number) => string) =>
    Math.abs(a - b) < 0.005 ? fn(a) : `${fn(a)}–${fn(b)}`;

  const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
  const marginColor = avgMargin >= 40 ? "text-green-700" : avgMargin >= 25 ? "text-yellow-700" : "text-red-700";

  return (
    <div className="bg-secondary-50 rounded-xl p-4 space-y-2 text-xs">
      <p className="text-[10px] font-semibold text-secondary-500 uppercase tracking-wide mb-2">Pricing Summary</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        <span className="text-secondary-500">Provider cost</span>
        <span className="font-medium text-secondary-900 text-right">{rng(minCost, maxCost, fmt)}</span>
        <span className="text-secondary-500">Retail price</span>
        <span className="font-medium text-secondary-900 text-right">{rng(minRetail, maxRetail, fmt)}</span>
        <span className="text-secondary-500">Gross profit</span>
        <span className="font-medium text-secondary-900 text-right">{rng(minProfit, maxProfit, fmt)}</span>
        <span className="text-secondary-500">Gross margin</span>
        <span className={`font-semibold text-right ${marginColor}`}>{rng(minMargin, maxMargin, pct)}</span>
      </div>
      <p className="text-[9px] text-secondary-400 pt-1">Gross margin = (retail − provider cost) / retail. Does not include shipping, platform fees, or taxes.</p>
    </div>
  );
}

// ── BuildSummary: sticky sidebar — single and multi mode ─────────────────────

export function BuildSummary({
  mode,
  product,
  multiProducts,
  variantCount,
  designName,
  technique,
  placement,
  variantPricing,
  dpiResult,
}: {
  mode: "single" | "multi" | null;
  product: V2CatalogProduct | null;
  multiProducts?: V2CatalogProduct[];
  variantCount: number;
  designName: string | null;
  technique: string | null;
  placement: string | null;
  variantPricing: VariantPricing[];
  dpiResult?: string | null;
}) {
  const priced = variantPricing.filter(
    (v): v is VariantPricing & { provider_cost: number } =>
      v.retail_price > 0 && v.provider_cost != null && v.provider_cost > 0
  );
  const minRetail = priced.length ? Math.min(...priced.map((v) => v.retail_price)) : null;
  const maxRetail = priced.length ? Math.max(...priced.map((v) => v.retail_price)) : null;
  const minCost   = priced.length ? Math.min(...priced.map((v) => v.provider_cost)) : null;
  const maxCost   = priced.length ? Math.max(...priced.map((v) => v.provider_cost)) : null;
  const margins   = priced.map((v) => ((v.retail_price - v.provider_cost) / v.retail_price) * 100);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const rng = (a: number | null, b: number | null) =>
    a === null ? "—" : b !== null && Math.abs(a - b) > 0.005 ? `${fmt(a)}–${fmt(b)}` : fmt(a!);

  // Multi mode: show per-product list
  if (mode === "multi" && multiProducts && multiProducts.length > 0) {
    return (
      <div className="sticky top-4 bg-white border border-secondary-200 rounded-xl p-4 space-y-3 shadow-sm">
        <p className="text-[10px] font-semibold text-secondary-500 uppercase tracking-wide">
          {multiProducts.length} Product{multiProducts.length !== 1 ? "s" : ""} Selected
        </p>
        <div className="space-y-3">
          {multiProducts.map((p) => {
            const s = summaryCache.get(p.id);
            return (
              <div key={p.id} className="flex items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.title} className="w-8 h-8 object-contain rounded border border-secondary-100 bg-secondary-50 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-secondary-900 line-clamp-1">{p.title}</p>
                  {s ? (
                    <p className="text-[10px] text-secondary-500">
                      {s.available_variants} variants
                      {s.min_cost !== null ? ` · From ${fmt(s.min_cost)}` : ""}
                    </p>
                  ) : (
                    <p className="text-[10px] text-secondary-400">{p.variant_count} variants</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {designName && (
          <div className="border-t border-secondary-100 pt-2 text-xs">
            <div className="flex justify-between">
              <span className="text-secondary-500">Design</span>
              <span className="font-medium truncate max-w-[120px]">{designName}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!product) return null;

  // Single mode
  return (
    <div className="sticky top-4 bg-white border border-secondary-200 rounded-xl p-4 space-y-3 text-sm shadow-sm">
      <p className="text-[10px] font-semibold text-secondary-500 uppercase tracking-wide">Build Summary</p>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.title} className="w-12 h-12 object-contain rounded-lg border border-secondary-100 bg-secondary-50 p-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-secondary-900 line-clamp-2 text-xs leading-snug">{product.title}</p>
          {product.brand && <p className="text-[10px] text-secondary-400">{product.brand}</p>}
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-secondary-500">Variants</span>
          <span className="font-medium">{variantCount > 0 ? variantCount : "—"}</span>
        </div>
        {technique && (
          <div className="flex justify-between">
            <span className="text-secondary-500">Technique</span>
            <span className="font-medium">{technique}</span>
          </div>
        )}
        {placement && (
          <div className="flex justify-between">
            <span className="text-secondary-500">Placement</span>
            <span className="font-medium">{placement}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-secondary-500">Design</span>
          <span className="font-medium truncate max-w-[110px]">{designName || "—"}</span>
        </div>
        {minCost !== null && (
          <div className="flex justify-between">
            <span className="text-secondary-500">Cost</span>
            <span className="font-medium">{rng(minCost, maxCost)}</span>
          </div>
        )}
        {minRetail !== null && (
          <div className="flex justify-between">
            <span className="text-secondary-500">Retail</span>
            <span className="font-medium text-secondary-900">{rng(minRetail, maxRetail)}</span>
          </div>
        )}
        {avgMargin !== null && (
          <div className="flex justify-between">
            <span className="text-secondary-500">Margin</span>
            <span className={`font-semibold ${avgMargin >= 40 ? "text-green-700" : avgMargin >= 25 ? "text-yellow-700" : "text-red-700"}`}>
              {avgMargin.toFixed(0)}%
            </span>
          </div>
        )}
        {dpiResult && (
          <div className="flex justify-between">
            <span className="text-secondary-500">DPI check</span>
            <span className={`font-medium text-[10px] ${
              dpiResult === "PASS" ? "text-green-700" :
              dpiResult === "PASS_WARNING" ? "text-yellow-700" : "text-red-700"
            }`}>{dpiResult}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MultiDryRunPanel: review matrix for multi-product dry-run ─────────────────
// Calls /api/catalog-builder/dry-run per product independently.
// A FAIL on one product does not affect others.
// NO database writes. NO mockup generation. NO Printful orders.

export interface MultiDryRunEntry {
  product: V2CatalogProduct;
  variantCount: number;
  minCost: number | null;
  maxCost: number | null;
  minRetail: number | null;
  maxRetail: number | null;
  dpiResult: string | null;
  dryRunResult: "pending" | "running" | "PASS" | "WARNING" | "FAIL";
  errors: string[];
}

// Derive a suggested action from the error message
function suggestAction(error: string): { label: string; hint: string } {
  const e = error.toLowerCase();
  if (e.includes("placement") || e.includes("technique"))
    return { label: "Fix Production", hint: "Go back to Production Settings and choose a valid placement/technique." };
  if (e.includes("variant") || e.includes("no variant"))
    return { label: "Fix Variants", hint: "Go back to Variant Selection and choose available variants." };
  if (e.includes("design") || e.includes("artwork"))
    return { label: "Fix Artwork", hint: "The design may be inactive or missing. Check your Design Library." };
  if (e.includes("slug"))
    return { label: "Fix Details", hint: "The product slug is already in use or invalid." };
  return { label: "Review Error", hint: error };
}

export function MultiDryRunPanel({
  entries,
  onRunAll,
  onRemove,
  running,
}: {
  entries: MultiDryRunEntry[];
  onRunAll: () => void;
  onRemove: (productId: number) => void;
  running: boolean;
}) {
  if (entries.length === 0) return null;

  const fmt = (n: number | null) => (n !== null ? `$${n.toFixed(2)}` : "—");
  const rng = (a: number | null, b: number | null) =>
    a === null ? "—" : b !== null && Math.abs(a - b) > 0.005 ? `${fmt(a)}–${fmt(b)}` : fmt(a);

  const resultBadge = (r: MultiDryRunEntry["dryRunResult"]) => {
    if (r === "PASS") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">PASS</span>;
    if (r === "WARNING") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-semibold">WARNING</span>;
    if (r === "FAIL") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">FAIL</span>;
    if (r === "running") return <Loader2 size={12} className="animate-spin text-secondary-400" />;
    return <span className="text-secondary-300 text-[10px]">—</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Review — {entries.length} Product{entries.length !== 1 ? "s" : ""}</h2>
        <button
          onClick={onRunAll}
          disabled={running}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
        >
          {running && <Loader2 size={14} className="animate-spin" />}
          {running ? "Validating…" : "Run Validation"}
        </button>
      </div>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.product.id} className={`rounded-xl border p-3 ${
            e.dryRunResult === "FAIL" ? "border-red-200 bg-red-50" :
            e.dryRunResult === "WARNING" ? "border-yellow-200 bg-yellow-50" :
            e.dryRunResult === "PASS" ? "border-green-200 bg-green-50" :
            "border-secondary-200 bg-white"
          }`}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.product.image} alt={e.product.title} className="w-9 h-9 object-contain rounded border border-secondary-100 bg-white flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-900 line-clamp-1">{e.product.title}</p>
                <p className="text-[10px] text-secondary-500">
                  {e.variantCount > 0 ? `${e.variantCount} variants` : ""}
                  {e.minCost !== null ? ` · Cost ${rng(e.minCost, e.maxCost)}` : ""}
                  {e.minRetail !== null ? ` · Retail ${rng(e.minRetail, e.maxRetail)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {resultBadge(e.dryRunResult)}
                <button
                  onClick={() => onRemove(e.product.id)}
                  disabled={running}
                  className="text-[10px] text-secondary-400 hover:text-red-600 underline disabled:opacity-40 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* Error details + actionable suggestions */}
            {e.dryRunResult === "FAIL" && e.errors.length > 0 && (
              <div className="mt-2 space-y-2 pl-12">
                {e.errors.map((err, i) => {
                  const action = suggestAction(err);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle size={11} className="mt-0.5 flex-shrink-0 text-red-500" />
                        <p className="text-xs text-red-700">{err}</p>
                      </div>
                      <p className="text-[10px] text-red-600 pl-4">→ {action.hint}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-secondary-400">
        Validation only — no products created, no mockups generated, no Printful orders.
      </p>
    </div>
  );
}

// ── StickyWizardNav: persistent bottom navigation bar (Issue B) ───────────────
// Stays visible regardless of content length. Shows step progress, back/continue.
// Continue is disabled with an explanation when validation is not met.

export function StickyWizardNav({
  stepLabel,
  stepIndex,
  totalSteps,
  onBack,
  onContinue,
  continueLabel,
  continueDisabled,
  continueDisabledReason,
  statusText,
  loading,
}: {
  stepLabel: string;
  stepIndex: number;
  totalSteps: number;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueDisabledReason?: string;
  statusText?: string;
  loading?: boolean;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-secondary-200 shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Back */}
        {onBack ? (
          <button onClick={onBack} className="text-sm text-secondary-500 hover:text-secondary-900 transition-colors flex-shrink-0">
            ← Back
          </button>
        ) : (
          <div className="w-12 flex-shrink-0" />
        )}

        {/* Centre: step info + status */}
        <div className="flex-1 min-w-0 text-center">
          <p className="text-xs text-secondary-500">
            Step {stepIndex + 1} of {totalSteps} — <span className="font-medium text-secondary-700">{stepLabel}</span>
          </p>
          {statusText && (
            <p className="text-xs text-secondary-600 mt-0.5 truncate">{statusText}</p>
          )}
          {continueDisabled && continueDisabledReason && (
            <p className="text-[10px] text-secondary-400 mt-0.5">{continueDisabledReason}</p>
          )}
        </div>

        {/* Continue */}
        {onContinue ? (
          <button
            onClick={onContinue}
            disabled={continueDisabled || loading}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2 flex-shrink-0"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {continueLabel ?? "Continue →"}
          </button>
        ) : (
          <div className="w-24 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

// ── BuilderStepSidebar — desktop left-side vertical step navigation ───────────
// Phase 11A.2: replaces the horizontal stepper.
// Renders the correct stage list for single, multi, and edit modes.
// Stage states: complete | current | available | future | needs-attention

export type StageStatus = "complete" | "current" | "available" | "future" | "needs-attention";

export interface SidebarStep {
  stage: string;
  label: string;
  status: StageStatus;
  onClick?: () => void;
}

export function BuilderStepSidebar({ steps }: { steps: SidebarStep[] }) {
  return (
    <nav
      aria-label="Builder steps"
      className="hidden lg:flex flex-col w-44 flex-shrink-0 pl-4 pt-6 sticky top-0 self-start h-screen overflow-y-auto"
    >
      <p className="text-[10px] font-semibold text-secondary-400 uppercase tracking-widest mb-3 px-2">
        Build Product
      </p>
      <ol className="space-y-0.5">
        {steps.map((step) => {
          const isCurrent = step.status === "current";
          const isClickable = (step.status === "complete" || step.status === "available") && !!step.onClick;
          const isNeedsAttention = step.status === "needs-attention";

          return (
            <li key={step.stage}>
              <button
                onClick={isClickable ? step.onClick : undefined}
                disabled={!isClickable}
                aria-current={isCurrent ? "step" : undefined}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                  isCurrent
                    ? "bg-secondary-900 text-white font-semibold"
                    : isNeedsAttention
                    ? "text-yellow-700 hover:bg-yellow-50 cursor-pointer"
                    : step.status === "complete"
                    ? "text-secondary-600 hover:bg-secondary-100 cursor-pointer"
                    : step.status === "available"
                    ? "text-secondary-500 hover:bg-secondary-100 cursor-pointer"
                    : "text-secondary-300 cursor-default"
                }`}
              >
                {/* Status icon */}
                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isCurrent
                    ? "bg-white text-secondary-900"
                    : step.status === "complete"
                    ? "bg-green-100 text-green-700"
                    : isNeedsAttention
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-secondary-100 text-secondary-400"
                }`}>
                  {step.status === "complete" ? (
                    <Check size={8} />
                  ) : isNeedsAttention ? (
                    "!"
                  ) : (
                    <span className="leading-none">●</span>
                  )}
                </span>
                <span className="truncate">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── MobileStepHeader — compact step indicator for narrow viewports ────────────
// Shows current step + "View Steps" toggle. Replaces horizontal stepper on mobile.

export function MobileStepHeader({
  steps,
  currentLabel,
  stepIndex,
  totalSteps,
}: {
  steps: SidebarStep[];
  currentLabel: string;
  stepIndex: number;
  totalSteps: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden mb-4">
      <div className="flex items-center justify-between bg-secondary-50 border border-secondary-200 rounded-xl px-4 py-2.5">
        <div>
          <p className="text-[10px] text-secondary-400 uppercase tracking-wide">
            Step {stepIndex + 1} of {totalSteps}
          </p>
          <p className="text-sm font-semibold text-secondary-900 leading-tight">{currentLabel}</p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-secondary-500 hover:text-secondary-900 transition-colors"
          aria-expanded={open}
        >
          {open ? "Hide" : "View Steps"}
          <svg
            className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="mt-1 bg-white border border-secondary-200 rounded-xl shadow-lg p-3 space-y-0.5">
          {steps.map((step) => {
            const isCurrent = step.status === "current";
            const isClickable = (step.status === "complete" || step.status === "available") && !!step.onClick;
            return (
              <button
                key={step.stage}
                onClick={() => { if (isClickable && step.onClick) { step.onClick(); setOpen(false); } }}
                disabled={!isClickable}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                  isCurrent ? "bg-secondary-900 text-white font-semibold"
                  : step.status === "complete" ? "text-secondary-600 hover:bg-secondary-100"
                  : step.status === "needs-attention" ? "text-yellow-700 hover:bg-yellow-50"
                  : "text-secondary-300 cursor-default"
                }`}
              >
                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isCurrent ? "bg-white text-secondary-900"
                  : step.status === "complete" ? "bg-green-100 text-green-700"
                  : step.status === "needs-attention" ? "bg-yellow-100 text-yellow-700"
                  : "bg-secondary-100 text-secondary-400"
                }`}>
                  {step.status === "complete" ? <Check size={8} /> : step.status === "needs-attention" ? "!" : "●"}
                </span>
                {step.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
