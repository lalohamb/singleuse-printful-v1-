"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, Loader2, Upload, AlertTriangle, CheckCircle, AlertCircle, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import type { PrintfulProduct, PrintfulVariant } from "@/lib/printful/types";
import type { Design } from "@/types";
import {
  validateArtworkForPrintfile,
  fetchPrintfileSpec,
  type ArtworkValidationResult,
  type ArtworkValidationStatus,
} from "@/lib/fulfillment/artwork-validation";
import type { ProductSummary } from "./types";

// ── Module-level summary cache (shared with Phase11AComponents) ───────────────
// Keyed by Printful catalog product ID. Populated in batches of 20.
// TTL: page session only — no stale data served across navigations.
const _summaryCache = new Map<number, ProductSummary | "loading" | null>();

async function batchFetchSummaries(ids: number[]): Promise<void> {
  const missing = ids.filter((id) => !_summaryCache.has(id));
  if (missing.length === 0) return;
  // Mark as loading immediately to prevent duplicate requests
  for (const id of missing) _summaryCache.set(id, "loading");
  // Fetch in chunks of 20 (server cap)
  for (let i = 0; i < missing.length; i += 20) {
    const chunk = missing.slice(i, i + 20);
    try {
      const res = await fetch(`/api/catalog-builder/product-summary?ids=${chunk.join(",")}`);
      const data = await res.json();
      for (const id of chunk) {
        const entry = data[id];
        _summaryCache.set(id, entry?.error || !entry ? null : (entry as ProductSummary));
      }
    } catch {
      for (const id of chunk) _summaryCache.set(id, null);
    }
  }
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-secondary-100 p-3 animate-pulse">
      <div className="aspect-square bg-secondary-100 rounded-lg mb-2" />
      <div className="h-3 bg-secondary-100 rounded w-3/4 mb-1" />
      <div className="h-2.5 bg-secondary-100 rounded w-1/2" />
    </div>
  );
}


// ── Deterministic top-level category map ─────────────────────────────────────
// Derived from Printful type_name values. Groups are ordered for operator UX.
// type_names not listed fall into "More".
const CATEGORY_MAP: { label: string; types: string[] }[] = [
  { label: "Apparel",      types: ["T-Shirts","Long Sleeve Shirts","Sweatshirts & Hoodies","Hoodies","Sweatshirts","Polo Shirts","Jackets","Tank Tops","Crop Tops","Shirts","Jerseys","Leggings","Shorts","Pants","Dresses","Skirts","Bodysuits","Swimwear","Underwear","Socks","Activewear"] },
  { label: "Hats",         types: ["Hats","Caps","Beanies","Bucket Hats","Snapbacks","Dad Hats","Trucker Hats","Visors"] },
  { label: "Kids",         types: ["Kids","Youth","Baby","Toddler","Onesies","Kids T-Shirts","Kids Hoodies"] },
  { label: "Accessories", types: ["Accessories","Bags","Tote Bags","Backpacks","Fanny Packs","Phone Cases","Stickers","Patches","Pins","Keychains","Face Masks","Luggage Tags"] },
  { label: "Home & Living",types: ["Home & Living","Pillows","Blankets","Rugs","Towels","Aprons","Ornaments","Candles","Doormats","Flags","Tapestries"] },
  { label: "Wall Art",     types: ["Wall Art","Posters","Canvas","Framed Prints","Metal Prints","Wood Prints","Art Prints"] },
  { label: "Drinkware",    types: ["Drinkware","Mugs","Tumblers","Water Bottles","Glasses","Cups"] },
];

function getTopCategory(typeName: string): string {
  for (const group of CATEGORY_MAP) {
    if (group.types.some((t) => typeName.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(typeName.toLowerCase()))) {
      return group.label;
    }
  }
  return "More";
}

type SortKey = "default" | "name" | "cost-asc" | "cost-desc" | "colors";

// ── Stage 1: Catalog Browser ──────────────────────────────────────────────────

export function BlankSelector({ onSelect }: { onSelect: (p: PrintfulProduct) => void }) {
  const [products, setProducts] = useState<PrintfulProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [topCategory, setTopCategory] = useState<string>("All");
  const [subType, setSubType] = useState<string>("All");
  const [sort, setSort] = useState<SortKey>("default");
  const [summaryTick, setSummaryTick] = useState(0);

  useEffect(() => {
    fetch("/api/printful/products")
      .then((r) => r.json())
      .then(async (d) => {
        if (d.error) throw new Error(d.error);
        const list: PrintfulProduct[] = d.result ?? [];
        setProducts(list);
        setCatalogLoading(false);
        await batchFetchSummaries(list.map((p) => p.id));
        setSummaryTick((t) => t + 1);
      })
      .catch((e) => { setError(e.message); setCatalogLoading(false); });
  }, []);

  // Top-level category tabs derived from data
  const topCategories = useMemo(() => {
    const present = new Set(products.map((p) => getTopCategory(p.type_name || "")));
    const ordered = ["All", ...CATEGORY_MAP.map((g) => g.label).filter((l) => present.has(l))];
    if (present.has("More")) ordered.push("More");
    return ordered;
  }, [products]);

  // Sub-types within the selected top category
  const subTypes = useMemo(() => {
    if (topCategory === "All") return [];
    const inGroup = products.filter((p) => getTopCategory(p.type_name || "") === topCategory);
    const seen = new Map<string, number>();
    for (const p of inGroup) {
      const t = p.type_name || "Other";
      seen.set(t, (seen.get(t) ?? 0) + 1);
    }
    if (seen.size <= 1) return [];
    return ["All", ...[...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)];
  }, [products, topCategory]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const matchTop = topCategory === "All" || getTopCategory(p.type_name || "") === topCategory;
      const matchSub = subType === "All" || (p.type_name || "") === subType;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.title.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.type_name ?? "").toLowerCase().includes(q);
      return matchTop && matchSub && matchSearch;
    });
    if (sort === "name") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "cost-asc" || sort === "cost-desc") {
      list = [...list].sort((a, b) => {
        const ca = _summaryCache.get(a.id);
        const cb = _summaryCache.get(b.id);
        const va = ca && ca !== "loading" ? (ca.min_cost ?? Infinity) : Infinity;
        const vb = cb && cb !== "loading" ? (cb.min_cost ?? Infinity) : Infinity;
        return sort === "cost-asc" ? va - vb : vb - va;
      });
    } else if (sort === "colors") {
      list = [...list].sort((a, b) => {
        const ca = _summaryCache.get(a.id);
        const cb = _summaryCache.get(b.id);
        const va = ca && ca !== "loading" ? ca.color_count : 0;
        const vb = cb && cb !== "loading" ? cb.color_count : 0;
        return vb - va;
      });
    }
    return list;
  }, [products, topCategory, subType, search, sort, summaryTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => { setSearch(""); setTopCategory("All"); setSubType("All"); };
  const hasFilters = search !== "" || topCategory !== "All" || subType !== "All";

  if (error) return <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>;

  return (
    <div className="space-y-3">
      {/* Search + sort row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-secondary-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, brand, or type…"
            className="input-field pl-9 py-2 text-sm"
            disabled={catalogLoading}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="input-field py-2 text-sm w-44 flex-shrink-0"
          disabled={catalogLoading}
        >
          <option value="default">Default order</option>
          <option value="name">Name A–Z</option>
          <option value="cost-asc">Cost: Low → High</option>
          <option value="cost-desc">Cost: High → Low</option>
          <option value="colors">Most colors</option>
        </select>
      </div>

      {/* Top-level category pills */}
      {!catalogLoading && (
        <div className="flex gap-1.5 flex-wrap">
          {topCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setTopCategory(cat); setSubType("All"); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                topCategory === cat
                  ? "bg-secondary-900 text-white"
                  : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200"
              }`}
            >{cat}</button>
          ))}
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1">
              <X size={10} />Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Sub-type pills */}
      {!catalogLoading && subTypes.length > 0 && (
        <div className="flex gap-1.5 flex-wrap pl-1">
          {subTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSubType(t)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
                subType === t
                  ? "border-secondary-900 bg-secondary-900 text-white"
                  : "border-secondary-200 text-secondary-500 hover:border-secondary-400"
              }`}
            >{t}</button>
          ))}
        </div>
      )}

      {/* Product list */}
      <div className="divide-y divide-secondary-100 rounded-xl border border-secondary-200 overflow-hidden">
        {catalogLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-20 h-20 rounded-lg bg-secondary-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-secondary-100 rounded w-2/3" />
                  <div className="h-2.5 bg-secondary-100 rounded w-1/3" />
                  <div className="h-2.5 bg-secondary-100 rounded w-1/4" />
                </div>
                <div className="h-8 w-16 bg-secondary-100 rounded-lg flex-shrink-0" />
              </div>
            ))
          : filtered.map((p) => {
              const cached = _summaryCache.get(p.id);
              const summary = cached && cached !== "loading" ? cached : null;
              const summaryLoading = cached === "loading";
              const unavailable = summary !== null && summary.available_variants === 0;
              const unknown = cached === undefined || cached === null;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 transition-colors ${
                    unavailable ? "opacity-60 bg-secondary-50" : "hover:bg-secondary-50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    className="w-20 h-20 object-contain rounded-lg border border-secondary-100 bg-white flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary-900 truncate">{p.title}</p>
                    <p className="text-xs text-secondary-500 mt-0.5">
                      {[p.brand, p.type_name].filter(Boolean).join(" • ")}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {summaryLoading ? (
                        <div className="h-2.5 bg-secondary-100 rounded w-28 animate-pulse" />
                      ) : summary ? (
                        <>
                          <span className="text-xs text-secondary-500">
                            {summary.color_count > 0 ? `${summary.color_count} color${summary.color_count !== 1 ? "s" : ""}` : ""}
                            {summary.color_count > 0 && summary.size_count > 0 ? " · " : ""}
                            {summary.size_count > 0 ? `${summary.size_count} size${summary.size_count !== 1 ? "s" : ""}` : ""}
                          </span>
                          {summary.min_cost !== null && (
                            <span className="text-xs font-medium text-secondary-700">
                              from ${summary.min_cost.toFixed(2)}
                              {summary.max_cost !== null && summary.max_cost !== summary.min_cost
                                ? `–$${summary.max_cost.toFixed(2)}` : ""}
                            </span>
                          )}
                          {unavailable && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Unavailable</span>
                          )}
                        </>
                      ) : unknown ? (
                        <span className="text-[10px] text-secondary-400">{p.variant_count} variants</span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    onClick={() => !unavailable && onSelect(p)}
                    disabled={unavailable}
                    className="flex-shrink-0 px-4 py-2 rounded-lg bg-secondary-900 text-white text-xs font-semibold hover:bg-secondary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Select
                  </button>
                </div>
              );
            })}
      </div>

      {!catalogLoading && filtered.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <p className="text-secondary-400 text-sm">No blanks found.</p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-secondary-500 underline">Clear filters</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stage 2: Variant Selection ────────────────────────────────────────────────

export function VariantPicker({
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
    fetch(`/api/printful/products/${catalogProductId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setVariants(d.result?.variants ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [catalogProductId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-secondary-300" /></div>;
  if (error) return <div className="bg-error-50 text-error-700 rounded-lg p-3 text-sm">{error}</div>;

  // Group by color
  const byColor = new Map<string, PrintfulVariant[]>();
  for (const v of variants) {
    const c = v.color || "Default";
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c)!.push(v);
  }

  const selectedIds = new Set(selected.map((v) => v.id));

  const toggle = (v: PrintfulVariant) => {
    if (selectedIds.has(v.id)) onChange(selected.filter((s) => s.id !== v.id));
    else onChange([...selected, v]);
  };

  const selectAll = () => onChange([...variants]);
  const deselectAll = () => onChange([]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={selectAll} className="text-xs text-primary-600 underline">Select all ({variants.length})</button>
        <button onClick={deselectAll} className="text-xs text-secondary-400 underline">Deselect all</button>
        <span className="text-xs text-secondary-500 ml-auto">{selected.length} selected</span>
      </div>
      {[...byColor.entries()].map(([color, cvariants]) => (
        <div key={color}>
          <p className="text-xs font-semibold text-secondary-600 mb-2">{color}</p>
          <div className="flex flex-wrap gap-2">
            {cvariants.map((v) => {
              const isSelected = selectedIds.has(v.id);
              return (
                <button key={v.id} onClick={() => toggle(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    isSelected
                      ? "border-secondary-900 bg-secondary-900 text-white"
                      : "border-secondary-200 text-secondary-700 hover:border-secondary-400"
                  }`}>
                  {isSelected && <Check size={11} />}
                  {v.size || v.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Artwork validation badge ──────────────────────────────────────────────────

function ValidationBadge({ status }: { status: ArtworkValidationStatus }) {
  if (status === "PASS") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success-100 text-success-700">
      <CheckCircle size={9} />PASS
    </span>
  );
  if (status === "PASS_WARNING") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warning-100 text-warning-700">
      <AlertTriangle size={9} />WARNING
    </span>
  );
  if (status === "FAIL") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-error-100 text-error-700">
      <AlertCircle size={9} />FAIL
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-500">
      <Info size={9} />UNVERIFIED
    </span>
  );
}

// ── Artwork validation panel ──────────────────────────────────────────────────

export function ArtworkValidationPanel({
  result,
}: {
  result: ArtworkValidationResult | null;
}) {
  if (!result) return null;
  const borderColor =
    result.status === "PASS" ? "border-success-200 bg-success-50" :
    result.status === "PASS_WARNING" ? "border-warning-200 bg-warning-50" :
    result.status === "FAIL" ? "border-error-200 bg-error-50" :
    "border-secondary-200 bg-secondary-50";

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${borderColor}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-secondary-800">Production Artwork Validation</p>
        <ValidationBadge status={result.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-secondary-700">
        <span className="text-secondary-500">Artwork</span>
        <span>{result.artworkWidth} × {result.artworkHeight} px</span>
        <span className="text-secondary-500">Prints at</span>
        <span>{result.printWidthInches.toFixed(1)}" × {result.printHeightInches.toFixed(1)}"</span>
        <span className="text-secondary-500">Effective DPI</span>
        <span className={result.effectiveDpi < result.minDpi ? "text-error-700 font-semibold" : result.effectiveDpi < result.recommendedDpi ? "text-warning-700 font-semibold" : "text-success-700 font-semibold"}>
          {result.effectiveDpi} DPI
        </span>
        <span className="text-secondary-500">Minimum</span>
        <span>{result.minDpi} DPI</span>
        <span className="text-secondary-500">Recommended</span>
        <span>{result.recommendedDpi} DPI</span>
      </div>
      <p className="text-xs text-secondary-600">{result.detail}</p>
    </div>
  );
}

// ── Stage 3: Design Selection ─────────────────────────────────────────────────

export function DesignPicker({
  selected,
  onSelect,
  catalogProductId,
  placement,
  variantId,
}: {
  selected: Design | null;
  onSelect: (d: Design, validation: ArtworkValidationResult | null) => void;
  catalogProductId?: number;
  placement?: string | null;
  variantId?: number;
}) {
  const [tab, setTab] = useState<"existing" | "upload">("existing");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadedMeta, setUploadedMeta] = useState<{ file_name?: string; file_type?: string; file_size?: number; width?: number; height?: number } | null>(null);
  const [designName, setDesignName] = useState("");
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ArtworkValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    fetch("/api/designs?status=active")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setDesigns(d.designs ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function runValidation(width: number, height: number): Promise<ArtworkValidationResult | null> {
    if (!catalogProductId || !placement) return null;
    setValidating(true);
    try {
      const spec = await fetchPrintfileSpec(catalogProductId, placement, variantId);
      if (!spec) return null;
      return validateArtworkForPrintfile(width, height, spec);
    } finally {
      setValidating(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null); setValidation(null);
    if (!file.type.startsWith("image/")) { setUploadError("Only image files are supported."); return; }
    if (file.size > 50 * 1024 * 1024) { setUploadError("File must be under 50 MB."); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/printful/artwork-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Get dimensions from the file locally
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
        img.src = url;
      });

      setUploadedUrl(data.url);
      setUploadedPath(data.storage_path);
      setUploadedMeta({ file_name: data.file_name, file_type: data.file_type, file_size: data.file_size, ...dims });
      if (!designName) setDesignName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));

      // Run validation if we have product/placement context
      if (dims.width > 0 && dims.height > 0) {
        const v = await runValidation(dims.width, dims.height);
        setValidation(v);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveAndUse() {
    if (!designName.trim()) { setUploadError("Design name is required."); return; }
    if (!uploadedUrl || !uploadedPath) { setUploadError("Upload artwork first."); return; }
    setSaving(true); setUploadError(null);
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: designName.trim(),
          artwork_url: uploadedUrl,
          storage_path: uploadedPath,
          ...uploadedMeta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save design");
      onSelect(data.design, validation);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to save design");
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectExisting(d: Design) {
    let v: ArtworkValidationResult | null = null;
    if (d.width && d.height) {
      v = await runValidation(d.width, d.height);
    }
    onSelect(d, v);
  }

  return (
    <div className="space-y-4">
      {/* Help text */}
      <div className="flex items-start gap-2 bg-secondary-50 border border-secondary-200 rounded-lg px-3 py-2 text-xs text-secondary-600">
        <Info size={13} className="flex-shrink-0 mt-0.5 text-secondary-400" />
        <span>Upload the original design file used for manufacturing. Do not upload a shirt mockup here — mockups are generated separately.</span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab("existing")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "existing" ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-700"
          }`}>
          Select Existing
        </button>
        <button onClick={() => setTab("upload")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
            tab === "upload" ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-700"
          }`}>
          <Upload size={13} />Upload New
        </button>
      </div>

      {/* Existing designs tab */}
      {tab === "existing" && (
        <>
          {loading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-secondary-300" /></div>}
          {error && <div className="bg-error-50 text-error-700 rounded-lg p-3 text-sm">{error}</div>}
          {!loading && designs.length === 0 && (
            <div className="text-center py-8 text-secondary-400">
              <p>No active designs yet.</p>
              <button onClick={() => setTab("upload")} className="mt-2 text-primary-600 underline text-sm">Upload your first design →</button>
            </div>
          )}
          {!loading && designs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {designs.map((d) => (
                <button key={d.id} onClick={() => handleSelectExisting(d)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selected?.id === d.id
                      ? "border-secondary-900 ring-2 ring-secondary-900 ring-offset-1"
                      : "border-secondary-200 hover:border-secondary-400"
                  }`}>
                  <div className="aspect-square bg-secondary-50 rounded-lg overflow-hidden mb-2 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.artwork_url} alt={d.name} className="w-full h-full object-contain p-2" />
                    {selected?.id === d.id && (
                      <div className="absolute top-1 right-1 bg-secondary-900 rounded-full p-0.5">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-secondary-900 line-clamp-1">{d.name}</p>
                  {d.width && d.height && (
                    <p className="text-[10px] text-secondary-400 mt-0.5">{d.width} × {d.height} px</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Upload new design tab */}
      {tab === "upload" && (
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />

          {!uploadedUrl ? (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-secondary-300 rounded-xl p-8 text-center hover:border-secondary-500 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 size={24} className="animate-spin text-secondary-300 mx-auto mb-2" /><p className="text-sm text-secondary-500">Uploading…</p></>
              ) : (
                <><Upload size={24} className="text-secondary-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-secondary-700">Click to upload artwork</p>
                <p className="text-xs text-secondary-400 mt-1">PNG recommended · max 50 MB · preserve transparency</p>
                <p className="text-xs text-secondary-400">For BC3001 front: minimum 1800 × 2400 px · recommended 3600 × 4800 px</p></>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedUrl} alt="uploaded artwork" className="w-24 h-24 object-contain rounded-lg border border-secondary-200 bg-secondary-50 p-1 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-secondary-900">{uploadedMeta?.file_name}</p>
                  <p className="text-xs text-secondary-500">
                    {uploadedMeta?.file_type?.toUpperCase().replace("IMAGE/", "")} · {uploadedMeta?.width} × {uploadedMeta?.height} px · {((uploadedMeta?.file_size ?? 0) / 1024).toFixed(0)} KB
                  </p>
                  {validating && <p className="text-xs text-secondary-400">Checking production requirements…</p>}
                  {validation && <ValidationBadge status={validation.status} />}
                  <button onClick={() => fileRef.current?.click()} className="text-xs text-primary-600 underline">Replace file</button>
                </div>
              </div>

              {validation && <ArtworkValidationPanel result={validation} />}

              <div>
                <label className="block text-xs font-medium text-secondary-700 mb-1">Design Name *</label>
                <input
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  className="input-field"
                  placeholder="Still Original — Retro Outdoors"
                />
                <p className="text-xs text-secondary-400 mt-1">This name appears in your Design Library and on the product review screen.</p>
              </div>

              {uploadError && <div className="bg-error-50 text-error-700 rounded-lg p-3 text-sm">{uploadError}</div>}

              <button
                onClick={handleSaveAndUse}
                disabled={saving || !designName.trim() || (validation?.status === "FAIL")}
                className="btn-primary w-full py-2 text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : "Save Design & Use on Product"}
              </button>
              {validation?.status === "FAIL" && (
                <p className="text-xs text-error-600 text-center">Artwork does not meet production requirements. Upload a higher-resolution file.</p>
              )}
            </div>
          )}
          {uploadError && !uploadedUrl && <div className="bg-error-50 text-error-700 rounded-lg p-3 text-sm">{uploadError}</div>}
        </div>
      )}
    </div>
  );
}
