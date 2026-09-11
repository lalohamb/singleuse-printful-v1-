import type { Metadata } from 'next';
import Link from 'next/link';
import { Star } from 'lucide-react';
import HeroAnimation from '@/components/HeroAnimation';
import FeatureRow from '@/components/FeatureRow';
import TestimonialCard from '@/components/TestimonialCard';
import PricingCard from '@/components/PricingCard';
import FadeUp from '@/components/FadeUp';
import ProblemStrip from '@/components/ProblemStrip';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'PrintifyPlatform — Your Printify Shop Deserves a Real Store',
  description: 'Launch a fully branded, Stripe-powered storefront synced live to your Printify catalog — in under 5 minutes. No developers. No code.',
  keywords: ['Printify storefront builder', 'Printify store', 'print on demand store', 'Printify SaaS'],
};

const PROBLEMS = [
  { iconName: 'Link2', problem: '"Your store is just a link"', solution: 'A real domain, real brand, real store' },
  { iconName: 'ShoppingCart', problem: '"Checkout kills conversions"', solution: 'Stripe-hosted checkout, optimized to convert' },
  { iconName: 'LayoutDashboard', problem: '"You need a developer"', solution: 'Admin dashboard — no code, ever' },
];

const STEPS = [
  { n: '01', title: 'Connect Your Printify Shop', desc: 'Paste your Printify API key. We pull your entire catalog instantly. No CSV exports, no manual uploads.' },
  { n: '02', title: 'Customize Your Brand', desc: 'Upload your logo, set your colors, write your SEO title. Your store looks like you — not like everyone else on Printify.' },
  { n: '03', title: 'Go Live', desc: 'Hit launch. Your store is live on your domain, synced to Printify, and ready to take Stripe payments. Done.' },
];

const FEATURES = [
  { iconName: 'Zap', title: 'Live Printify Sync', desc: "Your catalog updates automatically. New product on Printify? It's on your store. Price change? Reflected instantly. No manual work.", flip: false },
  { iconName: 'ShoppingCart', title: 'Stripe Checkout That Converts', desc: "Stripe's hosted checkout is trusted by millions. Customers feel safe. You get paid. Orders flow directly into Printify fulfillment — automatically.", flip: true },
  { iconName: 'LayoutDashboard', title: 'Admin Dashboard', desc: 'Feature products. Hide variants. Update your logo. Change your SEO description. Manage orders. All from a clean dashboard — no Figma, no dev, no drama.', flip: false },
  { iconName: 'Shield', title: 'Enterprise-Grade Security', desc: "Your Printify API key never touches the browser. Stripe webhooks are verified. Supabase RLS locks down your data. Built like a bank, priced like a SaaS.", flip: true },
  { iconName: 'Server', title: 'Deployed & Hosted', desc: "We handle the server, the SSL, the CDN, the uptime. You handle the products and the marketing. That's the deal.", flip: false },
];

const TIERS = [
  {
    name: 'Starter', price: 29, stores: '1', popular: false,
    features: [
      { label: 'Custom Domain', included: true }, { label: 'Printify Sync', included: true },
      { label: 'Stripe Checkout', included: true }, { label: 'Admin Dashboard', included: true },
      { label: 'Brand Settings', included: true }, { label: 'Order Management', included: true },
      { label: 'White-Label', included: false }, { label: 'Priority Support', included: false },
      { label: 'Multi-Shop', included: false },
    ],
  },
  {
    name: 'Pro', price: 79, stores: '1', popular: true,
    features: [
      { label: 'Custom Domain', included: true }, { label: 'Printify Sync', included: true },
      { label: 'Stripe Checkout', included: true }, { label: 'Admin Dashboard', included: true },
      { label: 'Brand Settings', included: true }, { label: 'Order Management', included: true },
      { label: 'White-Label', included: false }, { label: 'Priority Support', included: true },
      { label: 'Multi-Shop', included: false },
    ],
  },
  {
    name: 'Agency', price: 199, stores: 'Up to 10', popular: false,
    features: [
      { label: 'Custom Domain', included: true }, { label: 'Printify Sync', included: true },
      { label: 'Stripe Checkout', included: true }, { label: 'Admin Dashboard', included: true },
      { label: 'Brand Settings', included: true }, { label: 'Order Management', included: true },
      { label: 'White-Label', included: true }, { label: 'Priority Support', included: true },
      { label: 'Multi-Shop', included: true },
    ],
  },
];

const TESTIMONIALS = [
  { quote: 'I was sending people to my Printify link for 8 months. Within a week of switching to PrintifyPlatform, my conversion rate doubled.', author: 'Marcus T.', role: 'Streetwear Brand Owner' },
  { quote: 'The admin dashboard is insane. I can feature new drops, update my logo, and check orders — all from my phone.', author: 'Jasmine R.', role: 'Custom Apparel Seller' },
  { quote: 'I run 6 Printify shops for clients. The Agency plan paid for itself in the first month.', author: 'Derek M.', role: 'POD Agency Owner' },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 text-center relative">
          <FadeUp delay={0}>
            <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-1.5 text-sm text-text-secondary mb-8">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              500+ Printify sellers already launched
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
              Your Printify Shop<br />
              <span className="bg-brand-gradient bg-clip-text text-transparent">Deserves a Real Store.</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.2}>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              Stop sending customers to a generic link. Launch a fully branded, Stripe-powered storefront — synced live to your Printify catalog — in under 5 minutes.
            </p>
          </FadeUp>

          <FadeUp delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <Link href="/signup" className="bg-brand-gradient px-8 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity animate-glow-pulse">
                Launch My Store — It&apos;s Free
              </Link>
              <Link href="/demo" className="border border-border px-8 py-4 rounded-full font-semibold text-lg hover:border-brand hover:text-brand transition-colors">
                See a Live Demo
              </Link>
            </div>
          </FadeUp>

          <FadeUp delay={0.4}>
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              {[...Array(5)].map((_, i) => <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />)}
              <span className="ml-1">Trusted by 500+ Printify sellers · $2M+ in orders processed</span>
            </div>
          </FadeUp>

          <FadeUp delay={0.5}>
            <HeroAnimation />
          </FadeUp>
        </div>
      </section>

      {/* Problem → Solution */}
      <section className="py-24 border-y border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6">
          <ProblemStrip problems={PROBLEMS} />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-16">
              <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-3">How It Works</p>
              <h2 className="text-4xl md:text-5xl font-black">Three steps to your store.</h2>
            </div>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <FadeUp key={s.n}>
                <div className="relative p-8 rounded-2xl border border-border bg-surface">
                  <div className="text-6xl font-black text-brand/20 mb-4 font-mono">{s.n}</div>
                  <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                  <p className="text-text-secondary leading-relaxed">{s.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-20">
              <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
              <h2 className="text-4xl md:text-5xl font-black">Everything you need.<br />Nothing you don&apos;t.</h2>
            </div>
          </FadeUp>
          {FEATURES.map((f) => (
            <FeatureRow key={f.title} iconName={f.iconName} title={f.title} desc={f.desc} flip={f.flip} />
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-16">
              <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-4xl md:text-5xl font-black">Simple, transparent pricing.</h2>
              <p className="text-text-secondary mt-4">14-day free trial. No credit card required. Cancel anytime.</p>
            </div>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {TIERS.map((tier) => (
              <FadeUp key={tier.name}>
                <PricingCard {...tier} />
              </FadeUp>
            ))}
          </div>

          {/* Download option */}
          <FadeUp>
            <div className="mt-10 border border-border rounded-2xl p-8 bg-bg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📦</span>
                  <span className="font-black text-xl">Download &amp; Self-Host</span>
                  <span className="text-xs bg-surface border border-border px-2 py-0.5 rounded-full text-text-secondary">One-Time</span>
                </div>
                <p className="text-text-secondary text-sm max-w-lg">
                  Buy the full source code outright. Deploy on your own server. No monthly fees, ever. Full Next.js + Supabase codebase, setup guide, and license key included.
                </p>
                <div className="flex items-center gap-6 mt-3 text-sm text-text-secondary">
                  <span>✅ Full source code</span>
                  <span>✅ White-label</span>
                  <span>✅ No monthly fees</span>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="text-3xl font-black">$299</div>
                  <div className="text-text-secondary text-sm">Single site · or $799 unlimited</div>
                </div>
                <Link href="/pricing#download" className="bg-brand-gradient px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
                  Buy &amp; Download →
                </Link>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-16">
              <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-3">Testimonials</p>
              <h2 className="text-4xl md:text-5xl font-black">Sellers love it.</h2>
            </div>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <FadeUp key={t.author}>
                <TestimonialCard {...t} />
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <FadeUp>
            <h2 className="text-5xl md:text-6xl font-black mb-6">Your Next Sale Is Waiting.</h2>
            <p className="text-xl text-text-secondary mb-10 leading-relaxed">
              Launch your branded Printify storefront today. No developers. No guesswork. Just a store that sells.
            </p>
            <Link href="/signup" className="inline-block bg-brand-gradient px-10 py-5 rounded-full font-bold text-xl hover:opacity-90 transition-opacity animate-glow-pulse">
              Start Free — Launch in 5 Minutes
            </Link>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
