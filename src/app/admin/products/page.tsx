"use client";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Search, X, Loader2, RefreshCw, Star, EyeOff, Package, Lock, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase, formatPrice } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { ACTIVE_FLAGS } from "@/lib/productFlags";
import type { Product, Category } from "@/types";

function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [webhookInfoDismissed, setWebhookInfoDismissed] = useState(false);

  const fetchData = () => {
    Promise.all([
      supabase.from("products").select("*").order("title", { ascending: true }),
      supabase.from("categories").select("*").order("name"),
    ]).then(([pRes, cRes]) => { setProducts((pRes.data || []) as Product[]); setCategories((cRes.data || []) as Category[]); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = products.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
  const activeFiltered = filtered.filter((p) => p.status === "active");
  const inactiveFiltered = filtered.filter((p) => p.status !== "active");

  const toggleRow = (id: string) => setSelectedIds((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => setSelectedIds((s) => s.size === activeFiltered.length ? new Set() : new Set(activeFiltered.map((p) => p.id)));
  const clearSel = () => setSelectedIds(new Set());

  const stripHtml = (s: string) => s
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, "\u2014").replace(/&ndash;/g, "\u2013").replace(/&hellip;/g, "...")
    .replace(/&#[0-9]+;/g, "").replace(/&[a-z]+;/g, "")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  const runBulk = async (patch: Record<string, unknown>) => {
    if (!selectedIds.size) return;
    setBulkBusy(true);
    await supabase.from("products").update(patch).in("id", Array.from(selectedIds));
    setBulkBusy(false); clearSel(); fetchData();
  };
  const bulkAssignCategory = () => runBulk({ category_id: bulkCategory || null });
  const bulkSetFlag = (key: string, value: boolean) => runBulk({ [key]: value });
  const bulkSetStatus = (status: string) => runBulk({ status });
  const bulkCleanHtml = async () => {
    if (!selectedIds.size) return;
    setBulkBusy(true);
    const selected = products.filter((p) => selectedIds.has(p.id) && p.description && /<[^>]|&[a-z#]/.test(p.description));
    await Promise.all(selected.map((p) => supabase.from("products").update({ description: stripHtml(p.description!), content_locked: true, updated_at: new Date().toISOString() }).eq("id", p.id)));
    setBulkBusy(false); clearSel(); fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    fetchData();
  };

  const handleToggleFeatured = async (p: Product) => {
    await supabase.from("products").update({ featured: !p.featured }).eq("id", p.id);
    fetchData();
  };

  const handleActivate = async (id: string) => {
    setActivating(id);
    await supabase.from("products").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", id);
    setActivating(null);
    fetchData();
  };

  const handleSetDraft = async (id: string) => {
    setTogglingStatus(id);
    await supabase.from("products").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", id);
    setTogglingStatus(null);
    fetchData();
  };

  const handleSyncPrintify = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const { data: settingsData } = await supabase.from("settings").select("printify_shop_id").limit(1).maybeSingle();
      const shopId = settingsData?.printify_shop_id || process.env.NEXT_PUBLIC_PRINTIFY_SHOP_ID;
      if (!shopId) { setSyncMsg("No Printify Shop ID set. Add it in Admin → Settings."); setSyncing(false); return; }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${supabaseUrl}/functions/v1/printify-proxy/sync?shop_id=${shopId}`, { method: "POST", headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" } });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: "Sync failed" })); throw new Error(err.error || "Sync failed"); }
      const data = await res.json();
      setSyncMsg(`Synced ${data.synced || 0} products from Printify${data.deleted ? ` · ${data.deleted} removed` : ""}.`);
      fetchData();
    } catch (err) { setSyncMsg(err instanceof Error ? err.message : "Sync failed"); }
    finally { setSyncing(false); }
  };

  return (
    <div className="space-y-6">
      
      {syncMsg && <div className="bg-primary-50 border border-primary-100 text-primary-700 rounded-lg p-3 text-sm">{syncMsg}</div>}
      {!webhookInfoDismissed && products.some((p) => p.printify_id) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <span>
              <strong>Printify publish flow:</strong> When you click "Publish" on a product in Printify, it fires a webhook → this site confirms back → product becomes active. If a product is stuck at <em>"Publishing"</em> in Printify, the webhook confirmation failed — redeploy the <code className="bg-amber-100 px-1 rounded">printify-webhook</code> edge function and try publishing again.
            </span>
          </div>
          <button onClick={() => setWebhookInfoDismissed(true)} className="flex-shrink-0 text-amber-500 hover:text-amber-700"><X size={16} /></button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs"><Search size={18} className="absolute left-3 top-2.5 text-secondary-400" /><input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2" /></div>
        <div className="flex items-center gap-3">
          <button onClick={handleSyncPrintify} disabled={syncing} className="btn-outline py-2">{syncing ? <Loader2 size={18} className="mr-2 animate-spin" /> : <RefreshCw size={18} className="mr-2" />}Sync Printify</button>
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary py-2"><Plus size={18} className="mr-2" />Add Product</button>
        </div>
      </div>
      {/* Tab switcher */}
      <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab("active")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "active" ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-700"}`}>
          Active <span className="ml-1.5 text-xs bg-success-100 text-success-700 px-1.5 py-0.5 rounded-full">{activeFiltered.length}</span>
          {activeFiltered.filter(p => !p.printify_id).length > 0 && (
            <span className="ml-1 text-xs bg-gold-500/20 text-gold-600 px-1.5 py-0.5 rounded-full" title="Includes manually added products not linked to Printify">
              {activeFiltered.filter(p => !p.printify_id).length} manual
            </span>
          )}
        </button>
        <button onClick={() => setTab("inactive")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "inactive" ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-700"}`}>
          Inactive &amp; Unsynced <span className="ml-1.5 text-xs bg-secondary-200 text-secondary-600 px-1.5 py-0.5 rounded-full">{inactiveFiltered.length}</span>
        </button>
      </div>

      {/* ── ACTIVE TAB ── */}
      {tab === "active" && (
        <>
          {selectedIds.size > 0 && (
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-secondary-900">{selectedIds.size} selected</span>
              <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="input-field py-1.5 max-w-[200px]">
                <option value="">Uncategorized</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={bulkAssignCategory} disabled={bulkBusy} className="btn-primary py-1.5">Assign category</button>
              {ACTIVE_FLAGS.map((f) => (
                <button key={f.key as string} onClick={() => bulkSetFlag(f.key as string, true)} disabled={bulkBusy} className="btn-outline py-1.5">+ {f.label}</button>
              ))}
              <button onClick={() => bulkSetStatus("draft")} disabled={bulkBusy} className="btn-outline py-1.5 text-warning-600 border-warning-300 hover:bg-warning-50">Set Draft</button>
              <button onClick={bulkCleanHtml} disabled={bulkBusy} className="btn-outline py-1.5 text-secondary-600">Clean HTML</button>
              <button onClick={clearSel} className="text-sm text-secondary-500 underline">Clear</button>
            </div>
          )}
          {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div> : (
            <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-secondary-50 border-b border-secondary-100">
                    <tr>
                      <th className="px-4 py-3 w-10"><input type="checkbox" aria-label="Select all" checked={activeFiltered.length > 0 && selectedIds.size === activeFiltered.length} onChange={toggleAll} className="w-4 h-4 rounded" /></th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Product</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden md:table-cell">Category</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Price</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden lg:table-cell">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden lg:table-cell">Flags</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Featured</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-secondary-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-50">
                    {activeFiltered.map((p) => (
                      <tr key={p.id} className={`hover:bg-secondary-50 transition-colors ${selectedIds.has(p.id) ? "bg-primary-50/50" : ""}`}>
                        <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${p.title}`} checked={selectedIds.has(p.id)} onChange={() => toggleRow(p.id)} className="w-4 h-4 rounded" /></td>
                        <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={p.image_url || ""} alt={p.title} className="w-12 h-12 rounded-lg object-cover bg-secondary-100 flex-shrink-0" /><div className="min-w-0 max-w-[240px]"><p className="font-medium text-secondary-900 truncate flex items-center gap-1">{p.content_locked && <Lock size={12} className="text-warning-500 flex-shrink-0" aria-label="Content locked" />}{p.title}</p>{p.printify_id && <p className="text-xs text-secondary-400 truncate">Printify: {p.printify_id}</p>}</div></div></td>
                        <td className="px-4 py-3 text-sm text-secondary-600 hidden md:table-cell">{categories.find((c) => c.id === p.category_id)?.name || "Uncategorized"}</td>
                        <td className="px-4 py-3 font-medium text-secondary-900">{formatPrice(p.price)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
  <span className={`text-xs px-2 py-1 rounded-full ${p.status === "active" ? "bg-success-50 text-success-600" : p.status === "draft" ? "bg-warning-50 text-warning-600" : "bg-secondary-100 text-secondary-500"}`}>
    {p.status}
  </span>
  {p.status === "active" && p.printify_id && (
    <span title="Active via Printify sync — published through webhook handshake or visible=true on Printify" className="ml-1.5 text-[10px] text-secondary-400 cursor-help">via Printify</span>
  )}
  {p.status === "active" && !p.printify_id && (
    <span title="Manually added product — not linked to Printify" className="ml-1.5 text-[10px] text-gold-500 cursor-help">via Manual</span>
  )}
</td>
                        <td className="px-4 py-3 hidden lg:table-cell"><div className="flex flex-wrap gap-1">{ACTIVE_FLAGS.filter((f) => f.key !== "featured" && (p as unknown as Record<string, boolean>)[f.key as string]).map((f) => <span key={f.key as string} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.badgeClass}`}>{f.badge}</span>)}</div></td>
                        <td className="px-4 py-3"><button onClick={() => handleToggleFeatured(p)} className="p-1.5 rounded-lg hover:bg-secondary-100 transition-colors"><Star size={18} className={p.featured ? "fill-gold-500 text-gold-500" : "text-secondary-300"} /></button></td>
                        <td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><button onClick={() => handleSetDraft(p.id)} disabled={togglingStatus === p.id} title="Set to Draft" className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-warning-600 bg-warning-50 hover:bg-warning-100 border border-warning-200 rounded-lg transition-colors disabled:opacity-40">{togglingStatus === p.id ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}Draft</button><button onClick={() => { setEditing(p); setShowModal(true); }} className="p-2 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"><Edit2 size={16} /></button><button onClick={() => handleDelete(p.id)} className="p-2 text-secondary-500 hover:text-error-500 hover:bg-error-50 rounded-lg transition-colors"><Trash2 size={16} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activeFiltered.length === 0 && <div className="text-center py-12 text-secondary-400"><Package size={40} className="mx-auto mb-3 text-secondary-200" />No active products found</div>}
            </div>
          )}
        </>
      )}

      {/* ── INACTIVE TAB ── */}
      {tab === "inactive" && (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Product</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden md:table-cell">Printify ID</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden lg:table-cell">Blueprint</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden lg:table-cell">Shipping</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-secondary-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {inactiveFiltered.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.image_url || ""} alt={p.title} className="w-12 h-12 rounded-lg object-cover bg-secondary-100 flex-shrink-0 opacity-60" />
                        <div className="min-w-0 max-w-[240px]">
                          <p className="font-medium text-secondary-700 truncate">{p.title}</p>
                          <p className="text-xs text-secondary-400">{formatPrice(p.price)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        p.status === "draft" ? "bg-warning-50 text-warning-600"
                        : p.status === "archived" ? "bg-secondary-100 text-secondary-500"
                        : "bg-secondary-100 text-secondary-500"
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {p.printify_id
                        ? <span className="text-xs font-mono text-secondary-500">{p.printify_id}</span>
                        : <span className="text-xs text-secondary-300 italic">Not synced</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {p.blueprint_id && p.print_provider_id
                        ? <span className="inline-flex items-center gap-1 text-xs text-success-600"><CheckCircle size={12} />Blueprint {p.blueprint_id}</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-warning-600"><AlertTriangle size={12} />Missing</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {(p.shipping_info as any)?.profiles?.length > 0
                        ? <span className="inline-flex items-center gap-1 text-xs text-success-600"><CheckCircle size={12} />Stored</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-warning-600"><AlertTriangle size={12} />Missing — sync</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleActivate(p.id)}
                        disabled={activating === p.id}
                        className="btn-primary py-1.5 px-3 text-sm"
                      >
                        {activating === p.id ? <Loader2 size={14} className="animate-spin" /> : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inactiveFiltered.length === 0 && (
            <div className="text-center py-12 text-secondary-400">
              <CheckCircle size={40} className="mx-auto mb-3 text-success-200" />
              All products are active
            </div>
          )}
        </div>
      )}

      {showModal && <ProductModal product={editing} categories={categories} onClose={() => { setShowModal(false); setEditing(null); }} onSave={() => { setShowModal(false); setEditing(null); fetchData(); }} />}
    </div>
  );
}

function ProductModal({ product, categories, onClose, onSave }: { product: Product | null; categories: Category[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    title: product?.title || "", description: product?.description || "",
    price: product?.price?.toString() || "", cost: product?.cost?.toString() || "0",
    image_url: product?.image_url || "", category_id: product?.category_id || "",
    featured: product?.featured || false,
    is_new_arrival: product?.is_new_arrival || false, is_trending: product?.is_trending || false,
    is_bestseller: product?.is_bestseller || false, is_on_sale: product?.is_on_sale || false,
    content_locked: product?.content_locked || false,
    is_personalizable: product?.is_personalizable || false,
    personalization_label: product?.personalization_label || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    // Editing a synced product's text/image locks it so a Printify re-sync
    // won't overwrite the curated content. New products aren't locked.
    const textChanged = !!product && (
      form.title !== (product.title || "") ||
      form.description !== (product.description || "") ||
      form.image_url !== (product.image_url || "")
    );
    const payload = {
      title: form.title, description: form.description,
      price: parseFloat(form.price) || 0, cost: parseFloat(form.cost) || 0,
      image_url: form.image_url, category_id: form.category_id || null,
      featured: form.featured,
      is_new_arrival: form.is_new_arrival, is_trending: form.is_trending,
      is_bestseller: form.is_bestseller, is_on_sale: form.is_on_sale,
      content_locked: form.content_locked || textChanged,
      is_personalizable: form.is_personalizable,
      personalization_label: form.personalization_label || null,
      images: form.image_url ? [form.image_url] : [], updated_at: new Date().toISOString(),
    };
    const result = product ? await supabase.from("products").update(payload).eq("id", product.id) : await supabase.from("products").insert({ ...payload, variants: [{ id: "S", label: "Small", color: "Default" }] });
    if (result.error) { setError(result.error.message); setSaving(false); } else onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-secondary-900">{product ? "Edit Product" : "Add Product"}</h2>
          <button onClick={onClose} className="p-2 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="label-text">Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Product title" /></div>
          <div>
            <label className="label-text">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field min-h-[80px] whitespace-pre-wrap" placeholder="Product description" />
            <button type="button" onClick={() => setForm((prev) => ({ ...prev, description: (prev.description || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ldquo;/g, "\"").replace(/&rdquo;/g, "\"").replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "...").replace(/&#[0-9]+;/g, "").replace(/&[a-z]+;/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() }))} className="text-xs text-secondary-400 hover:text-secondary-700 mt-1 underline">Clean HTML tags</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Price ($)</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-field" placeholder="32.00" /></div>
            <div><label className="label-text">Cost ($)</label><input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="input-field" placeholder="12.50" /></div>
          </div>
          <div><label className="label-text">Image URL</label><div className="grid grid-cols-4 gap-2 mb-2">{Array.from(new Set([...(product?.images ?? []), ...(product?.image_url ? [product.image_url] : [])])).map((url, i) => (<button key={i} type="button" onClick={() => setForm({ ...form, image_url: url })} className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${form.image_url === url ? "border-gold-500" : "border-transparent"}`}><img src={url} alt="" className="w-full h-full object-cover" />{form.image_url === url && <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-lg">✓</span>}</button>))}</div><input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="input-field" placeholder="https://..." /></div>
          <div><label className="label-text">Category</label><select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input-field"><option value="">Uncategorized</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>

          <div>
            <label className="label-text">Badges</label>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVE_FLAGS.map((f) => (
                <label key={f.key as string} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!(form as unknown as Record<string, boolean>)[f.key as string]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
                  <span className="text-sm font-medium text-secondary-700">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
          {product ? (
            <div className={`border rounded-lg p-3 text-sm flex items-center justify-between gap-3 ${
              form.content_locked
                ? "bg-warning-50 border-warning-100 text-warning-700"
                : "bg-secondary-50 border-secondary-100 text-secondary-600"
            }`}>
              <span className="flex items-center gap-2">
                <Lock size={14} className={form.content_locked ? "text-warning-500" : "text-secondary-400"} />
                {form.content_locked
                  ? "Content locked — title, description & image preserved on Printify re-sync."
                  : "Content unlocked — Printify re-sync will overwrite title, description & image."}
              </span>
              <button type="button" onClick={() => setForm({ ...form, content_locked: !form.content_locked })} className="underline font-medium flex-shrink-0">
                {form.content_locked ? "Unlock" : "Lock"}
              </button>
            </div>
          ) : (
            <div className="bg-secondary-50 border border-secondary-100 text-secondary-500 rounded-lg p-3 text-sm flex items-center gap-2">
              <Lock size={14} className="text-secondary-400" />
              New products are not linked to Printify — no sync lock needed.
            </div>
          )}
          <div className="border-t border-secondary-100 pt-4">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" checked={form.is_personalizable} onChange={(e) => setForm({ ...form, is_personalizable: e.target.checked })} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
              <span className="text-sm font-medium text-secondary-700">Allow personalization (custom text)</span>
            </label>
            {form.is_personalizable && (
              <div>
                <label className="label-text">Personalization prompt label</label>
                <input value={form.personalization_label} onChange={(e) => setForm({ ...form, personalization_label: e.target.value })} className="input-field" placeholder="e.g. Name to print, Custom message..." />
                <p className="text-xs text-secondary-400 mt-1">This label appears above the text input on the product page.</p>
              </div>
            )}
          </div>
          {error && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{error}</div>}
        </div>
        <div className="flex gap-3 p-6 border-t border-secondary-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="btn-outline flex-1 py-2">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title || !form.price} className="btn-primary flex-1 py-2">{saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : null}{product ? "Save Changes" : "Create Product"}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  return <ProtectedAdmin><Products /></ProtectedAdmin>;
}
