import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import FadeUp from '@/components/FadeUp';
import HowItWorksSteps from '@/components/HowItWorksSteps';

export const metadata: Metadata = {
  title: 'How It Works — PrintifyPlatform',
  description: 'How to sell Printify products on your own website. Connect your shop, customize your brand, and go live in minutes.',
  keywords: ['how to sell Printify products on your own website', 'Printify custom store setup', 'Printify storefront builder'],
};

const STEPS = [
  {
    iconName: 'Key',
    step: '01',
    title: 'Connect Your Printify Shop',
    desc: 'Paste your Printify API key into your PrintifyPlatform dashboard. We instantly pull your entire product catalog — titles, images, variants, prices, and shipping profiles. No CSV exports. No manual uploads. No waiting.',
    bullets: [
      'Paginates through all Printify products automatically (50/page)',
      'Resolves color → image mapping per variant',
      'Fetches shipping profiles per blueprint & print provider',
      'Stores variants with color, size, price, and image URL',
    ],
    detail: 'Your API key is encrypted server-side and never exposed to the browser.',
  },
  {
    iconName: 'Palette',
    step: '02',
    title: 'Customize Your Brand',
    desc: 'Upload your logo. Set your primary color. Write your SEO title and meta description. Configure your hero image with pixel-perfect position controls. Your store looks like you — not like every other Printify seller.',
    bullets: [
      'Logo, tagline, and brand color from your admin dashboard',
      'Hero image with X/Y position, zoom, gradient direction, and fit controls',
      'Announcement bar with live toggle',
      'Social media links: Instagram, TikTok, Facebook, YouTube, Pinterest, Snapchat, Threads',
    ],
    detail: 'All brand settings update live. No redeploy needed.',
  },
  {
    iconName: 'Search',
    step: '03',
    title: 'Curate Your Catalog',
    desc: 'Not every Printify product belongs on your storefront. Use the admin product panel to activate, hide, feature, and organize your catalog. Assign categories, set badges, and lock content you\'ve customized so syncs don\'t overwrite your edits.',
    bullets: [
      'Active / Inactive tab switcher with live product counts',
      'Bulk actions: assign category, set flags (New Arrival, Trending), change status',
      'Featured star toggle per product',
      'Content-lock: protects custom titles, descriptions, and images from sync overwrites',
      'Badge system: Featured, New Arrival, Trending, Bestseller, On Sale',
    ],
    detail: 'One-click Sync from Printify pulls the latest catalog without touching locked content.',
  },
  {
    iconName: 'Globe',
    step: '04',
    title: 'Go Live on Your Domain',
    desc: 'Point your custom domain to PrintifyPlatform or use a free subdomain. Your store is SSL-secured, CDN-distributed, and ready to take orders within minutes of launch.',
    bullets: [
      'Custom domain or free subdomain at yourshop.printifyplatform.com',
      'SSL certificate provisioned automatically',
      'Global CDN for fast load times worldwide',
      'Docker-based deployment — zero downtime updates',
    ],
    detail: 'We handle the server, SSL, CDN, and uptime monitoring. You handle the products.',
  },
  {
    iconName: 'ShoppingBag',
    step: '05',
    title: 'Customers Browse & Buy',
    desc: 'Shoppers land on your branded storefront, browse your curated catalog with category filters and sort options, and add items to a persistent cart. The experience is fast, mobile-optimized, and built to convert.',
    bullets: [
      'Category sidebar with URL-driven filters (?category=slug)',
      'Sort: Featured, New Arrivals, Trending, Newest, Price Low→High, Price High→Low',
      'Multi-image product gallery with color swatches and size selectors',
      'Cart persisted to localStorage — survives page refresh and navigation',
      'Real-time shipping cost calculation per country (debounced 400ms)',
      'JSON-LD Product schema for Google rich snippets',
    ],
    detail: 'Product pages are SEO-optimized with per-product metadata, OG images, and canonical URLs.',
  },
  {
    iconName: 'CreditCard',
    step: '06',
    title: 'Stripe Handles the Payment',
    desc: 'Checkout redirects to Stripe\'s hosted payment page — trusted by millions of customers worldwide. You get paid. The order is confirmed. No PCI compliance headaches on your end.',
    bullets: [
      'Stripe Checkout Session created via Supabase Edge Function',
      'Line items include product name, variant label, and product image',
      'Shipping added as a separate line item',
      'Supports cards, Apple Pay, Google Pay, and more',
      'Allowed countries: US, CA, GB, AU (configurable)',
      'Pending order inserted to Supabase immediately on session creation',
    ],
    detail: 'Stripe webhook verifies payment and triggers fulfillment automatically.',
  },
  {
    iconName: 'Package',
    step: '07',
    title: 'Printify Fulfills Automatically',
    desc: 'The moment Stripe confirms payment, our webhook fires. We create the Printify order automatically — mapping your cart items to Printify line items with the correct variant IDs and shipping address. Your print partner picks, packs, and ships. You never touch inventory.',
    bullets: [
      'Stripe webhook verifies signature before processing',
      'Maps cart items to Printify line_items with printify_id + variant_id',
      'Builds address_to from Stripe session metadata',
      'Stores Printify order ID and fulfillment status in your orders table',
      'Order confirmation email sent via Resend with itemized receipt',
    ],
    detail: 'Order status syncs back to your dashboard in real time.',
  },
  {
    iconName: 'Mail',
    step: '08',
    title: 'Customer Gets Confirmation Email',
    desc: 'Immediately after payment, your customer receives a branded order confirmation email with their order ID, itemized list, total, and shipping address. Sent via Resend with your store name in the from field.',
    bullets: [
      'HTML email template with item list and totals',
      'Order ID (last 8 chars, uppercased) for easy reference',
      'Sent from your store name via Resend',
      'Post-checkout success page polls for order confirmation',
    ],
    detail: 'Transactional emails are sent via Resend — reliable delivery, no spam filters.',
  },
  {
    iconName: 'LayoutDashboard',
    step: '09',
    title: 'Manage Everything from Your Dashboard',
    desc: 'Your admin dashboard gives you full visibility and control. View orders, manage fulfillment status, issue refunds, check your Stripe balance, run email campaigns, and tweak your store settings — all without touching code.',
    bullets: [
      'Orders: search by name/email/ID, filter by status, update fulfillment, view tracking',
      'Stripe: balance, recent charges, payouts, full/partial refunds',
      'MailerLite: subscribers, groups, campaigns, automations, forms',
      'Media library: upload, rename, bulk delete, copy public URLs',
      'SEO settings: sitemap, robots.txt, JSON-LD, canonical URLs, OG image',
      'Shipping diagnostic: live coverage check, missing profiles list, sample rates',
    ],
    detail: 'Orders pause/resume toggle lets you stop new orders instantly without taking the store offline.',
  },
  {
    iconName: 'RefreshCw',
    step: '10',
    title: 'Keep Your Catalog in Sync',
    desc: 'New product on Printify? Price change? New variant? Hit Sync in your admin panel. We pull the latest catalog, update prices and variants, and leave your content-locked customizations untouched.',
    bullets: [
      'One-click sync from admin Products panel',
      'Content-lock prevents sync from overwriting custom titles, descriptions, and images',
      'Inactive/unsynced products shown in separate tab with blueprint and shipping checks',
      'Shipping profiles re-fetched per blueprint and print provider on each sync',
    ],
    detail: 'Sync shows a count of updated products and surfaces any errors inline.',
  },
];

const FEATURE_GROUPS = [
  {
    title: 'Storefront',
    color: 'text-brand',
    bg: 'bg-brand/10',
    border: 'border-brand/20',
    items: [
      'Sticky header with announcement bar',
      'Category navigation (desktop + mobile drawer)',
      'Cart icon with animated item-count badge',
      'Slide-out cart drawer with quantity controls',
      'Homepage hero with configurable image & gradient',
      'New Arrivals editorial carousel',
      'Shop by Category grid',
      'Featured Picks product grid',
      'Trending Now auto-scroll marquee',
      'Social proof / review cards',
      'Full-width CTA banner',
      'Brand values band',
      'Affirmations marquee ticker',
    ],
  },
  {
    title: 'Product & Catalog',
    color: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent/20',
    items: [
      'Multi-image gallery with thumbnail switcher',
      'Color swatches (image-based or text fallback)',
      'Size/style selector filtered by color',
      'Quantity stepper with Add to Cart',
      'Trust badges (free shipping, POD notice, quality guarantee)',
      'Related products grid',
      'Product badge chips: Featured, New, Trending',
      'JSON-LD Product schema for rich snippets',
      'Per-product OG image and canonical URL',
      'Content-lock to protect custom edits from sync',
    ],
  },
  {
    title: 'Admin Dashboard',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/20',
    items: [
      'Revenue, orders, pending, and product stat cards',
      'Orders pause/resume toggle',
      'Product curation: activate, hide, feature, bulk-edit',
      'Category management with auto-slug',
      'Order detail modal with fulfillment tracking',
      'Stripe balance, charges, payouts, and refunds',
      'MailerLite: subscribers, groups, campaigns, automations',
      'Resend email composer and sent history',
      'Media library with upload, rename, bulk delete',
      'SEO settings panel with feature toggles',
      'Shipping diagnostic with coverage check',
      'Integration status badges (Printify, Stripe, MailerLite, Resend)',
    ],
  },
  {
    title: 'Infrastructure & SEO',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    items: [
      'Next.js 14 App Router with ISR (60s revalidation)',
      'Dynamic XML sitemap with all active products',
      'Dynamic robots.txt with admin/checkout/api blocks',
      'Per-page generateMetadata with OG and Twitter cards',
      'Google Search Console verification tag',
      'Supabase RLS — row-level security on all tables',
      'Docker + Docker Compose for containerized deployment',
      'GitHub Actions CI/CD → DigitalOcean Droplet',
      'Playwright E2E test suite (storefront, checkout, admin)',
      'Health check endpoint for Docker healthcheck',
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <div className="pt-24">

      {/* Header */}
      <section className="py-24 text-center border-b border-border">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-4">How It Works</p>
            <h1 className="text-5xl md:text-6xl font-black mb-6 leading-tight">
              From Printify link to<br />
              <span className="bg-brand-gradient bg-clip-text text-transparent">real store — in minutes.</span>
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed mb-8">
              No developers. No Shopify fees. No guesswork. Here&apos;s exactly how PrintifyPlatform works — every step, every feature.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              {['Next.js 14', 'Supabase', 'Stripe', 'Printify', 'Docker', 'MailerLite', 'Resend'].map((t) => (
                <span key={t} className="bg-surface border border-border px-3 py-1 rounded-full text-text-secondary">{t}</span>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Free accounts caveat */}
      <section className="py-16 border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto px-6">
          <FadeUp>
            <div className="flex items-start gap-4 bg-accent/5 border border-accent/30 rounded-2xl p-6 mb-8">
              <span className="text-2xl flex-shrink-0">💡</span>
              <div>
                <h2 className="font-bold text-lg mb-1 text-white">Good news — every integration has a free tier.</h2>
                <p className="text-text-secondary leading-relaxed">
                  You can start with a <span className="text-white font-medium">$0 stack</span>. Each service below offers a free plan that&apos;s more than enough to launch and validate your store.
                  You&apos;ll need to create a free account on each platform and paste your API keys into your PrintifyPlatform dashboard — that&apos;s it.
                </p>
              </div>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                name: 'Printify',
                free: 'Free forever',
                what: 'Your product catalog & fulfillment network',
                key: 'API key',
                where: 'My Account → Connections',
                url: 'https://printify.com',
                note: 'Free to use. You only pay Printify when an order is placed.',
                color: 'border-orange-400/30 text-orange-400',
              },
              {
                name: 'Supabase',
                free: 'Free tier — 500MB DB, 1GB storage',
                what: 'Database, auth, storage & edge functions',
                key: 'Project URL + anon key + service role key',
                where: 'Project Settings → API',
                url: 'https://supabase.com',
                note: 'Free tier handles thousands of orders before you need to upgrade.',
                color: 'border-green-400/30 text-green-400',
              },
              {
                name: 'Stripe',
                free: 'No monthly fee',
                what: 'Payment processing & checkout',
                key: 'Publishable key + Secret key + Webhook secret',
                where: 'Developers → API keys',
                url: 'https://stripe.com',
                note: 'Stripe charges 2.9% + 30¢ per transaction. No monthly fee ever.',
                color: 'border-brand/30 text-brand',
              },
              {
                name: 'Resend',
                free: 'Free — 3,000 emails/mo',
                what: 'Transactional order confirmation emails',
                key: 'API key',
                where: 'API Keys → Create API Key',
                url: 'https://resend.com',
                note: '3,000 free emails/month is plenty for a growing store.',
                color: 'border-blue-400/30 text-blue-400',
              },
              {
                name: 'MailerLite',
                free: 'Free — up to 1,000 subscribers',
                what: 'Email marketing, campaigns & automations',
                key: 'API key',
                where: 'Integrations → API → Generate new token',
                url: 'https://mailerlite.com',
                note: 'Free up to 1,000 subscribers and 12,000 emails/month.',
                color: 'border-yellow-400/30 text-yellow-400',
              },
              {
                name: 'DigitalOcean',
                free: '$200 credit for new accounts',
                what: 'Server hosting for your storefront',
                key: 'Not an API key — SSH access to your Droplet',
                where: 'Create Droplet → Basic → $6/mo plan',
                url: 'https://digitalocean.com',
                note: 'A $6/mo Droplet runs your entire store. New accounts get $200 free credit.',
                color: 'border-cyan-400/30 text-cyan-400',
              },
            ].map(({ name, free, what, key, where, url, note, color }) => (
              <FadeUp key={name}>
                <div className={`rounded-2xl border ${color.split(' ')[0]} bg-bg p-6 flex flex-col gap-3 h-full`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-bold text-base ${color.split(' ')[1]}`}>{name}</h3>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">{free}</span>
                  </div>
                  <p className="text-sm text-white">{what}</p>
                  <div className="text-xs text-text-secondary space-y-1">
                    <p><span className="text-white font-medium">Key needed:</span> {key}</p>
                    <p><span className="text-white font-medium">Find it:</span> {where}</p>
                  </div>
                  <p className="text-xs text-text-secondary italic mt-auto">{note}</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs font-semibold ${color.split(' ')[1]} hover:underline`}
                  >
                    Create free account →
                  </a>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Step-by-step */}
      <section className="py-24 max-w-4xl mx-auto px-6">
        <FadeUp>
          <h2 className="text-3xl font-black mb-12">The full flow, step by step.</h2>
        </FadeUp>
        <HowItWorksSteps steps={STEPS} />
      </section>

      {/* Feature groups */}
      <section className="py-24 border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-16">
              <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-3">Full Feature Inventory</p>
              <h2 className="text-4xl font-black">Everything that ships with your store.</h2>
              <p className="text-text-secondary mt-3">Not a template. A production-grade application.</p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURE_GROUPS.map((group) => (
              <FadeUp key={group.title}>
                <div className={`rounded-2xl border ${group.border} bg-bg p-7`}>
                  <h3 className={`font-bold text-lg mb-5 ${group.color}`}>{group.title}</h3>
                  <ul className="space-y-2.5">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                        <Check size={14} className={`${group.color} flex-shrink-0 mt-0.5`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Database schema strip */}
      <section className="py-24 border-t border-border max-w-6xl mx-auto px-6">
        <FadeUp>
          <h2 className="text-3xl font-black mb-3">Built on a solid data model.</h2>
          <p className="text-text-secondary mb-10">Supabase Postgres with row-level security on every table.</p>
        </FadeUp>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { table: 'products', cols: 'printify_id, title, description, category_id, price, cost, image_url, images, variants, shipping_info, status, featured, is_new_arrival, is_trending, content_locked' },
            { table: 'orders', cols: 'stripe_session_id, stripe_payment_intent_id, printify_order_id, email, shipping_name, shipping_address, shipping_cost, subtotal, total, status, fulfillment_status, tracking_number, items' },
            { table: 'settings', cols: 'store_name, tagline, hero_image_url, hero_object_position, hero_height_vh, hero_gradient_dir, announcement, orders_paused, printify_connected, social_links' },
            { table: 'categories', cols: 'name, slug, description' },
            { table: 'seo_settings', cols: 'site_url, default_og_image, sitemap_enabled, robots_noindex_admin, jsonld_enabled, canonical_enabled, meta_title_suffix, twitter_handle, google_site_verification' },
            { table: 'admins', cols: 'user_id (fk auth.users), email, role (admin / super_admin)' },
          ].map(({ table, cols }) => (
            <FadeUp key={table}>
              <div className="rounded-xl border border-border bg-surface p-5">
                <p className="font-mono text-brand text-sm font-semibold mb-2">{table}</p>
                <p className="text-xs text-text-secondary leading-relaxed font-mono">{cols}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Edge functions strip */}
      <section className="py-16 border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp>
            <h2 className="text-3xl font-black mb-10">Supabase Edge Functions</h2>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: 'printify-proxy',
                trigger: 'HTTP (admin + webhook)',
                desc: 'Full Printify API proxy. Handles product sync with pagination, color/image mapping, shipping profile fetching, and content-lock logic. Keeps your API key server-side only.',
              },
              {
                name: 'stripe-checkout',
                trigger: 'HTTP (checkout page)',
                desc: 'Creates Stripe Checkout Session with line items, shipping, and metadata. Inserts a pending order into Supabase immediately. Returns session URL for client redirect.',
              },
              {
                name: 'stripe-webhook',
                trigger: 'Stripe webhook POST',
                desc: 'Verifies Stripe signature. On payment success: updates order to paid, sends confirmation email via Resend, and forwards order to Printify for fulfillment.',
              },
            ].map((fn) => (
              <FadeUp key={fn.name}>
                <div className="rounded-2xl border border-border bg-bg p-6">
                  <p className="font-mono text-accent text-sm font-semibold mb-1">{fn.name}</p>
                  <p className="text-xs text-text-secondary mb-3 font-mono">{fn.trigger}</p>
                  <p className="text-sm text-text-secondary leading-relaxed">{fn.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 border-t border-border text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="relative max-w-2xl mx-auto px-6">
          <FadeUp>
            <h2 className="text-4xl md:text-5xl font-black mb-4">Ready to launch?</h2>
            <p className="text-text-secondary text-lg mb-8">14-day free trial. No credit card required. Cancel anytime.</p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-brand-gradient px-8 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity animate-glow-pulse"
            >
              Start Free Trial <ArrowRight size={18} />
            </Link>
          </FadeUp>
        </div>
      </section>

    </div>
  );
}
