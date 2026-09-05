"use client";
import { useEffect, useState } from "react";
import { Save, Loader2, Check, Store, Truck, CreditCard, Printer, Send, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { StoreSettings } from "@/types";

function StatusBadge({ status }: { status: "checking" | "connected" | "warning" | "disconnected" }) {
  const map = {
    checking: "bg-secondary-100 text-secondary-500",
    connected: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    disconnected: "bg-error-50 text-error-600",
  };
  const labels = { checking: "Checking...", connected: "Connected", warning: "Account Issue", disconnected: "Not Connected" };
  return <span className={`text-xs px-3 py-1 rounded-full ${map[status]}`}>{labels[status]}</span>;
}

function Settings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState<Partial<StoreSettings>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewH, setPreviewH] = useState(400);

  const [stripeOk, setStripeOk] = useState<"checking" | "connected" | "warning" | "disconnected">("checking");
  const [mailerOk, setMailerOk] = useState<"checking" | "connected" | "warning" | "disconnected">("checking");
  const [resendOk, setResendOk] = useState<"checking" | "connected" | "warning" | "disconnected">("checking");

  useEffect(() => {
    supabase.from("settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) { setSettings(data as StoreSettings); setForm(data as StoreSettings); }
      setLoading(false);
    });
    fetch("/api/stripe-admin?action=balance").then((r) => {
      if (r.status === 200) setStripeOk("connected");
      else if (r.status === 401) setStripeOk("disconnected");
      else setStripeOk("warning");
    });
    fetch("/api/mailerlite?action=groups").then((r) => {
      if (r.status === 200) setMailerOk("connected");
      else if (r.status === 401) setMailerOk("disconnected");
      else setMailerOk("warning");
    });
    fetch("/api/resend?path=/domains").then((r) => {
      if (r.status === 200) setResendOk("connected");
      else if (r.status === 401) setResendOk("disconnected");
      else setResendOk("warning");
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({ store_name: form.store_name, tagline: form.tagline, hero_title: form.hero_title, hero_subtitle: form.hero_subtitle, hero_image_url: form.hero_image_url, story_image_url: form.story_image_url, hero_object_position: form.hero_object_position, our_why_image_url: form.our_why_image_url, our_why_object_position: form.our_why_object_position, announcement: form.announcement, announcement_active: form.announcement_active, shipping_free_threshold: form.shipping_free_threshold, default_shipping_cost: form.default_shipping_cost, printify_shop_id: form.printify_shop_id, stripe_connected: form.stripe_connected, updated_at: new Date().toISOString() }).eq("id", settings?.id);
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
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Our Why Section</h2>
        <div className="space-y-4">
          <div><label className="label-text">Image URL</label><input value={form.our_why_image_url || ""} onChange={(e) => setForm({ ...form, our_why_image_url: e.target.value })} className="input-field" placeholder="https://..." /></div>
          <div>
            <label className="label-text">Image Position</label>
            {(() => {
              const parts = (form.our_why_object_position || "0px 0px").replace(/px/g, "").split(" ");
              const x = parseInt(parts[0]) || 0;
              const y = parseInt(parts[1]) || 0;
              const setPos = (nx: number, ny: number) => setForm({ ...form, our_why_object_position: `${nx}px ${ny}px` });
              return (
                <div className="space-y-3 mt-1">
                  <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-16">X: {x}px</span><input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(parseInt(e.target.value), y)} className="flex-1 accent-gold-500" /></div>
                  <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-16">Y: {y}px</span><input type="range" min={-1000} max={1000} value={y} onChange={(e) => setPos(x, parseInt(e.target.value))} className="flex-1 accent-gold-500" /></div>
                  <div className="flex items-center justify-between"><p className="text-xs text-secondary-400">Value: <code>{form.our_why_object_position || "0px 0px"}</code></p><button type="button" onClick={() => setForm({ ...form, our_why_object_position: "0px 0px" })} className="text-xs text-red-400 hover:text-red-600">Reset position</button></div>
                  {form.our_why_image_url && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-24">Height: {previewH}px</span><input type="range" min={200} max={800} value={previewH} onChange={(e) => setPreviewH(parseInt(e.target.value))} className="flex-1 accent-gold-500" /></div>
                      <div className="relative w-full rounded-lg bg-secondary-100 overflow-hidden" style={{ height: previewH }}><img src={form.our_why_image_url} alt="Our Why preview" className="w-full h-full object-cover" style={{ objectPosition: form.our_why_object_position || "center" }} /><span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span></div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
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
              <div className="flex items-center gap-3"><CreditCard size={22} className={stripeOk === "connected" ? "text-success-500" : stripeOk === "warning" ? "text-warning-500" : "text-secondary-400"} /><div><p className="font-medium text-secondary-900">Stripe</p><p className="text-sm text-secondary-500">Payment processing</p></div></div>
              <StatusBadge status={stripeOk} />
            </div>
          <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
              <div className="flex items-center gap-3"><Send size={22} className={mailerOk === "connected" ? "text-success-500" : mailerOk === "warning" ? "text-warning-500" : "text-secondary-400"} /><div><p className="font-medium text-secondary-900">MailerLite</p><p className="text-sm text-secondary-500">Email marketing</p></div></div>
              <StatusBadge status={mailerOk} />
            </div>
          <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
              <div className="flex items-center gap-3"><Mail size={22} className={resendOk === "connected" ? "text-success-500" : resendOk === "warning" ? "text-warning-500" : "text-secondary-400"} /><div><p className="font-medium text-secondary-900">Resend</p><p className="text-sm text-secondary-500">Transactional email</p></div></div>
              <StatusBadge status={resendOk} />
            </div>

          {/* Connection info panel */}
          <div className="mt-2 rounded-lg border border-secondary-100 bg-secondary-50 p-4 space-y-3 text-xs text-secondary-600">
            <p className="font-semibold text-secondary-700 text-sm">Connection Status Guide</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <span><span className="font-medium text-success-600">Connected</span> — API key is valid and active.</span>
              <span><span className="font-medium text-warning-600">Account Issue</span> — Key found but access denied (suspended or missing permissions).</span>
              <span><span className="font-medium text-error-600">Not Connected</span> — API key is missing or invalid.</span>
              <span><span className="font-medium text-secondary-500">Checking…</span> — Status is being verified on page load.</span>
            </div>
            <div className="border-t border-secondary-200 pt-3 space-y-1">
              <p className="font-semibold text-secondary-700">Where to manage keys</p>
              <ul className="space-y-1 list-none">
                <li><span className="font-medium">Stripe</span> — Set <code className="bg-secondary-100 px-1 rounded">STRIPE_SECRET_KEY</code> in <code className="bg-secondary-100 px-1 rounded">.env.local</code> and as a Supabase secret via <code className="bg-secondary-100 px-1 rounded">supabase secrets set</code>. Manage at <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-primary-600 underline">dashboard.stripe.com/apikeys</a>.</li>
                <li><span className="font-medium">MailerLite</span> — Set <code className="bg-secondary-100 px-1 rounded">MAILER_LITE_API_KEY</code> in <code className="bg-secondary-100 px-1 rounded">.env.local</code>. Generate at <a href="https://dashboard.mailerlite.com/integrations/api" target="_blank" rel="noreferrer" className="text-primary-600 underline">dashboard.mailerlite.com/integrations/api</a>.</li>
                <li><span className="font-medium">Resend</span> — Set <code className="bg-secondary-100 px-1 rounded">RESEND_API_KEY</code> in <code className="bg-secondary-100 px-1 rounded">.env.local</code>. Manage at <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-primary-600 underline">resend.com/api-keys</a>. Sending domain must be verified.</li>
                <li><span className="font-medium">Printify</span> — Status is read from the database. Update <code className="bg-secondary-100 px-1 rounded">PRINTIFY_API_TOKEN</code> in <code className="bg-secondary-100 px-1 rounded">.env.local</code> and set the Shop ID above.</li>
              </ul>
            </div>
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
