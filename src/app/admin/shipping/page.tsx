"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Truck, Package, Globe, Info, RefreshCw, CheckCircle, AlertTriangle, XCircle, Save, Loader2, Check } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { supabase } from "@/lib/supabase";

interface Diagnostic {
  mode: "live" | "partial" | "fallback";
  printfulConnected: boolean;
  products: {
    total: number;
    withShippingInfo: number;
    missingShippingInfo: Array<{ id: string; title: string }>;
  };
  sampleRate: number | null;
  sampleProduct: string | null;
}

function ModeBadge({ mode }: { mode: Diagnostic["mode"] }) {
  if (mode === "live") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-success-50 text-success-700">
      <CheckCircle size={14} />Live Printful Rates
    </span>
  );
  if (mode === "partial") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-warning-50 text-warning-700">
      <AlertTriangle size={14} />Partial — Mixed Rates
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-error-50 text-error-700">
      <XCircle size={14} />Fallback Rate ($6.99)
    </span>
  );
}

function ProductRatesTable() {
  const [products, setProducts] = useState<Array<{
    id: string;
    title: string;
    image_url: string | null;
    shipping_info: { profiles?: Array<{ countries: string[]; first_item?: { cost?: number }; additional_items?: { cost?: number } }> } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, title, image_url, shipping_info")
      .eq("status", "active")
      .order("title")
      .then(({ data }) => {
        setProducts(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-2 border-secondary-300 border-t-secondary-900" /></div>;
  if (!products.length) return <p className="text-sm text-secondary-400">No active products found.</p>;

  return (
    <div className="space-y-2">
      {products.map((p) => {
        const profiles = p.shipping_info?.profiles ?? [];
        const usProfiles = profiles.filter((pr) => pr.countries?.includes("US"));
        const hasRates = usProfiles.length > 0;
        const isOpen = expanded === p.id;

        return (
          <div key={p.id} className="border border-secondary-100 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : p.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-secondary-50 hover:bg-secondary-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {p.image_url
                  ? <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  : <div className="w-8 h-8 rounded bg-secondary-200 flex-shrink-0" />}
                <span className="text-sm font-medium text-secondary-900 truncate">{p.title}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {hasRates
                  ? <span className="text-xs text-success-600 font-medium">
                      US: ${(Math.min(...usProfiles.map(pr => pr.first_item?.cost ?? 0)) / 100).toFixed(2)} first item
                    </span>
                  : <span className="text-xs text-error-500 font-medium">No US rate</span>}
                <span className="text-secondary-400 text-xs">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {isOpen && (
              <div className="px-4 py-3 border-t border-secondary-100">
                {profiles.length === 0 ? (
                  <p className="text-xs text-secondary-400">No shipping profiles stored. Run a product sync.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-secondary-500 border-b border-secondary-100">
                        <th className="text-left pb-2 font-medium">Region</th>
                        <th className="text-right pb-2 font-medium">First item</th>
                        <th className="text-right pb-2 font-medium">Additional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-50">
                      {profiles.map((pr, i) => (
                        <tr key={i} className="text-secondary-700">
                          <td className="py-1.5">{pr.countries?.join(", ") ?? "—"}</td>
                          <td className="py-1.5 text-right">${((pr.first_item?.cost ?? 0) / 100).toFixed(2)}</td>
                          <td className="py-1.5 text-right">${((pr.additional_items?.cost ?? 0) / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShippingPanel() {
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState("6.99");
  const [threshold, setThreshold] = useState("75");
  const [badges, setBadges] = useState([
    { text: "Free shipping on orders over $75", active: true },
    { text: "Print on demand - made fresh for you", active: true },
    { text: "Premium quality guarantee", active: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("settings").select("id, default_shipping_cost, shipping_free_threshold, product_badge_1_text, product_badge_1_active, product_badge_2_text, product_badge_2_active, product_badge_3_text, product_badge_3_active").limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setSettingsId(data.id);
        setFallback(String(data.default_shipping_cost ?? 6.99));
        setThreshold(String(data.shipping_free_threshold ?? 75));
        setBadges([
          { text: data.product_badge_1_text ?? "Free shipping on orders over $75", active: data.product_badge_1_active !== false },
          { text: data.product_badge_2_text ?? "Print on demand - made fresh for you", active: data.product_badge_2_active !== false },
          { text: data.product_badge_3_text ?? "Premium quality guarantee", active: data.product_badge_3_active !== false },
        ]);
      }
    });
  }, []);

  const saveFallback = async () => {
    if (!settingsId) { setSaveError("No settings row found"); return; }
    setSaving(true); setSaveError(null);
    // Keep badge 1 text in sync with threshold if it matches the default pattern
    const syncedBadges = badges.map((b, i) => {
      if (i === 0 && /free shipping on orders over \$[\d.]+/i.test(b.text)) {
        return { ...b, text: `Free shipping on orders over $${parseFloat(threshold) || 75}` };
      }
      return b;
    });
    const { error } = await supabase.from("settings").update({
      default_shipping_cost: parseFloat(fallback) || 6.99,
      shipping_free_threshold: parseFloat(threshold) || 75,
      product_badge_1_text: syncedBadges[0].text,
      product_badge_1_active: syncedBadges[0].active,
      product_badge_2_text: syncedBadges[1].text,
      product_badge_2_active: syncedBadges[1].active,
      product_badge_3_text: syncedBadges[2].text,
      product_badge_3_active: syncedBadges[2].active,
    }).eq("id", settingsId);
    setSaving(false);
    if (error) { setSaveError(error.message); } else {
      setBadges(syncedBadges);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    }
  };

  const runDiagnostic = async () => {
    setLoading(true);
    const r = await fetch("/api/shipping-diagnostic");
    setDiag(await r.json());
    setLoading(false);
  };

  useEffect(() => { runDiagnostic(); }, []);

  return (
    <div className="max-w-3xl space-y-8">

      {/* Live diagnostic */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2">
            <Truck size={20} className="text-primary-500" />Shipping Status
          </h2>
          <button onClick={runDiagnostic} disabled={loading} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh
          </button>
        </div>

        {loading && !diag ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
        ) : diag ? (
          <div className="space-y-5">

            {/* Mode banner */}
            <div className={`rounded-lg p-4 border ${diag.mode === "live" ? "bg-success-50 border-success-100" : diag.mode === "partial" ? "bg-warning-50 border-warning-100" : "bg-error-50 border-error-100"}`}>
              <ModeBadge mode={diag.mode} />
              <p className="text-sm mt-2 text-secondary-700">
                {diag.mode === "live" && `All ${diag.products.total} active products have Printful live rates active. Customers see real rates at checkout.`}
                {diag.mode === "partial" && `${diag.products.withShippingInfo} of ${diag.products.total} products have shipping profiles. The rest will use the $6.99 fallback.`}
                {diag.mode === "fallback" && "No Printful connection yet. Sync products from the Products panel to connect."}
              </p>
              {diag.sampleRate !== null && (
                <p className="text-xs text-secondary-500 mt-1">
                  Sample US rate from <em>{diag.sampleProduct}</em>: <strong>${diag.sampleRate.toFixed(2)}</strong> first item
                </p>
              )}
            </div>

            {/* Check rows */}
            <div className="space-y-3">
              {[
                {
                  label: "Printful connected",
                  ok: diag.printfulConnected,
                  detail: diag.printfulConnected
                    ? "Shop is marked as connected in settings."
                    : "Run a product sync from the Products panel to connect Printful.",
                },
                {
                  label: "Printful connected",
                  ok: diag.printfulConnected,
                  detail: diag.printfulConnected
                    ? "Printful API token is active."
                    : "Run a product sync from the Products panel to connect Printful.",
                },
                {
                  label: `Products synced (${diag.products.total})`,
                  ok: diag.products.total > 0,
                  detail: diag.products.total > 0
                    ? `${diag.products.total} active products synced from Printful.`
                    : "No products synced yet — run Sync Printful from the Products panel.",
                },
                {
                  label: `Shipping profiles stored (${diag.products.withShippingInfo}/${diag.products.total} products)`,
                  ok: diag.products.withShippingInfo === diag.products.total && diag.products.total > 0,
                  detail: diag.products.withShippingInfo === diag.products.total
                    ? "Printful live shipping rates are active for all products."
                    : `${diag.products.total - diag.products.withShippingInfo} product(s) missing shipping profiles — run a sync to fetch them.`,
                },
              ].map(({ label, ok, detail }) => (
                <div key={label} className="flex items-start gap-3 p-3 bg-secondary-50 rounded-lg">
                  {ok
                    ? <CheckCircle size={18} className="text-success-500 flex-shrink-0 mt-0.5" />
                    : <XCircle size={18} className="text-error-500 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-sm font-medium text-secondary-900">{label}</p>
                    <p className="text-xs text-secondary-500 mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Missing products */}
            {diag.products.missingShippingInfo.length > 0 && (
              <div>
                <p className="text-sm font-medium text-secondary-700 mb-2">Products missing shipping profiles:</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {diag.products.missingShippingInfo.map((p) => (
                    <li key={p.id} className="text-xs text-secondary-500 flex items-center gap-2 px-3 py-1.5 bg-secondary-50 rounded">
                      <AlertTriangle size={12} className="text-warning-500 flex-shrink-0" />{p.title}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-secondary-400 mt-2">
                  Go to <strong>Products → Sync Printful</strong> to pull these products from Printful.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Per-product shipping rates */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-4">
          <Package size={20} className="text-primary-500" />Shipping Rates by Product
        </h2>
        <p className="text-sm text-secondary-500 mb-4">Printful uses live rates at checkout — no static profiles needed.</p>
        <div className="bg-secondary-50 border border-secondary-100 rounded-lg p-4 text-xs text-secondary-600 space-y-1.5 mb-4">
          <p>• Printful returns live rates per cart at checkout.</p>
          <p>• The rate shown is the cheapest option from Printful's live API.</p>
          <p>• Non-US rows (CA, AU, REST_OF_THE_WORLD) are stored from the sync but <strong>not used</strong> — this store ships to the US only.</p>
        </div>
        <ProductRatesTable />
      </section>

      {/* Fallback rate control */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-2">
          <Truck size={20} className="text-primary-500" />Fallback Shipping Rate
        </h2>
        <p className="text-sm text-secondary-500 mb-4">Used when Printful's live API is unavailable. Keeps checkout from being blocked.</p>
        <div className="space-y-4">
          <div>
            <label className="label-text">Fallback rate (per order)</label>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-secondary-500 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={fallback} onChange={(e) => setFallback(e.target.value)} className="input-field w-32" />
            </div>
          </div>
          <div>
            <label className="label-text">Free shipping threshold</label>
            <p className="text-xs text-secondary-400 mb-1">Orders above this amount get free shipping. Shown on product pages and at checkout.</p>
            <div className="flex items-center gap-3">
              <span className="text-secondary-500 text-sm">$</span>
              <input type="number" min="0" step="1" value={threshold} onChange={(e) => {
                setThreshold(e.target.value);
                setBadges((prev) => prev.map((b, i) =>
                  i === 0 && /free shipping on orders over \$[\d.]*/i.test(b.text)
                    ? { ...b, text: `Free shipping on orders over $${e.target.value}` }
                    : b
                ));
              }} className="input-field w-32" />
            </div>
          </div>
          <div>
            <label className="label-text">Product Page Badges</label>
            <p className="text-xs text-secondary-400 mb-3">These appear below the Add to Cart button on every product page. Uncheck to hide.</p>
            <div className="space-y-3">
              {badges.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input type="checkbox" checked={b.active} onChange={(e) => setBadges((prev) => prev.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} className="w-4 h-4 rounded shrink-0" />
                  <input type="text" value={b.text} onChange={(e) => setBadges((prev) => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} className="input-field flex-1 py-1.5 text-sm" />
                </div>
              ))}
            </div>
          </div>
          <button onClick={saveFallback} disabled={saving} className="btn-primary py-2 text-sm flex items-center gap-2">
            {saving ? <><Loader2 size={15} className="animate-spin" />Saving...</> : saved ? <><Check size={15} />Saved!</> : <><Save size={15} />Save</>}
          </button>
          {saveError && <p className="text-sm text-error-600 mt-2">{saveError}</p>}
        </div>
      </section>

      {/* Printful notice */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 flex gap-4">
        <Info size={22} className="text-primary-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-secondary-900">Shipping is managed by Printful</p>
          <p className="text-sm text-secondary-600">
            Rates, carriers, and delivery windows are configured in your Printful account.
            At checkout, this store calls Printful's live shipping rates API with the customer's exact cart.
            If that call fails, it falls back to the static profiles stored during the last product sync.
          </p>
          <a href="https://www.printful.com/dashboard/shipping" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 underline mt-1">
            Open Printful Shipping Settings <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* How it works */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-6">
          <Truck size={20} className="text-primary-500" />How Shipping Works
        </h2>
        <ol className="space-y-4 text-sm text-secondary-700">
          {[
            { icon: RefreshCw, title: "Product sync stores shipping profiles as fallback", desc: "When you sync products from Printful, products are stored locally for fast browsing." },
            { icon: Globe, title: "Live rate fetched at checkout", desc: "When a customer checks out, the server calls Printful's live shipping rates API with the exact cart items. No client-side calculation." },
            { icon: Package, title: "Exact rate passed to Stripe", desc: "Printful's response is used directly as the shipping amount in the Stripe Checkout Session. Falls back to the default shipping cost on error." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <li key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0 text-primary-600 font-bold text-sm">{i + 1}</div>
              <div>
                <p className="font-medium text-secondary-900 flex items-center gap-2"><Icon size={15} className="text-primary-400" />{title}</p>
                <p className="text-secondary-500 mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What to configure in Printful */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">What to Configure in Printful</h2>
        <div className="space-y-3 text-sm">
          {[
            { label: "Shipping profiles", desc: "Set rates per region for each product type. Re-sync products after any changes." },
            { label: "Free shipping rules", desc: "Configure order-value thresholds for free shipping." },
            { label: "Carrier & speed options", desc: "Choose standard vs. express carriers per print provider." },
            { label: "International shipping", desc: "Enable or restrict shipping to specific countries." },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start justify-between gap-4 p-3 bg-secondary-50 rounded-lg">
              <div>
                <p className="font-medium text-secondary-800">{label}</p>
                <p className="text-secondary-500 text-xs mt-0.5">{desc}</p>
              </div>
              <a href="https://www.printful.com/dashboard/shipping" target="_blank" rel="noreferrer" className="flex-shrink-0 text-primary-600 hover:text-primary-700 flex items-center gap-1 text-xs font-medium underline">
                Configure <ExternalLink size={11} />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Fallback note */}
      <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-4 text-xs text-secondary-500 flex gap-2">
        <Info size={14} className="flex-shrink-0 mt-0.5 text-secondary-400" />
        <p>
          If Printful's live shipping API is unavailable, checkout falls back to the default shipping cost (configurable below).
          After changing shipping rates in Printful, the live API will reflect them immediately — no sync needed.
        </p>
      </div>

    </div>
  );
}

export default function AdminShippingPage() {
  return <ProtectedAdmin><ShippingPanel /></ProtectedAdmin>;
}
