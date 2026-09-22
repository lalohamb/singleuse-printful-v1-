import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import StorefrontLayout from "@/components/StorefrontLayout";

async function isProgramEnabled() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await sb.from("settings").select("affiliate_program_enabled").limit(1).maybeSingle();
  return data?.affiliate_program_enabled !== false;
}

export default async function AffiliatesPage() {
  if (!(await isProgramEnabled())) notFound();

  return (
    <StorefrontLayout>
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-20">

        {/* Hero */}
        <div className="text-center space-y-6">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary-600 bg-primary-50 px-4 py-1.5 rounded-full">Affiliate Program</span>
          <h1 className="text-4xl md:text-5xl font-bold text-secondary-900 leading-tight">Earn 10% on every sale<br />you drive.</h1>
          <p className="text-lg text-secondary-500 max-w-xl mx-auto">Share your unique link. When someone buys through it, you earn a 10% commission on their order — automatically tracked for 30 days.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/affiliates/signup" className="btn-primary px-8 py-3 text-base">Apply Now</Link>
            <Link href="/affiliates/dashboard" className="btn-outline px-8 py-3 text-base">Affiliate Login</Link>
          </div>
        </div>

        {/* How it works */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-secondary-900 text-center">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Apply", desc: "Fill out a short application. We review and approve within 48 hours." },
              { step: "2", title: "Share", desc: "Get your unique referral link and share it on your platforms." },
              { step: "3", title: "Earn", desc: "Earn 10% commission on every sale. Payouts sent monthly." },
            ].map((s) => (
              <div key={s.step} className="bg-secondary-50 rounded-2xl p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-secondary-900 text-white text-sm font-bold flex items-center justify-center mx-auto">{s.step}</div>
                <p className="font-semibold text-secondary-900">{s.title}</p>
                <p className="text-sm text-secondary-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Perks */}
        <div className="bg-secondary-900 text-white rounded-3xl p-10 space-y-8">
          <h2 className="text-2xl font-bold text-center">What you get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { icon: "💰", title: "10% commission", desc: "On every order subtotal — no cap." },
              { icon: "🍪", title: "30-day cookie", desc: "You get credit even if they buy a month later." },
              { icon: "📊", title: "Real-time dashboard", desc: "Track clicks, conversions, and earnings live." },
              { icon: "💸", title: "Monthly payouts", desc: "Via Cash App, PayPal, Venmo, or Zelle." },
              { icon: "📧", title: "Sale notifications", desc: "Email alert every time you earn a commission." },
              { icon: "🎯", title: "Unique referral link", desc: "Your own branded link to share anywhere." },
            ].map((p) => (
              <div key={p.title} className="flex items-start gap-4">
                <span className="text-2xl">{p.icon}</span>
                <div><p className="font-semibold">{p.title}</p><p className="text-sm text-secondary-400">{p.desc}</p></div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-secondary-900">Program rules</h2>
          <ul className="space-y-2 text-sm text-secondary-600">
            {[
              "10% commission on order subtotal (shipping excluded)",
              "30-day last-click attribution window",
              "14-day pending period before commissions are approved",
              "$99 minimum balance required to receive a payout",
              "Payouts processed on the 1st of each month",
              "Commissions voided on refunded or charged-back orders",
              "One affiliate account per person",
              "Eligibility: 20,000+ followers on one platform OR 100,000+ total views",
            ].map((r) => (
              <li key={r} className="flex items-start gap-2"><span className="text-secondary-400 mt-0.5">—</span>{r}</li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-secondary-900">Ready to start earning?</h2>
          <Link href="/affiliates/signup" className="btn-primary px-10 py-3 text-base inline-block">Apply Now</Link>
        </div>

      </div>
    </StorefrontLayout>
  );
}
