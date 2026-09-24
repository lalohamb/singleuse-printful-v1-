# Sales Copy — Printify POD Storefront (Self-Hosted, One-Time Purchase)

---

## Positioning

**Product type:** One-time purchase. You download the code, deploy it yourself, own it forever.
**Target buyer:** Printify sellers who want a real branded storefront — not a Shopify subscription, not a generic link.
**Core promise:** A production-ready Next.js storefront, fully wired to Printify + Stripe + Supabase, that you own outright. No monthly fees. No platform lock-in.

---

## Hero Section

**Headline:**
> Your Printify Store. Your Code. Your Rules.

**Subheadline:**
> A production-ready storefront built on Next.js 15, Supabase, and Stripe — fully synced to your Printify catalog. Buy once. Deploy on your own server. Own it forever. No subscriptions. No platform fees. No middleman.

**Primary CTA:** `Get the Code — $[price]`
**Secondary CTA:** `See the Live Demo`

**Trust bar:**
> ✅ One-time payment · ✅ Full source code included · ✅ Self-hosted on your own server · ✅ No monthly fees ever

---

## The Problem

Most Printify sellers are stuck choosing between two bad options:

- **Shopify** — $39–$399/month, plus transaction fees, plus app fees, and you never own anything
- **A raw Printify link** — no brand, no custom domain, no real checkout, no email list

There's a third option. Buy the storefront once. Deploy it on a $6/month DigitalOcean droplet. Keep 100% of your revenue.

---

## What You Get

A complete, production-ready storefront with every feature you'd expect from a $79/month SaaS — except you pay once and own the code.

### 🖨️ Live Printify Sync
One-click sync pulls your entire Printify catalog — every product, every variant, every price, every shipping profile. New product on Printify? Hit sync. It's live. Supports all blueprints and print providers.

### 💳 Stripe Checkout
Stripe's hosted checkout handles payments. Orders automatically forward to Printify for fulfillment the moment a customer pays. Full and partial refunds from your admin panel. Live and test mode switching built in.

### 🎛️ Full Admin Dashboard — Zero Code Required
Everything runs from `/admin`:
- **Products** — curate, feature, flag New Arrivals and Trending, bulk-edit categories, content-lock synced products
- **Orders** — view status, shipping address, fulfillment tracking, update manually
- **Settings** — hero image with live preview, position sliders, gradient controls, announcement bar
- **SEO** — sitemap, robots.txt, JSON-LD product schema, Open Graph, Google Search Console
- **Email Marketing** — full MailerLite integration: subscribers, groups, campaigns, automations
- **Transactional Email** — Resend integration: order confirmation emails sent automatically on every paid order
- **Media Library** — upload, rename, bulk-delete store images
- **Stripe Panel** — balance, recent charges, refunds, payouts
- **Shipping Diagnostics** — live coverage check, per-country rate calculator
- **Affiliate Program** — built-in referral tracking, 10% commission, payout management

### 🔒 Security Hardened
- Printify API key never touches the browser (Supabase Edge Function proxy)
- Stripe webhooks cryptographically verified
- Supabase Row-Level Security on every table
- Admin routes protected by session auth + database role check
- Input validation, SSRF protection, path traversal prevention, prototype pollution guard — all built in

### 📦 Print-on-Demand, Zero Inventory
Every order is made fresh. Products ship directly from Printify's global fulfillment network. You never touch inventory.

### 📱 Mobile-First Storefront
Sticky header, slide-out cart drawer, collapsible mobile filters, touch-friendly product gallery with color swatches and size selectors. Customers can shop and checkout from their phone without friction.

### 🔍 SEO Built In
Dynamic XML sitemap, robots.txt, per-product JSON-LD schema, Open Graph tags, canonical URLs, Twitter cards — all configurable from your admin panel.

### 📣 Affiliate Program Included
Built-in referral tracking with 30-day cookie, 10% commission, admin approval flow, Stripe payout integration, and affiliate dashboard at `/affiliates/dashboard`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router + React 19 + TypeScript |
| Styling | Tailwind CSS |
| Database / Auth | Supabase (Postgres + RLS + Edge Functions + Storage) |
| Payments | Stripe Checkout + Stripe Admin API |
| Fulfillment | Printify (via Supabase Edge Function proxy) |
| Email Marketing | MailerLite |
| Transactional Email | Resend |
| Deployment | Docker + Docker Compose → DigitalOcean Droplet |
| Testing | Playwright E2E |

---

## Cloud Setup — What You Need

This is a self-hosted product. You bring the accounts; the code wires them together.

| Service | Cost | What It's For |
|---|---|---|
| DigitalOcean Droplet (Basic) | ~$6–12/mo | Your server |
| Supabase (Free tier) | $0 | Database, auth, edge functions, storage |
| Stripe | 2.9% + 30¢/transaction | Payments (you keep the rest) |
| Printify | Free | Product fulfillment |
| Resend (Free tier) | $0 | Order confirmation emails (3,000/mo free) |
| MailerLite (Free tier) | $0 | Email marketing (1,000 subscribers free) |
| Domain name | ~$12/yr | Your store's URL |

**Total ongoing cost: ~$6–12/month for the server + your domain.** Everything else is free tier until you scale.

No platform fees. No revenue share. No subscription to us.

---

## How Deployment Works

The repo includes a full deployment script. Here's the flow:

**Step 1 — Provision your server**
Run `scripts/setup-droplet.sh` on a fresh DigitalOcean Ubuntu droplet. Installs Docker, Node, PM2, and all dependencies automatically.

**Step 2 — Configure your environment**
Copy `.env.example` to `.env.local`. Fill in your Supabase URL + keys, Stripe keys, Printify API key, Resend API key, MailerLite API key. Full documentation in `docs/ENVIRONMENT-VARIABLES.md`.

**Step 3 — Set up Supabase**
Run the included SQL schema in your Supabase dashboard. One file. Takes 2 minutes. Full guide in `docs/SUPABASE-SETUP.md`.

**Step 4 — Deploy**
Run `scripts/deploy.sh`. Builds the Next.js app, starts it with PM2, configures nginx as a reverse proxy, provisions SSL via Let's Encrypt. Your store is live on your domain.

**Step 5 — Connect Printify**
Paste your Printify API key in Admin → Settings. Hit "Sync from Printify." Your entire catalog appears in seconds.

**Step 6 — Go live**
Switch Stripe from test mode to live mode in Admin → Stripe. Your store is open for business.

Full step-by-step documentation included for every service. See `docs/GETTING-STARTED.md`.

---

## What's Included

```
✅ Full Next.js 15 source code (TypeScript)
✅ Supabase schema + all migrations
✅ Supabase Edge Functions (Printify proxy, Stripe checkout, Stripe webhook)
✅ Deployment scripts (DigitalOcean droplet setup, deploy, soft reset, full reset)
✅ Playwright E2E test suite
✅ Complete documentation (12 guides covering every service)
✅ Admin panel with 15+ management sections
✅ Affiliate program with referral tracking + payout management
✅ Newsletter popup + MailerLite integration
✅ SEO tools (sitemap, robots.txt, JSON-LD, OG tags)
✅ Security hardening (input validation, SSRF protection, RLS, webhook verification)
```

---

## Who This Is For

**✅ Right for you if:**
- You sell on Printify and want a real branded storefront
- You're comfortable with basic server setup (or willing to follow a guide)
- You want to own your store and pay no ongoing platform fees
- You want full control over your code, your data, and your customer list

**❌ Not right for you if:**
- You want a fully managed hosted solution (use Shopify)
- You've never touched a terminal and don't want to learn
- You need phone support

---

## FAQ

**Do I need to know how to code?**
No coding required to run the store. The admin dashboard handles everything. You do need to be comfortable running a few terminal commands to deploy — the scripts handle the hard parts, and the docs walk you through every step.

**What does "self-hosted" mean?**
You rent a server (DigitalOcean, ~$6/month), run the deployment script, and your store lives on that server. You control everything. No one can shut you down, raise your fees, or take a cut of your revenue.

**Do I pay anything ongoing?**
Only your server (~$6–12/month) and your domain (~$12/year). Supabase, Resend, and MailerLite are free at small scale. Stripe charges their standard 2.9% + 30¢ per transaction — that's between you and Stripe.

**Can I customize the design?**
Yes. You have the full source code. Change anything — colors, fonts, layout, copy, components. The brand system uses Tailwind CSS with a custom design token setup.

**Does it work with my existing Printify account?**
Yes. You connect with your Printify API key. Your existing products, variants, and pricing sync instantly.

**What happens when I add a new product on Printify?**
Click "Sync from Printify" in your admin panel. New products appear immediately. You can then curate, feature, or categorize them.

**Do you handle fulfillment?**
Printify handles fulfillment. When a customer pays, the order is automatically forwarded to Printify. They print and ship. You get paid.

**Is there a transaction fee?**
No. You pay once for the code. Stripe charges their standard processing fee — that's between you and Stripe.

**Can I use my own domain?**
Yes. The deployment script configures nginx + SSL for your domain automatically.

**What if I get stuck?**
The repo includes 12 documentation files covering every service, a troubleshooting guide, and a setup checklist. The code is well-structured and commented for developers who want to dig in.

**Can I resell this or use it for client stores?**
Check the license included with your purchase.

---

## Final CTA

**Headline:** Stop Paying Monthly Fees for a Store You Don't Own.

**Subheadline:** One payment. Full source code. Deploy on your own server in an afternoon. Your Printify catalog, your Stripe account, your customer data — all yours.

**CTA:** `Get the Code — $[price]`

Fine print: *One-time purchase. Full source code included. Self-hosted — you provide the server. No refunds on digital downloads.*

---

## Conversion Notes

- **Lead with ownership** — the core differentiator vs. Shopify is that you own the code and pay no ongoing fees. Every section should reinforce this.
- **Be honest about self-hosting** — buyers who aren't comfortable with a terminal will churn or leave bad reviews. Qualify them out in the copy.
- **Show the admin dashboard** — a screenshot or video of the admin panel is the single highest-converting asset. It makes the product real and shows the depth of what's included.
- **Anchor on Shopify cost** — $39–$399/month vs. a one-time fee is a compelling comparison. Name it.
- **The $6/month server cost** — say it clearly. Buyers worry about hidden ongoing costs. Naming the actual server cost builds trust.
- **Specificity sells** — "15+ admin sections," "12 documentation guides," "Playwright E2E test suite" — specifics signal a serious, complete product.
