"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Check, Loader2, Upload, AlertTriangle, CheckCircle, AlertCircle, Info } from "lucide-react";
import type { PrintfulProduct, PrintfulVariant } from "@/lib/printful/types";
import type { Design } from "@/types";
import {
  validateArtworkForPrintfile,
  fetchPrintfileSpec,
  type ArtworkValidationResult,
  type ArtworkValidationStatus,
} from "@/lib/fulfillment/artwork-validation";

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
