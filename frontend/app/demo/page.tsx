import type { Metadata } from 'next';
import Link from 'next/link';
import FadeUp from '@/components/FadeUp';

export const metadata: Metadata = {
  title: 'Live Demo — PrintifyPlatform',
  description: 'See a live PrintifyPlatform storefront in action. Browse products, add to cart, and experience the checkout flow.',
};

export default function DemoPage() {
  return (
    <div className="pt-24">
      <section className="py-16 text-center border-b border-border">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-4">Live Demo</p>
            <h1 className="text-5xl font-black mb-4">See it in action.</h1>
            <p className="text-xl text-text-secondary">
              This is a real PrintifyPlatform storefront. Browse products, add to cart, and experience the checkout flow — exactly what your customers will see.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Demo embed */}
      <section className="py-12 max-w-6xl mx-auto px-6">
        <FadeUp>
          <div className="rounded-2xl border border-border overflow-hidden shadow-[0_0_60px_rgba(108,71,255,0.15)]">
            {/* Browser chrome */}
            <div className="bg-surface px-5 py-3 flex items-center gap-3 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 mx-4 bg-brand/10 rounded-md px-4 py-1.5 text-sm font-mono text-brand">
                demo.printifyplatform.com
              </div>
            </div>
            <iframe src="https://bodyandsleeves.com/" className="w-full min-h-[600px] border-0" />
          </div>
        </FadeUp>
      </section>

      {/* CTA */}
      <section className="py-24 text-center border-t border-border">
        <FadeUp>
          <h2 className="text-4xl font-black mb-4">Like what you see?</h2>
          <p className="text-text-secondary mb-8">Your store can look exactly like this — with your brand, your products, your domain.</p>
          <Link href="/signup" className="inline-block bg-brand-gradient px-8 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity animate-glow-pulse">
            Launch My Store — It&apos;s Free
          </Link>
        </FadeUp>
      </section>
    </div>
  );
}
