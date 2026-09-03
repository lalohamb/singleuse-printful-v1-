"use client";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Loader2, FolderTree } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { Category } from "@/types";

function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const fetchCategories = () => { supabase.from("categories").select("*").order("name").then(({ data }) => { setCategories((data || []) as Category[]); setLoading(false); }); };
  useEffect(() => { fetchCategories(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Products will become uncategorized.")) return;
    await supabase.from("categories").delete().eq("id", id);
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-secondary-600">{categories.length} categories</p>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary py-2"><Plus size={18} className="mr-2" />Add Category</button>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center"><FolderTree size={20} className="text-primary-600" /></div>
                  <div><h3 className="font-semibold text-secondary-900">{cat.name}</h3><p className="text-xs text-secondary-400">/{cat.slug}</p></div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(cat); setShowModal(true); }} className="p-2 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(cat.id)} className="p-2 text-secondary-500 hover:text-error-500 hover:bg-error-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
              {cat.description && <p className="text-sm text-secondary-500 mt-3">{cat.description}</p>}
            </div>
          ))}
        </div>
      )}
      {showModal && <CategoryModal category={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={() => { setShowModal(false); setEditing(null); fetchCategories(); }} />}
    </div>
  );
}

function CategoryModal({ category, onClose, onSave }: { category: Category | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: category?.name || "", slug: category?.slug || "", description: category?.description || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const payload = { name: form.name, slug, description: form.description };
    const result = category ? await supabase.from("categories").update(payload).eq("id", category.id) : await supabase.from("categories").insert(payload);
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
