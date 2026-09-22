"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const { signIn, admin, loading } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const lockMinsLeft = lockedUntil ? Math.ceil((lockedUntil - Date.now()) / 60000) : 0;

  // Redirect once admin is confirmed — avoids race with checkAdmin()
  useEffect(() => {
    if (!loading && admin) router.replace("/admin/dashboard");
  }, [admin, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setSubmitting(true); setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setError(`Too many failed attempts. Try again in ${LOCKOUT_MS / 60000} minutes.`);
      } else {
        setError(`${error} (${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining)`);
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gold-500 flex items-center justify-center mx-auto mb-4"><ShieldCheck size={32} className="text-secondary-900" /></div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-secondary-400 mt-2">Store Management</p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-text">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-secondary-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-10" placeholder="admin@your-store.example" />
              </div>
            </div>
            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-secondary-400" />
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pl-10" placeholder="••••••••" />
              </div>
            </div>
            {error && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{error}</div>}
            {isLocked && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">Account locked. Try again in {lockMinsLeft} minute{lockMinsLeft !== 1 ? "s" : ""}.</div>}
            <button type="submit" disabled={submitting || isLocked} className="btn-primary w-full">
              {submitting ? <><Loader2 size={20} className="mr-2 animate-spin" />Verifying...</> : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-secondary-500 text-sm mt-6">Admin access required. Authorized personnel only.</p>
      </div>
    </div>
  );
}
