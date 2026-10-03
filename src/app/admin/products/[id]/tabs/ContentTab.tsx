"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types";
import type { ProductWorkspaceData } from "../page";

export function ContentTab({ data, onReload }: { data: ProductWorkspaceData; onReload: () => Promise<void> }) {
  const { product } = data;
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: product.title,
    description: product.description ?? "",
    short_description: product.short_description ?? "",
    slug: product.slug ?? "",
    brand: product.brand ?? "",
    product_type: product.product_type ?? "",
    category_id: product.category_id ?? "",
    meta_title: product.meta_title ?? "",
    meta_description: product.meta_description ?? "",
    compare_at_price: product.compare_at_price?.toString() ?? "",
    is_personalizable: product.is_personalizable,
    personalization_label: product.personalization_label ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data: cats }) => {
      setCategories((cats ?? []) as Category[]);
    });
  }, []);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description || null,
        short_description: form.short_description || null,
        slug: form.slug || null,
        brand: form.brand || null,
        product_type: form.product_type || null,
        category_id: form.category_id || null,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price) : null,
        is_personalizable: form.is_personalizable,
        personalization_label: form.personalization_label || null,
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg({ type: "error", text: d.error }); return; }
    setMsg({ type: "success", text: "Saved." });
    await onReload();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Section title="Product Information">
        <Field label="Title">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} className="input-field" />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input-field min-h-[140px]" />
        </Field>
        <Field label="Short Description">
          <textarea value={form.short_description} onChange={(e) => set("short_description", e.target.value)} className="input-field" rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Brand">
            <input value={form.brand} onChange={(e) => set("brand", e.target.value)} className="input-field" placeholder="e.g. Body & Sleeves" />
          </Field>
          <Field label="Product Type">
            <input value={form.product_type} onChange={(e) => set("product_type", e.target.value)} className="input-field" placeholder="e.g. tshirt" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)} className="input-field">
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Compare-at Price ($)">
            <input type="number" step="0.01" value={form.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value)} className="input-field" placeholder="Optional" />
          </Field>
        </div>
      </Section>

      <Section title="URL & SEO">
        <Field label="Slug" hint="Changing this breaks existing links">
          <input
            value={form.slug}
            onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))}
            className="input-field font-mono text-sm"
          />
        </Field>
        <Field label="Meta Title" hint="Fallback: title">
          <input value={form.meta_title} onChange={(e) => set("meta_title", e.target.value)} className="input-field" maxLength={70} placeholder={form.title} />
        </Field>
        <Field label="Meta Description">
          <textarea value={form.meta_description} onChange={(e) => set("meta_description", e.target.value)} className="input-field" rows={2} maxLength={160} />
        </Field>
      </Section>

      <Section title="Personalization">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_personalizable} onChange={(e) => set("is_personalizable", e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm text-secondary-700">Allow custom text personalization</span>
        </label>
        {form.is_personalizable && (
          <Field label="Personalization prompt">
            <input value={form.personalization_label} onChange={(e) => set("personalization_label", e.target.value)} className="input-field" placeholder="e.g. Name to print" />
          </Field>
        )}
      </Section>

      {msg && (
        <div className={`rounded-lg p-3 text-sm ${msg.type === "success" ? "bg-success-50 border border-success-200 text-success-800" : "bg-error-50 border border-error-100 text-error-700"}`}>
          {msg.text}
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn-primary py-2 disabled:opacity-50">
        {saving ? <><Loader2 size={16} className="mr-2 animate-spin" />Saving…</> : "Save Changes"}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-secondary-900">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-text">
        {label}{hint && <span className="text-secondary-400 font-normal text-xs ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
