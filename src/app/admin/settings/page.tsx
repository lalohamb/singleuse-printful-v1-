"use client";
import { useEffect, useState } from "react";
import { Save, Loader2, Check, Store, CreditCard, Printer, Send, Mail, Share2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import type { StoreSettings } from "@/types";

type SocialKey = keyof StoreSettings["social_links"];

const SOCIAL_META: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram",  placeholder: "https://instagram.com/yourhandle" },
  { key: "tiktok",    label: "TikTok",     placeholder: "https://tiktok.com/@yourhandle" },
  { key: "facebook",  label: "Facebook",   placeholder: "https://facebook.com/yourpage" },
  { key: "youtube",   label: "YouTube",    placeholder: "https://youtube.com/@yourchannel" },
  { key: "pinterest", label: "Pinterest",  placeholder: "https://pinterest.com/yourprofile" },
  { key: "snapchat",  label: "Snapchat",   placeholder: "https://snapchat.com/add/yourhandle" },
  { key: "threads",   label: "Threads",    placeholder: "https://threads.net/@yourhandle" },
  { key: "email",     label: "Email",      placeholder: "mailto:hello@yourdomain.com" },
];

const DEFAULT_TESTIMONIALS: NonNullable<StoreSettings["testimonials"]> = [
  { quote: "I wore my shirt to a family reunion and got so many compliments. This brand truly gets us.", name: "Jasmine T.", location: "Atlanta, GA", product: "Culture First Tee" },
  { quote: "The quality is unmatched. Soft, true to size, and the design is everything. Will be ordering again.", name: "Marcus W.", location: "Houston, TX", product: "Faith Over Fear Hoodie" },
  { quote: "Finally a brand that celebrates who we are. Every piece feels intentional and powerful.", name: "Aaliyah R.", location: "Chicago, IL", product: "Heritage Collection" },
];

const DEFAULT_SOCIAL: StoreSettings["social_links"] = {
  instagram: { url: "https://instagram.com/body_and_sleeves", enabled: true },
  tiktok:    { url: "https://tiktok.com/@bodyandsleeves",      enabled: true },
  facebook:  { url: "https://facebook.com/bodyandsleeves",     enabled: true },
  youtube:   { url: "https://youtube.com/@bodyandsleeves",     enabled: true },
  pinterest: { url: "https://pinterest.com/bodyandsleeves",    enabled: true },
  snapchat:  { url: "https://snapchat.com/add/bodyandsleeves", enabled: true },
  threads:   { url: "https://threads.net/@bodyandsleeves",     enabled: true },
  email:     { url: "mailto:Hello.BodyandSleeves@gmail.com",   enabled: true },
};
import { supabase } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import ImageUpload from "@/components/ImageUpload";

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

const WEBHOOK_URL = "https://SUPABASE_PROJECT_REF_REDACTED.supabase.co/functions/v1/stripe-webhook";

function StripeConfigSection({ stripeOk }: { stripeOk: "checking" | "connected" | "warning" | "disconnected" }) {
  const [secretKey, setSecretKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const isLiveKey = secretKey.startsWith("sk_live");
  const isTestKey = secretKey.startsWith("sk_test");

  const handleSave = async () => {
    if (!secretKey) return;
    setSaving(true); setResult(null);
    try {
      const res = await fetch("/api/stripe-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register_webhook", secret_key: secretKey, webhook_url: WEBHOOK_URL }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({
        type: "success",
        msg: `Webhook registered! Copy this signing secret and set it as STRIPE_WEBHOOK_SECRET in your Supabase secrets: ${data.signing_secret}`,
      });
    } catch (e: any) {
      setResult({ type: "error", msg: e.message });
    }
    setSaving(false);
  };

  return (
    <div className="border border-secondary-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-secondary-50">
        <div className="flex items-center gap-3">
          <CreditCard size={22} className={stripeOk === "connected" ? "text-success-500" : stripeOk === "warning" ? "text-warning-500" : "text-secondary-400"} />
          <div>
            <p className="font-medium text-secondary-900">Stripe</p>
            <p className="text-sm text-secondary-500">Payment processing</p>
          </div>
        </div>
        <StatusBadge status={stripeOk} />
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="label-text">Secret Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={secretKey}
              onChange={(e) => { setSecretKey(e.target.value); setResult(null); }}
              placeholder="sk_test_... or sk_live_..."
              className="input-field pr-10"
            />
            <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-3 top-2.5 text-secondary-400 hover:text-secondary-700">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {secretKey && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${isLiveKey ? "text-success-600" : isTestKey ? "text-amber-600" : "text-error-600"}`}>
              {isLiveKey ? "✓ Live key — real payments" : isTestKey ? "⚠ Test key — no real money" : "✗ Invalid key format"}
            </p>
          )}
        </div>
        <p className="text-xs text-secondary-500">Entering a key will register the webhook endpoint automatically. The signing secret will be shown — copy it and run: <code className="bg-secondary-100 px-1 rounded">npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref SUPABASE_PROJECT_REF_REDACTED</code></p>
        {result && (
          <div className={`rounded-lg p-3 text-xs ${result.type === "success" ? "bg-success-50 border border-success-200 text-success-800" : "bg-error-50 border border-error-100 text-error-700"}`}>
            {result.type === "success" && <p className="font-semibold mb-1">✓ Webhook registered successfully</p>}
            <p className="break-all">{result.msg}</p>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving || (!isLiveKey && !isTestKey)}
          className="btn-primary py-2 text-sm"
        >
          {saving ? <><Loader2 size={15} className="mr-2 animate-spin" />Registering...</> : "Save Key & Register Webhook"}
        </button>
      </div>
    </div>
  );
}

function Settings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState<Partial<StoreSettings>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [social, setSocial] = useState<StoreSettings["social_links"]>(DEFAULT_SOCIAL);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialSaved, setSocialSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [heroPreviewH, setHeroPreviewH] = useState(400);
  const [ourWhyPreviewH, setOurWhyPreviewH] = useState(400);
  const [showHeroPicker, setShowHeroPicker] = useState(false);
  const [showOurWhyPicker, setShowOurWhyPicker] = useState(false);

  const [stripeOk, setStripeOk] = useState<"checking" | "connected" | "warning" | "disconnected">("checking");
  const [mailerOk, setMailerOk] = useState<"checking" | "connected" | "warning" | "disconnected">("checking");
  const [resendOk, setResendOk] = useState<"checking" | "connected" | "warning" | "disconnected">("checking");

  useEffect(() => {
    supabase.from("settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setSettings(data as StoreSettings);
        const envShopId = process.env.NEXT_PUBLIC_PRINTIFY_SHOP_ID;
        setForm({ ...data as StoreSettings, printify_shop_id: (data as StoreSettings).printify_shop_id || envShopId || "" });
        if (data.social_links) setSocial(data.social_links as StoreSettings["social_links"]);
        if (data.hero_height_vh) setHeroPreviewH(data.hero_height_vh);
        if (data.our_why_height_vh) setOurWhyPreviewH(data.our_why_height_vh);
      }
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
    const { error } = await supabase.from("settings").update({ store_name: form.store_name, tagline: form.tagline, logo_url: form.logo_url, logo_size: form.logo_size ?? 40, hero_title: form.hero_title, hero_subtitle: form.hero_subtitle, hero_image_url: form.hero_image_url, story_image_url: form.story_image_url, story_object_position: form.story_object_position, story_image_scale: form.story_image_scale ?? 100, story_image_flip: form.story_image_flip, story_image_fit: form.story_image_fit ?? "cover", story_gradient_opacity: form.story_gradient_opacity ?? 40, story_gradient_dir: form.story_gradient_dir ?? "full", hero_object_position: form.hero_object_position, hero_height_vh: heroPreviewH, hero_image_flip: form.hero_image_flip, hero_image_scale: form.hero_image_scale ?? 100, hero_gradient_opacity: form.hero_gradient_opacity ?? 70, hero_gradient_dir: form.hero_gradient_dir ?? "left", hero_image_fit: form.hero_image_fit ?? "cover", our_why_image_url: form.our_why_image_url, our_why_object_position: form.our_why_object_position, our_why_height_vh: ourWhyPreviewH, our_why_label: form.our_why_label, our_why_quote: form.our_why_quote, our_why_body: form.our_why_body, our_why_image_scale: form.our_why_image_scale ?? 100, our_why_image_flip: form.our_why_image_flip, our_why_image_fit: form.our_why_image_fit ?? "cover", our_why_gradient_opacity: form.our_why_gradient_opacity ?? 70, our_why_gradient_dir: form.our_why_gradient_dir ?? "left", announcement: form.announcement, announcement_active: form.announcement_active, promo_banner_active: form.promo_banner_active ?? false, promo_banner_title: form.promo_banner_title, promo_banner_body: form.promo_banner_body, promo_banner_cta_label: form.promo_banner_cta_label, promo_banner_cta_url: form.promo_banner_cta_url, promo_banner_bg_color: form.promo_banner_bg_color, shipping_free_threshold: form.shipping_free_threshold, default_shipping_cost: form.default_shipping_cost, printify_shop_id: form.printify_shop_id, stripe_connected: form.stripe_connected, testimonials: form.testimonials ?? DEFAULT_TESTIMONIALS, updated_at: new Date().toISOString() }).eq("id", settings?.id);
    if (!error) { setSaved(true); setSaveError(null); setTimeout(() => setSaved(false), 2000); }
    else { setSaveError(error.message); }
    setSaving(false);
  };

  const handleSocialSave = async () => {
    setSocialSaving(true);
    const { error } = await supabase.from("settings").update({ social_links: social, updated_at: new Date().toISOString() }).eq("id", settings?.id);
    if (!error) { setSocialSaved(true); setTimeout(() => setSocialSaved(false), 2000); }
    setSocialSaving(false);
  };

  const setSocialField = (key: SocialKey, field: "url" | "enabled", value: string | boolean) =>
    setSocial((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  return (
    <div className="max-w-3xl space-y-8">
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-6"><Store size={22} className="text-primary-500" />Store Information</h2>
        <div className="space-y-4">
          <div><label className="label-text">Store Name</label><input value={form.store_name || ""} onChange={(e) => setForm({ ...form, store_name: e.target.value })} className="input-field" /></div>
          <div><label className="label-text">Tagline</label><input value={form.tagline || ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="input-field" /></div>
          <ImageUpload label="Logo" value={form.logo_url || ""} onChange={(url) => setForm({ ...form, logo_url: url })} folder="settings/logo" preview={false} />
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 h-12 flex items-center justify-center bg-secondary-50 rounded-lg px-4 border border-secondary-100">
              <img src={form.logo_url || "/logo.png"} alt="Logo preview" style={{ height: `${form.logo_size ?? 40}px`, width: "auto" }} />
            </div>
            <div className="flex-1">
              <label className="label-text">Logo Size: {form.logo_size ?? 40}px</label>
              <input type="range" min={20} max={80} value={form.logo_size ?? 40} onChange={(e) => setForm({ ...form, logo_size: parseInt(e.target.value) })} className="w-full accent-gold-500 mt-1" />
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Announcement Bar</h2>
        <div className="space-y-4">
          <div><label className="label-text">Announcement Text</label><input value={form.announcement || ""} onChange={(e) => setForm({ ...form, announcement: e.target.value })} className="input-field" placeholder="Free shipping on orders over $75!" /></div>
          <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.announcement_active || false} onChange={(e) => setForm({ ...form, announcement_active: e.target.checked })} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" /><span className="text-sm font-medium text-secondary-700">Show announcement bar</span></label>

          <div className="border-t border-secondary-100 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-secondary-800">Promotional Drop Banner</p>
                <p className="text-xs text-secondary-400 mt-0.5">Drops from the top on homepage load. Shown max 2× per session. User can dismiss.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.promo_banner_active || false} onChange={(e) => setForm({ ...form, promo_banner_active: e.target.checked })} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
                <span className="text-sm font-medium text-secondary-700">Active</span>
              </label>
            </div>
            <div><label className="label-text">Headline</label><input value={form.promo_banner_title || ""} onChange={(e) => setForm({ ...form, promo_banner_title: e.target.value })} className="input-field" placeholder="🔥 Limited Drop — 20% Off This Weekend Only" /></div>
            <div><label className="label-text">Body Text</label><input value={form.promo_banner_body || ""} onChange={(e) => setForm({ ...form, promo_banner_body: e.target.value })} className="input-field" placeholder="Use code CULTURE20 at checkout. Ends Sunday." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-text">CTA Button Label</label><input value={form.promo_banner_cta_label || ""} onChange={(e) => setForm({ ...form, promo_banner_cta_label: e.target.value })} className="input-field" placeholder="Shop the Drop" /></div>
              <div><label className="label-text">CTA URL</label><input value={form.promo_banner_cta_url || ""} onChange={(e) => setForm({ ...form, promo_banner_cta_url: e.target.value })} className="input-field" placeholder="/shop" /></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1"><label className="label-text">Banner Background Color</label><input type="color" value={form.promo_banner_bg_color || "#1a1a1a"} onChange={(e) => setForm({ ...form, promo_banner_bg_color: e.target.value })} className="mt-1 h-10 w-full rounded border border-secondary-200 cursor-pointer" /></div>
              <div className="flex-shrink-0 rounded-lg overflow-hidden border border-secondary-100" style={{ backgroundColor: form.promo_banner_bg_color || "#1a1a1a", minWidth: 160, padding: "10px 16px" }}>
                <p className="text-white font-bold text-xs truncate">{form.promo_banner_title || "Headline preview"}</p>
                {form.promo_banner_body && <p className="text-white/70 text-[10px] mt-0.5 truncate">{form.promo_banner_body}</p>}
                {form.promo_banner_cta_label && <span className="inline-block mt-1.5 px-3 py-0.5 rounded-full bg-white text-secondary-900 text-[10px] font-semibold">{form.promo_banner_cta_label}</span>}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Homepage Hero</h2>
        <div className="space-y-4">
          <div><label className="label-text">Hero Title</label><input value={form.hero_title || ""} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} className="input-field" /></div>
          <div><label className="label-text">Hero Subtitle</label><textarea value={form.hero_subtitle || ""} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} className="input-field min-h-[80px]" /></div>
          <ImageUpload label="Hero Image URL" value={form.hero_image_url || ""} onChange={(url) => setForm({ ...form, hero_image_url: url })} folder="settings/hero" preview={false} />
          <button type="button" onClick={() => setShowHeroPicker(true)} className="btn-outline py-2 text-sm">📷 Pick from Product Library</button>
          {showHeroPicker && <ProductImagePicker onSelect={(url) => { setForm({ ...form, hero_image_url: url }); setShowHeroPicker(false); }} onClose={() => setShowHeroPicker(false)} />}
          <div>
            <label className="label-text">Hero Image Position</label>
            {(() => {
              const parts = (form.hero_object_position || "0px 0px").replace(/px/g, "").split(" ");
              const x = parseInt(parts[0]) || 0;
              const y = parseInt(parts[1]) || 0;
              const setPos = (nx: number, ny: number) => setForm({ ...form, hero_object_position: `${nx}px ${ny}px` });
              const op = (form.hero_gradient_opacity ?? 70) / 100;
              const dir = form.hero_gradient_dir ?? "left";
              const gradMap: Record<string, string> = {
                left:   `linear-gradient(to right, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op * 0.6}) 50%, transparent 100%)`,
                right:  `linear-gradient(to left, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op * 0.6}) 50%, transparent 100%)`,
                center: `linear-gradient(to bottom, rgba(17,17,17,${op * 0.6}) 0%, rgba(17,17,17,${op}) 50%, rgba(17,17,17,${op * 0.6}) 100%)`,
                top:    `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
                bottom: `linear-gradient(to top, rgba(17,17,17,${op}) 0%, transparent 100%)`,
                full:   `rgba(17,17,17,${op})`,
                none:   `transparent`,
              };
              const previewGradient = gradMap[dir] ?? "transparent";
              return (
                <div className="space-y-3 mt-1">
                  {/* X slider above preview */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-secondary-500 w-16 flex-shrink-0">X: {x}px</span>
                    <input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(parseInt(e.target.value), y)} className="flex-1 accent-gold-500" />
                  </div>

                  {form.hero_image_url && (
                    <div className="flex gap-2 items-stretch">
                      <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                        <span className="text-[10px] text-secondary-400">▲</span>
                        <input type="range" min={30} max={100} value={heroPreviewH} onChange={(e) => setHeroPreviewH(parseInt(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
                        <span className="text-[10px] text-secondary-400">▼</span>
                        <span className="text-[10px] text-secondary-500 mt-1">{heroPreviewH}vh</span>
                      </div>
                      {/* live preview */}
                      <div className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: heroPreviewH * 4 }}>
                        <img src={form.hero_image_url} alt="Hero preview" className={`absolute inset-0 w-full h-full ${form.hero_image_fit === "contain" ? "object-contain" : (form.hero_image_scale ?? 100) === 100 ? "object-cover" : "object-contain"}`} style={{ objectPosition: form.hero_object_position || "center", transform: form.hero_image_flip ? "scaleX(-1)" : undefined, scale: `${form.hero_image_scale ?? 100}%` }} />
                        <div className="absolute inset-0" style={{ background: previewGradient }} />
                        <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span>
                      </div>
                      {/* Y vertical slider to the right */}
                      <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                        <span className="text-[10px] text-secondary-400">▲</span>
                        <input type="range" min={-1000} max={1000} value={y} onChange={(e) => setPos(x, parseInt(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
                        <span className="text-[10px] text-secondary-400">▼</span>
                        <span className="text-[10px] text-secondary-500 mt-1">{y}px</span>
                      </div>
                    </div>
                  )}

                  {/* Height control below preview */}

                  {form.hero_image_url && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Zoom: {form.hero_image_scale ?? 100}%</span>
                      <input type="range" min={10} max={100} value={form.hero_image_scale ?? 100} onChange={(e) => setForm({ ...form, hero_image_scale: parseInt(e.target.value) })} className="flex-1 accent-gold-500" />
                    </div>
                  )}

                  {form.hero_image_url && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Overlay: {form.hero_gradient_opacity ?? 70}%</span>
                      <input type="range" min={0} max={100} value={form.hero_gradient_opacity ?? 70} onChange={(e) => setForm({ ...form, hero_gradient_opacity: parseInt(e.target.value) })} className="flex-1 accent-gold-500" />
                    </div>
                  )}

                  {form.hero_image_url && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Gradient</span>
                      <div className="flex gap-1 flex-wrap">
                        {(["left", "right", "center", "top", "bottom", "full", "none"] as const).map((d) => (
                          <button key={d} type="button" onClick={() => setForm({ ...form, hero_gradient_dir: d })} className={`text-xs px-2 py-1 rounded border transition-colors capitalize ${(form.hero_gradient_dir ?? "left") === d ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>{d}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.hero_image_url && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Fit</span>
                      <div className="flex gap-1">
                        {(["cover", "contain"] as const).map((f) => (
                          <button key={f} type="button" onClick={() => setForm({ ...form, hero_image_fit: f })} className={`text-xs px-2 py-1 rounded border transition-colors capitalize ${(form.hero_image_fit ?? "cover") === f ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>{f}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-secondary-400">Position: <code>{form.hero_object_position || "0px 0px"}</code></p>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setForm({ ...form, hero_image_flip: !form.hero_image_flip })} className={`text-xs px-2 py-1 rounded border transition-colors ${form.hero_image_flip ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>⇄ Flip</button>
                      <button type="button" onClick={() => { setForm({ ...form, hero_object_position: "center", hero_image_scale: 100, hero_image_flip: false, hero_gradient_opacity: 70, hero_gradient_dir: "left", hero_image_fit: "cover" }); setHeroPreviewH(70); }} className="btn-outline py-2 text-sm">Reset</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Our Why Section</h2>
        <div className="space-y-4">
          <div><label className="label-text">Label (above quote)</label><input value={form.our_why_label || ""} onChange={(e) => setForm({ ...form, our_why_label: e.target.value })} className="input-field" placeholder="Our Why" /></div>
          <div><label className="label-text">Quote</label><input value={form.our_why_quote || ""} onChange={(e) => setForm({ ...form, our_why_quote: e.target.value })} className="input-field" placeholder="We don't just sell clothes. We tell stories." /></div>
          <div><label className="label-text">Body Text</label><textarea value={form.our_why_body || ""} onChange={(e) => setForm({ ...form, our_why_body: e.target.value })} className="input-field min-h-[80px]" placeholder="Body & Sleeves was born from..." /></div>
          <ImageUpload label="Image URL" value={form.our_why_image_url || ""} onChange={(url) => setForm({ ...form, our_why_image_url: url })} folder="settings/our-why" preview={false} />
          <button type="button" onClick={() => setShowOurWhyPicker(true)} className="btn-outline py-2 text-sm">📷 Pick from Product Library</button>
          {showOurWhyPicker && <ProductImagePicker onSelect={(url) => { setForm({ ...form, our_why_image_url: url }); setShowOurWhyPicker(false); }} onClose={() => setShowOurWhyPicker(false)} />}
          <div>
            <label className="label-text">Image Position</label>
            {(() => {
              const parts = (form.our_why_object_position || "0px 0px").replace(/px/g, "").split(" ");
              const x = parseInt(parts[0]) || 0;
              const y = parseInt(parts[1]) || 0;
              const setPos = (nx: number, ny: number) => setForm({ ...form, our_why_object_position: `${nx}px ${ny}px` });
              const op = (form.our_why_gradient_opacity ?? 70) / 100;
              const dir = form.our_why_gradient_dir ?? "left";
              const gradMap: Record<string, string> = {
                left:   `linear-gradient(to right, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op * 0.6}) 50%, transparent 100%)`,
                right:  `linear-gradient(to left, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op * 0.6}) 50%, transparent 100%)`,
                center: `linear-gradient(to bottom, rgba(17,17,17,${op * 0.6}) 0%, rgba(17,17,17,${op}) 50%, rgba(17,17,17,${op * 0.6}) 100%)`,
                top:    `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
                bottom: `linear-gradient(to top, rgba(17,17,17,${op}) 0%, transparent 100%)`,
                full:   `rgba(17,17,17,${op})`,
                none:   `transparent`,
              };
              const previewGradient = gradMap[dir] ?? "transparent";
              return (
                <div className="space-y-3 mt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-secondary-500 w-16 flex-shrink-0">X: {x}px</span>
                    <input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(parseInt(e.target.value), y)} className="flex-1 accent-gold-500" />
                  </div>
                  {form.our_why_image_url && (
                    <div className="flex gap-2 items-stretch">
                      <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                        <span className="text-[10px] text-secondary-400">▲</span>
                        <input type="range" min={200} max={800} value={ourWhyPreviewH} onChange={(e) => setOurWhyPreviewH(parseInt(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
                        <span className="text-[10px] text-secondary-400">▼</span>
                        <span className="text-[10px] text-secondary-500 mt-1">{ourWhyPreviewH}px</span>
                      </div>
                      <div className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: ourWhyPreviewH / 2 }}>
                        <img src={form.our_why_image_url} alt="Our Why preview" className={`absolute inset-0 w-full h-full ${form.our_why_image_fit === "contain" ? "object-contain" : (form.our_why_image_scale ?? 100) === 100 ? "object-cover" : "object-contain"}`} style={{ objectPosition: form.our_why_object_position || "center", transform: form.our_why_image_flip ? "scaleX(-1)" : undefined, scale: `${form.our_why_image_scale ?? 100}%` }} />
                        <div className="absolute inset-0" style={{ background: previewGradient }} />
                        <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                        <span className="text-[10px] text-secondary-400">▲</span>
                        <input type="range" min={-1000} max={1000} value={y} onChange={(e) => setPos(x, parseInt(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
                        <span className="text-[10px] text-secondary-400">▼</span>
                        <span className="text-[10px] text-secondary-500 mt-1">{y}px</span>
                      </div>
                    </div>
                  )}
                  {form.our_why_image_url && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Zoom: {form.our_why_image_scale ?? 100}%</span>
                      <input type="range" min={10} max={100} value={form.our_why_image_scale ?? 100} onChange={(e) => setForm({ ...form, our_why_image_scale: parseInt(e.target.value) })} className="flex-1 accent-gold-500" />
                    </div>
                  )}
                  {form.our_why_image_url && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Overlay: {form.our_why_gradient_opacity ?? 70}%</span>
                      <input type="range" min={0} max={100} value={form.our_why_gradient_opacity ?? 70} onChange={(e) => setForm({ ...form, our_why_gradient_opacity: parseInt(e.target.value) })} className="flex-1 accent-gold-500" />
                    </div>
                  )}
                  {form.our_why_image_url && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Gradient</span>
                      <div className="flex gap-1 flex-wrap">
                        {(["left", "right", "center", "top", "bottom", "full", "none"] as const).map((d) => (
                          <button key={d} type="button" onClick={() => setForm({ ...form, our_why_gradient_dir: d })} className={`text-xs px-2 py-1 rounded border transition-colors capitalize ${(form.our_why_gradient_dir ?? "left") === d ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>{d}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {form.our_why_image_url && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Fit</span>
                      <div className="flex gap-1">
                        {(["cover", "contain"] as const).map((f) => (
                          <button key={f} type="button" onClick={() => setForm({ ...form, our_why_image_fit: f })} className={`text-xs px-2 py-1 rounded border transition-colors capitalize ${(form.our_why_image_fit ?? "cover") === f ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>{f}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-secondary-400">Position: <code>{form.our_why_object_position || "0px 0px"}</code></p>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setForm({ ...form, our_why_image_flip: !form.our_why_image_flip })} className={`text-xs px-2 py-1 rounded border transition-colors ${form.our_why_image_flip ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>⇄ Flip</button>
                      <button type="button" onClick={() => setForm({ ...form, our_why_object_position: "0px 0px", our_why_image_scale: 100, our_why_image_flip: false, our_why_gradient_opacity: 70, our_why_gradient_dir: "left", our_why_image_fit: "cover" })} className="btn-outline py-2 text-sm">Reset</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Wear Your Story Section</h2>
        <div className="space-y-4">
          <ImageUpload label="Background Image URL" value={form.story_image_url || ""} onChange={(url) => setForm({ ...form, story_image_url: url })} folder="settings/story" preview={false} />
          {(() => {
            const parts = (form.story_object_position || "0px 0px").replace(/px/g, "").split(" ");
            const x = parseInt(parts[0]) || 0;
            const y = parseInt(parts[1]) || 0;
            const setPos = (nx: number, ny: number) => setForm({ ...form, story_object_position: `${nx}px ${ny}px` });
            const op = (form.story_gradient_opacity ?? 40) / 100;
            const dir = form.story_gradient_dir ?? "full";
            const gradMap: Record<string, string> = {
              left:   `linear-gradient(to right, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op * 0.6}) 50%, transparent 100%)`,
              right:  `linear-gradient(to left, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op * 0.6}) 50%, transparent 100%)`,
              center: `linear-gradient(to bottom, rgba(17,17,17,${op * 0.6}) 0%, rgba(17,17,17,${op}) 50%, rgba(17,17,17,${op * 0.6}) 100%)`,
              top:    `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
              bottom: `linear-gradient(to top, rgba(17,17,17,${op}) 0%, transparent 100%)`,
              full:   `rgba(17,17,17,${op})`,
              none:   `transparent`,
            };
            const previewGradient = gradMap[dir] ?? "transparent";
            return (
              <div className="space-y-3 mt-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary-500 w-16 flex-shrink-0">X: {x}px</span>
                  <input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(parseInt(e.target.value), y)} className="flex-1 accent-gold-500" />
                </div>
                <div className="flex gap-2 items-stretch">
                  <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                    <span className="text-[10px] text-secondary-400">▲</span>
                    <input type="range" min={10} max={200} value={form.story_image_scale ?? 100} onChange={(e) => setForm({ ...form, story_image_scale: parseInt(e.target.value) })} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
                    <span className="text-[10px] text-secondary-400">▼</span>
                    <span className="text-[10px] text-secondary-500 mt-1">{form.story_image_scale ?? 100}%</span>
                  </div>
                  <div className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: 200 }}>
                    {form.story_image_url && <img src={form.story_image_url} alt="Story preview" className={`absolute inset-0 w-full h-full ${form.story_image_fit === "contain" ? "object-contain" : "object-cover"}`} style={{ objectPosition: form.story_object_position || "center", transform: form.story_image_flip ? "scaleX(-1)" : undefined, scale: `${form.story_image_scale ?? 100}%` }} />}
                    <div className="absolute inset-0" style={{ background: previewGradient }} />
                    <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                    <span className="text-[10px] text-secondary-400">▲</span>
                    <input type="range" min={-1000} max={1000} value={y} onChange={(e) => setPos(x, parseInt(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
                    <span className="text-[10px] text-secondary-400">▼</span>
                    <span className="text-[10px] text-secondary-500 mt-1">{y}px</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Overlay: {form.story_gradient_opacity ?? 40}%</span>
                  <input type="range" min={0} max={100} value={form.story_gradient_opacity ?? 40} onChange={(e) => setForm({ ...form, story_gradient_opacity: parseInt(e.target.value) })} className="flex-1 accent-gold-500" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Gradient</span>
                  <div className="flex gap-1 flex-wrap">
                    {(["left", "right", "center", "top", "bottom", "full", "none"] as const).map((d) => (
                      <button key={d} type="button" onClick={() => setForm({ ...form, story_gradient_dir: d })} className={`text-xs px-2 py-1 rounded border transition-colors capitalize ${(form.story_gradient_dir ?? "full") === d ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary-500 w-24 flex-shrink-0">Fit</span>
                  <div className="flex gap-1">
                    {(["cover", "contain"] as const).map((f) => (
                      <button key={f} type="button" onClick={() => setForm({ ...form, story_image_fit: f })} className={`text-xs px-2 py-1 rounded border transition-colors capitalize ${(form.story_image_fit ?? "cover") === f ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-secondary-400">Position: <code>{form.story_object_position || "0px 0px"}</code></p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setForm({ ...form, story_image_flip: !form.story_image_flip })} className={`text-xs px-2 py-1 rounded border transition-colors ${form.story_image_flip ? "bg-gold-500 border-gold-500 text-white" : "border-secondary-300 text-secondary-500 hover:border-secondary-400"}`}>⇄ Flip</button>
                    <button type="button" onClick={() => setForm({ ...form, story_object_position: "0px 0px", story_image_scale: 100, story_image_flip: false, story_gradient_opacity: 40, story_gradient_dir: "full", story_image_fit: "cover" })} className="btn-outline py-2 text-sm">Reset</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-6">Customer Love</h2>
        <p className="text-sm text-secondary-500 mb-6">Edit the three testimonials shown in the &ldquo;What the Culture is Saying&rdquo; section.</p>
        <div className="space-y-6">
          {(form.testimonials ?? DEFAULT_TESTIMONIALS).map((t, i) => (
            <div key={i} className="space-y-3 p-4 bg-secondary-50 rounded-lg">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Review {i + 1}</p>
              <div><label className="label-text">Quote</label><textarea value={t.quote} onChange={(e) => { const next = [...(form.testimonials ?? DEFAULT_TESTIMONIALS)]; next[i] = { ...next[i], quote: e.target.value }; setForm({ ...form, testimonials: next }); }} className="input-field min-h-[80px]" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label-text">Name</label><input value={t.name} onChange={(e) => { const next = [...(form.testimonials ?? DEFAULT_TESTIMONIALS)]; next[i] = { ...next[i], name: e.target.value }; setForm({ ...form, testimonials: next }); }} className="input-field" /></div>
                <div><label className="label-text">Location</label><input value={t.location} onChange={(e) => { const next = [...(form.testimonials ?? DEFAULT_TESTIMONIALS)]; next[i] = { ...next[i], location: e.target.value }; setForm({ ...form, testimonials: next }); }} className="input-field" /></div>
                <div><label className="label-text">Product</label><input value={t.product} onChange={(e) => { const next = [...(form.testimonials ?? DEFAULT_TESTIMONIALS)]; next[i] = { ...next[i], product: e.target.value }; setForm({ ...form, testimonials: next }); }} className="input-field" /></div>
              </div>
            </div>
          ))}
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
          <StripeConfigSection stripeOk={stripeOk} />
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
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-2"><Share2 size={22} className="text-primary-500" />Social Media</h2>
        <p className="text-sm text-secondary-500 mb-6">Toggle and update the social links shown in the footer. Disabled icons are hidden from visitors.</p>
        <div className="space-y-3">
          {SOCIAL_META.map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
              <button
                type="button"
                onClick={() => setSocialField(key, "enabled", !social[key]?.enabled)}
                className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${social[key]?.enabled ? "bg-primary-500" : "bg-secondary-200"}`}
                aria-label={`Toggle ${label}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${social[key]?.enabled ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <span className={`text-sm font-medium w-20 flex-shrink-0 ${social[key]?.enabled ? "text-secondary-900" : "text-secondary-400"}`}>{label}</span>
              <input
                value={social[key]?.url || ""}
                onChange={(e) => setSocialField(key, "url", e.target.value)}
                placeholder={placeholder}
                disabled={!social[key]?.enabled}
                className="input-field flex-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              />
              {social[key]?.url && social[key]?.enabled && (
                <a href={social[key].url} target="_blank" rel="noreferrer" className="text-secondary-400 hover:text-primary-500 transition-colors flex-shrink-0" title="Preview link">
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={handleSocialSave} disabled={socialSaving} className="btn-primary">
            {socialSaving ? <><Loader2 size={18} className="mr-2 animate-spin" />Saving...</> : socialSaved ? <><Check size={18} className="mr-2" />Saved!</> : <><Save size={18} className="mr-2" />Save Social Links</>}
          </button>
        </div>
      </section>

      <div className="flex items-center justify-end gap-4 sticky bottom-4">
        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
        <button onClick={handleSave} disabled={saving} className={`shadow-lg btn-primary transition-colors duration-300 ${saved ? "!bg-success-600 !border-success-600 hover:!bg-success-700" : ""}`}>
          {saving ? <><Loader2 size={20} className="mr-2 animate-spin" />Saving...</> : saved ? <><Check size={20} className="mr-2" />Saved!</> : <><Save size={20} className="mr-2" />Save Settings</>}
        </button>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return <ProtectedAdmin><Settings /></ProtectedAdmin>;
}

function ProductImagePicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [products, setProducts] = useState<{ title: string; image_url: string | null }[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    supabase.from("products").select("title, image_url").eq("status", "active").then(({ data }) => {
      if (data) setProducts(data as { title: string; image_url: string | null }[]);
    });
  }, []);
  const filtered = products.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()) && p.image_url);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-secondary-100">
          <h3 className="font-semibold text-secondary-900">Pick a Product Image</h3>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-4 border-b border-secondary-100">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="input-field" />
        </div>
        <div className="overflow-y-auto p-4 grid grid-cols-5 gap-2">
          {filtered.map((p, i) => (
            <button key={i} type="button" title={p.title} onClick={() => onSelect(p.image_url!)} className="aspect-square rounded-lg border-2 border-transparent hover:border-gold-500 transition-colors p-1">
              <img src={p.image_url!} alt={p.title} className="w-full h-full object-cover rounded" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
