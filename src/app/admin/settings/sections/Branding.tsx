"use client";
import ImageUpload from "@/components/ImageUpload";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";

export default function Branding() {
  const { form, set, save, saved, error } = useSettings();

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <div>
        <label className="label-text">Store Name</label>
        <input value={form.store_name || ""} onChange={(e) => set("store_name", e.target.value)} className="input-field" />
      </div>
      <div>
        <label className="label-text">Tagline</label>
        <input value={form.tagline || ""} onChange={(e) => set("tagline", e.target.value)} className="input-field" />
      </div>
      <ImageUpload label="Logo" value={form.logo_url || ""} onChange={(url) => set("logo_url", url)} folder="settings/logo" preview={false} />
      <label className="label-text">
        Logo Size: {form.logo_size || 40}px
        <input type="range" min={20} max={160} value={form.logo_size || 40} onChange={(e) => set("logo_size", Number(e.target.value))} className="w-full accent-gold-500" />
      </label>
      <SaveBar onSave={() => save({ store_name: form.store_name, tagline: form.tagline, logo_url: form.logo_url, logo_size: form.logo_size })} saved={saved} error={error} />
    </div>
  );
}
