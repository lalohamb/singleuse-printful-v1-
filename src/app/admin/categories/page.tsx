"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Edit2, Trash2, X, Loader2, ImageOff, Check, Image, Search, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { Category } from "@/types";

const BUCKET = "store-images";
const FOLDERS = ["uploads", "settings/hero", "settings/our-why", "settings/story"];

const DIR_OPTIONS = [
  { value: "bottom", label: "Bottom → Top" },
  { value: "top",    label: "Top → Bottom" },
  { value: "full",   label: "Full overlay" },
  { value: "none",   label: "No gradient" },
];

function buildGrad(dir: string, opacity: number) {
  const op = opacity / 100;
  const map: Record<string, string> = {
    bottom: `linear-gradient(to top, rgba(17,17,17,${op * 0.9}) 0%, rgba(17,17,17,${op * 0.3}) 60%, transparent 100%)`,
    top:    `linear-gradient(to bottom, rgba(17,17,17,${op * 0.9}) 0%, transparent 100%)`,
    full:   `rgba(17,17,17,${op * 0.85})`,
    none:   `transparent`,
  };
  return map[dir] ?? map.bottom;
}

// ── Image Picker Modal ────────────────────────────────────────────────────────
function ImagePickerModal({ current, onSelect, onClose }: {
  current: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab]           = useState<"products" | "library" | "url">("products");
  const [files, setFiles]       = useState<{ name: string; publicUrl: string; path: string }[]>([]);
  const [products, setProducts] = useState<{ title: string; image_url: string | null }[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [loadingProd, setLoadingProd] = useState(true);
  const [search, setSearch]     = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // load products immediately
  useEffect(() => {
    supabase.from("products").select("title, image_url").eq("status", "active").then(({ data }) => {
      setProducts((data || []) as { title: string; image_url: string | null }[]);
      setLoadingProd(false);
    });
  }, []);

  // load media library only when that tab is opened
  useEffect(() => {
    if (tab !== "library" || files.length > 0) return;
    setLoadingLib(true);
    (async () => {
      const all: { name: string; publicUrl: string; path: string }[] = [];
      for (const folder of FOLDERS) {
        const { data } = await supabase.storage.from(BUCKET).list(folder, { sortBy: { column: "created_at", order: "desc" } });
        for (const f of data || []) {
          if (!f.name || f.name === ".emptyFolderPlaceholder") continue;
          const path = `${folder}/${f.name}`;
          const { data: u } = supabase.storage.from(BUCKET).getPublicUrl(path);
          all.push({ name: f.name, publicUrl: u.publicUrl, path });
        }
      }
      setFiles(all);
      setLoadingLib(false);
    })();
  }, [tab]);

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) continue;
      const path = `uploads/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    }
    const all: { name: string; publicUrl: string; path: string }[] = [];
    for (const folder of FOLDERS) {
      const { data } = await supabase.storage.from(BUCKET).list(folder, { sortBy: { column: "created_at", order: "desc" } });
      for (const f of data || []) {
        if (!f.name || f.name === ".emptyFolderPlaceholder") continue;
        const path = `${folder}/${f.name}`;
        const { data: u } = supabase.storage.from(BUCKET).getPublicUrl(path);
        all.push({ name: f.name, publicUrl: u.publicUrl, path });
      }
    }
    setFiles(all);
    setUploading(false);
  };

  const filteredProducts = products.filter((p) => p.image_url && p.title.toLowerCase().includes(search.toLowerCase()));
  const filteredFiles    = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  const TABS = [
    { key: "products", label: "Products" },
    { key: "library",  label: "Media Library" },
    { key: "url",      label: "Paste URL" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-secondary-100">
          <h2 className="text-lg font-bold text-secondary-900">Choose Image</h2>
          <button onClick={onClose} className="p-2 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
        </div>

        {/* tabs */}
        <div className="flex border-b border-secondary-100 px-5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch(""); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-secondary-900 text-secondary-900" : "border-transparent text-secondary-400 hover:text-secondary-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* search row — shown for products + library */}
        {tab !== "url" && (
          <div className="px-5 pt-4 flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-2.5 text-secondary-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "products" ? "Search products…" : "Search library…"}
                className="input-field pl-9 py-2 text-sm w-full" />
            </div>
            {tab === "library" && (
              <>
                <button onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-outline py-2 px-3 text-sm flex items-center gap-1.5">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Uploading…" : "Upload"}
                </button>
                <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && handleUpload(e.target.files)} />
              </>
            )}
          </div>
        )}

        {/* content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* products tab */}
          {tab === "products" && (
            loadingProd
              ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
              : filteredProducts.length === 0
                ? <p className="text-center text-secondary-400 py-10 text-sm">No products found.</p>
                : <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {filteredProducts.map((p, i) => (
                      <button key={i} onClick={() => { onSelect(p.image_url!); onClose(); }}
                        title={p.title}
                        className={`relative aspect-square rounded-xl overflow-hidden bg-secondary-100 border-2 transition-all hover:border-gold-400 ${
                          current === p.image_url ? "border-gold-500 ring-2 ring-gold-300" : "border-transparent"
                        }`}>
                        <img src={p.image_url!} alt={p.title} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                          <p className="text-white text-[10px] leading-tight truncate">{p.title}</p>
                        </div>
                        {current === p.image_url && (
                          <div className="absolute inset-0 bg-gold-500/20 flex items-center justify-center">
                            <Check size={20} className="text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
          )}

          {/* library tab */}
          {tab === "library" && (
            loadingLib
              ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
              : filteredFiles.length === 0
                ? <p className="text-center text-secondary-400 py-10 text-sm">No images found.</p>
                : <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {filteredFiles.map((f) => (
                      <button key={f.path} onClick={() => { onSelect(f.publicUrl); onClose(); }}
                        className={`relative aspect-square rounded-xl overflow-hidden bg-secondary-100 border-2 transition-all hover:border-gold-400 ${
                          current === f.publicUrl ? "border-gold-500 ring-2 ring-gold-300" : "border-transparent"
                        }`}>
                        <img src={f.publicUrl} alt={f.name} className="w-full h-full object-cover" />
                        {current === f.publicUrl && (
                          <div className="absolute inset-0 bg-gold-500/20 flex items-center justify-center">
                            <Check size={20} className="text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
          )}

          {/* url tab */}
          {tab === "url" && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-secondary-500">Paste any public image URL — Pexels, Unsplash, or your own CDN.</p>
              <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://images.pexels.com/…"
                className="input-field text-sm" />
              {urlInput && <img src={urlInput} alt="preview" className="w-full max-h-48 object-contain rounded-xl bg-secondary-100" onError={(e) => (e.currentTarget.style.display = "none")} />}
              <button onClick={() => { if (urlInput.trim()) { onSelect(urlInput.trim()); onClose(); } }}
                disabled={!urlInput.trim()} className="btn-primary w-full py-2 text-sm">Use This Image</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, autoImage, onEdit, onDelete, onSaved }: {
  cat: Category;
  autoImage: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onSaved: (updated: Category) => void;
}) {
  const [dir, setDir]           = useState(cat.gradient_dir ?? "bottom");
  const [opacity, setOpacity]   = useState(cat.gradient_opacity ?? 60);
  const [imageUrl, setImageUrl] = useState(cat.category_image_url ?? null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const displayImage = imageUrl ?? autoImage;

  const dirty =
    dir !== (cat.gradient_dir ?? "bottom") ||
    opacity !== (cat.gradient_opacity ?? 60) ||
    imageUrl !== (cat.category_image_url ?? null);

  const handleSave = async () => {
    setSaving(true);
    const { data } = await supabase
      .from("categories")
      .update({ gradient_dir: dir, gradient_opacity: opacity, category_image_url: imageUrl })
      .eq("id", cat.id)
      .select()
      .single();
    setSaving(false);
    if (data) { setSaved(true); onSaved(data as Category); setTimeout(() => setSaved(false), 2000); }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
        {/* Image preview */}
        <div className="relative aspect-video bg-secondary-200">
          {displayImage
            ? <img src={displayImage} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" />
            : <div className="absolute inset-0 flex items-center justify-center"><ImageOff size={28} className="text-secondary-300" /></div>
          }
          {dir !== "none" && (
            <div className="absolute inset-0 transition-all duration-300" style={{ background: buildGrad(dir, opacity) }} />
          )}
          <div className="absolute bottom-3 left-3">
            <span className="text-white text-sm font-bold drop-shadow">{cat.name}</span>
            <p className="text-white/60 text-xs">/{cat.slug}</p>
          </div>
          {/* top-right actions */}
          <div className="absolute top-2 right-2 flex gap-1">
            <button onClick={() => setShowPicker(true)} className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Change image"><Image size={13} /></button>
            <button onClick={onEdit} className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Edit name/slug"><Edit2 size={13} /></button>
            <button onClick={onDelete} className="p-1.5 bg-black/40 hover:bg-error-600 text-white rounded-lg transition-colors" title="Delete"><Trash2 size={13} /></button>
          </div>
          {/* auto-image badge */}
          {!imageUrl && autoImage && (
            <span className="absolute top-2 left-2 text-[10px] bg-black/40 text-white/70 px-2 py-0.5 rounded-full">auto</span>
          )}
        </div>

        {/* Gradient controls */}
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Image Gradient</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DIR_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setDir(o.value)}
                className={`text-xs py-1.5 rounded-lg border transition-colors ${dir === o.value ? "bg-secondary-900 text-white border-secondary-900" : "border-secondary-200 text-secondary-600 hover:border-secondary-400"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-secondary-500">Opacity</span>
              <span className="text-xs font-medium text-secondary-700">{opacity}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-primary-600"
              disabled={dir === "none"}
            />
          </div>
          {dirty && (
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-1.5 text-sm">
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save Changes"}
            </button>
          )}
          {saved && !dirty && (
            <p className="text-xs text-success-600 flex items-center gap-1"><Check size={12} />Saved</p>
          )}
        </div>

        {cat.description && <p className="text-xs text-secondary-400 px-4 pb-4">{cat.description}</p>}
      </div>

      {showPicker && (
        <ImagePickerModal
          current={imageUrl}
          onSelect={(url) => setImageUrl(url)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function Categories() {
  const [categories, setCategories]         = useState<Category[]>([]);
  const [autoImages, setAutoImages]         = useState<Record<string, string>>({});
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]           = useState(false);
  const [editing, setEditing]               = useState<Category | null>(null);

  const fetchAll = async () => {
    const [{ data: cats }, { data: imgs }] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("products").select("category_id, image_url").eq("status", "active").not("image_url", "is", null).not("category_id", "is", null),
    ]);
    setCategories((cats || []) as Category[]);
    const map: Record<string, string> = {};
    for (const row of (imgs || []) as Array<{ category_id: string; image_url: string }>) {
      if (row.category_id && row.image_url && !map[row.category_id]) map[row.category_id] = row.image_url;
    }
    setAutoImages(map);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Products will become uncategorized.")) return;
    await supabase.from("categories").delete().eq("id", id);
    fetchAll();
  };

  const handleSaved = (updated: Category) => {
    setCategories((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-secondary-600">{categories.length} categories</p>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary py-2"><Plus size={18} className="mr-2" />Add Category</button>
      </div>
      {loading
        ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                autoImage={autoImages[cat.id] ?? null}
                onEdit={() => { setEditing(cat); setShowModal(true); }}
                onDelete={() => handleDelete(cat.id)}
                onSaved={handleSaved}
              />
            ))}
          </div>
        )
      }
      {showModal && (
        <CategoryModal
          category={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={() => { setShowModal(false); setEditing(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ── Category Modal (name/slug/description only) ───────────────────────────────
function CategoryModal({ category, onClose, onSave }: { category: Category | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: category?.name || "", slug: category?.slug || "", description: category?.description || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const payload = { name: form.name, slug, description: form.description };
    const result = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert(payload);
    if (result.error) { setError(result.error.message); setSaving(false); } else onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100">
          <h2 className="text-lg font-bold text-secondary-900">{category ? "Edit Category" : "Add Category"}</h2>
          <button onClick={onClose} className="p-2 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="label-text">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="T-Shirts" /></div>
          <div><label className="label-text">Slug (URL)</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-field" placeholder="t-shirts" /></div>
          <div><label className="label-text">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field min-h-[60px]" placeholder="Category description" /></div>
          {error && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{error}</div>}
        </div>
        <div className="flex gap-3 p-6 border-t border-secondary-100">
          <button onClick={onClose} className="btn-outline flex-1 py-2">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary flex-1 py-2">{saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : null}{category ? "Save" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  return <ProtectedAdmin><Categories /></ProtectedAdmin>;
}
