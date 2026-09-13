"use client";
import ImageUpload from "@/components/ImageUpload";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";

export default function Footer() {
  const { form, set, save, saved, error } = useSettings();

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <ImageUpload label="Footer Logo" value={form.footer_logo_url || ""} onChange={(url) => set("footer_logo_url", url)} folder="settings/footer-logo" preview={false} />
      <label className="label-text">
        Footer Logo Size: {form.footer_logo_size || 40}px
        <input type="range" min={20} max={160} value={form.footer_logo_size || 40} onChange={(e) => set("footer_logo_size", Number(e.target.value))} className="w-full accent-gold-500" />
      </label>
      <div>
        <label className="label-text">Footer Text</label>
        <textarea value={form.footer_text || ""} onChange={(e) => set("footer_text", e.target.value)} className="input-field min-h-[100px]" />
      </div>
      <div>
        <label className="label-text">Bottom Footer Message</label>
        <input value={form.footer_bottom_message || ""} onChange={(e) => set("footer_bottom_message", e.target.value)} className="input-field" />
      </div>
      <SaveBar onSave={() => save({ footer_logo_url: form.footer_logo_url, footer_logo_size: form.footer_logo_size, footer_text: form.footer_text, footer_bottom_message: form.footer_bottom_message })} saved={saved} error={error} />
    </div>
  );
}
