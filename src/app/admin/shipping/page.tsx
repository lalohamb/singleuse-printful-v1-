"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Truck, Package, Globe, Info, RefreshCw, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

interface Diagnostic {
  mode: "live" | "partial" | "fallback";
  printifyConnected: boolean;
  shopId: string | null;
  products: {
    total: number;
    withBlueprint: number;
    withShippingInfo: number;
    missingShippingInfo: Array<{ id: string; title: string }>;
  };
  sampleRate: number | null;
  sampleProduct: string | null;
}

function ModeBadge({ mode }: { mode: Diagnostic["mode"] }) {
  if (mode === "live") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-success-50 text-success-700">
      <CheckCircle size={14} />Live Printify Rates
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

function ShippingPanel() {
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(true);

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
                {diag.mode === "live" && `All ${diag.products.total} active products have Printify shipping profiles stored. Customers see real rates at checkout.`}
                {diag.mode === "partial" && `${diag.products.withShippingInfo} of ${diag.products.total} products have shipping profiles. The rest will use the $6.99 fallback.`}
                {diag.mode === "fallback" && "No products have shipping profiles stored yet. Run a product sync to pull them from Printify."}
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
                  label: "Printify connected",
                  ok: diag.printifyConnected,
                  detail: diag.printifyConnected
                    ? "Shop is marked as connected in settings."
                    : "Run a product sync from the Products panel to connect Printify.",
                },
                {
                  label: "Shop ID configured",
                  ok: !!diag.shopId,
                  detail: diag.shopId
                    ? `Shop ID: ${diag.shopId}`
                    : "Set your Printify Shop ID in Settings → Integrations.",
                },
                {
                  label: `Blueprint data (${diag.products.withBlueprint}/${diag.products.total} products)`,
                  ok: diag.products.withBlueprint === diag.products.total && diag.products.total > 0,
                  detail: diag.products.withBlueprint === diag.products.total
                    ? "All products have blueprint and provider IDs."
                    : "Some products are missing blueprint data — sync from the Products panel.",
                },
                {
                  label: `Shipping profiles stored (${diag.products.withShippingInfo}/${diag.products.total} products)`,
                  ok: diag.products.withShippingInfo === diag.products.total && diag.products.total > 0,
                  detail: diag.products.withShippingInfo === diag.products.total
                    ? "All products have Printify shipping rate profiles stored locally."
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
                  Go to <strong>Products → Sync from Printify</strong> to pull shipping profiles for these items.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Printify notice */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 flex gap-4">
        <Info size={22} className="text-primary-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-secondary-900">Shipping is managed by Printify</p>
          <p className="text-sm text-secondary-600">
            Rates, carriers, and delivery windows are configured in your Printify account.
            During each product sync, this store fetches the static shipping rate profile for each product&apos;s blueprint and print provider and stores it locally.
            At checkout, rates are calculated from those stored profiles — no live API call needed.
          </p>
          <a href="https://printify.com/app/store/shipping" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 underline mt-1">
            Open Printify Shipping Settings <ExternalLink size={13} />
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
            { icon: RefreshCw, title: "Product sync fetches shipping profiles", desc: "When you sync products from Printify, the shipping rate profile for each product's blueprint and print provider is fetched from Printify's catalog API and stored in the database." },
            { icon: Globe, title: "Customer selects their country at checkout", desc: "The checkout page looks up the stored shipping profile for each cart item and finds the rate matching the customer's country." },
            { icon: Package, title: "Rate is calculated and charged", desc: "Cost = first item rate + (quantity − 1) × additional item rate, summed across all products. This exact amount is shown to the customer and passed to Stripe." },
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

      {/* What to configure in Printify */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">What to Configure in Printify</h2>
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
              <a href="https://printify.com/app/store/shipping" target="_blank" rel="noreferrer" className="flex-shrink-0 text-primary-600 hover:text-primary-700 flex items-center gap-1 text-xs font-medium underline">
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
          If a product has no shipping profile stored, checkout falls back to a flat <strong>$6.99</strong> rate for that item so orders are never blocked.
          After changing shipping rates in Printify, run a product sync to pull the updated profiles.
        </p>
      </div>

    </div>
  );
}

export default function AdminShippingPage() {
  return <ProtectedAdmin><ShippingPanel /></ProtectedAdmin>;
}
