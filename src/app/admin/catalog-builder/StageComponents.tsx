"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Search, Check, Loader2 } from "lucide-react";
import type { PrintfulProduct, PrintfulVariant } from "@/lib/printful/types";
import type { Design } from "@/types";

// ── Stage 1: Blank Selection ──────────────────────────────────────────────────

export function BlankSelector({ onSelect }: { onSelect: (p: PrintfulProduct) => void }) {
  const [products, setProducts] = useState<PrintfulProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/printful/products")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setProducts(d.result ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-secondary-300" /></div>;
  if (error) return <div className="bg-error-50 text-error-700 rounded-lg p-3 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-2.5 text-secondary-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blanks by name or brand..."
          className="input-field pl-9 py-2"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((p) => (
          <button key={p.id} onClick={() => onSelect(p)}
            className="rounded-xl border border-secondary-200 p-3 text-left hover:border-secondary-900 hover:shadow-sm transition-all group">
            <div className="aspect-square bg-secondary-50 rounded-lg overflow-hidden mb-2 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.title} className="w-full h-full object-contain p-1" />
            </div>
            <p className="text-xs font-semibold text-secondary-900 line-clamp-2 leading-tight">{p.title}</p>
            {p.brand && <p className="text-[10px] text-secondary-400 mt-0.5">{p.brand}</p>}
            <p className="text-[10px] text-secondary-400 mt-0.5">{p.variant_count} variants</p>
          </button>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center text-secondary-400 py-8">No blanks found.</p>}
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

// ── Stage 3: Design Selection ─────────────────────────────────────────────────

export function DesignPicker({
  selected,
  onSelect,
}: {
  selected: Design | null;
  onSelect: (d: Design) => void;
}) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/designs?status=active")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setDesigns(d.designs ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-secondary-300" /></div>;
  if (error) return <div className="bg-error-50 text-error-700 rounded-lg p-3 text-sm">{error}</div>;
  if (designs.length === 0) return (
    <div className="text-center py-8 text-secondary-400">
      <p>No active designs. <a href="/admin/designs" target="_blank" className="text-primary-600 underline">Create one in Design Library →</a></p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {designs.map((d) => (
        <button key={d.id} onClick={() => onSelect(d)}
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
        </button>
      ))}
    </div>
  );
}
