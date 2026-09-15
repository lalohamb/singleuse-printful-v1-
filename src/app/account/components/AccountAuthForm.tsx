"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { SAMPLE_CUSTOMER } from "@/lib/account-data";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup";

export function AccountAuthForm({ mode }: { mode: Mode }) {
  const isSignup = mode === "signup";
  const [form, setForm] = useState({
    email: "",
    username: "",
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    newsletterOptIn: true,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const set = (key: keyof typeof form, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: form.email,
      options: {
        emailRedirectTo: `${window.location.origin}/account`,
        data: isSignup ? {
          username: form.username,
          full_name: form.fullName,
          phone: form.phone,
          newsletter_opt_in: form.newsletterOptIn,
          address: {
            name: form.fullName,
            line1: form.line1,
            line2: form.line2,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country,
          },
        } : undefined,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6 sm:p-8">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-3">Customer Account</p>
        <h1 className="text-3xl font-bold text-secondary-900">{isSignup ? "Create your account" : "Sign in to your account"}</h1>
        <p className="text-secondary-500 mt-3">
          {isSignup
            ? "Save your address, track orders, and keep your apparel preferences in one place."
            : "We will email you a secure sign-in link. No password needed."}
        </p>

        {status === "sent" ? (
          <div className="mt-8 bg-success-50 border border-success-100 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <CheckCircle size={22} className="text-success-600 mt-0.5" />
              <div>
                <p className="font-semibold text-success-700">Check your email</p>
                <p className="text-sm text-success-700/80 mt-1">We sent a secure sign-in link to {form.email}.</p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="label-text">Email</label>
              <input required type="email" value={form.email} onChange={(event) => set("email", event.target.value)} placeholder={SAMPLE_CUSTOMER.email} className="input-field" />
            </div>

            {isSignup && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Username</label>
                    <input required value={form.username} onChange={(event) => set("username", event.target.value)} placeholder={SAMPLE_CUSTOMER.username} className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Phone</label>
                    <input value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder={SAMPLE_CUSTOMER.phone} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="label-text">Full name</label>
                  <input required value={form.fullName} onChange={(event) => set("fullName", event.target.value)} placeholder={SAMPLE_CUSTOMER.fullName} className="input-field" />
                </div>
                <div>
                  <label className="label-text">Default shipping address</label>
                  <input required value={form.line1} onChange={(event) => set("line1", event.target.value)} placeholder={SAMPLE_CUSTOMER.address.line1} className="input-field" />
                  <input value={form.line2} onChange={(event) => set("line2", event.target.value)} placeholder={SAMPLE_CUSTOMER.address.line2} className="input-field mt-3" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <input required value={form.city} onChange={(event) => set("city", event.target.value)} placeholder={SAMPLE_CUSTOMER.address.city} className="input-field" />
                    <input required value={form.state} onChange={(event) => set("state", event.target.value)} placeholder={SAMPLE_CUSTOMER.address.state} className="input-field" />
                    <input required value={form.zip} onChange={(event) => set("zip", event.target.value)} placeholder={SAMPLE_CUSTOMER.address.zip} className="input-field" />
                  </div>
                </div>
                <label className="flex items-center gap-3 text-sm text-secondary-600">
                  <input type="checkbox" checked={form.newsletterOptIn} onChange={(event) => set("newsletterOptIn", event.target.checked)} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500" />
                  Send me new drops, order updates, and exclusive offers.
                </label>
              </>
            )}

            {status === "error" && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{error}</div>}
            <button disabled={status === "loading"} className="btn-primary w-full">
              {status === "loading" ? <><Loader2 size={18} className="mr-2 animate-spin" />Sending...</> : <>{isSignup ? "Create account" : "Send sign-in link"} <ArrowRight size={18} className="ml-2" /></>}
            </button>
          </form>
        )}

        <p className="text-sm text-secondary-500 mt-6 text-center">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <Link href={isSignup ? "/account/login" : "/account/signup"} className="text-primary-600 hover:text-primary-700 font-medium">
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}

