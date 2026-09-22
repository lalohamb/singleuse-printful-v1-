"use client";
import { useEffect, useState } from "react";
import { Shield, Trash2, UserPlus, RefreshCw, Crown, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminAuth } from "@/lib/admin-auth";

type AdminRow = { id: string; email: string; role: string; created_at: string };

function authHeader(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function AdminAccounts() {
  const { session, admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === "super_admin";
  const token = session?.access_token ?? "";

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviting, setInviting] = useState(false);

  // Password change
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwShow, setPwShow] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/manage", { headers: authHeader(token) });
    const data = await res.json();
    setAdmins(data.admins ?? []);
    setLoading(false);
  };

  useEffect(() => { if (token) load(); }, [token]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const res = await fetch("/api/admin/manage", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({ action: "invite", email: inviteEmail.trim(), role: inviteRole }),
    });
    const data = await res.json();
    setInviting(false);
    if (data.ok) { setInviteEmail(""); flash(data.message, true); load(); }
    else flash(data.error, false);
  };

  const remove = async (id: string, email: string) => {
    if (!confirm(`Remove admin access for ${email}? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/manage", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({ action: "remove", id }),
    });
    const data = await res.json();
    if (data.ok) { flash(`${email} removed`, true); load(); }
    else flash(data.error, false);
  };

  const changeRole = async (id: string, role: string) => {
    const res = await fetch("/api/admin/manage", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({ action: "change_role", id, role }),
    });
    const data = await res.json();
    if (data.ok) { flash("Role updated", true); load(); }
    else flash(data.error, false);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) { setPwMsg({ text: "Passwords do not match", ok: false }); return; }
    if (pwNew.length < 8) { setPwMsg({ text: "Password must be at least 8 characters", ok: false }); return; }
    // Verify current password by re-signing in
    setPwLoading(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: admin?.email ?? "", password: pwCurrent });
    if (signInErr) { setPwMsg({ text: "Current password is incorrect", ok: false }); setPwLoading(false); return; }
    const { error: updateErr } = await supabase.auth.updateUser({ password: pwNew });
    setPwLoading(false);
    if (updateErr) { setPwMsg({ text: updateErr.message, ok: false }); return; }
    setPwMsg({ text: "Password updated successfully", ok: true });
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
    setTimeout(() => setPwMsg(null), 4000);
  };

  return (
    <div className="space-y-8">
      {/* Admin list */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary-500" />
            <h2 className="font-semibold text-secondary-900">Admin Accounts</h2>
            <span className="text-xs bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-full">{admins.length} / 3</span>
          </div>
          <button onClick={load} className="p-1.5 text-secondary-400 hover:text-secondary-700 transition-colors"><RefreshCw size={15} /></button>
        </div>

        {msg && <p className={`text-sm mb-4 px-3 py-2 rounded-lg ${msg.ok ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>{msg.text}</p>}

        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-secondary-300 border-t-secondary-900" /></div>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-secondary-100 bg-secondary-50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${a.role === "super_admin" ? "bg-gold-100 text-gold-700" : "bg-primary-50 text-primary-600"}`}>
                    {a.role === "super_admin" ? <Crown size={14} /> : a.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary-900">{a.email}</p>
                    <p className="text-xs text-secondary-400">
                      {a.role === "super_admin" ? "Super Admin" : "Admin"} · Added {new Date(a.created_at).toLocaleDateString()}
                      {a.id === session?.user.id && <span className="ml-1 text-primary-500">(you)</span>}
                    </p>
                  </div>
                </div>
                {isSuperAdmin && a.id !== session?.user.id && (
                  <div className="flex items-center gap-2">
                    <select
                      value={a.role}
                      onChange={(e) => changeRole(a.id, e.target.value)}
                      className="text-xs border border-secondary-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    >
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                    <button onClick={() => remove(a.id, a.email)} className="p-1.5 text-error-400 hover:text-error-600 hover:bg-error-50 rounded transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Invite form — super_admin only, max 3 */}
        {isSuperAdmin && admins.length < 3 && (
          <form onSubmit={invite} className="mt-4 pt-4 border-t border-secondary-100 flex flex-wrap gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="new-admin@email.com"
              className="input-field flex-1 min-w-[200px] py-2 text-sm"
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="input-field py-2 text-sm w-auto">
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <button type="submit" disabled={inviting} className="btn-primary py-2 text-sm flex items-center gap-1.5">
              <UserPlus size={15} />{inviting ? "Sending…" : "Send Invite"}
            </button>
          </form>
        )}
        {isSuperAdmin && admins.length >= 3 && (
          <p className="mt-4 pt-4 border-t border-secondary-100 text-xs text-secondary-400">Maximum of 3 admins reached. Remove one to invite another.</p>
        )}
        {!isSuperAdmin && (
          <p className="mt-4 pt-4 border-t border-secondary-100 text-xs text-secondary-400">Only a Super Admin can invite or remove admins.</p>
        )}
      </div>

      {/* Password change */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={18} className="text-primary-500" />
          <h2 className="font-semibold text-secondary-900">Change Your Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-4 max-w-sm">
          {pwMsg && <p className={`text-sm px-3 py-2 rounded-lg ${pwMsg.ok ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>{pwMsg.text}</p>}
          <div>
            <label className="label-text">Current Password</label>
            <div className="relative">
              <input type={pwShow ? "text" : "password"} required value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} className="input-field pr-10" placeholder="••••••••" />
              <button type="button" onClick={() => setPwShow(s => !s)} className="absolute right-3 top-2.5 text-secondary-400">{pwShow ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <div>
            <label className="label-text">New Password</label>
            <input type={pwShow ? "text" : "password"} required minLength={8} value={pwNew} onChange={(e) => setPwNew(e.target.value)} className="input-field" placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="label-text">Confirm New Password</label>
            <input type={pwShow ? "text" : "password"} required minLength={8} value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} className="input-field" placeholder="Repeat new password" />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary text-sm py-2">
            {pwLoading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
