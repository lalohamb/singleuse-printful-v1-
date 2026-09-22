import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Package, Users, Gift, Star, ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore everything Body & Sleeves offers — custom orders, bulk wholesale, gift services, affiliate program, and more.",
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function ServicesPage() {
  const { data } = await supabase
    .from("settings")
    .select("social_links, store_name")
    .limit(1)
    .maybeSingle();

  type SocialEntry = { url: string; enabled: boolean };
  const social = (data?.social_links ?? {}) as Record<string, SocialEntry>;
  const emailHref = social.email?.enabled && social.email.url ? social.email.url : "mailto:hello@bodyandsleeves.com";

  const SERVICES = [
    {
      id: "custom",
      icon: Sparkles,
      title: "Custom Orders",
      tagline: "Your vision, made real.",
      description: "Have a design idea, a special occasion, or a one-of-a-kind concept? We work with you to bring it to life. From personalized text and graphics to fully custom colorways, every piece is made to order — no minimums, no waste.",
      bullets: ["Personalized names, dates, or messages", "Custom graphic placement", "Available on tees, hoodies, hats & more", "Turnaround in 3–7 business days"],
      cta: { label: "Start a Custom Order", href: `${emailHref.replace(/\?.*$/, "")}?subject=Custom%20Order` },
      accent: "bg-primary-50 border-primary-100",
      iconColor: "text-primary-500 bg-primary-100",
    },
    {
      id: "bulk",
      icon: Package,
      title: "Bulk & Wholesale",
      tagline: "Outfit your team, crew, or event.",
      description: "Need 10, 50, or 500 pieces? We offer bulk pricing for teams, organizations, events, and resellers. Every order is still printed on demand through Printify — meaning no inventory risk and consistent quality at scale.",
      bullets: ["Discounted pricing at 10+ units", "Mix sizes and styles in one order", "Perfect for events, uniforms & merch drops", "White-label options available"],
      cta: { label: "Request a Bulk Quote", href: `${emailHref.replace(/\?.*$/, "")}?subject=Bulk%20Order%20Quote` },
      accent: "bg-warning-50 border-warning-100",
      iconColor: "text-warning-600 bg-warning-100",
    },
    {
      id: "gifting",
      icon: Gift,
      title: "Gift Services",
      tagline: "The gift that actually fits.",
      description: "Send a thoughtful, made-to-order gift directly to someone special. We offer gift-ready packaging, personalized notes, and direct shipping to any address. Great for birthdays, holidays, corporate gifting, and more.",
      bullets: ["Gift-ready packaging on request", "Personalized message cards", "Ship directly to the recipient", "E-gift cards available"],
      cta: { label: "Shop Gift Ideas", href: "/shop" },
      accent: "bg-accent-50 border-accent-100",
      iconColor: "text-accent-600 bg-accent-100",
    },
    {
      id: "affiliate",
      icon: Users,
      title: "Affiliate Program",
      tagline: "Share the brand. Earn every time.",
      description: "Love Body & Sleeves? Join our affiliate program and earn a commission on every sale you refer. Whether you're a content creator, stylist, or just someone with great taste and a following — we want to partner with you.",
      bullets: ["Competitive commission on every referred sale", "Unique tracking link provided", "Monthly payouts via PayPal or Venmo", "Early access to new drops for affiliates"],
      cta: { label: "Apply to Affiliate Program", href: "/affiliate" },
      accent: "bg-success-50 border-success-100",
      iconColor: "text-success-600 bg-success-100",
    },
  ];

  return (
    <StorefrontLayout>
      {/* Hero */}
      <section className="bg-secondary-900 text-white py-20 px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-gold-400 uppercase tracking-widest text-sm font-semibold mb-3">What We Offer</p>
        <h1 className="text-4xl lg:text-5xl font-bold max-w-3xl mx-auto leading-tight">
          More than a store — a full service brand experience
        </h1>
        <p className="text-secondary-400 mt-6 max-w-2xl mx-auto text-lg leading-relaxed">
          From one-of-a-kind custom pieces to bulk orders, thoughtful gifting, and an affiliate program that pays — Body &amp; Sleeves is built to serve you at every level.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-8">
          <Link href="/shop" className="btn-gold">Shop Now</Link>
          <a href={emailHref} className="btn-outline border-white/20 text-white hover:bg-white/10">
            <Mail size={18} className="mr-2" />Get in Touch
          </a>
        </div>
      </section>

      {/* Services Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-8">
        {SERVICES.map((s) => (
          <div key={s.id} id={s.id} className={`rounded-2xl border p-8 lg:p-10 ${s.accent}`}>
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconColor}`}>
                <s.icon size={26} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary-400 mb-1">{s.tagline}</p>
                <h2 className="text-2xl font-bold text-secondary-900 mb-3">{s.title}</h2>
                <p className="text-secondary-600 leading-relaxed mb-5 max-w-2xl">{s.description}</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-secondary-700">
                      <Star size={14} className="text-gold-500 mt-0.5 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <a
                  href={s.cta.href}
                  {...(s.cta.href.startsWith("mailto") ? {} : {})}
                  className="inline-flex items-center gap-2 btn-primary text-sm"
                >
                  {s.cta.label} <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Promo: Build a site like this */}
      <section className="bg-secondary-900 text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
             
              <p className="text-secondary-400 leading-relaxed mb-6">
                We partner with another Black-Owned Business <strong className="text-white">Atlas Cloud Hosting</strong> to deploy custom Next.js storefronts just like this one — fully branded, self-hosted, and connected to your own Printify catalog, Stripe payments, and email marketing.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  "No inventory or warehousing costs",
                  "Your own domain, brand, and checkout",
                  "Stripe payments + Printify fulfillment",
                  "Admin panel to manage products, orders & email",
                  "Deployed on your own server — you own everything",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-secondary-300">
                    <Star size={14} className="text-gold-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://atlascloudhosting.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold inline-flex items-center gap-2"
                >
                  Get Your Store Built <ExternalLink size={16} />
                </a>
                <a
                  href="https://printify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline border-white/20 text-white hover:bg-white/10 inline-flex items-center gap-2 text-sm"
                >
                  Learn About Printify <ExternalLink size={15} />
                </a>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5">
              <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest">How it works</p>
              {[
                { step: "01", title: "Connect Printify", desc: "Link your Printify catalog — hundreds of products, printed and shipped by global print partners." },
                { step: "02", title: "Customize your storefront", desc: "Your logo, colors, pages, and products — all managed from a built-in admin panel." },
                { step: "03", title: "Accept payments via Stripe", desc: "Secure checkout, automatic order forwarding to Printify, and real-time order tracking." },
                { step: "04", title: "Grow with email marketing", desc: "Built-in MailerLite integration for newsletters, automations, and subscriber management." },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <span className="text-gold-500 font-bold text-lg w-8 flex-shrink-0">{item.step}</span>
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-secondary-400 text-sm mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </StorefrontLayout>
  );
}
