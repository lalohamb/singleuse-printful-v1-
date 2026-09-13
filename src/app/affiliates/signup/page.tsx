"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";
import { supabase } from "@/lib/supabase";

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Facebook", "Twitter/X", "Pinterest", "Other"];
const PAYOUT_METHODS = [
  { value: "cashapp", label: "Cash App ($cashtag)" },
  { value: "paypal",  label: "PayPal (email)" },
  { value: "venmo",   label: "Venmo (@handle)" },
  { value: "zelle",   label: "Zelle (phone or email)" },
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
}

export default function AffiliateSignupPage() {
  const [form, setForm] = useState({
    name: "", email: "", platform: "Instagram", platform_url: "",
    follower_count: "", total_views: "",
    payout_method: "cashapp", payout_handle: "",
  });
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");

    const followers = parseInt(form.follower_count) || 0;
    const views = parseInt(form.total_views) || 0;

    if (followers < 20000 && views < 100000) {
      setErrorMsg("You need at least 20,000 followers on one platform OR 100,000+ total views to apply.");
      setState("error");
      return;
    }

    // Generate a unique code from their name
    const baseCode = slugify(form.name) || "creator";
    const code = `${baseCode}${Math.floor(Math.random() * 900) + 100}`;

    const { error } = await supabase.from("affiliates").insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      code,
      platform_url: form.platform_url.trim(),
      follower_count: followers,
      total_views: views,
      payout_method: form.payout_method,
      payout_handle: form.payout_handle.trim(),
      status: "pending",
    });

    if (error) {
      setErrorMsg(error.message.includes("unique") ? "An account with this email already exists." : error.message);
      setState("error");
      return;
    }

    setState("done");
  };

  if (state === "done") {
    return (
      <StorefrontLayout>
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <CheckCircle size={56} className="text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-secondary-900 mb-4">Application Received!</h1>
            <p className="text-secondary-500 leading-relaxed mb-8">
              Thanks, <strong>{form.name.split(" ")[0]}</strong>! We&apos;ll review your application and get back to you within 3–5 business days.
            </p>
            <Link href="/" className="btn-gold">Back to Store</Link>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  return (
    <StorefrontLayout>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Link href="/affiliates" className="flex items-center gap-1 text-secondary-500 hover:text-secondary-900 mb-8 transition-colors text-sm">
          <ArrowLeft size={16} /> Back to Affiliate Program
        </Link>

        <div className="mb-10">
          <p className="text-gold-500 uppercase tracking-widest text-xs font-semibold mb-2">Partner Application</p>
          <h1 className="text-3xl font-bold text-secondary-900">Apply to Join</h1>
          <p className="text-secondary-500 mt-2">Takes less than 2 minutes. We review every application personally.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl border border-secondary-100 shadow-sm p-8">

          {/* Personal info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Full Name</label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="input-field" placeholder="Your name" />
            </div>
            <div>
              <label className="label-text">Email Address</label>
              <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input-field" placeholder="you@example.com" />
            </div>
          </div>

          {/* Platform */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Primary Platform</label>
              <select value={form.platform} onChange={(e) => set("platform", e.target.value)} className="input-field">
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Profile / Channel URL</label>
              <input required type="url" value={form.platform_url} onChange={(e) => set("platform_url", e.target.value)} className="input-field" placeholder="https://instagram.com/yourhandle" />
            </div>
          </div>

          {/* Reach */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Followers on Primary Platform</label>
              <input required type="number" min={0} value={form.follower_count} onChange={(e) => set("follower_count", e.target.value)} className="input-field" placeholder="e.g. 25000" />
            </div>
            <div>
              <label className="label-text">Total Views Across All Content</label>
              <input required type="number" min={0} value={form.total_views} onChange={(e) => set("total_views", e.target.value)} className="input-field" placeholder="e.g. 150000" />
            </div>
          </div>
          <p className="text-xs text-secondary-400 -mt-2">Minimum: 20,000 followers on one platform OR 100,000+ total views.</p>

          {/* Payout */}
          <div className="border-t border-secondary-100 pt-6">
            <h3 className="font-semibold text-secondary-800 mb-4">Payout Preference</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-text">Payout Method</label>
                <select value={form.payout_method} onChange={(e) => set("payout_method", e.target.value)} className="input-field">
                  {PAYOUT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label-text">
                  {form.payout_method === "cashapp" ? "$Cashtag" :
                   form.payout_method === "venmo"   ? "@Handle" :
                   "Email / Phone"}
                </label>
                <input required value={form.payout_handle} onChange={(e) => set("payout_handle", e.target.value)} className="input-field"
                  placeholder={
                    form.payout_method === "cashapp" ? "$yourcashtag" :
                    form.payout_method === "venmo"   ? "@yourhandle" :
                    form.payout_method === "zelle"   ? "phone or email" : "you@paypal.com"
                  }
                />
              </div>
            </div>
            <p className="text-xs text-secondary-400 mt-2">Payouts sent monthly on the 1st once your balance reaches $99.</p>
          </div>

          {state === "error" && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg p-4 text-sm">{errorMsg}</div>
          )}

          <button type="submit" disabled={state === "loading"} className="btn-gold w-full py-4 text-base">
            {state === "loading" ? <><Loader2 size={18} className="animate-spin mr-2" />Submitting...</> : "Submit Application"}
          </button>

          <p className="text-xs text-secondary-400 text-center">
            By applying you agree to our affiliate terms. We review every application and respond within 3–5 business days.
          </p>
        </form>
      </div>
    </StorefrontLayout>
  );
}
