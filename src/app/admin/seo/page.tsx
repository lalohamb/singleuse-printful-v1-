"use client";
import { useEffect, useState } from "react";
import { Save, Loader2, Check, Search, Globe, FileText, Code2, Link2, Map, Bot, ExternalLink, RefreshCw } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

interface SeoSettings {
  site_url: string;
  default_og_image: string;
  sitemap_enabled: boolean;
  robots_noindex_admin: boolean;
  jsonld_enabled: boolean;
  canonical_enabled: boolean;
  meta_title_suffix: string;
  twitter_handle: string;
  google_site_verification: string;
  updated_at: string;
}

type StatusType = "idle" | "saving" | "saved" | "error";

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <label className="flex items-start gap-4 cursor-pointer group">
      <div className="relative mt-0.5 flex-shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className={`w-11 h-6 rounded-full transition-colors ${checked ? "bg-primary-500" : "bg-secondary-200"}`} />
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </div>
      <div>
        <p className="font-medium text-secondary-900 text-sm">{label}</p>
        <p className="text-xs text-secondary-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function SeoStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${enabled ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-400"}`}>
      {enabled ? "Active" : "Disabled"}
    </span>
  );
}

function SeoPanel() {
  const [form, setForm] = useState<SeoSettings>({
    site_url: "https://genderapparel.example",
    default_og_image: "",
    sitemap_enabled: true,
    robots_noindex_admin: true,
    jsonld_enabled: true,
    canonical_enabled: true,
    meta_title_suffix: "| Gender Apparel",
    twitter_handle: "@gender_apparel",
    google_site_verification: "",
    updated_at: "",
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusType>("idle");
  const [productCount, setProductCount] = useState<number | null>(null);
  const [sitemapLoading, setSitemapLoading] = useState(false);

  useEffect(() => {
    fetch("/api/seo")
      .then((r) => r.json())
      .then((data) => {
        if (data) setForm((f) => ({ ...f, ...data }));
        setLoading(false);
      });
  }, []);

  const checkSitemap = async () => {
    setSitemapLoading(true);
    const r = await fetch("/api/seo?action=sitemap_products");
    const data = await r.json();
    setProductCount(Array.isArray(data) ? data.length : 0);
    setSitemapLoading(false);
  };

  const handleSave = async () => {
    setStatus("saving");
    const { updated_at, ...payload } = form;
    const r = await fetch("/api/seo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setStatus(r.ok ? "saved" : "error");
    if (r.ok) { fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/"] }) }); setTimeout(() => setStatus("idle"), 2500); }
  };

  const set = (key: keyof SeoSettings, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  return (
    <div className="max-w-3xl space-y-8">

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Sitemap", icon: Map, active: form.sitemap_enabled },
          { label: "Robots.txt", icon: Bot, active: form.robots_noindex_admin },
          { label: "JSON-LD", icon: Code2, active: form.jsonld_enabled },
          { label: "Canonical URLs", icon: Link2, active: form.canonical_enabled },
        ].map(({ label, icon: Icon, active }) => (
          <div key={label} className="bg-white rounded-xl border border-secondary-100 shadow-sm p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Icon size={18} className={active ? "text-primary-500" : "text-secondary-300"} />
              <SeoStatusBadge enabled={active} />
            </div>
            <p className="text-sm font-medium text-secondary-700">{label}</p>
          </div>
        ))}
      </div>

      {/* Site basics */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-6"><Globe size={20} className="text-primary-500" />Site Basics</h2>
        <div className="space-y-4">
          <div>
            <label className="label-text">Production URL</label>
            <input value={form.site_url} onChange={(e) => set("site_url", e.target.value)} className="input-field" placeholder="https://your-domain.com" />
            <p className="text-xs text-secondary-400 mt-1">Used in sitemap, canonical URLs, and JSON-LD. No trailing slash.</p>
          </div>
          <div>
            <label className="label-text">Meta Title Suffix</label>
            <input value={form.meta_title_suffix} onChange={(e) => set("meta_title_suffix", e.target.value)} className="input-field" placeholder="| Gender Apparel" />
            <p className="text-xs text-secondary-400 mt-1">Appended to page titles — e.g. &ldquo;Classic Tee | Gender Apparel&rdquo;</p>
          </div>
          <div>
            <label className="label-text">Twitter / X Handle</label>
            <input value={form.twitter_handle} onChange={(e) => set("twitter_handle", e.target.value)} className="input-field" placeholder="@gender_apparel" />
          </div>
          <div>
            <label className="label-text">Google Search Console Verification Code</label>
            <input value={form.google_site_verification} onChange={(e) => set("google_site_verification", e.target.value)} className="input-field" placeholder="e.g. abc123xyz" />
            <p className="text-xs text-secondary-400 mt-1">Paste the content value from the meta tag Google gives you. Leave blank if not needed.</p>
          </div>
        </div>
      </section>

      {/* Open Graph */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-2"><Search size={20} className="text-primary-500" />Open Graph / Social Sharing</h2>
        <p className="text-sm text-secondary-500 mb-6">Controls how links appear when shared on Facebook, Twitter, iMessage, etc. Product pages automatically use the product image.</p>
        <div>
          <label className="label-text">Default OG Image URL</label>
          <input value={form.default_og_image} onChange={(e) => set("default_og_image", e.target.value)} className="input-field" placeholder="https://your-domain.com/og-default.jpg" />
          <p className="text-xs text-secondary-400 mt-1">Used on pages without a specific image (home, shop, about). Recommended: 1200×630px.</p>
        </div>
        {form.default_og_image && (
          <div className="mt-4 rounded-lg overflow-hidden border border-secondary-100 max-w-sm">
            <img src={form.default_og_image} alt="OG preview" className="w-full h-auto object-cover" />
            <p className="text-xs text-secondary-400 p-2">OG image preview</p>
          </div>
        )}
      </section>

      {/* Feature toggles */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-6"><FileText size={20} className="text-primary-500" />SEO Features</h2>
        <div className="space-y-6">
          <Toggle
            checked={form.sitemap_enabled}
            onChange={(v) => set("sitemap_enabled", v)}
            label="Sitemap XML"
            description="Generates /sitemap.xml with all active product pages, shop, home, about, and policy pages. Submit to Google Search Console."
          />
          <Toggle
            checked={form.robots_noindex_admin}
            onChange={(v) => set("robots_noindex_admin", v)}
            label="Robots.txt — Block Admin & Checkout"
            description="Generates /robots.txt that allows all public pages and disallows /admin/, /checkout/, and /api/ from being crawled."
          />
          <Toggle
            checked={form.jsonld_enabled}
            onChange={(v) => set("jsonld_enabled", v)}
            label="JSON-LD Product Schema"
            description="Adds structured data to every product page so Google can show price, availability, and brand in search results (rich snippets)."
          />
          <Toggle
            checked={form.canonical_enabled}
            onChange={(v) => set("canonical_enabled", v)}
            label="Canonical URLs"
            description="Adds a canonical <link> tag to product pages to prevent duplicate content penalties from URL variations."
          />
        </div>
      </section>

      {/* Sitemap inspector */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-2"><Map size={20} className="text-primary-500" />Sitemap Inspector</h2>
        <p className="text-sm text-secondary-500 mb-4">Check how many product URLs are currently in your sitemap, and open it directly.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={checkSitemap} disabled={sitemapLoading} className="btn-outline flex items-center gap-2">
            {sitemapLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Check Sitemap
          </button>
          <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="btn-outline flex items-center gap-2">
            <ExternalLink size={16} />View /sitemap.xml
          </a>
          <a href="/robots.txt" target="_blank" rel="noreferrer" className="btn-outline flex items-center gap-2">
            <ExternalLink size={16} />View /robots.txt
          </a>
        </div>
        {productCount !== null && (
          <div className="mt-4 p-4 bg-secondary-50 rounded-lg text-sm text-secondary-700">
            <span className="font-semibold text-secondary-900">{productCount}</span> active product{productCount !== 1 ? "s" : ""} indexed &nbsp;+&nbsp; 5 static pages &nbsp;=&nbsp; <span className="font-semibold text-secondary-900">{productCount + 5}</span> total URLs in sitemap
          </div>
        )}
      </section>

      {/* Google Search Console */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-2"><Search size={20} className="text-primary-500" />Google Search Console</h2>
        <p className="text-sm text-secondary-500 mb-4">After saving your verification code above, submit your sitemap to Google to start tracking search performance.</p>
        <ol className="text-sm text-secondary-600 space-y-2 list-decimal list-inside">
          <li>Go to <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-primary-600 underline">search.google.com/search-console</a></li>
          <li>Add property → URL prefix → enter your site URL</li>
          <li>Choose &ldquo;HTML tag&rdquo; verification → copy the content value → paste above → Save Settings</li>
          <li>Click Verify in Search Console</li>
          <li>Go to Sitemaps → submit <code className="bg-secondary-100 px-1 rounded">{form.site_url}/sitemap.xml</code></li>
        </ol>
      </section>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-4 sticky bottom-4">
        {status === "error" && <p className="text-sm text-red-500">Save failed — check console</p>}
        <button onClick={handleSave} disabled={status === "saving"} className="btn-primary shadow-lg">
          {status === "saving" ? <><Loader2 size={20} className="mr-2 animate-spin" />Saving...</>
            : status === "saved" ? <><Check size={20} className="mr-2" />Saved!</>
            : <><Save size={20} className="mr-2" />Save SEO Settings</>}
        </button>
      </div>
    </div>
  );
}

export default function AdminSeoPage() {
  return <ProtectedAdmin><SeoPanel /></ProtectedAdmin>;
}
