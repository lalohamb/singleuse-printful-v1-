"use client";
import ImageUpload from "@/components/ImageUpload";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";

export default function StoreInformation() {
  const { form, set, save, saved, error } = useSettings();

  const handleSave = () => save({
    store_name: form.store_name,
    tagline: form.tagline,
    logo_url: form.logo_url,
    logo_size: form.logo_size,
    footer_logo_url: form.footer_logo_url,
    footer_logo_size: form.footer_logo_size,
    footer_text: form.footer_text,
    footer_bottom_message: form.footer_bottom_message,
    favicon_url: form.favicon_url,
  });

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
      <div className="border-t border-secondary-100 pt-4 space-y-4">
        <p className="font-semibold text-secondary-800">Footer Branding</p>
        <ImageUpload label="Footer Logo" value={form.footer_logo_url || ""} onChange={(url) => set("footer_logo_url", url)} folder="settings/footer-logo" preview={false} />
        <label className="label-text">
          Footer Logo Size: {form.footer_logo_size || 40}px
          <input type="range" min={20} max={160} value={form.footer_logo_size || 40} onChange={(e) => set("footer_logo_size", Number(e.target.value))} className="w-full accent-gold-500" />
        </label>
        <div>
          <label className="label-text">Top Footer Text</label>
          <textarea value={form.footer_text || ""} onChange={(e) => set("footer_text", e.target.value)} className="input-field min-h-[90px]" />
        </div>
        <div>
          <label className="label-text">Bottom Footer Message</label>
          <input value={form.footer_bottom_message || ""} onChange={(e) => set("footer_bottom_message", e.target.value)} placeholder="Made to order. Made with love." className="input-field" />
        </div>
      </div>
      <div className="border-t border-secondary-100 pt-4">
        <ImageUpload label="Favicon" value={form.favicon_url || ""} onChange={(url) => set("favicon_url", url)} folder="settings/logo" preview={false} />
        <p className="text-xs text-secondary-400 mt-1">Use a square PNG or ICO image for browser tabs.</p>
      </div>
      <SaveBar onSave={handleSave} saved={saved} error={error} />
    </div>
  );
}
