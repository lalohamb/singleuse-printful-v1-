"use client";
import { useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import AppImage from "@/components/AppImage";
import { supabase } from "@/lib/supabase";
import type { ProductWorkspaceData } from "../page";

export function VariantsTab({ data, onReload }: { data: ProductWorkspaceData; onReload: () => Promise<void> }) {
  const { product, variants } = data;
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(variants.map((v) => [v.id, String(v.retail_price)]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkTarget, setBulkTarget] = useState<"all" | "color" | "size">("all");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<string[] | null>(null);

  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[];

  const getTargetVariants = () => {
    if (bulkTarget === "all") return variants;
    if (bulkTarget === "color") return variants.filter((v) => v.color === bulkValue);
    if (bulkTarget === "size") return variants.filter((v) => v.size === bulkValue);
    return [];
  };

  const applyBulkPrice = async () => {
    const price = parseFloat(bulkPrice);
    if (isNaN(price) || price <= 0) { setMsg("Invalid bulk price"); return; }
    const targets = getTargetVariants();
    if (!targets.length) { setMsg("No variants match"); return; }
    setBulkBusy(true); setMsg(null);
    for (const v of targets) {
      await supabase.from("product_variants")
        .update({ retail_price: price, updated_at: new Date().toISOString() })
        .eq("id", v.id);
    }
    setBulkBusy(false);
    setBulkPrice(""); setBulkPreview(null);
    setMsg(`Updated ${targets.length} variant${targets.length !== 1 ? "s" : ""} to $${price.toFixed(2)}`);
    await onReload();
  };

  const savePrice = async (variantId: string) => {
    const price = parseFloat(prices[variantId]);
    if (isNaN(price) || price <= 0) { setMsg("Invalid price"); return; }
    setSaving(variantId); setMsg(null);
    const { error } = await supabase
      .from("product_variants")
      .update({ retail_price: price, updated_at: new Date().toISOString() })
      .eq("id", variantId);
    setSaving(null);
    if (error) { setMsg(error.message); return; }
    await onReload();
  };

  const toggleAvailability = async (variantId: string, current: boolean) => {
    setToggling(variantId);
    await supabase
      .from("product_variants")
      .update({ available: !current, updated_at: new Date().toISOString() })
      .eq("id", variantId);
    setToggling(null);
    await onReload();
  };

  // Group by color
  const byColor = variants.reduce<Record<string, typeof variants>>((acc, v) => {
    const key = v.color ?? "Default";
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Bulk pricing */}
      <div className="bg-white rounded-xl border border-secondary-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-secondary-900">Bulk Pricing</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="label-text text-xs">Apply to</label>
            <select value={bulkTarget} onChange={(e) => { setBulkTarget(e.target.value as "all"|"color"|"size"); setBulkValue(""); }} className="input-field py-1.5 text-sm">
              <option value="all">All variants</option>
              <option value="color">By color</option>
              <option value="size">By size</option>
            </select>
          </div>
          {bulkTarget === "color" && (
            <div>
              <label className="label-text text-xs">Color</label>
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="input-field py-1.5 text-sm">
                <option value="">Select…</option>
                {colors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {bulkTarget === "size" && (
            <div>
              <label className="label-text text-xs">Size</label>
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="input-field py-1.5 text-sm">
                <option value="">Select…</option>
                {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label-text text-xs">New price ($)</label>
            <input type="number" step="0.01" min="0.01" value={bulkPrice}
              onChange={(e) => { setBulkPrice(e.target.value); setBulkPreview(getTargetVariants().map((v) => v.id)); }}
              className="input-field py-1.5 text-sm w-24" placeholder="0.00" />
          </div>
          <button onClick={applyBulkPrice} disabled={bulkBusy || !bulkPrice || (bulkTarget !== "all" && !bulkValue)}
            className="btn-primary py-1.5 text-sm disabled:opacity-50">
            {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
          </button>
        </div>
        {bulkPrice && (
          <p className="text-xs text-secondary-500">
            Will update {getTargetVariants().length} variant{getTargetVariants().length !== 1 ? "s" : ""} to ${parseFloat(bulkPrice || "0").toFixed(2)}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary-500">
          {variants.length} variant{variants.length !== 1 ? "s" : ""} · {variants.filter((v) => v.available).length} available
        </p>
        {product.catalog_source === "catalog_builder" && (
          <p className="text-xs text-secondary-400">Provider mappings are read-only — set at product creation</p>
        )}
      </div>

      {msg && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{msg}</div>}

      {Object.entries(byColor).map(([color, colorVariants]) => (
        <div key={color} className="bg-white rounded-xl border border-secondary-100 overflow-hidden">
          <div className="px-4 py-2.5 bg-secondary-50 border-b border-secondary-100 flex items-center gap-3">
            <span className="text-sm font-semibold text-secondary-900">{color}</span>
            <span className="text-xs text-secondary-400">{colorVariants.length} size{colorVariants.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-secondary-50">
            {colorVariants.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                {v.image_url && (
                  <div className="w-10 h-10 rounded-lg bg-secondary-50 relative overflow-hidden flex-shrink-0">
                    <AppImage src={v.image_url} alt={v.label} fill className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary-900">{v.size ?? v.label}</p>
                  <p className="text-xs font-mono text-secondary-400 truncate">{v.id}</p>
                  {v.printful_variant_id && (
                    <p className="text-xs text-secondary-400">Printful variant: {v.printful_variant_id}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-secondary-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={prices[v.id] ?? ""}
                      onChange={(e) => setPrices((p) => ({ ...p, [v.id]: e.target.value }))}
                      className="input-field py-1 text-sm w-20"
                    />
                    <button
                      onClick={() => savePrice(v.id)}
                      disabled={saving === v.id || prices[v.id] === String(v.retail_price)}
                      className="text-xs px-2 py-1 bg-secondary-900 text-white rounded-lg disabled:opacity-40 transition-opacity"
                    >
                      {saving === v.id ? <Loader2 size={11} className="animate-spin" /> : "Save"}
                    </button>
                  </div>
                  <button
                    onClick={() => toggleAvailability(v.id, v.available)}
                    disabled={toggling === v.id}
                    title={v.available ? "Mark unavailable" : "Mark available"}
                    className="p-1.5 rounded-lg hover:bg-secondary-100 transition-colors"
                  >
                    {toggling === v.id
                      ? <Loader2 size={14} className="animate-spin text-secondary-400" />
                      : v.available
                        ? <CheckCircle size={16} className="text-success-500" />
                        : <XCircle size={16} className="text-secondary-300" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
