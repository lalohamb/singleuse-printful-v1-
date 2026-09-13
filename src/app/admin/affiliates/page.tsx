"use client";
import { useEffect, useState } from "react";
import { Search, CheckCircle, XCircle, PauseCircle, ExternalLink, ChevronDown, ChevronUp, RefreshCw, Users, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase, formatPrice } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";

type Affiliate = {
  id: string; name: string; email: string; code: string; status: string;
  commission_rate: number; payout_method: string; payout_handle: string;
  platform_url: string; follower_count: number; total_views: number;
  notes: string; created_at: string;
};

type Conversion = {
  id: string; order_subtotal: number; commission_amount: number;
  status: string; created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-warning-50 text-warning-700",
  active:    "bg-success-50 text-success-700",
  suspended: "bg-error-50 text-error-700",
  rejected:  "bg-secondary-100 text-secondary-500",
};

function AffiliatesAdmin() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [conversions, setConversions] = useState<Record<string, Conversion[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [programEnabled, setProgramEnabled] = useState<boolean>(true);
  const [togglingProgram, setTogglingProgram] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    const [{ data: aff }, { data: settings }] = await Promise.all([
      supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("affiliate_program_enabled").limit(1).maybeSingle(),
    ]);
    setAffiliates((aff || []) as Affiliate[]);
    setProgramEnabled(settings?.affiliate_program_enabled !== false);
    setLoading(false);
  };

  const toggleProgram = async () => {
    setTogglingProgram(true);
    const next = !programEnabled;
    await supabase.from("settings").update({ affiliate_program_enabled: next }).eq("id", (await supabase.from("settings").select("id").limit(1).maybeSingle()).data?.id);
    setProgramEnabled(next);
    setTogglingProgram(false);
  };

  useEffect(() => { fetch_(); }, []);

  const loadConversions = async (id: string) => {
    if (conversions[id]) return;
    const { data } = await supabase.from("affiliate_conversions").select("*").eq("affiliate_id", id).order("created_at", { ascending: false });
    setConversions((c) => ({ ...c, [id]: (data || []) as Conversion[] }));
  };

  const toggle = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadConversions(id);
  };

  const updateStatus = async (id: string, status: string) => {
    setSaving(id);
    await supabase.from("affiliates").update({ status }).eq("id", id);
    // If approving, also trigger approval email via API
    if (status === "active") {
      await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", affiliate_id: id }),
      }).catch(() => {});
    } else {
      setAffiliates((a) => a.map((x) => x.id === id ? { ...x, status } : x));
    }
    await fetch_();
    setSaving(null);
  };

  const saveNotes = async (id: string) => {
    setSaving(id);
    await supabase.from("affiliates").update({ notes: notes[id] ?? "" }).eq("id", id);
    setAffiliates((a) => a.map((x) => x.id === id ? { ...x, notes: notes[id] ?? "" } : x));
    setSaving(null);
  };

  const filtered = affiliates.filter((a) => {
    const q = search.toLowerCase();
    return (statusFilter === "all" || a.status === statusFilter) &&
      (a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
  });

  const pendingCount = affiliates.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Program toggle */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-secondary-900">Affiliate Program</p>
          <p className="text-sm text-secondary-500 mt-0.5">{programEnabled ? "Active — signup page is live" : "Disabled — signup page returns 404"}</p>
        </div>
        <button onClick={toggleProgram} disabled={togglingProgram} className="flex items-center gap-2 text-sm font-medium disabled:opacity-50">
          {programEnabled
            ? <><ToggleRight size={28} className="text-success-600" /><span className="text-success-700">Enabled</span></>
            : <><ToggleLeft size={28} className="text-secondary-400" /><span className="text-secondary-500">Disabled</span></>}
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg px-4 py-3 text-sm text-warning-800 font-medium">
          {pendingCount} application{pendingCount > 1 ? "s" : ""} awaiting review
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-2.5 text-secondary-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, code..." className="input-field pl-9 py-2" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field py-2 w-auto">
          <option value="all">All Status</option>
          {["pending","active","suspended","rejected"].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
        <button onClick={fetch_} disabled={loading} className="flex items-center gap-2 text-sm text-secondary-500 hover:text-secondary-900">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm text-center py-16">
          <Users size={40} className="mx-auto mb-3 text-secondary-200" />
          <p className="text-secondary-400">No affiliates found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm divide-y divide-secondary-50">
          {filtered.map((a) => (
            <div key={a.id}>
              <div className="flex items-center gap-4 px-5 py-4 hover:bg-secondary-50 transition-colors cursor-pointer" onClick={() => toggle(a.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-secondary-900">{a.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || "bg-secondary-100 text-secondary-500"}`}>{a.status}</span>
                    <code className="text-xs bg-secondary-100 px-2 py-0.5 rounded text-secondary-600">{a.code}</code>
                  </div>
                  <p className="text-sm text-secondary-500 mt-0.5">{a.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-6 text-sm text-secondary-500 flex-shrink-0">
                  <span>{(a.follower_count || 0).toLocaleString()} followers</span>
                  <span>{(a.total_views || 0).toLocaleString()} views</span>
                  <span className="capitalize">{a.payout_method}</span>
                </div>
                {expanded === a.id ? <ChevronUp size={18} className="text-secondary-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-secondary-400 flex-shrink-0" />}
              </div>

              {expanded === a.id && (
                <div className="px-5 pb-6 space-y-5 bg-secondary-50/50 border-t border-secondary-100">
                  {/* Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                    <div><p className="text-xs text-secondary-400 uppercase tracking-wide mb-1">Platform</p>
                      <a href={a.platform_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                        View Profile <ExternalLink size={12} />
                      </a>
                    </div>
                    <div><p className="text-xs text-secondary-400 uppercase tracking-wide mb-1">Payout</p>
                      <p className="text-sm text-secondary-700 capitalize">{a.payout_method}: <span className="font-medium">{a.payout_handle}</span></p>
                    </div>
                    <div><p className="text-xs text-secondary-400 uppercase tracking-wide mb-1">Commission Rate</p>
                      <p className="text-sm text-secondary-700 font-medium">{(a.commission_rate * 100).toFixed(0)}%</p>
                    </div>
                    <div><p className="text-xs text-secondary-400 uppercase tracking-wide mb-1">Followers</p>
                      <p className="text-sm text-secondary-700">{(a.follower_count || 0).toLocaleString()}</p>
                    </div>
                    <div><p className="text-xs text-secondary-400 uppercase tracking-wide mb-1">Total Views</p>
                      <p className="text-sm text-secondary-700">{(a.total_views || 0).toLocaleString()}</p>
                    </div>
                    <div><p className="text-xs text-secondary-400 uppercase tracking-wide mb-1">Applied</p>
                      <p className="text-sm text-secondary-700">{new Date(a.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {a.status !== "active" && (
                      <button onClick={() => updateStatus(a.id, "active")} disabled={saving === a.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-success-600 text-white hover:bg-success-700 transition-colors disabled:opacity-50">
                        <CheckCircle size={13} />Approve
                      </button>
                    )}
                    {a.status !== "rejected" && (
                      <button onClick={() => updateStatus(a.id, "rejected")} disabled={saving === a.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary-200 text-secondary-700 hover:bg-secondary-300 transition-colors disabled:opacity-50">
                        <XCircle size={13} />Reject
                      </button>
                    )}
                    {a.status === "active" && (
                      <button onClick={() => updateStatus(a.id, "suspended")} disabled={saving === a.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-error-50 text-error-700 hover:bg-error-100 transition-colors disabled:opacity-50">
                        <PauseCircle size={13} />Suspend
                      </button>
                    )}
                    {a.status === "suspended" && (
                      <button onClick={() => updateStatus(a.id, "active")} disabled={saving === a.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-success-50 text-success-700 hover:bg-success-100 transition-colors disabled:opacity-50">
                        <CheckCircle size={13} />Reactivate
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="label-text">Admin Notes</label>
                    <textarea
                      rows={2}
                      value={notes[a.id] ?? a.notes ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                      className="input-field text-sm"
                      placeholder="Internal notes..."
                    />
                    <button onClick={() => saveNotes(a.id)} disabled={saving === a.id}
                      className="mt-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary-900 text-white hover:bg-secondary-700 transition-colors disabled:opacity-50">
                      Save Notes
                    </button>
                  </div>

                  {/* Conversions */}
                  <div>
                    <p className="text-xs text-secondary-400 uppercase tracking-wide mb-3">Conversions</p>
                    {!conversions[a.id] ? (
                      <p className="text-sm text-secondary-400">Loading...</p>
                    ) : conversions[a.id].length === 0 ? (
                      <p className="text-sm text-secondary-400">No conversions yet.</p>
                    ) : (
                      <div className="rounded-lg border border-secondary-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary-50 border-b border-secondary-100">
                            <tr>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-secondary-600">Date</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-secondary-600">Order Subtotal</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-secondary-600">Commission</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-secondary-600">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-secondary-50 bg-white">
                            {conversions[a.id].map((c) => (
                              <tr key={c.id}>
                                <td className="px-4 py-2 text-secondary-600">{new Date(c.created_at).toLocaleDateString()}</td>
                                <td className="px-4 py-2">{formatPrice(c.order_subtotal)}</td>
                                <td className="px-4 py-2 font-semibold text-success-700">{formatPrice(c.commission_amount)}</td>
                                <td className="px-4 py-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] || "bg-secondary-100 text-secondary-500"}`}>{c.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="px-4 py-2 bg-secondary-50 border-t border-secondary-100 text-xs text-secondary-600 flex justify-between">
                          <span>Total earned</span>
                          <span className="font-semibold text-success-700">
                            {formatPrice(conversions[a.id].filter((c) => c.status !== "voided").reduce((s, c) => s + c.commission_amount, 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminAffiliatesPage() {
  return <ProtectedAdmin><AffiliatesAdmin /></ProtectedAdmin>;
}
