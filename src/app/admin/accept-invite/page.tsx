"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Stage = "loading" | "set-password" | "done" | "error";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash: #access_token=...&type=invite
    // onAuthStateChange fires with event "PASSWORD_RECOVERY" or "SIGNED_IN"
    // after the hash is consumed. We just need to wait for the session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Token exchanged — user is now signed in, prompt for password
        setStage("set-password");
      } else if (event === "PASSWORD_RECOVERY") {
        setStage("set-password");
      }
    });

    // Also handle the case where Supabase has already consumed the hash
    // before our listener attached (fast renders)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStage("set-password");
    });

    return () => subscription.unsubscribe();
  }, []);

  // Timeout — if no token found after 5s, show error
  useEffect(() => {
    const t = setTimeout(() => {
      setStage((s) => s === "loading" ? "error" : s);
      setErrorMsg("No invite token found. Make sure you clicked the link from your invite email.");
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setErrorMsg("Passwords do not match"); return; }
    if (password.length < 8) { setErrorMsg("Password must be at least 8 characters"); return; }
    setErrorMsg("");
    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setStage("done");
    setTimeout(() => router.replace("/admin/dashboard"), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gold-500 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-secondary-900" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Invite</h1>
          <p className="text-secondary-400 mt-2">Set your password to activate your account</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl">
          {stage === "loading" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 size={32} className="animate-spin text-secondary-400" />
              <p className="text-secondary-500 text-sm">Verifying your invite link…</p>
            </div>
          )}

          {stage === "set-password" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-secondary-600 mb-2">Choose a strong password for your admin account.</p>
              {errorMsg && (
                <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{errorMsg}</div>
              )}
              <div>
                <label className="label-text">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-secondary-400" />
                  <input
                    type={show ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-9 pr-10"
                    placeholder="Min 8 characters"
                  />
                  <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-2.5 text-secondary-400">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label-text">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-secondary-400" />
                  <input
                    type={show ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input-field pl-9"
                    placeholder="Repeat password"
                  />
                </div>
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? <><Loader2 size={18} className="mr-2 animate-spin" />Activating…</> : "Activate Account"}
              </button>
            </form>
          )}

          {stage === "done" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle size={40} className="text-success-500" />
              <p className="font-semibold text-secondary-900">Account activated!</p>
              <p className="text-sm text-secondary-500">Redirecting to your dashboard…</p>
            </div>
          )}

          {stage === "error" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="text-error-600 font-semibold">Invalid or expired invite link</p>
              <p className="text-sm text-secondary-500">{errorMsg}</p>
              <button onClick={() => router.replace("/admin")} className="btn-primary text-sm">
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
