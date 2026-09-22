"use client";
import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import Link from "next/link";

const PAYOUT_METHODS = ["cashapp", "paypal", "venmo", "zelle"];

export default function AffiliateSignupForm() {
  const [form, setForm] = useState({
    name: "", email: "", platform_url: "",
    follower_count: "", total_views: "",
    payout_method: "paypal", payout_handle: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await fetch("/api/affiliates/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        follower_count: Number(form.follower_count) || 0,
        total_views: Number(form.total_views) || 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setLoading(false); return; }
    setDone(true);
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="mb-8 space-y-2">
        <Link href="/affiliates" className="text-sm text-secondary-400 hover:text-secondary-700">← Back to Affiliate Program</Link>
        <h1 className="text-3xl font-bold text-secondary-900">Apply to become an affiliate</h1>
        <p className="text-secondary-500">We review all applications within 48 hours.</p>
      </div>

      {done ? (
        <div className="bg-success-50 border border-success-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mx-auto"><Check size={24} className="text-success-600" /></div>
          <h2 className="text-xl font-bold text-secondary-900">Application submitted!</h2>
          <p className="text-secondary-600">We'll review your application and email you within 48 hours.</p>
          <Link href="/" className="btn-primary inline-block mt-2">Back to Store</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 bg-white border border-secondary-100 rounded-2xl p-6 shadow-sm">
          <div>
            <label className="label-text">Full Name *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required className="input-field" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="label-text">Email Address *</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required className="input-field" placeholder="you@example.com" />
          </div>
          <div>
            <label className="label-text">Primary Platform URL *</label>
            <input type="url" value={form.platform_url} onChange={(e) => set("platform_url", e.target.value)} required className="input-field" placeholder="https://instagram.com/yourhandle" />
            <p className="text-xs text-secondary-400 mt-1">Link to your main channel, page, or profile.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Followers (primary platform)</label>
              <input type="number" min="0" value={form.follower_count} onChange={(e) => set("follower_count", e.target.value)} className="input-field" placeholder="25000" />
            </div>
            <div>
              <label className="label-text">Total Views (all content)</label>
              <input type="number" min="0" value={form.total_views} onChange={(e) => set("total_views", e.target.value)} className="input-field" placeholder="150000" />
            </div>
          </div>
          <p className="text-xs text-secondary-400 -mt-2">Eligibility: 20,000+ followers on one platform OR 100,000+ total views.</p>

          <div>
            <label className="label-text">Payout Method *</label>
            <select value={form.payout_method} onChange={(e) => set("payout_method", e.target.value)} className="input-field">
              {PAYOUT_METHODS.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label-text">Payout Handle *</label>
            <input value={form.payout_handle} onChange={(e) => set("payout_handle", e.target.value)} required className="input-field" placeholder="$cashtag, @handle, email, or phone" />
            <p className="text-xs text-secondary-400 mt-1">Your {form.payout_method} username, email, or phone number.</p>
          </div>

          {error && <p className="text-sm text-error-600 bg-error-50 border border-error-100 rounded-lg px-4 py-3">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">
            {loading ? <><Loader2 size={16} className="mr-2 animate-spin inline" />Submitting...</> : "Submit Application"}
          </button>
        </form>
      )}
    </div>
  );
}
