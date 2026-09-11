# PrintifyPlatform — SaaS Marketing Site Frontend Prompt

## What We're Building

A **high-converting SaaS marketing & onboarding website** for **PrintifyPlatform** — the fastest way for Printify sellers to launch a real, branded ecommerce store without writing a single line of code.

This is NOT the storefront itself. This is the **platform's public-facing website** that sells the service, captures leads, and onboards new merchants.

---

## The Pitch (internalize this before building anything)

> Printify gives you the products. We give you the store.

Most Printify sellers are stuck sharing a generic Printify storefront link. No branding. No SEO. No real checkout experience. No control.

**PrintifyPlatform** fixes that. In minutes, a seller gets:
- A fully branded Next.js storefront synced live to their Printify catalog
- Stripe-powered checkout that actually converts
- An admin dashboard to curate products, manage orders, and control their brand — zero dev required
- Deployed, hosted, and running — not a template, a real production app

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router (TypeScript) |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Forms | React Hook Form |
| Icons | Lucide React |

---

## Pages & Routes

```
/                  → Hero + Features + Pricing + Testimonials + CTA
/how-it-works      → Step-by-step visual walkthrough
/pricing           → Tier breakdown with feature matrix
/demo              → Live embedded demo storefront preview
/blog              → SEO content hub (Printify tips, POD guides)
/login             → Merchant login (Supabase auth)
/signup            → Onboarding flow (connect Printify → pick plan → launch)
/dashboard         → Merchant portal (post-login)
```

---

## Homepage Sections (in order)

### 1. Navbar
- Logo: "PrintifyPlatform" — bold, modern wordmark
- Links: How It Works · Pricing · Demo · Blog
- CTA button (top right): **"Launch My Store →"** — high contrast, pill shape
- Sticky on scroll, slight blur backdrop

---

### 2. Hero Section

**Headline (large, bold, centered):**
> "Your Printify Shop Deserves a Real Store."

**Subheadline:**
> Stop sending customers to a generic link. Launch a fully branded, Stripe-powered storefront — synced live to your Printify catalog — in under 5 minutes.

**CTAs (side by side):**
- Primary: `Launch My Store — It's Free` (filled, brand color)
- Secondary: `See a Live Demo` (outlined)

**Social proof bar below CTAs:**
> ⭐⭐⭐⭐⭐ Trusted by 500+ Printify sellers · $2M+ in orders processed

**Hero visual:**
- Split screen or floating browser mockup showing:
  - Left: a generic Printify storefront link (dull, unbranded)
  - Right: a beautiful branded storefront powered by PrintifyPlatform (vibrant, professional)
- Subtle animated gradient background

---

### 3. Problem → Solution Strip

Three columns, icon + headline + one-liner each:

| Problem | Solution |
|---------|----------|
| 🔗 "Your store is just a link" | A real domain, real brand, real store |
| 🛒 "Checkout kills conversions" | Stripe-hosted checkout, optimized to convert |
| 🤯 "You need a developer" | Admin dashboard — no code, ever |

---

### 4. How It Works (3 Steps)

Large numbered steps with animated illustrations:

**Step 1 — Connect Your Printify Shop**
> Paste your Printify API key. We pull your entire catalog instantly. No CSV exports, no manual uploads.

**Step 2 — Customize Your Brand**
> Upload your logo, set your colors, write your SEO title. Your store looks like *you* — not like everyone else on Printify.

**Step 3 — Go Live**
> Hit launch. Your store is live on your domain, synced to Printify, and ready to take Stripe payments. Done.

---

### 5. Feature Showcase

Alternating image + text rows (Framer Motion scroll reveal):

**🖨️ Live Printify Sync**
> Your catalog updates automatically. New product on Printify? It's on your store. Price change? Reflected instantly. No manual work.

**💳 Stripe Checkout That Converts**
> Stripe's hosted checkout is trusted by millions. Customers feel safe. You get paid. Orders flow directly into Printify fulfillment — automatically.

**🎛️ Admin Dashboard**
> Feature products. Hide variants. Update your logo. Change your SEO description. Manage orders. All from a clean dashboard — no Figma, no dev, no drama.

**🔒 Enterprise-Grade Security**
> Your Printify API key never touches the browser. Stripe webhooks are verified. Supabase RLS locks down your data. Built like a bank, priced like a SaaS.

**🚀 Deployed & Hosted**
> We handle the server, the SSL, the CDN, the uptime. You handle the products and the marketing. That's the deal.

---

### 6. Pricing

Three tiers, centered card layout. Middle card ("Pro") is visually elevated with a "Most Popular" badge.

| | Starter | Pro | Agency |
|--|---------|-----|--------|
| Price | $29/mo | $79/mo | $199/mo |
| Stores | 1 | 1 | Up to 10 |
| Custom Domain | ✅ | ✅ | ✅ |
| Printify Sync | ✅ | ✅ | ✅ |
| Stripe Checkout | ✅ | ✅ | ✅ |
| Admin Dashboard | ✅ | ✅ | ✅ |
| Brand Settings | ✅ | ✅ | ✅ |
| Order Management | ✅ | ✅ | ✅ |
| White-Label | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |
| Multi-Shop | ❌ | ❌ | ✅ |

CTA under each card: **"Start Free Trial"**

Fine print: *14-day free trial. No credit card required. Cancel anytime.*

---

### 7. Testimonials

Three quote cards in a horizontal scroll or grid:

> *"I was sending people to my Printify link for 8 months. Within a week of switching to PrintifyPlatform, my conversion rate doubled."*
> — **Marcus T., Streetwear Brand Owner**

> *"The admin dashboard is insane. I can feature new drops, update my logo, and check orders — all from my phone."*
> — **Jasmine R., Custom Apparel Seller**

> *"I run 6 Printify shops for clients. The Agency plan paid for itself in the first month."*
> — **Derek M., POD Agency Owner**

---

### 8. Final CTA Section

Full-width, brand-color background, centered:

**Headline:** "Your Next Sale Is Waiting."

**Subheadline:** "Launch your branded Printify storefront today. No developers. No guesswork. Just a store that sells."

**CTA Button:** `Start Free — Launch in 5 Minutes`

---

### 9. Footer

- Logo + tagline: *"The storefront layer for Printify sellers."*
- Links: How It Works · Pricing · Demo · Blog · Login · Privacy · Terms
- Social: Twitter/X · Instagram · YouTube
- Copyright: © 2025 PrintifyPlatform

---

## Design System

### Colors
```
Brand Primary:    #6C47FF  (electric violet — trust + tech)
Brand Accent:     #00D4AA  (mint green — growth + money)
Background:       #0A0A0F  (near-black — premium feel)
Surface:          #13131A  (card backgrounds)
Text Primary:     #FFFFFF
Text Secondary:   #A0A0B0
Border:           #2A2A3A
```

### Typography
```
Headings:   Inter or Geist — Bold/Black weight
Body:       Inter — Regular/Medium
Mono:       JetBrains Mono (for code snippets / API key inputs)
```

### Motion
- Hero elements: fade-up on load (staggered, 0.1s delay each)
- Feature rows: slide-in on scroll (Framer Motion `whileInView`)
- Pricing cards: subtle scale on hover (`whileHover: { scale: 1.02 }`)
- CTA buttons: glow pulse animation on idle

### Component Patterns
- Cards: `rounded-2xl`, `border border-[#2A2A3A]`, subtle `backdrop-blur`
- Buttons: pill shape (`rounded-full`), gradient fill for primary
- Section spacing: `py-24` between major sections
- Max content width: `max-w-6xl mx-auto px-6`

---

## Key Conversion Principles (apply everywhere)

1. **Specificity sells** — "5 minutes" beats "fast setup". "$2M+ processed" beats "trusted by sellers".
2. **Remove friction** — Every CTA leads to signup. Signup asks for email only, first step.
3. **Show, don't tell** — The demo page embeds a real live storefront. Let them click around.
4. **Anchor on pain** — The Printify seller's pain is invisibility. Every section should remind them of that pain, then immediately resolve it.
5. **Social proof everywhere** — Star ratings, order volume, seller count. Repeat it. Reinforce it.

---

## Onboarding Flow (`/signup`)

Multi-step, no page reloads:

```
Step 1: Enter email + password  →
Step 2: Paste Printify API Key  →
Step 3: We pull your shop + show product count  →
Step 4: Pick a plan  →
Step 5: Enter card (Stripe)  →
Step 6: 🎉 "Your store is live at [subdomain].printifyplatform.com"
```

Progress bar at top. Each step is one focused action. No walls of form fields.

---

## SEO Targets

| Page | Target Keyword |
|------|---------------|
| `/` | "Printify storefront builder" |
| `/how-it-works` | "how to sell Printify products on your own website" |
| `/pricing` | "Printify SaaS platform pricing" |
| `/blog/*` | "print on demand store tips", "Printify vs Shopify", etc. |
