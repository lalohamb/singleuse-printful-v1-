"use client";
import { useEffect, useState } from "react";
import { DollarSign, CheckCircle, RefreshCw, Send } from "lucide-react";
import { supabase, formatPrice } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";

type PayoutRow = {
  affiliate_id: string;
  name: string;
  email: string;
  payout_method: string;
  payout_handle: string;
  code: string;
  pending_amount: number;
  conversion_ids: string[];
};

type Payout = {
  id: string;
  affiliate_id: string;
  period: string;
  total_amount: number;
  payout_method: string;
  payout_handle: string;
  stripe_memo: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  affiliates: { name: string; email: string; code: string } | null;
};

function PayoutsAdmin() {
  const [queue, setQueue] = useState<PayoutRow[]>([]);
  const [history, setHistory] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [stripeAccounts, setStripeAccounts] = useState<Record<string, string>>();

  const load = async () => {
    setLoading(true);

    // Load approved conversions not yet paid, grouped by affiliate
    const { data: convs } = await supabase
      .from("affiliate_conversions")
      .select("id, affiliate_id, commission_amount, status")
      .eq("status", "approved");

    // Load affiliates
    const { data: affs } = await supabase
      .from("affiliates")
      .select("id, name, email, code, payout_method, payout_handle")
      .eq("status", "active");

    const affMap = new Map((affs || []).map((a) => [a.id, a]));

    // Group by affiliate, only those >= $99
    const grouped: Record<string, PayoutRow> = {};
    for (const c of convs || []) {
      const aff = affMap.get(c.affiliate_id);
      if (!aff) continue;
      if (!grouped[c.affiliate_id]) {
        grouped[c.affiliate_id] = {
          affiliate_id: c.affiliate_id,
          name: aff.name,
          email: aff.email,
          payout_method: aff.payout_method,
          payout_handle: aff.payout_handle,
          code: aff.code,
          pending_amount: 0,
          conversion_ids: [],
        };
      }
      grouped[c.affiliate_id].pending_amount += c.commission_amount;
      grouped[c.affiliate_id].conversion_ids.push(c.id);
    }

    setQueue(Object.values(grouped).filter((r) => r.pending_amount >= 99));

    // Load payout history
    const { data: payouts } = await supabase
      .from("affiliate_payouts")
      .select("*, affiliates(name, email, code)")
      .order("created_at", { ascending: false })
      .limit(50);

    setHistory((payouts || []) as Payout[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (row: PayoutRow) => {
    setProcessing(row.affiliate_id);
    const period = new Date().toISOString().slice(0, 7);
    const memo = memos[row.affiliate_id] || "";
    const stripeAccountId = stripeAccounts?.[row.affiliate_id] || "";

    // Insert payout record first
    const { data: payout, error } = await supabase
      .from("affiliate_payouts")
      .insert({
        affiliate_id: row.affiliate_id,
        period,
        total_amount: row.pending_amount,
        payout_method: row.payout_method,
        payout_handle: row.payout_handle,
        stripe_memo: memo,
        status: "pending",
      })
      .select()
      .single();

    if (error || !payout) {
      alert("Failed to create payout: " + (error?.message || "unknown error"));
      setProcessing(null);
      return;
    }

    // Link conversions to payout
    await supabase
      .from("affiliate_conversions")
      .update({ payout_id: payout.id })
      .in("id", row.conversion_ids);

    // Call API to finalize (Stripe transfer + email)
    const res = await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "payout",
        payout_id: payout.id,
        memo,
        ...(stripeAccountId ? { stripe_account_id: stripeAccountId } : {}),
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      alert("Payout API error: " + (result.error || "unknown"));
    } else if (result.stripe_transfer_id) {
      alert(`✅ Paid! Stripe Transfer ID: ${result.stripe_transfer_id}`);
    } else {
      alert("✅ Payout marked as paid and email sent.");
    }

    await load();
    setProcessing(null);
  };

  const approveConversions = async () => {
    // Auto-approve pending conversions older than 14 days
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("affiliate_conversions")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("status", "pending")
      .lt("created_at", cutoff);
    const approvedCount = Array.isArray(count) ? count.length : 0;
    alert(`Conversions approved.`);
    await load();
  };

  return (
    <div className="space-y-8">
      {/* Approve pending */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-secondary-900">Approve Pending Conversions</p>
          <p className="text-sm text-secondary-500 mt-0.5">Auto-approves all conversions older than 14 days (past refund window).</p>
        </div>
        <button onClick={approveConversions} className="btn-primary py-2 text-sm flex items-center gap-2 flex-shrink-0">
          <CheckCircle size={16} />Run Approval
        </button>
      </div>

      {/* Payout queue */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
          <div>
            <h2 className="font-semibold text-secondary-900">Payout Queue</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Affiliates with ≥ $99 in approved commissions</p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-sm text-secondary-500 hover:text-secondary-900">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-7 w-7 border-2 border-secondary-300 border-t-secondary-900" /></div>
        ) : queue.length === 0 ? (
          <div className="text-center py-12 text-secondary-400">
            <DollarSign size={36} className="mx-auto mb-3 text-secondary-200" />
            <p>No payouts due right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-50">
            {queue.map((row) => (
              <div key={row.affiliate_id} className="px-5 py-4 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-secondary-900">{row.name}</p>
                    <p className="text-sm text-secondary-500">{row.email}</p>
                    <p className="text-xs text-secondary-400 mt-0.5 capitalize">
                      {row.payout_method}: <span className="font-medium text-secondary-700">{row.payout_handle}</span>
                      <span className="ml-3">{row.conversion_ids.length} conversion{row.conversion_ids.length !== 1 ? "s" : ""}</span>
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-success-700">{formatPrice(row.pending_amount)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    value={memos[row.affiliate_id] || ""}
                    onChange={(e) => setMemos((m) => ({ ...m, [row.affiliate_id]: e.target.value }))}
                    placeholder="Stripe transfer ID or memo (optional)"
                    className="input-field py-2 text-sm flex-1"
                  />
                  <input
                    value={stripeAccounts?.[row.affiliate_id] || ""}
                    onChange={(e) => setStripeAccounts((s) => ({ ...s, [row.affiliate_id]: e.target.value }))}
                    placeholder="Stripe Connect acct_xxx (optional)"
                    className="input-field py-2 text-sm flex-1"
                  />
                  <button
                    onClick={() => markPaid(row)}
                    disabled={processing === row.affiliate_id}
                    className="btn-primary py-2 text-sm flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
                  >
                    {processing === row.affiliate_id
                      ? <><RefreshCw size={14} className="animate-spin" />Processing...</>
                      : <><Send size={14} />Mark Paid</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout history */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-secondary-100">
          <h2 className="font-semibold text-secondary-900">Payout History</h2>
        </div>
        {history.length === 0 ? (
          <p className="text-center py-10 text-secondary-400 text-sm">No payouts recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Affiliate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Period</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 hidden md:table-cell">Method</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 hidden lg:table-cell">Memo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {history.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-secondary-900">{p.affiliates?.name || "—"}</p>
                      <p className="text-xs text-secondary-400">{p.affiliates?.code}</p>
                    </td>
                    <td className="px-4 py-3 text-secondary-600">{p.period}</td>
                    <td className="px-4 py-3 font-semibold text-success-700">{formatPrice(p.total_amount)}</td>
                    <td className="px-4 py-3 text-secondary-600 hidden md:table-cell capitalize">{p.payout_method}: {p.payout_handle}</td>
                    <td className="px-4 py-3 text-secondary-500 hidden lg:table-cell text-xs">{p.stripe_memo || "—"}</td>
                    <td className="px-4 py-3 text-secondary-600 text-xs">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPayoutsPage() {
  return <ProtectedAdmin><PayoutsAdmin /></ProtectedAdmin>;
}
