"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Check, X, AlertCircle } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { supabase } from "@/lib/supabase";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const statusColors: Record<string, string> = {
  pending: "bg-warning-50 text-warning-600",
  active: "bg-success-50 text-success-600",
  suspended: "bg-error-50 text-error-600",
  rejected: "bg-secondary-100 text-secondary-400",
};

function AffiliatesAdmin() {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [commissions, setCommissions] = useState<Record<string, string>>({});
  const [programEnabled, setProgramEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const res = await fetch("/api/affiliates", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const list = json.affiliates ?? [];
    setAffiliates(list);
    const n: Record<string, string> = {};
    const c: Record<string, string> = {};
    for (const a of list) {
      n[a.id] = a.notes ?? "";
      c[a.id] = String(a.commission_rate ?? 0.10);
    }
    setNotes(n); setCommissions(c);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from("settings").select("affiliate_program_enabled").limit(1).maybeSingle().then(({ data }) => {
      setProgramEnabled(data?.affiliate_program_enabled !== false);
    });
  }, []);

  const act = async (action: string, id: string, extra?: object) => {
    setActing(`${action}-${id}`);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, affiliate_id: id, ...extra }),
    });
    setActing(null);
    load();
  };

  const toggleProgram = async () => {
    setToggling(true);
    const { data: row } = await supabase.from("settings").select("id").limit(1).maybeSingle();
    if (row) await supabase.from("settings").update({ affiliate_program_enabled: !programEnabled }).eq("id", row.id);
    setProgramEnabled((v) => !v);
    setToggling(false);
  };

  const pending = affiliates.filter((a) => a.status === "pending");
  const filtered = statusFilter === "all" ? affiliates : affiliates.filter((a) => a.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Affiliates</h1>
          {pending.length > 0 && (
            <p className="text-sm text-warning-600 mt-0.5 flex items-center gap-1"><AlertCircle size={14} />{pending.length} pending application{pending.length > 1 ? "s" : ""}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-secondary-500 hover:text-secondary-900"><RefreshCw size={14} />Refresh</button>
          <button onClick={toggleProgram} disabled={toggling} className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${programEnabled ? "bg-success-50 border-success-200 text-success-700 hover:bg-success-100" : "bg-secondary-100 border-secondary-200 text-secondary-500 hover:bg-secondary-200"}`}>
            {toggling ? <Loader2 size={14} className="animate-spin" /> : programEnabled ? <Check size={14} /> : <X size={14} />}
            Program {programEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "active", "suspended", "rejected"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${statusFilter === s ? "bg-secondary-900 text-white border-secondary-900" : "bg-white text-secondary-600 border-secondary-200 hover:border-secondary-400"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && <span className="ml-1.5 opacity-60">{affiliates.filter((a) => a.status === s).length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-100 p-12 text-center text-secondary-400">No affiliates found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const totalEarned = (a.affiliate_conversions ?? []).filter((c: any) => c.status !== "voided").reduce((s: number, c: any) => s + Number(c.commission_amount), 0);
            const isExpanded = expanded === a.id;
            return (
              <div key={a.id} className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-secondary-50 transition-colors" onClick={() => setExpanded(isExpanded ? null : a.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-secondary-900">{a.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[a.status] ?? "bg-secondary-100 text-secondary-500"}`}>{a.status}</span>
                    </div>
                    <p className="text-sm text-secondary-500">{a.email} · <span className="font-mono">?ref={a.code}</span></p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-secondary-900">{fmt(totalEarned)}</p>
                    <p className="text-xs text-secondary-400">{(a.affiliate_conversions ?? []).length} conversions</p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-secondary-400 shrink-0" /> : <ChevronDown size={16} className="text-secondary-400 shrink-0" />}
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-secondary-100 px-5 py-5 space-y-5 bg-secondary-50">
                    {/* Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-secondary-500">Platform</p>
                        <a href={a.platform_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">{a.platform_url}</a>
                      </div>
                      <div className="space-y-1">
                        <p className="text-secondary-500">Audience</p>
                        <p className="text-secondary-900">{(a.follower_count ?? 0).toLocaleString()} followers · {(a.total_views ?? 0).toLocaleString()} views</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-secondary-500">Payout</p>
                        <p className="text-secondary-900">{a.payout_method} → {a.payout_handle}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-secondary-500">Applied</p>
                        <p className="text-secondary-900">{new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Commission rate */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-secondary-600 shrink-0">Commission rate</label>
                      <input type="number" step="0.01" min="0" max="1" value={commissions[a.id] ?? "0.10"} onChange={(e) => setCommissions((p) => ({ ...p, [a.id]: e.target.value }))} className="input-field w-24 py-1.5 text-sm" />
                      <span className="text-sm text-secondary-400">(e.g. 0.10 = 10%)</span>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-sm text-secondary-600 block mb-1">Internal notes</label>
                      <textarea rows={2} value={notes[a.id] ?? ""} onChange={(e) => setNotes((p) => ({ ...p, [a.id]: e.target.value }))} className="input-field text-sm" placeholder="Admin notes (not visible to affiliate)" />
                    </div>
                    <button onClick={() => act("save_notes", a.id, { notes: notes[a.id], commission_rate: commissions[a.id] })} disabled={acting === `save_notes-${a.id}`} className="btn-outline py-1.5 text-sm">
                      {acting === `save_notes-${a.id}` ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}Save Notes & Rate
                    </button>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {a.status === "pending" && (
                        <>
                          <button onClick={() => act("approve", a.id)} disabled={!!acting} className="btn-primary py-1.5 text-sm px-4">
                            {acting === `approve-${a.id}` ? <Loader2 size={13} className="animate-spin inline mr-1" /> : <Check size={13} className="inline mr-1" />}Approve
                          </button>
                          <button onClick={() => act("reject", a.id)} disabled={!!acting} className="btn-outline py-1.5 text-sm px-4 text-error-600 border-error-200 hover:bg-error-50">
                            {acting === `reject-${a.id}` ? <Loader2 size={13} className="animate-spin inline mr-1" /> : <X size={13} className="inline mr-1" />}Reject
                          </button>
                        </>
                      )}
                      {a.status === "active" && (
                        <button onClick={() => act("suspend", a.id)} disabled={!!acting} className="btn-outline py-1.5 text-sm px-4 text-error-600 border-error-200 hover:bg-error-50">
                          {acting === `suspend-${a.id}` ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}Suspend
                        </button>
                      )}
                      {a.status === "suspended" && (
                        <button onClick={() => act("reactivate", a.id)} disabled={!!acting} className="btn-primary py-1.5 text-sm px-4">
                          {acting === `reactivate-${a.id}` ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminAffiliatesPage() {
  return <ProtectedAdmin><AffiliatesAdmin /></ProtectedAdmin>;
}
