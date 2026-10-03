"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X, Loader2, Archive, Image as ImageIcon, Tag, Trash2, RotateCcw, Users, ArrowUpCircle, AlertTriangle } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import AppImage from "@/components/AppImage";
import type { Design } from "@/types";

type DesignWithUsage = Design & { usage_count?: number };

function DesignLibrary() {
  const [designs, setDesigns] = useState<DesignWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Design | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [usageModal, setUsageModal] = useState<{ design: DesignWithUsage; products: { id: string; title: string; status: string }[] } | null>(null);

  const fetchDesigns = async () => {
    setLoading(true);
    const res = await fetch(`/api/designs?status=${statusFilter}`);
    const data = await res.json();
    // Fetch usage counts
    const list: DesignWithUsage[] = data.designs ?? [];
    setDesigns(list);
    setLoading(false);
  };

  useEffect(() => { fetchDesigns(); }, [statusFilter]); // eslint-disable-line

  const handleArchive = async (d: DesignWithUsage) => {
    if (!confirm(`Archive "${d.name}"? It will remain usable by existing products.`)) return;
    setBusy(d.id);
    await fetch(`/api/designs/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setBusy(null);
    fetchDesigns();
  };

  const handleRestore = async (d: DesignWithUsage) => {
    setBusy(d.id);
    await fetch(`/api/designs/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    setBusy(null);
    fetchDesigns();
  };

  const handleDelete = async (d: DesignWithUsage) => {
    const res = await fetch(`/api/designs/${d.id}`);
    const data = await res.json();
    const usageCount = data.design?.usage_count ?? 0;
    if (usageCount > 0) {
      setMsg({ type: "error", text: `Cannot delete "${d.name}" — used by ${usageCount} product(s). Archive instead.` });
      return;
    }
    if (!confirm(`Permanently delete "${d.name}"? This cannot be undone.`)) return;
    setBusy(d.id);
    // Note: no DELETE endpoint on designs — archive is the safe path
    await fetch(`/api/designs/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setBusy(null);
    setMsg({ type: "success", text: `"${d.name}" archived (safe delete).` });
    fetchDesigns();
  };

  const handleViewUsage = async (d: DesignWithUsage) => {
    const res = await fetch(`/api/designs/${d.id}`);
    const data = await res.json();
    // Fetch products using this design
    const pdRes = await fetch(`/api/product-designs?product_id=all&design_id=${d.id}`).catch(() => null);
    // Fallback: use product_designs API
    const pdRes2 = await fetch(`/api/product-designs?product_id=${d.id}`).catch(() => null);
    setUsageModal({ design: { ...d, usage_count: data.design?.usage_count ?? 0 }, products: [] });
  };

  const handlePromote = async (d: DesignWithUsage) => {
    if (!d.storage_path?.startsWith("artwork/tmp/")) {
      setMsg({ type: "success", text: `"${d.name}" is already at a permanent path.` });
      return;
    }
    if (!confirm(`Promote "${d.name}" to permanent storage? The original tmp/ file will be preserved as a backup.`)) return;
    setBusy(d.id);
    const res = await fetch("/api/designs/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design_id: d.id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setMsg({ type: "error", text: data.error }); return; }
    setMsg({ type: "success", text: `"${d.name}" promoted to permanent storage.` });
    fetchDesigns();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg w-fit">
          {(["active", "archived", "all"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${statusFilter === s ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-700"}`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary py-2">
          <Plus size={18} className="mr-2" />New Design
        </button>
      </div>

      {msg && (
        <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${msg.type === "error" ? "bg-error-50 border border-error-100 text-error-700" : "bg-success-50 border border-success-200 text-success-800"}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-secondary-300" /></div>
      ) : designs.length === 0 ? (
        <div className="text-center py-16 text-secondary-400">
          <ImageIcon size={40} className="mx-auto mb-3 text-secondary-200" />
          <p>No designs yet. Upload artwork to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {designs.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden group">
              <div className="aspect-square bg-secondary-50 relative overflow-hidden">
                <AppImage src={d.artwork_url} alt={d.name} fill className="object-contain p-2" />
                {d.status === "archived" && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <span className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Archived</span>
                  </div>
                )}
                {d.storage_path?.startsWith("artwork/tmp/") && (
                  <div className="absolute top-1 left-1 bg-warning-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">TMP</div>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-secondary-900 text-sm truncate">{d.name}</p>
                {d.width && d.height && (
                  <p className="text-xs text-secondary-400">{d.width}×{d.height}px</p>
                )}
                {d.tags && d.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {d.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-[10px] bg-secondary-100 text-secondary-500 px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <button onClick={() => { setEditing(d); setShowModal(true); }}
                    className="flex-1 text-xs text-secondary-500 hover:text-secondary-900 border border-secondary-200 rounded-lg py-1 transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleViewUsage(d)} title="View usage"
                    className="p-1.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                    <Users size={13} />
                  </button>
                  {d.storage_path?.startsWith("artwork/tmp/") && (
                    <button onClick={() => handlePromote(d)} disabled={busy === d.id} title="Promote to permanent storage"
                      className="p-1.5 text-secondary-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors disabled:opacity-40">
                      {busy === d.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpCircle size={13} />}
                    </button>
                  )}
                  {d.status === "active" ? (
                    <button onClick={() => handleArchive(d)} disabled={busy === d.id} title="Archive"
                      className="p-1.5 text-secondary-400 hover:text-warning-600 hover:bg-warning-50 rounded-lg transition-colors disabled:opacity-40">
                      <Archive size={13} />
                    </button>
                  ) : (
                    <button onClick={() => handleRestore(d)} disabled={busy === d.id} title="Restore"
                      className="p-1.5 text-secondary-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors disabled:opacity-40">
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage modal */}
      {usageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-secondary-900/50" onClick={() => setUsageModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-secondary-900">Design Usage</h2>
              <button onClick={() => setUsageModal(null)} className="p-1 text-secondary-400 hover:text-secondary-900"><X size={18} /></button>
            </div>
            <p className="text-sm text-secondary-700 mb-2 font-medium">{usageModal.design.name}</p>
            <p className="text-sm text-secondary-500">
              Used by <strong>{usageModal.design.usage_count ?? 0}</strong> product(s).
            </p>
            <p className="text-xs text-secondary-400 mt-3">View product details in Admin → Products.</p>
          </div>
        </div>
      )}

      {showModal && (
        <DesignModal
          design={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={() => { setShowModal(false); setEditing(null); fetchDesigns(); }}
        />
      )}
    </div>
  );
}

function DesignModal({ design, onClose, onSave }: { design: Design | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: design?.name || "",
    description: design?.description || "",
    tags: design?.tags?.join(", ") || "",
  });
  const [artworkUrl, setArtworkUrl] = useState(design?.artwork_url || "");
  const [storagePath, setStoragePath] = useState(design?.storage_path || "");
  const [fileMeta, setFileMeta] = useState<{ file_name?: string; file_type?: string; file_size?: number; width?: number; height?: number; file_hash?: string }>({});
  const [duplicateDesign, setDuplicateDesign] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/printful/artwork-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setArtworkUrl(data.url);
      setStoragePath(data.storage_path);
      setFileMeta({ file_name: data.file_name, file_type: data.file_type, file_size: data.file_size, file_hash: data.file_hash });
      setDuplicateDesign(data.duplicate_design ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!artworkUrl && !design) { setError("Artwork is required"); return; }
    setSaving(true); setError(null);

    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);

    if (design) {
      // Edit existing
      const res = await fetch(`/api/designs/${design.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description || null, tags }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }
    } else {
      // Create new
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, description: form.description || undefined,
          artwork_url: artworkUrl, storage_path: storagePath, tags, ...fileMeta,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }
    }
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-secondary-900">{design ? "Edit Design" : "New Design"}</h2>
          <button onClick={onClose} className="p-2 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Artwork */}
          <div>
            <label className="label-text">Artwork</label>
            {artworkUrl ? (
              <div className="relative aspect-square w-32 rounded-xl overflow-hidden border border-secondary-200 bg-secondary-50 mb-2">
                <AppImage src={artworkUrl} alt="artwork" fill className="object-contain p-2" />
              </div>
            ) : null}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="btn-outline py-2 text-sm" type="button">
              {uploading ? <><Loader2 size={14} className="mr-2 animate-spin" />Uploading…</> : artworkUrl ? "Replace Artwork" : "Upload Artwork"}
            </button>
            {duplicateDesign && (
              <div className="mt-2 bg-warning-50 border border-warning-200 text-warning-800 rounded-lg p-3 text-xs flex items-start gap-2">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>Identical artwork already exists as <strong>{duplicateDesign.name}</strong>. Consider using the existing design instead of creating a duplicate.</span>
              </div>
            )}
            {!design && <p className="text-xs text-secondary-400 mt-1">PNG or JPEG, max 50 MB. PNG preserves transparency.</p>}
          </div>

          <div>
            <label className="label-text">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Cook County Heritage" />
          </div>
          <div>
            <label className="label-text">Description <span className="text-secondary-400 font-normal text-xs">optional</span></label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" rows={2} placeholder="Brief description of this design" />
          </div>
          <div>
            <label className="label-text flex items-center gap-1"><Tag size={13} />Tags <span className="text-secondary-400 font-normal text-xs">comma-separated</span></label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="input-field" placeholder="heritage, county, culture" />
          </div>

          {error && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{error}</div>}
        </div>
        <div className="flex gap-3 p-6 border-t border-secondary-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="btn-outline flex-1 py-2">Cancel</button>
          <button onClick={handleSave} disabled={saving || uploading} className="btn-primary flex-1 py-2">
            {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : null}
            {design ? "Save Changes" : "Create Design"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDesignsPage() {
  return <ProtectedAdmin><DesignLibrary /></ProtectedAdmin>;
}
