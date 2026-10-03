"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Package, Layers, AlertCircle } from "lucide-react";
import type { PrintfulProduct, PrintfulVariant } from "@/lib/printful/types";
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
  product: PrintfulProduct;
  selected: boolean;
  onSelect: (p: PrintfulProduct) => void;
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

// ── VariantMatrix: color × size grid ─────────────────────────────────────────

export function VariantMatrix({
  catalogProductId,
  selected,
  onChange,
}: {
  catalogProductId: number;
  selected: PrintfulVariant[];
  onChange: (v: PrintfulVariant[]) => void;
}) {
  const [variants, setVariants] = useState<PrintfulVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/printful/products/${catalogProductId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setVariants(d.result?.variants ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [catalogProductId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-secondary-300" /></div>;
  if (error) return <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>;

  const selectedIds = new Set(selected.map((v) => v.id));

  // Detect if this is a color×size product or a flat list
  const hasColors = variants.some((v) => v.color);
  const hasSizes  = variants.some((v) => v.size);
  const isMatrix  = hasColors && hasSizes;

  const toggle = (v: PrintfulVariant) => {
    if (!v.in_stock) return;
    if (selectedIds.has(v.id)) onChange(selected.filter((s) => s.id !== v.id));
    else onChange([...selected, v]);
  };

  const available = variants.filter((v) => v.in_stock);

  // ── Non-apparel fallback: flat list ──────────────────────────────────────
  if (!isMatrix) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onChange([...available])} className="text-xs text-primary-600 underline">
            Select all available ({available.length})
          </button>
          <button onClick={() => onChange([])} className="text-xs text-secondary-400 underline">Clear</button>
          <span className="text-xs text-secondary-500 ml-auto">{selected.length} selected</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const isSel = selectedIds.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => toggle(v)}
                disabled={!v.in_stock}
                title={v.in_stock ? `$${parseFloat(v.price).toFixed(2)} cost` : "Out of stock"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  !v.in_stock
                    ? "border-secondary-100 text-secondary-300 cursor-not-allowed line-through"
                    : isSel
                    ? "border-secondary-900 bg-secondary-900 text-white"
                    : "border-secondary-200 text-secondary-700 hover:border-secondary-400"
                }`}
              >
                {isSel && <Check size={11} />}
                {v.size || v.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Apparel matrix ────────────────────────────────────────────────────────
  const colors: string[] = [];
  const sizes: string[] = [];
  const matrix = new Map<string, PrintfulVariant>();

  for (const v of variants) {
    const c = v.color || "Default";
    const s = v.size || "One Size";
    if (!colors.includes(c)) colors.push(c);
    if (!sizes.includes(s)) sizes.push(s);
    matrix.set(`${c}|${s}`, v);
  }

  const toggleColor = (color: string) => {
    const cv = variants.filter((v) => (v.color || "Default") === color && v.in_stock);
    const allSel = cv.every((v) => selectedIds.has(v.id));
    if (allSel) onChange(selected.filter((s) => (s.color || "Default") !== color));
    else onChange([...selected, ...cv.filter((v) => !selectedIds.has(v.id))]);
  };

  const toggleSize = (size: string) => {
    const sv = variants.filter((v) => (v.size || "One Size") === size && v.in_stock);
    const allSel = sv.every((v) => selectedIds.has(v.id));
    if (allSel) onChange(selected.filter((s) => (s.size || "One Size") !== size));
    else onChange([...selected, ...sv.filter((v) => !selectedIds.has(v.id))]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => onChange([...available])} className="text-xs text-primary-600 underline">
          Select all available ({available.length})
        </button>
        <button onClick={() => onChange([])} className="text-xs text-secondary-400 underline">Clear</button>
        <span className="text-xs text-secondary-500 ml-auto">{selected.length} selected</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left p-1.5 text-secondary-500 font-medium w-28">Color</th>
              {sizes.map((s) => {
                const sv = variants.filter((v) => (v.size || "One Size") === s && v.in_stock);
                const allSel = sv.length > 0 && sv.every((v) => selectedIds.has(v.id));
                return (
                  <th key={s} className="p-1.5 text-center min-w-[48px]">
                    <button
                      onClick={() => toggleSize(s)}
                      className={`text-[10px] font-semibold transition-colors ${allSel ? "text-secondary-900" : "text-secondary-400 hover:text-secondary-700"}`}
                    >
                      {s}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {colors.map((color) => {
              const cv = variants.filter((v) => (v.color || "Default") === color && v.in_stock);
              const allSel = cv.length > 0 && cv.every((v) => selectedIds.has(v.id));
              const someSel = cv.some((v) => selectedIds.has(v.id));
              return (
                <tr key={color} className="border-t border-secondary-100">
                  <td className="p-1.5">
                    <button
                      onClick={() => toggleColor(color)}
                      className={`text-left font-medium transition-colors ${
                        allSel ? "text-secondary-900" : someSel ? "text-secondary-600" : "text-secondary-400"
                      }`}
                    >
                      {color}
                    </button>
                  </td>
                  {sizes.map((size) => {
                    const v = matrix.get(`${color}|${size}`);
                    if (!v) return (
                      <td key={size} className="p-1.5 text-center text-secondary-200 text-[10px]">—</td>
                    );
                    if (!v.in_stock) return (
                      <td key={size} className="p-1.5 text-center">
                        <span className="inline-block w-9 h-7 rounded border border-secondary-100 bg-secondary-50 text-[9px] text-secondary-300 leading-7 text-center">OOS</span>
                      </td>
                    );
                    const isSel = selectedIds.has(v.id);
                    const cost = parseFloat(v.price);
                    return (
                      <td key={size} className="p-1.5 text-center">
                        <button
                          onClick={() => toggle(v)}
                          title={`$${cost.toFixed(2)} cost`}
                          className={`w-9 h-7 rounded border text-[10px] font-medium transition-all ${
                            isSel
                              ? "border-secondary-900 bg-secondary-900 text-white"
                              : "border-secondary-200 text-secondary-600 hover:border-secondary-500"
                          }`}
                        >
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

// ── PricingPreview: full cost/retail/profit/margin breakdown ─────────────────

export function PricingPreview({ variantPricing }: { variantPricing: VariantPricing[] }) {
  const priced = variantPricing.filter((v) => v.retail_price > 0 && v.provider_cost > 0);
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
  product: PrintfulProduct | null;
  multiProducts?: PrintfulProduct[];
  variantCount: number;
  designName: string | null;
  technique: string | null;
  placement: string | null;
  variantPricing: VariantPricing[];
  dpiResult?: string | null;
}) {
  const priced = variantPricing.filter((v) => v.retail_price > 0 && v.provider_cost > 0);
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
  product: PrintfulProduct;
  variantCount: number;
  minCost: number | null;
  maxCost: number | null;
  minRetail: number | null;
  maxRetail: number | null;
  dpiResult: string | null;
  dryRunResult: "pending" | "running" | "PASS" | "WARNING" | "FAIL";
  errors: string[];
}

export function MultiDryRunPanel({
  entries,
  onRunAll,
  running,
}: {
  entries: MultiDryRunEntry[];
  onRunAll: () => void;
  running: boolean;
}) {
  if (entries.length === 0) return null;

  const fmt = (n: number | null) => (n !== null ? `$${n.toFixed(2)}` : "—");
  const rng = (a: number | null, b: number | null) =>
    a === null ? "—" : b !== null && Math.abs(a - b) > 0.005 ? `${fmt(a)}–${fmt(b)}` : fmt(a);

  const resultColor = (r: MultiDryRunEntry["dryRunResult"]) => {
    if (r === "PASS") return "text-green-700 font-semibold";
    if (r === "WARNING") return "text-yellow-700 font-semibold";
    if (r === "FAIL") return "text-red-700 font-semibold";
    return "text-secondary-400";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Review — {entries.length} Products</h2>
        <button
          onClick={onRunAll}
          disabled={running}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
        >
          {running && <Loader2 size={14} className="animate-spin" />}
          {running ? "Validating…" : "Run Validation"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-secondary-200">
        <table className="text-xs w-full border-collapse">
          <thead className="bg-secondary-50">
            <tr>
              <th className="text-left p-3 font-medium text-secondary-600">Product</th>
              <th className="text-right p-3 font-medium text-secondary-600">Variants</th>
              <th className="text-right p-3 font-medium text-secondary-600">Cost</th>
              <th className="text-right p-3 font-medium text-secondary-600">Retail</th>
              <th className="text-center p-3 font-medium text-secondary-600">DPI</th>
              <th className="text-center p-3 font-medium text-secondary-600">Result</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.product.id} className="border-t border-secondary-100">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.product.image} alt={e.product.title} className="w-7 h-7 object-contain rounded border border-secondary-100 bg-secondary-50 flex-shrink-0" />
                    <span className="font-medium text-secondary-900 line-clamp-1">{e.product.title}</span>
                  </div>
                  {e.errors.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {e.errors.map((err, i) => (
                        <li key={i} className="flex items-start gap-1 text-red-600">
                          <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
                          {err}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="p-3 text-right text-secondary-700">{e.variantCount || "—"}</td>
                <td className="p-3 text-right text-secondary-700">{rng(e.minCost, e.maxCost)}</td>
                <td className="p-3 text-right text-secondary-700">{rng(e.minRetail, e.maxRetail)}</td>
                <td className="p-3 text-center text-secondary-500">{e.dpiResult ?? "—"}</td>
                <td className={`p-3 text-center ${resultColor(e.dryRunResult)}`}>
                  {e.dryRunResult === "pending" ? "—" :
                   e.dryRunResult === "running" ? <Loader2 size={12} className="animate-spin mx-auto" /> :
                   e.dryRunResult}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-secondary-400">
        Validation only — no products created, no mockups generated, no Printful orders.
      </p>
    </div>
  );
}
