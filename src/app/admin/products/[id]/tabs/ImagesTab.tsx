"use client";
import { useRef, useState } from "react";
import { Loader2, Star, Trash2, Upload, ArrowUp, ArrowDown } from "lucide-react";
import AppImage from "@/components/AppImage";
import type { ProductWorkspaceData } from "../page";

export function ImagesTab({ data, onReload }: { data: ProductWorkspaceData; onReload: () => Promise<void> }) {
  const { product, images } = data;
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/printful/artwork-upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      const res = await fetch("/api/product-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          image_url: uploadData.url,
          storage_path: uploadData.storage_path,
          source: "manual",
          is_primary: images.length === 0,
          display_order: images.length,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save image");
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setPrimary = async (imageId: string) => {
    setBusy(imageId);
    try {
      await fetch("/api/product-images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: imageId, product_id: product.id, is_primary: true }),
      });
      // Sync products.image_url
      const img = images.find((i) => i.id === imageId);
      if (img) {
        await fetch(`/api/admin/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: img.image_url }),
        });
      }
      await onReload();
    } finally { setBusy(null); }
  };

  const deleteImage = async (imageId: string) => {
    if (!confirm("Delete this image?")) return;
    setBusy(imageId);
    try {
      const res = await fetch(`/api/product-images?image_id=${imageId}&product_id=${product.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      await onReload();
    } finally { setBusy(null); }
  };

  const reorder = async (imageId: string, direction: "up" | "down") => {
    const idx = images.findIndex((i) => i.id === imageId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= images.length) return;
    setBusy(imageId);
    try {
      await Promise.all([
        fetch("/api/product-images", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_id: imageId, product_id: product.id, display_order: swapIdx }),
        }),
        fetch("/api/product-images", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_id: images[swapIdx].id, product_id: product.id, display_order: idx }),
        }),
      ]);
      await onReload();
    } finally { setBusy(null); }
  };

  const updateAlt = async (imageId: string, altText: string) => {
    await fetch("/api/product-images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_id: imageId, product_id: product.id, alt_text: altText }),
    });
    await onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary-500">{images.length} image{images.length !== 1 ? "s" : ""}</p>
        <div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary py-2 text-sm">
            {uploading ? <><Loader2 size={14} className="mr-2 animate-spin" />Uploading…</> : <><Upload size={14} className="mr-2" />Upload Image</>}
          </button>
        </div>
      </div>

      {error && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{error}</div>}

      {images.length === 0 ? (
        <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-10 text-center text-secondary-400 text-sm">
          No images yet. Upload an image or regenerate mockups from the Design tab.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img, idx) => (
            <div key={img.id} className={`bg-white rounded-xl border overflow-hidden ${img.is_primary ? "border-primary-300 ring-1 ring-primary-200" : "border-secondary-100"}`}>
              <div className="aspect-square bg-secondary-50 relative">
                <AppImage src={img.image_url} alt={img.alt_text ?? ""} fill className="object-contain p-2" />
                {img.is_primary && (
                  <div className="absolute top-2 left-2 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">PRIMARY</div>
                )}
                <div className="absolute top-2 right-2 bg-secondary-900/60 text-white text-[10px] px-1.5 py-0.5 rounded capitalize">
                  {img.source.replace("_", " ")}
                </div>
              </div>
              <div className="p-3 space-y-2">
                <AltTextInput value={img.alt_text ?? ""} onSave={(v) => updateAlt(img.id, v)} />
                <div className="flex items-center gap-1 flex-wrap">
                  {!img.is_primary && (
                    <button onClick={() => setPrimary(img.id)} disabled={busy === img.id} title="Set as primary"
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-secondary-200 hover:border-primary-300 hover:text-primary-600 transition-colors disabled:opacity-40">
                      {busy === img.id ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />}Primary
                    </button>
                  )}
                  <button onClick={() => reorder(img.id, "up")} disabled={idx === 0 || busy === img.id} title="Move up"
                    className="p-1.5 rounded-lg border border-secondary-200 hover:bg-secondary-50 disabled:opacity-30 transition-colors">
                    <ArrowUp size={12} />
                  </button>
                  <button onClick={() => reorder(img.id, "down")} disabled={idx === images.length - 1 || busy === img.id} title="Move down"
                    className="p-1.5 rounded-lg border border-secondary-200 hover:bg-secondary-50 disabled:opacity-30 transition-colors">
                    <ArrowDown size={12} />
                  </button>
                  <button onClick={() => deleteImage(img.id)} disabled={busy === img.id} title="Delete"
                    className="p-1.5 rounded-lg border border-secondary-200 hover:border-error-300 hover:text-error-600 disabled:opacity-40 transition-colors ml-auto">
                    {busy === img.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AltTextInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) return (
    <button onClick={() => { setDraft(value); setEditing(true); }}
      className="text-xs text-secondary-400 hover:text-secondary-700 truncate w-full text-left">
      {value || "Add alt text…"}
    </button>
  );
  return (
    <div className="flex gap-1">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} className="input-field py-1 text-xs flex-1" placeholder="Alt text" autoFocus />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-xs px-2 py-1 bg-secondary-900 text-white rounded-lg">Save</button>
      <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 border border-secondary-200 rounded-lg">✕</button>
    </div>
  );
}
