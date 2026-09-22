"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Check, DollarSign, AlertCircle } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { supabase } from "@/lib/supabase";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const PAYOUT_MIN = 99;
const PENDING_DAYS = 14;

function PayoutsAdmin() {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const res = await fetch("/api/affiliates/payouts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setAffiliates(json.affiliates ?? []);
    setConversions(json.conversions ?? []);
    setPayouts(json.payouts ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const act = async (action: string, key: string, body: object) => {
    setActing(key);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...body }),
    });
    setActing(null);
    load();
  };

  const now = Date.now();
  const eligibleConversions = conversions.filter((c) => {
    const age = (now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return age >= PENDING_DAYS;
  });

  // Group approved conversions by affiliate
  const approvedByAffiliate: Record<string, { affiliate: any; total: number; ids: string[] }> = {};
  for (const c of conversions.filter((c) => c.status === "approved")) {
    const aff = affiliates.find((a) => a.id === c.affiliate_id);
    if (!aff) continue;
    if (!approvedByAffiliate[aff.id]) approvedByAffiliate[aff.id] = { affiliate: aff, total: 0, ids: [] };
    approvedByAffiliate[aff.id].total += Number(c.commission_amount);
    approvedByAffiliate[aff.id].ids.push(c.id);
  }
  const payoutQueue = Object.values(approvedByAffiliate).filter((e) => e.total >= PAYOUT_MIN);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Affiliate Payouts</h1>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-secondary-500 hover:text-secondary-900"><RefreshCw size={14} />Refresh</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
      ) : (
        <>
          {/* Step 1 — Approve eligible conversions */}
          <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-secondary-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-secondary-900">Step 1 — Approve Conversions</h2>
                <p className="text-xs text-secondary-400 mt-0.5">Conversions older than {PENDING_DAYS} days are eligible. Approve before issuing payouts.</p>
              </div>
              {eligibleConversions.filter((c) => c.status === "pending").length > 0 && (
                <span className="text-xs bg-warning-50 text-warning-600 px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertCircle size={12} />{eligibleConversions.filter((c) => c.status === "pending").length} ready
                </span>
              )}
            </div>
            {eligibleConversions.length === 0 ? (
              <p className="p-8 text-center text-secondary-400 text-sm">No conversions eligible yet.</p>
            ) : (
              <div className="divide-y divide-secondary-50">
                {eligibleConversions.map((c) => {
                  const aff = affiliates.find((a) => a.id === c.affiliate_id);
                  const age = Math.floor((now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-secondary-900">{aff?.name ?? "Unknown"}</p>
                        <p className="text-xs text-secondary-400">Order: {fmt(c.order_subtotal)} · Commission: {fmt(c.commission_amount)} · {age}d ago</p>
                      </div>
                      {c.status === "approved" ? (
                        <span className="text-xs text-success-600 flex items-center gap-1"><Check size={12} />Approved</span>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => act("approve_conversion", `approve-${c.id}`, { conversion_id: c.id })} disabled={!!acting} className="text-xs px-3 py-1.5 rounded-lg bg-success-600 text-white hover:bg-success-700 disabled:opacity-50">
                            {acting === `approve-${c.id}` ? <Loader2 size={11} className="animate-spin inline" /> : "Approve"}
                          </button>
                          <button onClick={() => act("void_conversion", `void-${c.id}`, { conversion_id: c.id })} disabled={!!acting} className="text-xs px-3 py-1.5 rounded-lg border border-secondary-200 text-secondary-600 hover:bg-secondary-50 disabled:opacity-50">
                            Void
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2 — Payout queue */}
          <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-secondary-100">
              <h2 className="font-semibold text-secondary-900">Step 2 — Issue Payouts</h2>
              <p className="text-xs text-secondary-400 mt-0.5">Affiliates with ≥ ${PAYOUT_MIN} in approved commissions.</p>
            </div>
            {payoutQueue.length === 0 ? (
              <p className="p-8 text-center text-secondary-400 text-sm">No affiliates have reached the ${PAYOUT_MIN} payout threshold yet.</p>
            ) : (
              <div className="divide-y divide-secondary-50">
                {payoutQueue.map((entry) => (
                  <div key={entry.affiliate.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-secondary-900">{entry.affiliate.name}</p>
                        <p className="text-sm text-secondary-500">{entry.affiliate.email}</p>
                        <p className="text-sm text-secondary-700 mt-1">
                          <span className="font-semibold text-success-700">{fmt(entry.total)}</span> via {entry.affiliate.payout_method} → <span className="font-mono">{entry.affiliate.payout_handle}</span>
                        </p>
                      </div>
                      <DollarSign size={20} className="text-success-500 shrink-0 mt-1" />
                    </div>
                    <div className="flex items-center gap-3">
                      <input value={memos[entry.affiliate.id] ?? ""} onChange={(e) => setMemos((p) => ({ ...p, [entry.affiliate.id]: e.target.value }))} placeholder="Optional memo / reference" className="input-field flex-1 py-1.5 text-sm" />
                      <button
                        onClick={() => act("payout", `payout-${entry.affiliate.id}`, { affiliate_id: entry.affiliate.id, memo: memos[entry.affiliate.id] ?? "", period: new Date().toISOString().slice(0, 7) })}
                        disabled={!!acting}
                        className="btn-primary py-1.5 text-sm px-5 shrink-0 disabled:opacity-50"
                      >
                        {acting === `payout-${entry.affiliate.id}` ? <Loader2 size={13} className="animate-spin inline mr-1" /> : <Check size={13} className="inline mr-1" />}Mark Paid
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payout history */}
          <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-secondary-100">
              <h2 className="font-semibold text-secondary-900">Payout History</h2>
            </div>
            {payouts.length === 0 ? (
              <p className="p-8 text-center text-secondary-400 text-sm">No payouts issued yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary-50 border-b border-secondary-100">
                    <tr>
                      {["Affiliate", "Period", "Amount", "Method", "Status", "Date"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-50">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-secondary-50">
                        <td className="px-4 py-3 text-sm font-medium text-secondary-900">{(p.affiliates as any)?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-secondary-600">{p.period}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-secondary-900">{fmt(p.total_amount)}</td>
                        <td className="px-4 py-3 text-sm text-secondary-600">{p.payout_method} → {p.payout_handle}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${p.status === "paid" ? "bg-success-50 text-success-600" : "bg-warning-50 text-warning-600"}`}>{p.status}</span></td>
                        <td className="px-4 py-3 text-sm text-secondary-500">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminAffiliatePayoutsPage() {
  return <ProtectedAdmin><PayoutsAdmin /></ProtectedAdmin>;
}
