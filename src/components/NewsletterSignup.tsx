"use client";
import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

export default function NewsletterSignup({ variant = "section" }: { variant?: "section" | "footer" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/mailerlite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_subscriber", email, groups: ["182701481182365511"] }),
      });
      const data = await res.json();
      if (!res.ok || data.error || data.message) {
        setErrorMsg(data.message || data.error || "Something went wrong.");
        setState("error");
      } else {
        setState("done");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  };

  if (variant === "footer") {
    return (
      <div className="mb-10">
        <h4 className="text-white font-semibold mb-2">Stay in the Loop</h4>
        <p className="text-secondary-400 text-sm mb-4">New drops, culture, and exclusive offers — straight to your inbox.</p>
        {state === "done" ? (
          <p className="flex items-center gap-2 text-success-400 text-sm font-medium"><Check size={16} />You&apos;re in! Welcome to the culture.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
            <input
              required type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setState("idle"); }}
              placeholder="your@email.com"
              className="flex-1 min-w-0 bg-secondary-800 border border-secondary-700 text-white placeholder-secondary-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
            />
            <button disabled={state === "loading"} className="bg-gold-500 hover:bg-gold-400 text-secondary-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center gap-1">
              {state === "loading" ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            </button>
          </form>
        )}
        {state === "error" && <p className="text-error-400 text-xs mt-2">{errorMsg}</p>}
      </div>
    );
  }

  return (
    <section className="bg-secondary-900 bg-weave py-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-gold-400 text-xs font-medium tracking-widest uppercase mb-3">Join the Culture</p>
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3">Be First to Know</h2>
        <p className="text-secondary-400 mb-8">New drops, exclusive offers, and culture — delivered to your inbox. No spam, ever.</p>
        {state === "done" ? (
          <div className="flex items-center justify-center gap-3 text-success-400 font-semibold text-lg">
            <Check size={24} />You&apos;re in! Welcome to the culture.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              required type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setState("idle"); }}
              placeholder="Enter your email"
              className="flex-1 bg-secondary-800 border border-secondary-700 text-white placeholder-secondary-500 rounded-xl px-4 py-3 focus:outline-none focus:border-gold-500"
            />
            <button disabled={state === "loading"} className="btn-gold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60">
              {state === "loading" ? <><Loader2 size={18} className="animate-spin" />Joining...</> : <>Subscribe <ArrowRight size={18} /></>}
            </button>
          </form>
        )}
        {state === "error" && <p className="text-error-400 text-sm mt-3">{errorMsg}</p>}
      </div>
    </section>
  );
}
