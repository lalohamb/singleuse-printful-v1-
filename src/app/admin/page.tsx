"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const { signIn } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await signIn(email, password);
    if (error) { setError(error); setLoading(false); }
    else router.push("/admin/dashboard");
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
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <><Loader2 size={20} className="mr-2 animate-spin" />Processing...</> : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-secondary-500 text-sm mt-6">Admin access required. Authorized personnel only.</p>
      </div>
    </div>
  );
}
