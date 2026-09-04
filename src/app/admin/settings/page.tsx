"use client";
import { useEffect, useState } from "react";
import { Save, Loader2, Check, Store, Truck, CreditCard, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { StoreSettings } from "@/types";

function Settings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState<Partial<StoreSettings>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewH, setPreviewH] = useState(400);

  useEffect(() => {
    supabase.from("settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) { setSettings(data as StoreSettings); setForm(data as StoreSettings); }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({ store_name: form.store_name, tagline: form.tagline, hero_title: form.hero_title, hero_subtitle: form.hero_subtitle, hero_image_url: form.hero_image_url, story_image_url: form.story_image_url, hero_object_position: form.hero_object_position, announcement: form.announcement, announcement_active: form.announcement_active, shipping_free_threshold: form.shipping_free_threshold, default_shipping_cost: form.default_shipping_cost, printify_shop_id: form.printify_shop_id, updated_at: new Date().toISOString() }).eq("id", settings?.id);
    if (!error) { setSaved(true); setSaveError(null); setTimeout(() => setSaved(false), 2000); }
    else { setSaveError(error.message); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  return (
    <div className="max-w-3xl space-y-8">
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-6"><Store size={22} className="text-primary-500" />Store Information</h2>
        <div className="space-y-4">
          <div><label className="label-text">Store Name</label><input value={form.store_name || ""} onChange={(e) => setForm({ ...form, store_name: e.target.value })} className="input-field" /></div>
          <div><label className="label-text">Tagline</label><input value={form.tagline || ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="input-field" /></div>
        </div>
      </section>
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Homepage Hero</h2>
        <div className="space-y-4">
          <div><label className="label-text">Hero Title</label><input value={form.hero_title || ""} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} className="input-field" /></div>
          <div><label className="label-text">Hero Subtitle</label><textarea value={form.hero_subtitle || ""} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} className="input-field min-h-[80px]" /></div>
          <div><label className="label-text">Hero Image URL</label><input value={form.hero_image_url || ""} onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })} className="input-field" /></div>
          <div>
            <label className="label-text">Hero Image Position</label>
            {(() => {
              const parts = (form.hero_object_position || "0px 0px").replace(/px/g, "").split(" ");
              const x = parseInt(parts[0]) || 0;
              const y = parseInt(parts[1]) || 0;
              const setPos = (nx: number, ny: number) => setForm({ ...form, hero_object_position: `${nx}px ${ny}px` });
              return (
                <div className="space-y-3 mt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-secondary-500 w-16">X: {x}px</span>
                    <input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(parseInt(e.target.value), y)} className="flex-1 accent-gold-500" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-secondary-500 w-16">Y: {y}px</span>
                    <input type="range" min={-1000} max={1000} value={y} onChange={(e) => setPos(x, parseInt(e.target.value))} className="flex-1 accent-gold-500" />
                  </div>
                  <p className="text-xs text-secondary-400">Value: <code>{form.hero_object_position || "0px 0px"}</code></p>
                  <button type="button" onClick={() => setForm({ ...form, hero_object_position: "0px 0px" })} className="text-xs text-red-400 hover:text-red-600">Reset position</button>
                  {form.hero_image_url && <div className="space-y-2"><div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-24">Height: {previewH}px</span><input type="range" min={200} max={800} value={previewH} onChange={(e) => setPreviewH(parseInt(e.target.value))} className="flex-1 accent-gold-500" /></div><div className="relative w-full rounded-lg bg-secondary-100 overflow-hidden" style={{ height: previewH }}><img src={form.hero_image_url} alt="Hero preview" className="w-full h-full object-cover" style={{ objectPosition: form.hero_object_position || "center" }} /><span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span></div></div>}
                </div>
              );
            })()}
          </div>
          <div><label className="label-text">&ldquo;Wear Your Story&rdquo; Background Image URL</label><input value={form.story_image_url || ""} onChange={(e) => setForm({ ...form, story_image_url: e.target.value })} className="input-field" />{form.story_image_url && <img src={form.story_image_url} alt="Story section preview" className="w-full h-auto max-h-none rounded-lg mt-2 bg-secondary-100" />}</div>
        </div>
      </section>
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Announcement Bar</h2>
        <div className="space-y-4">
          <div><label className="label-text">Announcement Text</label><input value={form.announcement || ""} onChange={(e) => setForm({ ...form, announcement: e.target.value })} className="input-field" placeholder="Free shipping on orders over $75!" /></div>
          <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.announcement_active || false} onChange={(e) => setForm({ ...form, announcement_active: e.target.checked })} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" /><span className="text-sm font-medium text-secondary-700">Show announcement bar</span></label>
        </div>
      </section>
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-6"><Truck size={22} className="text-primary-500" />Shipping</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label-text">Free Shipping Threshold ($)</label><input type="number" step="0.01" value={form.shipping_free_threshold || 75} onChange={(e) => setForm({ ...form, shipping_free_threshold: parseFloat(e.target.value) })} className="input-field" /><p className="text-xs text-secondary-400 mt-1">Orders above this amount get free shipping</p></div>
          <div><label className="label-text">Default Shipping Cost ($)</label><input type="number" step="0.01" value={form.default_shipping_cost || 6.99} onChange={(e) => setForm({ ...form, default_shipping_cost: parseFloat(e.target.value) })} className="input-field" /></div>
        </div>
      </section>
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Integrations</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
              <div className="flex items-center gap-3"><Printer size={22} className={settings?.printify_connected ? "text-success-500" : "text-secondary-400"} /><div><p className="font-medium text-secondary-900">Printify</p><p className="text-sm text-secondary-500">Print-on-demand fulfillment</p></div></div>
              <span className={`text-xs px-3 py-1 rounded-full ${settings?.printify_connected ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}>{settings?.printify_connected ? "Connected" : "Not Connected"}</span>
            </div>
          <div><label className="label-text">Printify Shop ID</label><input value={form.printify_shop_id || ""} onChange={(e) => setForm({ ...form, printify_shop_id: e.target.value })} className="input-field" placeholder="e.g. 12345678" /><p className="text-xs text-secondary-400 mt-1">Find this in your Printify dashboard URL or via the API</p></div>
          <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
              <div className="flex items-center gap-3"><CreditCard size={22} className={settings?.stripe_connected ? "text-success-500" : "text-secondary-400"} /><div><p className="font-medium text-secondary-900">Stripe</p><p className="text-sm text-secondary-500">Payment processing</p></div></div>
              <span className={`text-xs px-3 py-1 rounded-full ${settings?.stripe_connected ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}>{settings?.stripe_connected ? "Connected" : "Not Connected"}</span>
            </div>
        </div>
      </section>
      <div className="flex items-center justify-end gap-4 sticky bottom-4">
        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
        <button onClick={handleSave} disabled={saving} className="btn-primary shadow-lg">
          {saving ? <><Loader2 size={20} className="mr-2 animate-spin" />Saving...</> : saved ? <><Check size={20} className="mr-2" />Saved!</> : <><Save size={20} className="mr-2" />Save Settings</>}
        </button>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return <ProtectedAdmin><Settings /></ProtectedAdmin>;
}
