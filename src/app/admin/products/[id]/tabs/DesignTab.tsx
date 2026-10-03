"use client";
import { useRef, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle, Upload, RefreshCw, ExternalLink } from "lucide-react";
import AppImage from "@/components/AppImage";
import { validateArtworkForPrintfile, fetchPrintfileSpec } from "@/lib/fulfillment/artwork-validation";
import type { ArtworkValidationResult } from "@/lib/fulfillment/artwork-validation";
import type { ProductWorkspaceData } from "../page";

export function DesignTab({ data, onReload }: { data: ProductWorkspaceData; onReload: () => Promise<void> }) {
  const { product, product_designs, variants } = data;
  const isCatalogBuilder = product.catalog_source === "catalog_builder";
  const primaryDesign = product_designs.find((pd) => pd.is_primary) ?? product_designs[0];
  const design = primaryDesign?.designs;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ArtworkValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [pendingArtwork, setPendingArtwork] = useState<{ url: string; storagePath: string; fileName: string; width: number; height: number } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadError(null); setValidation(null); setPendingArtwork(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (primaryDesign?.design_id) fd.append("designId", primaryDesign.design_id);
      const res = await fetch("/api/printful/artwork-upload", { method: "POST", body: fd });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server returned unexpected response (HTTP ${res.status}). Check your session and try again.`);
      }
      const uploadData = await res.json();
      if (!res.ok) throw new Error(uploadData.error || "Upload failed");

      // Get dimensions from image
      const img = new window.Image();
      img.src = uploadData.url;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
      const w = img.naturalWidth || uploadData.width || 0;
      const h = img.naturalHeight || uploadData.height || 0;

      setPendingArtwork({ url: uploadData.url, storagePath: uploadData.storage_path, fileName: file.name, width: w, height: h });

      // Validate against printfile spec
      if (product.printful_catalog_id && primaryDesign?.placement) {
        setValidating(true);
        const firstVariant = variants[0];
        const spec = await fetchPrintfileSpec(
          product.printful_catalog_id,
          primaryDesign.placement,
          firstVariant?.printful_variant_id ? Number(firstVariant.printful_variant_id) : undefined
        );
        if (spec && w && h) {
          setValidation(validateArtworkForPrintfile(w, h, spec));
        }
        setValidating(false);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSaveArtwork = async () => {
    if (!pendingArtwork || !primaryDesign) return;
    if (validation?.status === "FAIL") return; // blocked

    setSaving(true); setSaveMsg(null);
    try {
      // Update the design record's artwork_url
      const res = await fetch(`/api/designs/${primaryDesign.design_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artwork_url: pendingArtwork.url,
          storage_path: pendingArtwork.storagePath,
          file_name: pendingArtwork.fileName,
          width: pendingArtwork.width,
          height: pendingArtwork.height,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");

      // Update product_design configuration artworkUrl
      await fetch("/api/product-designs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: primaryDesign.id,
          configuration: { ...((primaryDesign.configuration as Record<string, unknown>) ?? {}), artworkUrl: pendingArtwork.url },
          needs_regeneration: true,
        }),
      });

      setSaveMsg("Artwork updated. Future orders will use the new artwork. Existing order snapshots are unchanged.");
      setPendingArtwork(null);
      setValidation(null);
      await onReload();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateMockups = async () => {
    if (!product.printful_catalog_id || !primaryDesign || !design) return;
    setRegenerating(true); setRegenMsg(null);
    try {
      const variantIds = variants.map((v) => Number(v.printful_variant_id)).filter(Boolean);
      if (!variantIds.length) throw new Error("No variants with Printful IDs");

      // Use frozen position from product_design configuration if available
      const frozenPosition = (primaryDesign.configuration as Record<string, unknown>)?.position ?? null;

      const taskRes = await fetch("/api/printful/mockups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeProductId: product.id,
          variant_ids: variantIds,
          files: [{
            placement: primaryDesign.placement,
            image_url: design.artwork_url,
            ...(frozenPosition ? { position: frozenPosition } : {}),
          }],
          technique: primaryDesign.technique ?? undefined,
        }),
      });
      const contentType = taskRes.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server returned unexpected response (HTTP ${taskRes.status}). Check your session and try again.`);
      }
      const taskData = await taskRes.json();
      if (!taskRes.ok) throw new Error(taskData.error || "Mockup task failed");

      const taskKey = taskData.result?.task_key;
      if (!taskKey) throw new Error("No task key returned");

      // Poll for completion
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(`/api/printful/mockups/${taskKey}`);
        const pollData = await pollRes.json();
        if (pollData.result?.status === "completed") {
          // Persist
          const persistRes = await fetch("/api/printful/mockups/persist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskKey, productId: product.id }),
          });
          const persistData = await persistRes.json();
          if (!persistRes.ok) throw new Error(persistData.error || "Persist failed");
          setRegenMsg(`${persistData.result?.length ?? 0} mockups regenerated and saved.`);
          await onReload();
          break;
        }
        if (pollData.result?.status === "failed") throw new Error("Mockup generation failed");
        attempts++;
      }
      if (attempts >= 30) throw new Error("Mockup generation timed out");
    } catch (err) {
      setRegenMsg(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  if (!isCatalogBuilder) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
        <p className="font-semibold mb-1">Legacy Printful Sync Product</p>
        <p>Design and production configuration is managed through Printful for sync products. Use the Printful Dashboard to update artwork.</p>
        {product.printful_id && (
          <a href={`https://www.printful.com/dashboard/products/${product.printful_id}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-amber-700 underline">
            Open in Printful <ExternalLink size={13} />
          </a>
        )}
      </div>
    );
  }

  if (!primaryDesign || !design) {
    return (
      <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-5 text-sm text-secondary-600">
        No design attached to this product.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current design */}
      <div className="bg-white rounded-xl border border-secondary-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-secondary-900">Current Design</h3>
          <a
            href={`/admin/catalog-builder?edit=${product.id}`}
            className="btn-outline py-1.5 text-sm flex items-center gap-1.5"
          >
            Edit in Designer
          </a>
        </div>
        <div className="flex gap-5 flex-wrap">
          <div className="w-32 h-32 rounded-xl border border-secondary-200 bg-secondary-50 relative overflow-hidden flex-shrink-0">
            <AppImage src={design.artwork_url} alt={design.name} fill className="object-contain p-2" />
          </div>
          <div className="space-y-2 text-sm flex-1 min-w-0">
            <p className="font-medium text-secondary-900">{design.name}</p>
            <p className="text-xs font-mono text-secondary-400 break-all">{design.id}</p>
            {design.file_name && <p className="text-secondary-500">{design.file_name}</p>}
            {design.width && design.height && (
              <p className="text-secondary-500">{design.width} × {design.height} px</p>
            )}
            {design.file_size && (
              <p className="text-secondary-500">{(design.file_size / 1024 / 1024).toFixed(1)} MB</p>
            )}
            <div className="flex gap-2 flex-wrap pt-1">
              <span className="text-xs bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded-full">
                {primaryDesign.technique ?? "—"}
              </span>
              <span className="text-xs bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded-full">
                {primaryDesign.placement}
              </span>
              <span className="text-xs bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded-full">
                Catalog {product.printful_catalog_id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Replace artwork */}
      <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-secondary-900">Replace Artwork</h3>
          <p className="text-xs text-secondary-500 mt-1">
            Changes affect future orders only. Existing order fulfillment snapshots remain unchanged.
          </p>
        </div>

        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-outline py-2 text-sm">
          {uploading ? <><Loader2 size={14} className="mr-2 animate-spin" />Uploading…</> : <><Upload size={14} className="mr-2" />Select New Artwork</>}
        </button>

        {uploadError && (
          <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{uploadError}</div>
        )}

        {validating && (
          <div className="flex items-center gap-2 text-sm text-secondary-500">
            <Loader2 size={14} className="animate-spin" />Validating artwork…
          </div>
        )}

        {pendingArtwork && (
          <div className="space-y-3">
            <div className="flex gap-4 items-start">
              <div className="w-24 h-24 rounded-lg border border-secondary-200 bg-secondary-50 relative overflow-hidden flex-shrink-0">
                <AppImage src={pendingArtwork.url} alt="pending" fill className="object-contain p-1" />
              </div>
              <div className="text-sm space-y-1">
                <p className="font-medium text-secondary-900">{pendingArtwork.fileName}</p>
                <p className="text-secondary-500">{pendingArtwork.width} × {pendingArtwork.height} px</p>
              </div>
            </div>

            {validation && <ValidationBadge result={validation} />}

            {validation?.status === "FAIL" && (
              <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm flex items-start gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>Artwork does not meet minimum DPI requirements and cannot replace the active production artwork. Upload higher-resolution artwork.</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setPendingArtwork(null); setValidation(null); }} className="btn-outline py-2 text-sm">
                Discard
              </button>
              <button
                onClick={handleSaveArtwork}
                disabled={saving || validation?.status === "FAIL"}
                className="btn-primary py-2 text-sm disabled:opacity-50"
              >
                {saving ? <><Loader2 size={14} className="mr-2 animate-spin" />Saving…</> : "Save New Artwork"}
              </button>
            </div>
          </div>
        )}

        {saveMsg && (
          <div className={`rounded-lg p-3 text-sm ${saveMsg.includes("updated") ? "bg-success-50 border border-success-200 text-success-800" : "bg-error-50 border border-error-100 text-error-700"}`}>
            {saveMsg}
          </div>
        )}
      </div>

      {/* Regenerate mockups */}
      <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-secondary-900">Mockups</h3>
        <p className="text-xs text-secondary-500">Regenerate Printful mockups using the current artwork. Existing images are preserved until new mockups are successfully generated.</p>
        <button onClick={handleRegenerateMockups} disabled={regenerating} className="btn-outline py-2 text-sm">
          {regenerating ? <><Loader2 size={14} className="mr-2 animate-spin" />Generating…</> : <><RefreshCw size={14} className="mr-2" />Regenerate Mockups</>}
        </button>
        {regenMsg && (
          <div className={`rounded-lg p-3 text-sm ${regenMsg.includes("regenerated") ? "bg-success-50 border border-success-200 text-success-800" : "bg-error-50 border border-error-100 text-error-700"}`}>
            {regenMsg}
          </div>
        )}
      </div>
    </div>
  );
}

function ValidationBadge({ result }: { result: ArtworkValidationResult }) {
  const colors = {
    PASS: "bg-success-50 border-success-200 text-success-800",
    PASS_WARNING: "bg-warning-50 border-warning-200 text-warning-800",
    FAIL: "bg-error-50 border-error-200 text-error-800",
    UNVERIFIED: "bg-secondary-50 border-secondary-200 text-secondary-600",
  };
  const icons = {
    PASS: <CheckCircle size={14} className="text-success-600 flex-shrink-0" />,
    PASS_WARNING: <AlertTriangle size={14} className="text-warning-600 flex-shrink-0" />,
    FAIL: <AlertTriangle size={14} className="text-error-600 flex-shrink-0" />,
    UNVERIFIED: null,
  };
  return (
    <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${colors[result.status]}`}>
      {icons[result.status]}
      <div>
        <p className="font-semibold">{result.status} — {result.effectiveDpi} DPI effective</p>
        <p className="text-xs mt-0.5">{result.detail}</p>
      </div>
    </div>
  );
}
