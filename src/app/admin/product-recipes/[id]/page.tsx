"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle, FlaskConical } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { validateProductRecipe } from "@/lib/catalog/recipe-engine";
import type { ProductRecipeInput, PricingStrategy } from "@/lib/catalog/recipe-engine";

const BLANK_FORM: ProductRecipeInput = {
  name: "",
  slug: "",
  description: null,
  status: "draft",
  provider: "printful",
  printful_catalog_id: 0,
  technique: "",
  placement: "",
  printfile_id: null,
  variant_rules: { colors: [], sizes: [] },
  pricing_rules: { strategy: "FIXED_PRICE", fixed_price: 0 },
  mockup_rules: { views: ["front"], max_mockups: 5 },
  commercial_defaults: {},
  publication_default: "draft",
  metadata: {},
};

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function RecipeEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [form, setForm] = useState<ProductRecipeInput>(BLANK_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Variant rule helpers
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.recipe) setForm(d.recipe);
        setLoading(false);
      });
  }, [id, isNew]);

  const set = (k: keyof ProductRecipeInput, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const validation = validateProductRecipe(form);
    if (!validation.valid) {
      setError(validation.errors.map((e) => `${e.field}: ${e.message}`).join(" · "));
      return;
    }
    setSaving(true); setError(null);
    const res = await fetch(isNew ? "/api/recipes" : `/api/recipes/${id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setError(d.error || JSON.stringify(d.errors)); return; }
    setSaved(true);
    if (isNew) router.push(`/admin/product-recipes/${d.recipe.id}`);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-secondary-300" /></div>;

  const colors: string[] = form.variant_rules?.colors ?? [];
  const sizes: string[] = form.variant_rules?.sizes ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/product-recipes" className="p-2 text-secondary-400 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-secondary-400" />
          <h1 className="text-xl font-bold text-secondary-900">{isNew ? "New Recipe" : form.name || "Edit Recipe"}</h1>
        </div>
      </div>

      {/* 1. Identity */}
      <Section title="1. Identity">
        <Field label="Recipe Name">
          <input value={form.name} onChange={(e) => {
            set("name", e.target.value);
            if (isNew) set("slug", generateSlug(e.target.value));
          }} className="input-field" placeholder="Premium Long Sleeve Graphic Tee" />
        </Field>
        <Field label="Slug">
          <input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))}
            className="input-field font-mono text-sm" placeholder="premium-long-sleeve-graphic-tee" />
        </Field>
        <Field label="Description">
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)}
            className="input-field" rows={2} placeholder="Optional description" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className="input-field">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </Section>

      {/* 2. Blank Product */}
      <Section title="2. Blank Product">
        <p className="text-xs text-secondary-500 mb-3">Enter the Printful catalog product ID. Use the Catalog Builder to discover verified IDs.</p>
        <Field label="Printful Catalog Product ID">
          <input type="number" value={form.printful_catalog_id || ""} onChange={(e) => set("printful_catalog_id", parseInt(e.target.value) || 0)}
            className="input-field" placeholder="e.g. 1580" />
        </Field>
        <div className="bg-secondary-50 rounded-lg p-3 text-xs text-secondary-500 space-y-1">
          <p className="font-medium">Verified catalog products:</p>
          <p>1580 — BC4851GD Garment Dye Long Sleeve Tee (DTFILM, front_dtf)</p>
          <p>71 — BC3001 Unisex Jersey Short Sleeve Tee (DTG, front)</p>
          <p>638 — Yupoong 6606 Dad Hat (EMBROIDERY, embroidery_front)</p>
        </div>
      </Section>

      {/* 3. Production */}
      <Section title="3. Production">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Technique">
            <input value={form.technique} onChange={(e) => set("technique", e.target.value)}
              className="input-field" placeholder="e.g. DTFILM, DTG, EMBROIDERY" />
          </Field>
          <Field label="Placement">
            <input value={form.placement} onChange={(e) => set("placement", e.target.value)}
              className="input-field" placeholder="e.g. front_dtf, front, embroidery_front" />
          </Field>
        </div>
        <Field label="Printfile ID (optional)">
          <input type="number" value={form.printfile_id ?? ""} onChange={(e) => set("printfile_id", parseInt(e.target.value) || null)}
            className="input-field" placeholder="Leave blank to auto-resolve" />
        </Field>
      </Section>

      {/* 4. Variants */}
      <Section title="4. Variants">
        <p className="text-xs text-secondary-500 mb-3">Leave colors/sizes empty to include all available variants.</p>
        <Field label="Allowed Colors">
          <div className="flex flex-wrap gap-1 mb-2">
            {colors.map((c) => (
              <span key={c} className="flex items-center gap-1 text-xs bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full">
                {c}
                <button onClick={() => set("variant_rules", { ...form.variant_rules, colors: colors.filter((x) => x !== c) })}
                  className="text-secondary-400 hover:text-error-600">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={colorInput} onChange={(e) => setColorInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && colorInput.trim()) { set("variant_rules", { ...form.variant_rules, colors: [...colors, colorInput.trim()] }); setColorInput(""); } }}
              className="input-field flex-1 text-sm" placeholder="Type color and press Enter" />
            <button onClick={() => { if (colorInput.trim()) { set("variant_rules", { ...form.variant_rules, colors: [...colors, colorInput.trim()] }); setColorInput(""); } }}
              className="btn-outline py-1.5 text-sm">Add</button>
          </div>
        </Field>
        <Field label="Allowed Sizes">
          <div className="flex flex-wrap gap-1 mb-2">
            {sizes.map((s) => (
              <span key={s} className="flex items-center gap-1 text-xs bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full">
                {s}
                <button onClick={() => set("variant_rules", { ...form.variant_rules, sizes: sizes.filter((x) => x !== s) })}
                  className="text-secondary-400 hover:text-error-600">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && sizeInput.trim()) { set("variant_rules", { ...form.variant_rules, sizes: [...sizes, sizeInput.trim()] }); setSizeInput(""); } }}
              className="input-field flex-1 text-sm" placeholder="Type size and press Enter" />
            <button onClick={() => { if (sizeInput.trim()) { set("variant_rules", { ...form.variant_rules, sizes: [...sizes, sizeInput.trim()] }); setSizeInput(""); } }}
              className="btn-outline py-1.5 text-sm">Add</button>
          </div>
        </Field>
      </Section>

      {/* 5. Pricing */}
      <Section title="5. Pricing">
        <Field label="Strategy">
          <select value={form.pricing_rules?.strategy ?? "FIXED_PRICE"}
            onChange={(e) => set("pricing_rules", { ...form.pricing_rules, strategy: e.target.value as PricingStrategy })}
            className="input-field">
            <option value="FIXED_PRICE">Fixed Price</option>
            <option value="COST_PLUS">Cost + Margin</option>
          </select>
        </Field>
        {form.pricing_rules?.strategy === "FIXED_PRICE" && (
          <Field label="Fixed Price ($)">
            <input type="number" step="0.01" min="0.01" value={form.pricing_rules?.fixed_price ?? ""}
              onChange={(e) => set("pricing_rules", { ...form.pricing_rules, fixed_price: parseFloat(e.target.value) || 0 })}
              className="input-field" placeholder="29.99" />
          </Field>
        )}
        {form.pricing_rules?.strategy === "COST_PLUS" && (
          <Field label="Margin ($)">
            <input type="number" step="0.01" min="0" value={form.pricing_rules?.cost_plus_margin ?? ""}
              onChange={(e) => set("pricing_rules", { ...form.pricing_rules, cost_plus_margin: parseFloat(e.target.value) || 0 })}
              className="input-field" placeholder="12.00" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rounding">
            <select value={form.pricing_rules?.rounding ?? "none"}
              onChange={(e) => set("pricing_rules", { ...form.pricing_rules, rounding: e.target.value as "none" | "ceil" | "nearest_99" })}
              className="input-field">
              <option value="none">None</option>
              <option value="ceil">Round up</option>
              <option value="nearest_99">Nearest .99</option>
            </select>
          </Field>
          <Field label="Minimum Price ($)">
            <input type="number" step="0.01" min="0" value={form.pricing_rules?.min_price ?? ""}
              onChange={(e) => set("pricing_rules", { ...form.pricing_rules, min_price: parseFloat(e.target.value) || undefined })}
              className="input-field" placeholder="Optional floor" />
          </Field>
        </div>
      </Section>

      {/* 6. Mockups */}
      <Section title="6. Mockups">
        <Field label="Max Mockups">
          <input type="number" min="1" max="10" value={form.mockup_rules?.max_mockups ?? 5}
            onChange={(e) => set("mockup_rules", { ...form.mockup_rules, max_mockups: parseInt(e.target.value) || 5 })}
            className="input-field" />
        </Field>
      </Section>

      {/* 7. Commercial Defaults */}
      <Section title="7. Commercial Defaults">
        <p className="text-xs text-secondary-500 mb-3">These defaults can be overridden at generation time.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Brand">
            <input value={(form.commercial_defaults as Record<string,string>)?.brand ?? ""}
              onChange={(e) => set("commercial_defaults", { ...form.commercial_defaults, brand: e.target.value || undefined })}
              className="input-field" placeholder="e.g. CountyBuys" />
          </Field>
          <Field label="Product Type">
            <input value={(form.commercial_defaults as Record<string,string>)?.product_type ?? ""}
              onChange={(e) => set("commercial_defaults", { ...form.commercial_defaults, product_type: e.target.value || undefined })}
              className="input-field" placeholder="e.g. T-Shirt" />
          </Field>
        </div>
        <Field label="Description Template">
          <textarea value={(form.commercial_defaults as Record<string,string>)?.description_template ?? ""}
            onChange={(e) => set("commercial_defaults", { ...form.commercial_defaults, description_template: e.target.value || undefined })}
            className="input-field" rows={2} placeholder="Default product description" />
        </Field>
      </Section>

      {/* 8. Publication */}
      <Section title="8. Publication Default">
        <Field label="Generated products default to">
          <select value={form.publication_default}
            onChange={(e) => set("publication_default", e.target.value as "draft" | "active")}
            className="input-field">
            <option value="draft">Draft (recommended)</option>
            <option value="active">Active (publish immediately)</option>
          </select>
        </Field>
        <p className="text-xs text-secondary-500">Draft is strongly recommended. Review generated products before publishing.</p>
      </Section>

      {/* 9. Review */}
      <Section title="9. Review">
        <div className="space-y-2 text-sm">
          {[
            ["Catalog Product", form.printful_catalog_id || "—"],
            ["Technique", form.technique || "—"],
            ["Placement", form.placement || "—"],
            ["Colors", colors.length ? colors.join(", ") : "All"],
            ["Sizes", sizes.length ? sizes.join(", ") : "All"],
            ["Pricing", form.pricing_rules?.strategy === "FIXED_PRICE"
              ? `Fixed $${form.pricing_rules.fixed_price?.toFixed(2)}`
              : `Cost + $${form.pricing_rules?.cost_plus_margin}`],
            ["Publication", form.publication_default],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between">
              <span className="text-secondary-500">{label}</span>
              <span className="text-secondary-900 font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      </Section>

      {error && (
        <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />{error}
        </div>
      )}
      {saved && !isNew && (
        <div className="bg-success-50 border border-success-200 text-success-800 rounded-lg p-3 text-sm flex items-center gap-2">
          <CheckCircle size={14} />Saved.
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/admin/product-recipes" className="btn-outline py-2">Cancel</Link>
        <button onClick={handleSave} disabled={saving || !form.name || !form.slug} className="btn-primary py-2 disabled:opacity-50">
          {saving ? <><Loader2 size={14} className="mr-2 animate-spin" />Saving…</> : isNew ? "Create Recipe" : "Save Changes"}
        </button>
      </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-text">{label}</label>
      {children}
    </div>
  );
}

export default function RecipeEditorPage() {
  return <ProtectedAdmin><RecipeEditor /></ProtectedAdmin>;
}
