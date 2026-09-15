"use client";
import { useEffect, useState } from "react";
import { Copy, CheckCircle, DollarSign, MousePointer, TrendingUp, Clock, LogOut, ExternalLink } from "lucide-react";
import { supabase, formatPrice } from "@/lib/supabase";
import StorefrontLayout from "@/components/StorefrontLayout";
import Link from "next/link";

type Affiliate = {
  id: string; name: string; email: string; code: string; status: string;
  commission_rate: number; payout_method: string; payout_handle: string;
};
type Conversion = {
  id: string; order_subtotal: number; commission_amount: number;
  status: string; created_at: string;
};
type Payout = {
  id: string; period: string; total_amount: number;
  payout_method: string; payout_handle: string;
  stripe_memo: string; status: string; paid_at: string | null; created_at: string;
};

const CONV_COLORS: Record<string, string> = {
  pending:  "bg-warning-50 text-warning-700",
  approved: "bg-primary-50 text-primary-700",
  paid:     "bg-success-50 text-success-700",
  voided:   "bg-secondary-100 text-secondary-500",
};

export default function AffiliateDashboard() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [clicks, setClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<"loading" | "unauthenticated" | "not_affiliate" | "pending" | "rejected" | "suspended" | "ready">("loading");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setAuthState("unauthenticated"); setLoading(false); return; }
      loadAffiliate(session.user.email!);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) loadAffiliate(session.user.email!);
      else { setAuthState("unauthenticated"); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadAffiliate = async (email: string) => {
    setLoading(true);
    const { data: aff } = await supabase.from("affiliates").select("*").eq("email", email.toLowerCase()).maybeSingle();

    if (!aff) { setAuthState("not_affiliate"); setLoading(false); return; }
    if (aff.status === "pending")   { setAuthState("pending");   setLoading(false); return; }
    if (aff.status === "rejected")  { setAuthState("rejected");  setLoading(false); return; }
    if (aff.status === "suspended") { setAuthState("suspended"); setLoading(false); return; }

    setAffiliate(aff as Affiliate);

    const [{ data: convs }, { data: pays }, { count }] = await Promise.all([
      supabase.from("affiliate_conversions").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }),
      supabase.from("affiliate_payouts").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }),
      supabase.from("affiliate_clicks").select("*", { count: "exact", head: true }).eq("code", aff.code),
    ]);

    setConversions((convs || []) as Conversion[]);
    setPayouts((pays || []) as Payout[]);
    setClicks(count || 0);
    setAuthState("ready");
    setLoading(false);
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    await supabase.auth.signInWithOtp({ email: loginEmail, options: { emailRedirectTo: `${window.location.origin}/affiliates/dashboard` } });
    setLoginSent(true);
    setLoginLoading(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const copyLink = () => {
    if (!affiliate) return;
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${affiliate.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalEarned = conversions.filter((c) => c.status !== "voided").reduce((s, c) => s + c.commission_amount, 0);
  const pendingEarnings = conversions.filter((c) => c.status === "pending").reduce((s, c) => s + c.commission_amount, 0);
  const approvedEarnings = conversions.filter((c) => c.status === "approved").reduce((s, c) => s + c.commission_amount, 0);
  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.total_amount, 0);

  // ── Auth states ──────────────────────────────────────────────────────────
  if (authState === "loading" || loading) {
    return (
      <StorefrontLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" />
        </div>
      </StorefrontLayout>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <StorefrontLayout>
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <p className="text-gold-500 uppercase tracking-widest text-xs font-semibold mb-2">Affiliate Portal</p>
              <h1 className="text-2xl font-bold text-secondary-900">Sign In</h1>
              <p className="text-secondary-500 text-sm mt-2">We&apos;ll send a magic link to your email.</p>
            </div>
            {loginSent ? (
              <div className="text-center bg-success-50 border border-success-100 rounded-xl p-6">
                <CheckCircle size={32} className="text-success-600 mx-auto mb-3" />
                <p className="font-semibold text-secondary-900">Check your email</p>
                <p className="text-sm text-secondary-500 mt-1">We sent a sign-in link to <strong>{loginEmail}</strong></p>
              </div>
            ) : (
              <form onSubmit={sendMagicLink} className="space-y-4 bg-white rounded-2xl border border-secondary-100 shadow-sm p-6">
                <div>
                  <label className="label-text">Email Address</label>
                  <input required type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="input-field" placeholder="you@example.com" />
                </div>
                <button type="submit" disabled={loginLoading} className="btn-gold w-full">
                  {loginLoading ? "Sending..." : "Send Magic Link"}
                </button>
              </form>
            )}
            <p className="text-center text-sm text-secondary-400 mt-6">
              Not an affiliate yet? <Link href="/affiliates/signup" className="text-primary-600 hover:underline">Apply here</Link>
            </p>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  if (authState === "not_affiliate") {
    return (
      <StorefrontLayout>
        <div className="min-h-[60vh] flex items-center justify-center px-4 text-center">
          <div className="max-w-sm">
            <h2 className="text-xl font-bold text-secondary-900 mb-3">No affiliate account found</h2>
            <p className="text-secondary-500 mb-6">This email isn&apos;t linked to an affiliate account.</p>
            <Link href="/affiliates/signup" className="btn-gold">Apply Now</Link>
            <button onClick={signOut} className="block mx-auto mt-4 text-sm text-secondary-400 hover:text-secondary-700">Sign out</button>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  if (authState === "pending") {
    return (
      <StorefrontLayout>
        <div className="min-h-[60vh] flex items-center justify-center px-4 text-center">
          <div className="max-w-sm">
            <Clock size={40} className="text-warning-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-secondary-900 mb-3">Application Under Review</h2>
            <p className="text-secondary-500 mb-6">We&apos;ll email you within 3–5 business days once your application is reviewed.</p>
            <button onClick={signOut} className="text-sm text-secondary-400 hover:text-secondary-700">Sign out</button>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  if (authState === "rejected" || authState === "suspended") {
    return (
      <StorefrontLayout>
        <div className="min-h-[60vh] flex items-center justify-center px-4 text-center">
          <div className="max-w-sm">
            <h2 className="text-xl font-bold text-secondary-900 mb-3">
              {authState === "rejected" ? "Application Not Approved" : "Account Suspended"}
            </h2>
            <p className="text-secondary-500 mb-6">
              {authState === "rejected"
                ? "Unfortunately your application didn't meet our current requirements."
                : "Your account has been suspended. Please contact us for more information."}
            </p>
            <button onClick={signOut} className="text-sm text-secondary-400 hover:text-secondary-700">Sign out</button>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  return (
    <StorefrontLayout>
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-gold-500 uppercase tracking-widest text-xs font-semibold mb-1">Affiliate Dashboard</p>
            <h1 className="text-2xl font-bold text-secondary-900">Hey, {affiliate!.name.split(" ")[0]} 👋</h1>
            <p className="text-secondary-500 text-sm mt-1">{(affiliate!.commission_rate * 100).toFixed(0)}% commission · Payouts via {affiliate!.payout_method}</p>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-secondary-400 hover:text-secondary-700">
            <LogOut size={16} />Sign out
          </button>
        </div>

        {/* Referral link */}
        <div className="bg-secondary-900 rounded-2xl p-6 text-white">
          <p className="text-xs text-white/50 uppercase tracking-widest mb-2">Your Referral Link</p>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="flex-1 bg-white/10 rounded-lg px-4 py-2.5 text-sm font-mono break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/?ref=${affiliate!.code}` : `/?ref=${affiliate!.code}`}
            </code>
            <button onClick={copyLink} className="flex items-center gap-2 btn-gold flex-shrink-0">
              {copied ? <><CheckCircle size={16} />Copied!</> : <><Copy size={16} />Copy Link</>}
            </button>
          </div>
          <p className="text-white/40 text-xs mt-3">Share this link anywhere. You earn {(affiliate!.commission_rate * 100).toFixed(0)}% on every order placed within 30 days of a click.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Earned",      value: formatPrice(totalEarned),      icon: DollarSign,    color: "bg-success-50 text-success-600" },
            { label: "Pending",           value: formatPrice(pendingEarnings),   icon: Clock,         color: "bg-warning-50 text-warning-600" },
            { label: "Ready to Pay Out",  value: formatPrice(approvedEarnings),  icon: TrendingUp,    color: "bg-primary-50 text-primary-600" },
            { label: "Link Clicks",       value: clicks.toLocaleString(),        icon: MousePointer,  color: "bg-secondary-100 text-secondary-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-secondary-100 shadow-sm p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon size={20} />
              </div>
              <p className="text-xl font-bold text-secondary-900">{s.value}</p>
              <p className="text-xs text-secondary-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {approvedEarnings > 0 && approvedEarnings < 99 && (
          <div className="bg-warning-50 border border-warning-100 rounded-xl p-4 text-sm text-warning-800">
            You have <strong>{formatPrice(approvedEarnings)}</strong> approved — you need <strong>{formatPrice(99 - approvedEarnings)}</strong> more to reach the $99 payout threshold.
          </div>
        )}

        {/* Conversions */}
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-100">
            <h2 className="font-semibold text-secondary-900">Conversions</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Orders placed through your link</p>
          </div>
          {conversions.length === 0 ? (
            <div className="text-center py-12 text-secondary-400">
              <TrendingUp size={32} className="mx-auto mb-3 text-secondary-200" />
              <p>No conversions yet. Start sharing your link!</p>
              <Link href="/" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline mt-3">
                Visit Store <ExternalLink size={13} />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary-50 border-b border-secondary-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Order Value</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Your Commission</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-50">
                  {conversions.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary-50">
                      <td className="px-4 py-3 text-secondary-600">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{formatPrice(c.order_subtotal)}</td>
                      <td className="px-4 py-3 font-semibold text-success-700">{formatPrice(c.commission_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONV_COLORS[c.status] || "bg-secondary-100 text-secondary-500"}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-secondary-100 bg-secondary-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-xs text-secondary-500">Total earned (excl. voided)</td>
                    <td className="px-4 py-3 font-bold text-success-700">{formatPrice(totalEarned)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Payout history */}
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-100">
            <h2 className="font-semibold text-secondary-900">Payout History</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Total paid out: <strong>{formatPrice(totalPaid)}</strong></p>
          </div>
          {payouts.length === 0 ? (
            <p className="text-center py-10 text-secondary-400 text-sm">No payouts yet. Payouts go out on the 1st of each month once you hit $99.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary-50 border-b border-secondary-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Period</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Method</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600">Date Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-50">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary-50">
                      <td className="px-4 py-3 text-secondary-600">{p.period}</td>
                      <td className="px-4 py-3 font-semibold text-success-700">{formatPrice(p.total_amount)}</td>
                      <td className="px-4 py-3 text-secondary-600 capitalize">{p.payout_method}: {p.payout_handle}</td>
                      <td className="px-4 py-3 text-secondary-600">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </StorefrontLayout>
  );
}
