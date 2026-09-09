"use client";
import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, DollarSign, TrendingUp, CreditCard, ArrowDownCircle, X, Loader2, Check, AlertCircle } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

interface Balance {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
}

interface Charge {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  status: string;
  refunded: boolean;
  description: string | null;
  billing_details: { name: string | null; email: string | null };
  created: number;
  receipt_url: string | null;
  payment_intent: string | null;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: number;
  created: number;
}

const fmt = (amount: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);

const statusBadge: Record<string, string> = {
  succeeded: "bg-success-50 text-success-600",
  pending: "bg-warning-50 text-warning-600",
  failed: "bg-error-50 text-error-600",
  paid: "bg-success-50 text-success-600",
  in_transit: "bg-primary-50 text-primary-600",
};

function RefundModal({ charge, onClose, onRefunded }: { charge: Charge; onClose: () => void; onRefunded: () => void }) {
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const refundable = charge.amount - charge.amount_refunded;

  const handleRefund = async () => {
    setLoading(true); setError(null);
    const body: any = { action: "refund", charge_id: charge.id };
    if (partial && amount) body.amount = Math.round(parseFloat(amount) * 100);
    const res = await fetch("/api/stripe-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Refund failed"); }
    else { setDone(true); setTimeout(() => { onRefunded(); onClose(); }, 1500); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-secondary-900">Issue Refund</h2>
          <button onClick={onClose} className="p-1 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
        </div>
        <div className="bg-secondary-50 rounded-lg p-4 mb-6 space-y-1 text-sm">
          <p className="font-medium text-secondary-900">{charge.billing_details.name || "—"}</p>
          <p className="text-secondary-500">{charge.billing_details.email || "—"}</p>
          <p className="text-secondary-700 font-semibold mt-2">Charge: {fmt(charge.amount, charge.currency)}</p>
          {charge.amount_refunded > 0 && <p className="text-warning-600">Already refunded: {fmt(charge.amount_refunded, charge.currency)}</p>}
          <p className="text-secondary-700">Refundable: {fmt(refundable, charge.currency)}</p>
        </div>
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="w-4 h-4 rounded text-primary-500" />
          <span className="text-sm font-medium text-secondary-700">Partial refund</span>
        </label>
        {partial && (
          <div className="mb-4">
            <label className="label-text">Amount ($)</label>
            <input type="number" step="0.01" min="0.01" max={(refundable / 100).toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" placeholder={`Max ${fmt(refundable, charge.currency)}`} />
          </div>
        )}
        {error && <div className="flex items-center gap-2 text-error-600 text-sm mb-4"><AlertCircle size={16} />{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={handleRefund} disabled={loading || done || refundable === 0} className="btn-primary flex-1">
            {done ? <><Check size={18} className="mr-2" />Refunded!</>
              : loading ? <><Loader2 size={18} className="mr-2 animate-spin" />Processing...</>
              : "Confirm Refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

const WEBHOOK_URL = "https://SUPABASE_PROJECT_REF_REDACTED.supabase.co/functions/v1/stripe-webhook";

function GoLiveChecklist({ isLive, onSwitched }: { isLive: boolean; onSwitched: () => void }) {
  const [open, setOpen] = useState(!isLive);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchLog, setSwitchLog] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const switchMode = async () => {
    setSwitching(true); setSwitchLog(null); setSwitchError(null);
    const target = isLive ? "test" : "live";
    try {
      const r = await fetch("/api/stripe-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: target }),
      });
      const data = await r.json();
      if (!r.ok) { setSwitchError(data.error || "Switch failed"); setSwitchLog(data.log || null); }
      else {
        setSwitchLog(data.log + "\n\n⏳ Waiting for server restart...");
        // Wait for PM2 to restart before re-fetching mode
        await new Promise(res => setTimeout(res, 12_000));
        onSwitched();
      }
    } catch (e: any) {
      setSwitchError(e.message);
    }
    setSwitching(false);
  };

  const copy = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const liveSteps = [
    {
      label: "Get your live Secret key from Stripe",
      detail: "Go to Stripe Dashboard → Developers → API keys → copy the live Secret key (starts with sk_live_)",
      link: { href: "https://dashboard.stripe.com/apikeys", label: "Open Stripe API Keys →" },
    },
    {
      label: "Update .env.local with the live key",
      code: "STRIPE_SECRET_KEY=sk_live_...",
      detail: "Replace the existing sk_test_ value in your .env.local file.",
    },
    {
      label: "Set the live key as a Supabase secret",
      code: "npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref SUPABASE_PROJECT_REF_REDACTED",
    },
    {
      label: "Register the webhook in Stripe (live mode)",
      detail: `Go to Stripe Dashboard → Developers → Webhooks → Add endpoint → URL: ${WEBHOOK_URL} → Enable: checkout.session.completed, payment_intent.payment_failed`,
      link: { href: "https://dashboard.stripe.com/webhooks", label: "Open Stripe Webhooks →" },
    },
    {
      label: "Set the webhook signing secret",
      code: "npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref SUPABASE_PROJECT_REF_REDACTED",
      detail: "Copy the Signing secret from the webhook you just created (starts with whsec_).",
    },
    {
      label: "Redeploy edge functions",
      code: "npx supabase functions deploy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED",
    },
  ];

  const testSteps = [
    {
      label: "Get your test Secret key from Stripe",
      detail: "Go to Stripe Dashboard → toggle \"Test mode\" on → Developers → API keys → copy the test Secret key (starts with sk_test_)",
      link: { href: "https://dashboard.stripe.com/test/apikeys", label: "Open Stripe Test API Keys →" },
    },
    {
      label: "Update .env.local with the test key",
      code: "STRIPE_SECRET_KEY=sk_test_...",
      detail: "Replace the sk_live_ value in your .env.local file.",
    },
    {
      label: "Set the test key as a Supabase secret",
      code: "npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref SUPABASE_PROJECT_REF_REDACTED",
    },
    {
      label: "Register a webhook in Stripe (test mode)",
      detail: `In Stripe test mode: Developers → Webhooks → Add endpoint → URL: ${WEBHOOK_URL} → Enable: checkout.session.completed, payment_intent.payment_failed`,
      link: { href: "https://dashboard.stripe.com/test/webhooks", label: "Open Stripe Test Webhooks →" },
    },
    {
      label: "Set the test webhook signing secret",
      code: "npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref SUPABASE_PROJECT_REF_REDACTED",
      detail: "Copy the Signing secret from the test webhook you just created.",
    },
    {
      label: "Redeploy edge functions",
      code: "npx supabase functions deploy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED",
    },
  ];

  const steps = isLive ? testSteps : liveSteps;
  const accentBorder = isLive ? "border-success-200" : "border-amber-200";
  const accentText = isLive ? "text-success-700" : "text-amber-700";
  const accentBg = isLive ? "bg-success-50" : "bg-amber-50";
  const stepBorder = isLive ? "border-success-100" : "border-amber-100";
  const badgeBg = isLive ? "bg-success-100 text-success-700" : "bg-amber-100 text-amber-700";

  return (
    <div className={`rounded-xl border ${accentBg} ${accentBorder}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between p-4 text-left">
        <div className="flex items-center gap-3">
          <AlertCircle size={18} className={isLive ? "text-success-500" : "text-amber-500"} />
          <div>
            <p className={`text-sm font-semibold ${isLive ? "text-success-800" : "text-amber-800"}`}>
              Stripe is in <strong>{isLive ? "LIVE" : "TEST"}</strong> mode
            </p>
            <p className={`text-xs ${accentText}`}>
              {isLive ? "Real payments are being processed." : "No real money is being processed — complete the checklist below before launching."}
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 ${accentText}`}>
          {open ? "Hide" : isLive ? "Switch to Test Mode" : "Go Live checklist"}
        </span>
      </button>

      {open && (
        <div className={`border-t ${accentBorder} px-4 pb-4 pt-3 space-y-3`}>

          {/* One-click switch button */}
          <div className={`rounded-lg p-3 border ${accentBorder} bg-white flex items-center justify-between gap-4`}>
            <div>
              <p className="text-sm font-semibold text-secondary-900">
                {isLive ? "Switch to Test / Sandbox mode" : "Switch to Live mode"}
              </p>
              <p className="text-xs text-secondary-500 mt-0.5">
                Updates Supabase secrets and redeploys edge functions automatically.
              </p>
            </div>
            <button
              onClick={switchMode}
              disabled={switching}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                switching ? "bg-secondary-400 cursor-not-allowed" :
                isLive ? "bg-amber-500 hover:bg-amber-600" : "bg-success-600 hover:bg-success-700"
              }`}
            >
              {switching
                ? <><Loader2 size={15} className="animate-spin" />Switching...</>
                : isLive ? "→ Switch to Test" : "→ Switch to Live"
              }
            </button>
          </div>

          {/* Log output */}
          {(switchLog || switchError) && (
            <div className={`rounded-lg p-3 text-xs font-mono whitespace-pre-wrap border ${
              switchError ? "bg-error-50 border-error-200 text-error-700" : "bg-secondary-900 border-secondary-700 text-green-400"
            }`}>
              {switchError && <p className="font-semibold mb-1">Error: {switchError}</p>}
              {switchLog}
            </div>
          )}

          <p className={`text-xs font-semibold uppercase tracking-wide ${accentText}`}>
            {isLive ? "Manual steps (if needed)" : "Manual steps (if needed)"}
          </p>
          {steps.map((step, i) => (
            <div key={i} className={`bg-white rounded-lg border ${stepBorder} p-3 space-y-1.5`}>
              <p className="text-sm font-medium text-secondary-900">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${badgeBg} text-xs font-bold mr-2`}>{i + 1}</span>
                {step.label}
              </p>
              {step.detail && <p className="text-xs text-secondary-500 ml-7">{step.detail}</p>}
              {step.link && (
                <a href={step.link.href} target="_blank" rel="noopener noreferrer" className="ml-7 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                  {step.link.label} <ExternalLink size={11} />
                </a>
              )}
              {step.code && (
                <div className="ml-7 flex items-center gap-2">
                  <code className="flex-1 text-xs bg-secondary-50 border border-secondary-200 rounded px-2 py-1.5 text-secondary-700 break-all">{step.code}</code>
                  <button onClick={() => copy(step.code!, i)} className="flex-shrink-0 text-xs px-2 py-1.5 rounded border border-secondary-200 text-secondary-500 hover:text-secondary-900 hover:border-secondary-400 transition-colors">
                    {copiedStep === i ? <Check size={13} className="text-success-500" /> : "Copy"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StripeDashboard() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [orderMap, setOrderMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<Charge | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchAll = async () => {
    setLoading(true); setError(null);
    try {
      const [balRes, chargesRes, payoutsRes] = await Promise.all([
        fetch("/api/stripe-admin?action=balance"),
        fetch("/api/stripe-admin?action=charges&limit=20"),
        fetch("/api/stripe-admin?action=payouts"),
      ]);
      const [balData, chargesData, payoutsData] = await Promise.all([balRes.json(), chargesRes.json(), payoutsRes.json()]);
      if (!balRes.ok) throw new Error(balData.error);
      setBalance(balData);
      setIsLive(!!balData.livemode);
      const chargeList: Charge[] = chargesData.data || [];
      setCharges(chargeList);
      setPayouts(payoutsData.data || []);

      // Match charges to order IDs via payment_intent
      const piIds = chargeList.map((c) => c.payment_intent).filter(Boolean) as string[];
      if (piIds.length) {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: orders } = await sb
          .from("orders")
          .select("id, stripe_payment_intent_id")
          .in("stripe_payment_intent_id", piIds);
        const map: Record<string, string> = {};
        for (const o of orders || []) map[o.stripe_payment_intent_id] = o.id;
        setOrderMap(map);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const [chargeSearch, setChargeSearch] = useState("");
  const [chargeStatus, setChargeStatus] = useState("all");

  const filteredCharges = charges.filter((c) => {
    const matchSearch = !chargeSearch ||
      (c.billing_details.name || "").toLowerCase().includes(chargeSearch.toLowerCase()) ||
      (c.billing_details.email || "").toLowerCase().includes(chargeSearch.toLowerCase()) ||
      (c.payment_intent && orderMap[c.payment_intent] ? orderMap[c.payment_intent].slice(-8).toUpperCase().includes(chargeSearch.toUpperCase()) : false);
    const matchStatus = chargeStatus === "all" || (chargeStatus === "refunded" ? c.refunded : c.status === chargeStatus);
    return matchSearch && matchStatus;
  });
  const available = balance?.available.reduce((s, b) => s + b.amount, 0) ?? 0;
  const pending = balance?.pending.reduce((s, b) => s + b.amount, 0) ?? 0;
  const totalVolume = charges.filter((c) => c.status === "succeeded").reduce((s, c) => s + c.amount, 0);
  const totalRefunded = charges.reduce((s, c) => s + c.amount_refunded, 0);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  if (error) return (
    <div className="bg-error-50 border border-error-100 rounded-xl p-6 text-center">
      <AlertCircle size={32} className="mx-auto mb-3 text-error-500" />
      <p className="font-semibold text-error-700 mb-1">Could not connect to Stripe</p>
      <p className="text-sm text-error-600 mb-4">{error}</p>
      <p className="text-xs text-secondary-500">Make sure <code>STRIPE_SECRET_KEY</code> is set in <code>.env.local</code></p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Go Live checklist */}
      <GoLiveChecklist isLive={isLive} onSwitched={fetchAll} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
          Open Stripe Dashboard <ExternalLink size={16} />
        </a>
        <button onClick={fetchAll} className="flex items-center gap-2 text-sm text-secondary-500 hover:text-secondary-900 transition-colors">
          <RefreshCw size={16} />Refresh
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Available Balance", value: fmt(available), icon: DollarSign, color: "bg-success-50 text-success-600" },
          { label: "Pending Balance", value: fmt(pending), icon: TrendingUp, color: "bg-warning-50 text-warning-600" },
          { label: "Volume (last 20)", value: fmt(totalVolume), icon: CreditCard, color: "bg-primary-50 text-primary-600" },
          { label: "Refunded (last 20)", value: fmt(totalRefunded), icon: ArrowDownCircle, color: "bg-error-50 text-error-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 border border-secondary-100 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}><card.icon size={20} /></div>
            <p className="text-xl font-bold text-secondary-900">{card.value}</p>
            <p className="text-xs text-secondary-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Charges */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-secondary-100 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-secondary-900 flex-1">Recent Charges</h2>
          <input
            value={chargeSearch}
            onChange={(e) => setChargeSearch(e.target.value)}
            placeholder="Search order, name, email…"
            className="input-field py-1.5 text-sm w-52"
          />
          <select value={chargeStatus} onChange={(e) => setChargeStatus(e.target.value)} className="input-field py-1.5 text-sm w-auto">
            <option value="all">All Status</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        {charges.length === 0 ? (
          <div className="p-10 text-center text-secondary-400"><CreditCard size={36} className="mx-auto mb-2 text-secondary-200" />No charges yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  {["Order #", "Customer", "Amount", "Status", "Date", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {filteredCharges.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-secondary-400 text-sm">No charges match your filters</td></tr>
                ) : filteredCharges.map((charge) => (
                  <tr key={charge.id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      {charge.payment_intent && orderMap[charge.payment_intent]
                        ? <span className="text-xs font-mono font-semibold text-secondary-900">#{orderMap[charge.payment_intent].slice(-8).toUpperCase()}</span>
                        : <span className="text-xs text-secondary-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-secondary-900">{charge.billing_details.name || "—"}</p>
                      <p className="text-xs text-secondary-500">{charge.billing_details.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-secondary-900">{fmt(charge.amount, charge.currency)}</p>
                      {charge.amount_refunded > 0 && <p className="text-xs text-error-500">-{fmt(charge.amount_refunded, charge.currency)} refunded</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusBadge[charge.status] || "bg-secondary-100 text-secondary-500"}`}>
                        {charge.refunded ? "refunded" : charge.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-500">
                      {new Date(charge.created * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {charge.receipt_url && (
                          <a href={charge.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                            Receipt <ExternalLink size={12} />
                          </a>
                        )}
                        {charge.status === "succeeded" && !charge.refunded && (
                          <button onClick={() => setRefundTarget(charge)} className="text-xs text-error-600 hover:text-error-700 font-medium">
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payouts */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-secondary-100">
          <h2 className="font-semibold text-secondary-900">Recent Payouts</h2>
        </div>
        {payouts.length === 0 ? (
          <div className="p-10 text-center text-secondary-400"><ArrowDownCircle size={36} className="mx-auto mb-2 text-secondary-200" />No payouts yet</div>
        ) : (
          <div className="divide-y divide-secondary-50">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between px-5 py-4 hover:bg-secondary-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-secondary-900">{fmt(payout.amount, payout.currency)}</p>
                  <p className="text-xs text-secondary-500">Arrives {new Date(payout.arrival_date * 1000).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${statusBadge[payout.status] || "bg-secondary-100 text-secondary-500"}`}>
                  {payout.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {refundTarget && <RefundModal charge={refundTarget} onClose={() => setRefundTarget(null)} onRefunded={fetchAll} />}
    </div>
  );
}

export default function AdminStripePage() {
  return <ProtectedAdmin><StripeDashboard /></ProtectedAdmin>;
}
