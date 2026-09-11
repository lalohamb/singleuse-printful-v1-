import type { Metadata } from 'next';
import Link from 'next/link';
import FadeUp from '@/components/FadeUp';
import PricingCard from '@/components/PricingCard';

export const metadata: Metadata = {
  title: 'Pricing — PrintifyPlatform',
  description: 'Simple, transparent pricing for Printify sellers. Start free for 14 days. No credit card required.',
  keywords: ['Printify SaaS platform pricing', 'Printify store builder cost'],
};

const TIERS = [
  {
    name: 'Starter', price: 29, stores: '1', popular: false,
    features: [
      { label: 'Custom Domain', included: true },
      { label: 'Printify Sync', included: true },
      { label: 'Stripe Checkout', included: true },
      { label: 'Admin Dashboard', included: true },
      { label: 'Brand Settings', included: true },
      { label: 'Order Management', included: true },
      { label: 'White-Label', included: false },
      { label: 'Priority Support', included: false },
      { label: 'Multi-Shop', included: false },
    ],
  },
  {
    name: 'Pro', price: 79, stores: '1', popular: true,
    features: [
      { label: 'Custom Domain', included: true },
      { label: 'Printify Sync', included: true },
      { label: 'Stripe Checkout', included: true },
      { label: 'Admin Dashboard', included: true },
      { label: 'Brand Settings', included: true },
      { label: 'Order Management', included: true },
      { label: 'White-Label', included: false },
      { label: 'Priority Support', included: true },
      { label: 'Multi-Shop', included: false },
    ],
  },
  {
    name: 'Agency', price: 199, stores: 'Up to 10', popular: false,
    features: [
      { label: 'Custom Domain', included: true },
      { label: 'Printify Sync', included: true },
      { label: 'Stripe Checkout', included: true },
      { label: 'Admin Dashboard', included: true },
      { label: 'Brand Settings', included: true },
      { label: 'Order Management', included: true },
      { label: 'White-Label', included: true },
      { label: 'Priority Support', included: true },
      { label: 'Multi-Shop', included: true },
    ],
  },
];

const FAQS = [
  { q: 'Do I need a credit card to start?', a: 'No. Your 14-day free trial starts the moment you sign up. No card required until you choose a plan.' },
  { q: 'Can I switch plans later?', a: 'Yes. Upgrade or downgrade anytime from your dashboard. Changes take effect immediately.' },
  { q: 'What happens if I cancel?', a: 'Your store stays live until the end of your billing period. No data is deleted for 30 days after cancellation.' },
  { q: 'Do you take a cut of my sales?', a: 'Never. We charge a flat monthly fee. Every dollar your customers spend goes to you (minus Stripe\'s standard processing fee).' },
];

export default function PricingPage() {
  return (
    <div className="pt-24">
      <section className="py-24 text-center border-b border-border">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-4">Pricing</p>
            <h1 className="text-5xl md:text-6xl font-black mb-4">Simple, transparent pricing.</h1>
            <p className="text-xl text-text-secondary">Monthly subscription or buy the code outright. No hidden fees.</p>
          </FadeUp>
        </div>
      </section>

      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {TIERS.map((tier) => (
            <FadeUp key={tier.name}>
              <PricingCard {...tier} />
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Download section */}
      <section id="download" className="py-24 border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-12">
              <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-3">Own It Forever</p>
              <h2 className="text-4xl md:text-5xl font-black">Download &amp; Self-Host</h2>
              <p className="text-text-secondary mt-4 max-w-xl mx-auto">
                Buy the full source code once. Deploy on your own server. No monthly fees, no vendor lock-in.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <FadeUp>
              <div className="bg-bg border border-border rounded-2xl p-8 flex flex-col h-full">
                <div className="font-black text-xl mb-1">Single Site</div>
                <div className="text-text-secondary text-sm mb-6">One domain · 1 year of updates</div>
                <div className="text-4xl font-black mb-6">$299</div>
                <ul className="space-y-2 text-sm text-text-secondary flex-1 mb-8">
                  {['Full Next.js + Supabase source code', 'Deploy on any server or VPS', 'White-label (remove our branding)', 'Setup guide + all docs', '1 year of free updates', 'Community support'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-accent">✓</span> {f}
                    </li>
                  ))}
                  <li className="flex items-center gap-2 opacity-40"><span>✗</span> Resell rights</li>
                </ul>
                <Link href="/signup?path=download&license=single"
                  className="w-full text-center border border-border py-3 rounded-xl font-semibold hover:border-brand hover:text-brand transition-colors">
                  Buy Single Site — $299
                </Link>
              </div>
            </FadeUp>

            <FadeUp>
              <div className="bg-bg border border-brand rounded-2xl p-8 flex flex-col h-full relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand text-white text-xs font-bold px-3 py-1 rounded-full">Best Value</span>
                </div>
                <div className="font-black text-xl mb-1">Unlimited</div>
                <div className="text-text-secondary text-sm mb-6">Unlimited domains · Lifetime updates</div>
                <div className="text-4xl font-black mb-6">$799</div>
                <ul className="space-y-2 text-sm text-text-secondary flex-1 mb-8">
                  {['Full Next.js + Supabase source code', 'Deploy on unlimited domains', 'White-label (remove our branding)', 'Setup guide + all docs', 'Lifetime free updates', 'Priority email support'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-accent">✓</span> {f}
                    </li>
                  ))}
                  <li className="flex items-center gap-2 opacity-40"><span>✗</span> Resell rights</li>
                </ul>
                <Link href="/signup?path=download&license=unlimited"
                  className="w-full text-center bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
                  Buy Unlimited — $799
                </Link>
              </div>
            </FadeUp>
          </div>

          <FadeUp>
            <p className="text-center text-text-secondary text-sm mt-8">
              Need help setting up?{' '}
              <Link href="mailto:hello@printifyplatform.com" className="text-brand hover:underline">Book a setup call →</Link>
            </p>
          </FadeUp>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 border-t border-border max-w-3xl mx-auto px-6">
        <FadeUp>
          <h2 className="text-3xl font-black mb-12 text-center">Frequently asked questions</h2>
        </FadeUp>
        <div className="space-y-6">
          {FAQS.map((faq) => (
            <FadeUp key={faq.q}>
              <div className="border border-border rounded-2xl p-6 bg-surface">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{faq.a}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      <section className="py-24 border-t border-border text-center">
        <FadeUp>
          <h2 className="text-4xl font-black mb-4">Still have questions?</h2>
          <p className="text-text-secondary mb-8">Talk to us. We respond within a few hours.</p>
          <Link href="mailto:hello@printifyplatform.com" className="inline-block border border-border px-8 py-4 rounded-full font-semibold hover:border-brand hover:text-brand transition-colors">
            Contact Us
          </Link>
        </FadeUp>
      </section>
    </div>
  );
}
