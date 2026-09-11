import type { Metadata } from 'next';
import Link from 'next/link';
import FadeUp from '@/components/FadeUp';

export const metadata: Metadata = {
  title: 'Blog — PrintifyPlatform',
  description: 'Print on demand store tips, Printify guides, and ecommerce strategies for POD sellers.',
  keywords: ['print on demand store tips', 'Printify vs Shopify', 'POD ecommerce guide'],
};

const POSTS = [
  {
    slug: 'printify-vs-shopify',
    title: 'Printify vs Shopify: Which Is Right for POD Sellers in 2025?',
    excerpt: 'Shopify is powerful but expensive and complex. Printify is great for fulfillment but lacks a real storefront. Here\'s why PrintifyPlatform is the better answer.',
    date: 'Jun 12, 2025',
    readTime: '7 min read',
    tag: 'Comparison',
  },
  {
    slug: 'how-to-increase-printify-conversion-rate',
    title: '5 Ways to Double Your Printify Store Conversion Rate',
    excerpt: 'Most Printify sellers lose 80% of their traffic because their "store" is just a link. Here\'s how to fix that and start converting visitors into buyers.',
    date: 'Jun 5, 2025',
    readTime: '5 min read',
    tag: 'Growth',
  },
  {
    slug: 'printify-seo-guide',
    title: 'The Complete SEO Guide for Printify Sellers',
    excerpt: 'Generic Printify storefronts can\'t be indexed by Google. Your branded PrintifyPlatform store can. Here\'s how to rank for product keywords.',
    date: 'May 28, 2025',
    readTime: '9 min read',
    tag: 'SEO',
  },
  {
    slug: 'pod-niche-ideas-2025',
    title: '12 Profitable Print-on-Demand Niches for 2025',
    excerpt: 'The POD market is crowded — but these 12 niches still have massive untapped demand. Find your angle and launch a store that stands out.',
    date: 'May 20, 2025',
    readTime: '6 min read',
    tag: 'Strategy',
  },
  {
    slug: 'stripe-vs-paypal-pod',
    title: 'Stripe vs PayPal for Print-on-Demand: A Seller\'s Guide',
    excerpt: 'Stripe converts better, has lower dispute rates, and integrates seamlessly with Printify fulfillment. Here\'s the data.',
    date: 'May 14, 2025',
    readTime: '4 min read',
    tag: 'Payments',
  },
  {
    slug: 'printify-agency-guide',
    title: 'How to Run a Printify Agency: Managing Multiple Shops',
    excerpt: 'Running POD stores for clients? Our Agency plan lets you manage up to 10 branded storefronts from one dashboard. Here\'s how to scale.',
    date: 'May 7, 2025',
    readTime: '8 min read',
    tag: 'Agency',
  },
];

const TAG_COLORS: Record<string, string> = {
  Comparison: 'bg-blue-500/10 text-blue-400',
  Growth: 'bg-green-500/10 text-green-400',
  SEO: 'bg-brand/10 text-brand',
  Strategy: 'bg-yellow-500/10 text-yellow-400',
  Payments: 'bg-accent/10 text-accent',
  Agency: 'bg-purple-500/10 text-purple-400',
};

export default function BlogPage() {
  return (
    <div className="pt-24">
      <section className="py-24 text-center border-b border-border">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-4">Blog</p>
            <h1 className="text-5xl font-black mb-4">Grow your POD business.</h1>
            <p className="text-xl text-text-secondary">Printify tips, ecommerce strategies, and guides for print-on-demand sellers.</p>
          </FadeUp>
        </div>
      </section>

      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {POSTS.map((post) => (
            <FadeUp key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group block rounded-2xl border border-border bg-surface p-6 hover:border-brand/50 transition-colors h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${TAG_COLORS[post.tag] ?? 'bg-border text-text-secondary'}`}>
                    {post.tag}
                  </span>
                  <span className="text-xs text-text-secondary">{post.readTime}</span>
                </div>
                <h2 className="font-bold text-lg leading-snug mb-3 group-hover:text-brand transition-colors flex-1">{post.title}</h2>
                <p className="text-text-secondary text-sm leading-relaxed mb-4">{post.excerpt}</p>
                <p className="text-xs text-text-secondary mt-auto">{post.date}</p>
              </Link>
            </FadeUp>
          ))}
        </div>
      </section>
    </div>
  );
}
