import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DollarSign, Users, Link2, TrendingUp, CheckCircle, Clock, CreditCard } from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const metadata: Metadata = {
  title: "Affiliate Program",
  description: "Partner with us. Earn 10% on every sale you drive. Apply to join the Gender Apparel affiliate program.",
};

const perks = [
  { icon: DollarSign, title: "10% Commission", desc: "Earn 10% of every order subtotal placed through your unique link." },
  { icon: Clock,      title: "30-Day Cookie",  desc: "Your referral is tracked for 30 days after a visitor clicks your link." },
  { icon: CreditCard, title: "Easy Payouts",   desc: "Get paid via Cash App, PayPal, Venmo, or Zelle once you hit $99." },
  { icon: TrendingUp, title: "Real-Time Stats", desc: "Track clicks, conversions, and earnings from your dashboard." },
];

const steps = [
  { n: "01", title: "Apply",   desc: "Fill out the short application. We review within 3–5 business days." },
  { n: "02", title: "Get Approved", desc: "Once approved, you'll receive your unique referral link and code." },
  { n: "03", title: "Share",   desc: "Post, story, reel — share your link wherever your audience lives." },
  { n: "04", title: "Earn",    desc: "Every sale through your link earns you 10%. Payouts go out monthly." },
];

const rules = [
  "Minimum 20,000 followers on any single platform, OR 100,000+ total views across your content",
  "One affiliate account per person",
  "Commissions are pending for 14 days (refund window) before approval",
  "Minimum $99 balance required to receive a payout",
  "Payouts processed on the 1st of each month",
  "Commissions are voided on refunded or charged-back orders",
  "Referral cookie lasts 30 days — last-click attribution",
];

export default async function AffiliatesPage() {
  const { data } = await supabase.from("settings").select("affiliate_program_enabled").limit(1).maybeSingle();
  if (data?.affiliate_program_enabled === false) notFound();
  return (
    <StorefrontLayout>
      {/* Hero */}
      <section className="bg-secondary-900 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gold-400 uppercase tracking-widest text-sm font-semibold mb-4">Partner Program</p>
          <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
            Create Content.<br />Earn Real Money.
          </h1>
          <p className="text-white/70 text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
            Join the Gender Apparel affiliate program. Share your unique link, earn 10% on every sale, and get paid monthly — straight to your Cash App, PayPal, Venmo, or Zelle.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mt-10">
            <Link href="/affiliates/signup" className="btn-gold text-lg px-8 py-4">
              Apply Now
            </Link>
            <a href="#how-it-works" className="btn-outline border-white/30 text-white hover:bg-white/10 hover:border-white text-lg px-8 py-4">
              How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-secondary-900">Why Partner With Us</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {perks.map((p) => (
              <div key={p.title} className="text-center p-6 rounded-2xl border border-secondary-100 shadow-sm">
                <div className="w-14 h-14 rounded-full bg-gold-50 flex items-center justify-center mx-auto mb-4">
                  <p.icon size={26} className="text-gold-500" />
                </div>
                <h3 className="font-bold text-secondary-900 text-lg">{p.title}</h3>
                <p className="text-secondary-500 text-sm mt-2 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 bg-secondary-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-gold-500 uppercase tracking-widest text-sm font-semibold mb-2">Simple Process</p>
            <h2 className="text-3xl font-bold text-secondary-900">How It Works</h2>
          </div>
          <div className="space-y-6">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-6 items-start bg-white rounded-2xl p-6 shadow-sm border border-secondary-100">
                <span className="text-4xl font-bold text-gold-400 leading-none flex-shrink-0">{s.n}</span>
                <div>
                  <h3 className="font-bold text-secondary-900 text-lg">{s.title}</h3>
                  <p className="text-secondary-500 mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility & Rules */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold-500 uppercase tracking-widest text-sm font-semibold mb-2">Program Rules</p>
            <h2 className="text-3xl font-bold text-secondary-900">Eligibility &amp; Terms</h2>
          </div>
          <ul className="space-y-4">
            {rules.map((r, i) => (
              <li key={i} className="flex gap-3 items-start">
                <CheckCircle size={20} className="text-gold-500 flex-shrink-0 mt-0.5" />
                <span className="text-secondary-700 leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Payout methods */}
      <section className="py-20 px-4 bg-secondary-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-gold-400 uppercase tracking-widest text-sm font-semibold mb-4">Get Paid</p>
          <h2 className="text-3xl font-bold mb-6">Payout Methods</h2>
          <p className="text-white/70 mb-10 leading-relaxed">
            Once your balance hits <span className="text-gold-400 font-semibold">$99</span>, we send your payout on the 1st of the following month. Choose how you want to get paid when you apply.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["Cash App", "PayPal", "Venmo", "Zelle"].map((m) => (
              <div key={m} className="bg-white/10 rounded-xl py-4 px-3 font-semibold text-white">
                {m}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-white text-center">
        <div className="max-w-2xl mx-auto">
          <Users size={40} className="text-gold-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-secondary-900 mb-4">Ready to Partner?</h2>
          <p className="text-secondary-500 mb-8 leading-relaxed">
            Applications take less than 2 minutes. We review every application personally and respond within 3–5 business days.
          </p>
          <Link href="/affiliates/signup" className="btn-gold text-lg px-10 py-4">
            Apply Now <Link2 size={18} className="ml-2" />
          </Link>
        </div>
      </section>
    </StorefrontLayout>
  );
}
