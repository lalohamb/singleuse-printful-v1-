"use client";
import { useEffect, useState } from "react";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import { DEFAULT_SITE_MENU_SETTINGS, type SiteMenuSettings } from "@/lib/site-menu-settings";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types";

export default function AdminMenu() {
  const { save, saved, error } = useSettings();
  const [s, setS] = useState<SiteMenuSettings>(DEFAULT_SITE_MENU_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const upd = (k: keyof SiteMenuSettings, v: any) => setS((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    supabase.from("categories").select("id, name, slug").order("name").then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  const previewCats = s.categorySlugs.length
    ? categories.filter((c) => s.categorySlugs.includes(c.slug))
    : categories;

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <p className="text-xs text-secondary-500">Change the storefront homepage menu colors and typography.</p>

      {/* Preview */}
      <div className="border border-secondary-200 rounded-xl p-4">
        <div className="rounded-lg p-4" style={{ backgroundColor: s.backgroundColor, color: s.textColor, fontFamily: s.fontFamily === "display" ? "Georgia, serif" : "Inter, sans-serif", fontSize: s.fontSize === "small" ? "14px" : s.fontSize === "large" ? "18px" : "16px", fontWeight: s.fontWeight === "semibold" ? 600 : s.fontWeight === "normal" ? 400 : 500, letterSpacing: s.letterSpacing === "wide" ? "0.08em" : s.letterSpacing === "relaxed" ? "0.025em" : "0" }}>
          <div className="flex flex-wrap items-center gap-4">
            <span>All Products</span>
            {previewCats.slice(0, 5).map((c) => <span key={c.id}>{c.name}</span>)}
            <span>About</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="label-text">Menu background<input type="color" value={s.backgroundColor} onChange={(e) => upd("backgroundColor", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
        <label className="label-text">Menu font color<input type="color" value={s.textColor} onChange={(e) => upd("textColor", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="label-text">Font type<select value={s.fontFamily} onChange={(e) => upd("fontFamily", e.target.value)} className="input-field mt-1"><option value="sans">Sans</option><option value="display">Display</option></select></label>
        <label className="label-text">Font size<select value={s.fontSize} onChange={(e) => upd("fontSize", e.target.value)} className="input-field mt-1"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
        <label className="label-text">Font weight<select value={s.fontWeight} onChange={(e) => upd("fontWeight", e.target.value)} className="input-field mt-1"><option value="normal">Normal</option><option value="medium">Medium</option><option value="semibold">Semibold</option></select></label>
        <label className="label-text">Letter spacing<select value={s.letterSpacing} onChange={(e) => upd("letterSpacing", e.target.value)} className="input-field mt-1"><option value="normal">Normal</option><option value="relaxed">Relaxed</option><option value="wide">Wide</option></select></label>
      </div>

      <div className="border-t border-secondary-100 pt-4">
        <h3 className="text-sm font-semibold text-secondary-800">Categories shown in menu</h3>
        <p className="text-xs text-secondary-500 mt-1">Leave all unchecked to show all categories.</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-secondary-700">
              <input type="checkbox" checked={s.categorySlugs.includes(c.slug)} onChange={(e) => upd("categorySlugs", e.target.checked ? [...s.categorySlugs, c.slug] : s.categorySlugs.filter((sl) => sl !== c.slug))} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500" />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center">
        <button type="button" onClick={() => setS(DEFAULT_SITE_MENU_SETTINGS)} className="btn-outline py-2 text-sm">Reset to Defaults</button>
      </div>
      <SaveBar onSave={() => save({ site_menu_settings: s })} saved={saved} error={error} />
    </div>
  );
}
