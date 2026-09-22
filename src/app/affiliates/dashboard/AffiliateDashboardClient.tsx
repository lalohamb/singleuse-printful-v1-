"use client";
import { useEffect, useState } from "react";
import { Copy, Check, TrendingUp, DollarSign, MousePointer, CreditCard } from "lucide-react";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const statusColors: Record<string, string> = {
  pending: "bg-warning-50 text-warning-600",
  approved: "bg-primary-50 text-primary-600",
  paid: "bg-success-50 text-success-600",
  voided: "bg-secondary-100 text-secondary-400",
};

export default function AffiliateDashboardClient() {
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) { setInput(c); loadDashboard(c); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboard = async (c: string) => {
    setLoading(true); setError(null);
    const res = await fetch(`/api/affiliates/dashboard?code=${encodeURIComponent(c)}`);
    const json = await res.json();
    if (!res.ok) { setError(json.error); setLoading(false); return; }
    setData(json); setCode(c);
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(data.referral_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 space-y-8">
      <div className="space-y-1">
        <Link href="/affiliates" className="text-sm text-secondary-400 hover:text-secondary-700">← Affiliate Program</Link>
        <h1 className="text-3xl font-bold text-secondary-900">Affiliate Dashboard</h1>
      </div>

      {!data && (
        <div className="bg-white border border-secondary-100 rounded-2xl p-6 shadow-sm space-y-4">
          <p className="text-secondary-600">Enter your affiliate code to view your dashboard.</p>
          <div className="flex gap-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Your affiliate code" className="input-field flex-1" onKeyDown={(e) => e.key === "Enter" && loadDashboard(input)} />
            <button onClick={() => loadDashboard(input)} disabled={!input || loading} className="btn-primary px-6 disabled:opacity-50">
              {loading ? "Loading..." : "View"}
            </button>
          </div>
          {error && <p className="text-sm text-error-600">{error}</p>}
        </div>
      )}

      {data && (
        <>
          <div className="bg-secondary-900 text-white rounded-2xl p-6 space-y-1">
            <p className="text-secondary-400 text-sm">Welcome back,</p>
            <p className="text-xl font-bold">{data.affiliate.name}</p>
            <p className="text-secondary-400 text-sm">{data.affiliate.commission_rate * 100}% commission rate</p>
          </div>

          <div className="bg-white border border-secondary-100 rounded-2xl p-5 space-y-2 shadow-sm">
            <p className="text-sm font-semibold text-secondary-900">Your Referral Link</p>
            <div className="flex items-center gap-2">
              <input readOnly value={data.referral_url} className="input-field flex-1 font-mono text-sm bg-secondary-50" />
              <button onClick={copy} className="btn-outline px-4 py-2 flex items-center gap-1.5 shrink-0">
                {copied ? <><Check size={14} />Copied!</> : <><Copy size={14} />Copy</>}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Clicks", value: data.stats.total_clicks, icon: MousePointer, color: "bg-primary-50 text-primary-600" },
              { label: "Conversions", value: data.stats.total_conversions, icon: TrendingUp, color: "bg-success-50 text-success-600" },
              { label: "Pending", value: fmt(data.stats.pending_earnings), icon: CreditCard, color: "bg-warning-50 text-warning-600" },
              { label: "Paid Out", value: fmt(data.stats.paid_earnings), icon: DollarSign, color: "bg-success-50 text-success-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-secondary-100 rounded-xl p-4 shadow-sm">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}><s.icon size={16} /></div>
                <p className="text-lg font-bold text-secondary-900">{s.value}</p>
                <p className="text-xs text-secondary-500">{s.label}</p>
              </div>
            ))}
          </div>

          {data.stats.approved_earnings > 0 && (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-primary-800">
              <strong>${data.stats.approved_earnings.toFixed(2)} approved</strong> and ready for payout on the 1st of next month.
              {data.stats.approved_earnings < 99 && ` ($${(99 - data.stats.approved_earnings).toFixed(2)} away from the $99 minimum.)`}
            </div>
          )}

          <div className="bg-white border border-secondary-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-secondary-100">
              <h2 className="font-semibold text-secondary-900">Conversions</h2>
            </div>
            {data.conversions.length === 0 ? (
              <p className="p-8 text-center text-secondary-400 text-sm">No conversions yet. Share your link to start earning!</p>
            ) : (
              <div className="divide-y divide-secondary-50">
                {data.conversions.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-secondary-900">{fmt(c.commission_amount)} commission</p>
                      <p className="text-xs text-secondary-400">Order: {fmt(c.order_subtotal)} · {new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[c.status] ?? "bg-secondary-100 text-secondary-500"}`}>{c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.payouts.length > 0 && (
            <div className="bg-white border border-secondary-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-secondary-100">
                <h2 className="font-semibold text-secondary-900">Payout History</h2>
              </div>
              <div className="divide-y divide-secondary-50">
                {data.payouts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-secondary-900">{fmt(p.total_amount)}</p>
                      <p className="text-xs text-secondary-400">{p.period} · {p.payout_method} → {p.payout_handle}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${p.status === "paid" ? "bg-success-50 text-success-600" : "bg-warning-50 text-warning-600"}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
