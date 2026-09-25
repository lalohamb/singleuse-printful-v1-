"use client";
import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, DollarSign, TrendingUp, CreditCard, ArrowDownCircle, X, Loader2, Check, AlertCircle, Eye, EyeOff, Trash2, Settings, ChevronDown } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { getErrorMessage } from "@/lib/errors";

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
    const body: { action: string; charge_id: string; amount?: number } = { action: "refund", charge_id: charge.id };
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

interface KeyStatus { configured: boolean; key_configured: boolean; key_hint: string; }

function StripeSetup({ activeMode: activeModeOverride, onActivated }: { activeMode?: string; onActivated: (mode: "live" | "test") => void }) {
  const [status, setStatus] = useState<{ live: KeyStatus; test: KeyStatus; active_mode: string } | null>(null);
  const [key, setKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [resetting, setResetting] = useState<"live" | "test" | null>(null);
  const [result, setResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchStatus = async () => {
    const r = await fetch("/api/stripe-setup");
    if (r.ok) setStatus(await r.json());
  };

  useEffect(() => { fetchStatus(); }, []);

  const connect = async (activate: boolean) => {
    if (!key) return;
    activate ? setActivating(true) : setLoading(true);
    setResult(null);
    const r = await fetch("/api/stripe-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret_key: key, webhook_secret: webhookSecret || undefined, activate }),
    });
    const data = await r.json();
    if (!r.ok) {
      setResult({ type: "error", msg: data.error });
      activate ? setActivating(false) : setLoading(false);
    } else {
      setResult({ type: "success", msg: data.steps.join(" → ") });
      setKey(""); setWebhookSecret("");
      if (activate) {
        const activatedMode = key.startsWith("sk_live_") ? "live" : "test";
        setActivating(false);
        fetchStatus();
        onActivated(activatedMode);
      } else {
        setLoading(false);
        fetchStatus();
      }
    }
  };

  const switchMode = async (mode: "live" | "test") => {
    setActivating(true); setResult(null);
    const r = await fetch("/api/stripe-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await r.json();
    if (!r.ok) { setResult({ type: "error", msg: data.error }); setActivating(false); return; }
    setActivating(false);
    fetchStatus();
    onActivated(mode);
  };

  const resetMode = async (mode: "live" | "test") => {
    if (!confirm(`Clear all saved ${mode.toUpperCase()} Stripe keys from the database?`)) return;
    setResetting(mode); setResult(null);
    const r = await fetch("/api/stripe-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await r.json();
    setResetting(null);
    if (!r.ok) { setResult({ type: "error", msg: data.error }); return; }
    setResult({ type: "success", msg: `${mode.toUpperCase()} keys cleared.` });
    fetchStatus();
  };

  const keyMode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : null;
  const isValid = keyMode !== null;
  const activeMode = activeModeOverride ?? status?.active_mode ?? "test";

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {/* Status cards */}
      {status && (
        <div className="grid grid-cols-2 gap-3">
          {(["live", "test"] as const).map((m) => (
            <div key={m} className={`rounded-xl border p-3 space-y-2 ${
              m === "live" ? "border-success-200 bg-success-50" : "border-amber-200 bg-amber-50"
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  m === "live" ? "bg-success-100 text-success-700" : "bg-amber-100 text-amber-700"
                }`}>{m.toUpperCase()}</span>
                <div className="flex items-center gap-1">
                  {activeMode === m
                    ? <span className="text-xs text-success-600 font-medium flex items-center gap-1"><Check size={11} />Active</span>
                    : status[m].key_configured
                      ? <button onClick={() => switchMode(m)} disabled={activating || !!resetting} className="text-xs font-medium px-2 py-1 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
                          {activating ? <Loader2 size={11} className="animate-spin" /> : `Use ${m}`}
                        </button>
                      : <span className="text-xs text-secondary-400">Not set up</span>}
                  {status[m].key_configured && (
                    <button
                      onClick={() => resetMode(m)}
                      disabled={!!resetting || activating}
                      title={`Clear ${m} keys`}
                      className="p-1 text-secondary-400 hover:text-error-600 disabled:opacity-40 transition-colors"
                    >
                      {resetting === m ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  )}
                </div>
              </div>
              {status[m].key_configured
                ? <p className="text-xs font-mono text-secondary-500 truncate">{status[m].key_hint}</p>
                : <p className="text-xs text-secondary-400">Paste a sk_{m}_ key below</p>}
            </div>
          ))}
        </div>
      )}

      {/* Connect form */}
      <div className="bg-white rounded-xl border border-secondary-100 p-4 space-y-3">
        <p className="text-sm font-semibold text-secondary-900">Connect Stripe</p>

        {/* Secret key */}
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => { setKey(e.target.value); setResult(null); }}
            placeholder="sk_live_... or sk_test_..."
            className="input-field pr-10 font-mono text-sm"
          />
          <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-2.5 text-secondary-400">
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {key && (
          <p className={`text-xs ${
            keyMode === "live" ? "text-success-600" : keyMode === "test" ? "text-amber-600" : "text-error-600"
          }`}>
            {keyMode === "live" ? "✓ Live key — real payments" : keyMode === "test" ? "⚠ Test key — no real money" : "✗ Invalid key format"}
          </p>
        )}

        {/* Webhook secret */}
        <div className="relative">
          <input
            type={showWebhook ? "text" : "password"}
            value={webhookSecret}
            onChange={(e) => { setWebhookSecret(e.target.value); setResult(null); }}
            placeholder="whsec_... (optional — auto-registered if blank)"
            className="input-field pr-10 font-mono text-sm"
          />
          <button type="button" onClick={() => setShowWebhook((v) => !v)} className="absolute right-3 top-2.5 text-secondary-400">
            {showWebhook ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {webhookSecret && !webhookSecret.startsWith("whsec_") && (
          <p className="text-xs text-error-600">✗ Invalid — must start with whsec_</p>
        )}

        {result && (
          <div className={`rounded-lg p-3 text-xs ${
            result.type === "success" ? "bg-success-50 border border-success-200 text-success-800" : "bg-error-50 border border-error-100 text-error-700"
          }`}>
            <p className="break-all">{result.msg}</p>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => connect(false)}
            disabled={!isValid || loading || activating}
            className="btn-outline py-2 text-sm flex-1 disabled:opacity-50"
          >
            {loading ? <><Loader2 size={14} className="mr-1 animate-spin" />Saving...</> : "Save Only"}
          </button>
          <button
            onClick={() => connect(true)}
            disabled={!isValid || loading || activating}
            className="btn-primary py-2 text-sm flex-1 disabled:opacity-50"
          >
            {activating ? <><Loader2 size={14} className="mr-1 animate-spin" />Activating...</> : "Save & Activate"}
          </button>
        </div>
        <p className="text-xs text-secondary-400">&quot;Save Only&quot; stores the key without switching active mode. &quot;Save &amp; Activate&quot; saves and immediately switches to this mode.</p>
      </div>
    </div>
  );
}

function StripeDashboard() {
  const [activeMode, setActiveMode] = useState<"live" | "test">("test");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [orderMap, setOrderMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<Charge | null>(null);

  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [balanceCurrency, setBalanceCurrency] = useState("usd");
  const [webhookStatus, setWebhookStatus] = useState<{ live: boolean; test: boolean }>({ live: false, test: false });

  const loadStripeData = async (knownMode?: "live" | "test", showSpinner = true) => {
    if (showSpinner) { setLoading(true); setError(null); }
    setRefreshError(null);
    try {
      // Check setup first — skip balance calls if keys not configured
      const setupRes = await fetch("/api/stripe-setup", { cache: "no-store" });
      const setupData = await setupRes.json();
      const hasKeys = setupData?.live?.configured || setupData?.test?.configured;
      if (!hasKeys) { if (showSpinner) setLoading(false); return; }
      setWebhookStatus({ live: !!setupData?.live?.configured, test: !!setupData?.test?.configured });

      const [balRes, chargesRes, payoutsRes] = await Promise.all([
        fetch("/api/stripe-admin?action=balance"),
        fetch("/api/stripe-admin?action=charges&limit=20"),
        fetch("/api/stripe-admin?action=payouts"),
      ]);
      const [balData, chargesData, payoutsData] = await Promise.all([balRes.json(), chargesRes.json(), payoutsRes.json()]);
      if (!balRes.ok) throw new Error(balData.error);
      setActiveMode(knownMode ?? setupData.active_mode ?? (balData.livemode ? "live" : "test"));
      setBalance(balData);
      const currency = balData.available?.[0]?.currency ?? "usd";
      setBalanceCurrency(currency);
      const chargeList: Charge[] = chargesData.data || [];
      setCharges(chargeList);
      setPayouts(payoutsData.data || []);
      // Always reset orderMap so stale IDs from previous mode don't persist
      const piIds = chargeList.map((c) => c.payment_intent).filter(Boolean) as string[];
      if (piIds.length) {
        const { supabase: sb } = await import("@/lib/supabase");
        const { data: orders } = await sb.from("orders").select("id, stripe_payment_intent_id").in("stripe_payment_intent_id", piIds);
        const map: Record<string, string> = {};
        for (const o of orders || []) map[o.stripe_payment_intent_id] = o.id;
        setOrderMap(map);
      } else {
        setOrderMap({});
      }
    } catch (e: unknown) {
      if (showSpinner) setError(getErrorMessage(e));
      else setRefreshError("Data refresh failed after mode switch — click Refresh to retry.");
    }
    if (showSpinner) setLoading(false);
  };

  const fetchAll = () => loadStripeData(undefined, true);
  // Delay background reload by 2s to allow PM2 process to fully boot with new key
  const onModeSwitch = (mode: "live" | "test") => {
    setActiveMode(mode);
    window.dispatchEvent(new CustomEvent("stripe-mode-changed", { detail: mode }));
    setTimeout(() => loadStripeData(mode, false), 2000);
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [showSetup, setShowSetup] = useState(false);
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
  const chargeCurrency = charges[0]?.currency ?? balanceCurrency;

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  if (!balance) return (
    <div className="space-y-4">
      <p className="text-sm text-secondary-500">No Stripe keys configured yet. Add your keys below to get started.</p>
      <StripeSetup onActivated={onModeSwitch} />
    </div>
  );

  if (error) return (
    <div className="space-y-6">
      <div className="bg-error-50 border border-error-100 rounded-xl p-4 text-sm text-error-700">{error}</div>
      <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-5">
        <h3 className="font-semibold text-secondary-900 mb-4">Connect Stripe</h3>
        <StripeSetup onActivated={(mode) => { setError(null); onModeSwitch(mode); }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Top bar — mode badge + manage keys toggle + refresh */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
            activeMode === "live" ? "bg-success-50 border-success-200 text-success-700" : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            {activeMode === "live" ? "● LIVE" : "● TEST"}
          </div>
          <p className="text-xs text-secondary-500 hidden sm:block">
            {activeMode === "live" ? "Real payments are being processed." : "Test mode — no real charges."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSetup((v) => !v)}
            className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              showSetup ? "bg-secondary-900 text-white border-secondary-900" : "bg-white text-secondary-700 border-secondary-200 hover:border-secondary-400"
            }`}
          >
            <Settings size={15} />
            Manage Keys
            <ChevronDown size={14} className={`transition-transform ${showSetup ? "rotate-180" : ""}`} />
          </button>
          <a href={activeMode === "live" ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test/dashboard"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
            Stripe <ExternalLink size={14} />
          </a>
          <button onClick={() => fetchAll()} className="flex items-center gap-1.5 text-sm text-secondary-500 hover:text-secondary-900 transition-colors">
            <RefreshCw size={15} />Refresh
          </button>
        </div>
      </div>

      {/* Collapsible setup drawer */}
      {showSetup && (
        <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-secondary-900">Connect Stripe</h3>
            <button onClick={() => setShowSetup(false)} className="p-1 text-secondary-400 hover:text-secondary-700"><X size={18} /></button>
          </div>
          <StripeSetup activeMode={activeMode} onActivated={(mode) => { onModeSwitch(mode); setShowSetup(false); }} />
        </div>
      )}

      {/* Balance Cards */}
      {(() => {
        const balanceCards = [
          { label: "Available Balance", value: fmt(available, balanceCurrency), icon: DollarSign, color: "bg-success-50 text-success-600" },
          { label: "Pending Balance", value: fmt(pending, balanceCurrency), icon: TrendingUp, color: "bg-warning-50 text-warning-600" },
          { label: "Volume (last 20)", value: fmt(totalVolume, chargeCurrency), icon: CreditCard, color: "bg-primary-50 text-primary-600" },
          { label: "Refunded (last 20)", value: fmt(totalRefunded, chargeCurrency), icon: ArrowDownCircle, color: "bg-error-50 text-error-600" },
        ];
        return (
          <>
            {refreshError && (
              <div className="flex items-center gap-2 text-xs text-error-700 bg-error-50 border border-error-100 rounded-lg px-4 py-2">
                <AlertCircle size={14} className="flex-shrink-0" />{refreshError}
              </div>
            )}
            {!webhookStatus[activeMode] && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span><strong>{activeMode.toUpperCase()} webhook not configured.</strong> Stripe cannot confirm payments until a webhook signing secret is saved. Re-save your {activeMode} key via the Connect Stripe panel to register it.</span>
              </div>
            )}
            {activeMode !== "live" && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                These values reflect your Stripe test account — no real money involved.
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {balanceCards.map((card) => (
                <div key={card.label} className="bg-white rounded-xl p-5 border border-secondary-100 shadow-sm">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}><card.icon size={20} /></div>
                  <p className="text-xl font-bold text-secondary-900">{card.value}</p>
                  <p className="text-xs text-secondary-500 mt-1">{card.label}</p>
                </div>
              ))}
            </div>
          </>
        );
      })()}

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

      {refundTarget && <RefundModal charge={refundTarget} onClose={() => setRefundTarget(null)} onRefunded={() => loadStripeData(activeMode, false)} />}
    </div>
  );
}

export default function AdminStripePage() {
  return <ProtectedAdmin><StripeDashboard /></ProtectedAdmin>;
}
