# Prompt: Transform to POD Demo Storefront

## Goal

Convert this Next.js codebase from the **Body & Sleeves** brand into a polished,
generic **print-on-demand demo storefront** that:

1. Showcases the platform's capabilities to potential buyers / clients
2. Uses compelling, sales-forward ("salesy") copy that sells the *idea* of owning
   a POD store — not just the products
3. Makes it crystal clear this is a **Printify-powered POD platform** — not a
   competing product, but a working example of what you can build with it
4. Feels like a real, live store — not a placeholder or wireframe

The demo brand name is **"ThreadLaunch"** — a fictional POD store that sells
premium custom apparel. The tagline is **"Your Brand. Zero Inventory."**

---

## Positioning & Tone

This is the most important part. Every line of copy should do one of two things:

- **Sell the product** (the apparel on screen) as if it's a real store
- **Sell the platform** (the POD business model) to the person browsing the demo

Use a dual-layer voice:
- Primary layer: a real apparel store ("Shop our latest drops")
- Secondary layer: a subtle meta-message ("This is what YOUR store could look like")

Avoid:
- Anything that sounds like a tutorial or documentation
- Phrases like "this is a demo" or "placeholder content"
- Overly corporate or dry language

Use:
- Confident, punchy copy ("Zero inventory. Zero risk. 100% yours.")
- Social proof framing ("Thousands of creators already sell this way")
- Urgency and aspiration ("Your brand could be live in 24 hours")

---

## Brand Identity for "ThreadLaunch"

| Attribute       | Value                                                        |
|-----------------|--------------------------------------------------------------|
| Brand name      | ThreadLaunch                                                 |
| Tagline         | Your Brand. Zero Inventory.                                  |
| Hero title      | Launch Your Brand. Keep Your Day Job.                        |
| Hero subtitle   | Premium custom apparel, printed on demand and shipped direct to your customers. No warehouse. No minimums. No risk. |
| Our Why label   | Why POD Works                                                |
| Our Why quote   | The best time to start your brand was yesterday. The second best time is right now. |
| Our Why body    | ThreadLaunch is built on Printify's print-on-demand network — 900+ products, global print partners, and automatic fulfillment. You design it, we print it, Printify ships it. You keep the profit. |
| Announcement    | Free shipping on orders over $75 · Printed fresh for every order · Powered by Printify |
| CTA section     | Your Store Could Look Exactly Like This                      |
| CTA body        | This entire storefront — products, checkout, order tracking, admin panel — is ready to launch with your brand in 24 hours. |

---

## Hero Images (use free Pexels/Unsplash URLs — no auth needed)

Replace all Body & Sleeves specific images with generic apparel/lifestyle shots:

| Usage           | URL                                                                                                      |
|-----------------|----------------------------------------------------------------------------------------------------------|
| Hero background | `https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=1600`   |
| Our Why panel   | `https://images.pexels.com/photos/3622608/pexels-photo-3622608.jpeg?auto=compress&cs=tinysrgb&w=800`    |
| Story/CTA bg    | `https://images.pexels.com/photos/1884581/pexels-photo-1884581.jpeg?auto=compress&cs=tinysrgb&w=1600`   |
| OG / fallback   | `https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=1200`   |

---

## File-by-File Changes

### 1. `src/app/HomeClient.tsx`

**AFFIRMATIONS marquee** — replace the 5 strings:
```
"Your Brand. Your Rules."
"Zero Inventory. Zero Risk."
"Powered by Printify"
"Launch in 24 Hours"
"Custom Apparel. On Demand."
```

**Feature strip** (4 icons below hero) — replace titles and descriptions:
```
{ icon: Truck,     title: "Ships Direct",    desc: "Printify fulfills every order" }
{ icon: Sparkles,  title: "No Minimums",     desc: "Order one or ten thousand" }
{ icon: Shield,    title: "Zero Inventory",  desc: "Printed fresh, never warehoused" }
{ icon: Heart,     title: "Your Brand",      desc: "Your logo, your story, your store" }
```

**Category section heading** — replace with:
```
Browse the Collection — Every Category Ships on Demand
```

**Brand Values Band** (3 stats) — replace with:
```
{ stat: "900+",    label: "Products Available",   sub: "T-shirts, hoodies, hats, mugs, and more via Printify" }
{ stat: "0",       label: "Inventory Required",   sub: "Every item printed fresh when an order comes in" }
{ stat: "24hrs",   label: "Time to Launch",       sub: "Your branded store live in under a day" }
```

**Featured Picks section** — keep heading, change subtitle to:
```
"Printed on demand — no stock, no waste"
```

**Testimonials section heading** — replace with:
```
<p>Platform Love</p>
<h2>What Store Owners Are Saying</h2>
```

**Testimonials data** — replace the 3 hardcoded reviews:
```js
[
  {
    quote: "I launched my brand in a weekend. First sale came in 3 days later. This platform handles everything.",
    name: "Jordan M.",
    location: "Austin, TX",
    product: "Custom Hoodie Drop"
  },
  {
    quote: "No inventory, no headaches. I design, customers order, Printify ships. I just watch the dashboard.",
    name: "Taylor S.",
    location: "Brooklyn, NY",
    product: "Graphic Tee Collection"
  },
  {
    quote: "The admin panel alone is worth it. I manage products, orders, and emails all in one place.",
    name: "Riley K.",
    location: "Denver, CO",
    product: "Hat & Accessories Line"
  }
]
```

**"Wear Your Story" CTA section** — replace heading and body:
```
<h2>Your Store Could Look Exactly Like This</h2>
<p>This entire storefront — products, checkout, order tracking, admin panel — is ready to launch with your brand in 24 hours. Powered by Printify.</p>
<Link href="/shop">Explore the Demo Store</Link>
```

**Trending section subtitle** — replace with:
```
"What's moving — all printed on demand"
```

---

### 2. `src/components/Footer.tsx`

**Brand name display** — replace `Body<span>&</span>Sleeves` with:
```
Thread<span className="text-gold-500">Launch</span>
```

**Brand description paragraph** — replace with:
```
A demo print-on-demand storefront powered by Printify. Zero inventory, zero minimums — your brand live in 24 hours.
```

**Footer tagline** (bottom right) — replace with:
```
Powered by Printify. Built to launch.
```

**Copyright** — replace with:
```
© {new Date().getFullYear()} ThreadLaunch Demo. All rights reserved.
```

**DEFAULT_SOCIAL** — set all URLs to `""` and `enabled: false` except email:
```js
const DEFAULT_SOCIAL = {
  instagram: { url: "", enabled: false },
  tiktok:    { url: "", enabled: false },
  facebook:  { url: "", enabled: false },
  youtube:   { url: "", enabled: false },
  pinterest: { url: "", enabled: false },
  snapchat:  { url: "", enabled: false },
  threads:   { url: "", enabled: false },
  email:     { url: "mailto:hello@yourdomain.com", enabled: true },
};
```

**Contact email link** in Customer Care nav — replace with:
```
mailto:hello@yourdomain.com
```

**"Our Story" nav column** — rename to "Platform" and update links:
```
About This Demo  → /about
How POD Works    → /about#how-it-works
Printify Sync    → /about#printify
```

---

### 3. `src/components/Header.tsx`

**Logo alt text** — replace `"Body & Sleeves"` with `"ThreadLaunch"`

**Fallback logo text** (if no logo_url) — replace brand name display with:
```
Thread<span className="text-gold-500">Launch</span>
```

---

### 4. `src/components/AdminLayout.tsx`

**Sidebar brand name** — replace `"Body & Sleeves"` with `"ThreadLaunch"`

---

### 5. `src/app/layout.tsx`

```ts
title: { default: "ThreadLaunch", template: "%s | ThreadLaunch" }
description: "A live print-on-demand demo store powered by Printify. Launch your brand with zero inventory."
```

---

### 6. `src/app/page.tsx` (metadata)

```ts
export const metadata = {
  title: "ThreadLaunch — POD Demo Store",
  description: "See a fully working print-on-demand storefront in action. Powered by Printify.",
};
```

---

### 7. `src/app/about/page.tsx`

Rewrite as a POD explainer page with three sections:

**Section 1 — What is ThreadLaunch?**
> ThreadLaunch is a fully working demo of a Printify-powered print-on-demand storefront. Every product you see is real, every checkout is live, and every order is fulfilled automatically by Printify's global print network.

**Section 2 — How It Works**
> 1. Customer places an order on your store
> 2. Order is automatically sent to Printify
> 3. Printify prints and ships direct to your customer
> 4. You keep the margin — no inventory, no fulfillment headaches

**Section 3 — What's Included**
> - Full Next.js storefront with product pages, cart, and checkout
> - Stripe payments (live + test mode)
> - Printify product sync and order submission
> - Admin panel: products, orders, categories, settings, SEO, email
> - Transactional emails via Resend
> - Newsletter via MailerLite
> - Supabase backend (DB + edge functions)

Add a CTA at the bottom:
> Ready to launch your own version? → [Get Started]

---

### 8. `src/app/privacy-policy/page.tsx`

Replace Body & Sleeves references with `ThreadLaunch` and `hello@yourdomain.com`.
Keep the structure — just swap the brand name throughout.

---

### 9. `src/app/refund-policy/page.tsx`

Replace Body & Sleeves references with `ThreadLaunch`.
Update the policy to reflect POD reality:
> Since all items are printed on demand specifically for each order, we do not accept returns for buyer's remorse. Defective or incorrect items will be reprinted or refunded.

---

### 10. `src/app/terms-of-service/page.tsx`

Replace Body & Sleeves references with `ThreadLaunch` and `hello@yourdomain.com`.

---

### 11. `supabase/functions/stripe-webhook/index.ts`

Email sender line:
```
from: "ThreadLaunch <orders@yourdomain.com>"
```

Order confirmation email — replace all Body & Sleeves references:
- `"BODY & SLEEVES"` → `"THREADLAUNCH"`
- `"Thanks for supporting our small business!"` → `"Your order is being printed fresh, just for you."`
- Contact email → `hello@yourdomain.com`

---

### 12. `supabase/functions/printify-webhook/index.ts`

Same email sender and header replacements as above.

---

## Database Seed Values (`settings` table)

Run this SQL after deploying to set the demo defaults:

```sql
UPDATE settings SET
  store_name      = 'ThreadLaunch',
  tagline         = 'Your Brand. Zero Inventory.',
  hero_title      = 'Launch Your Brand. Keep Your Day Job.',
  hero_subtitle   = 'Premium custom apparel, printed on demand and shipped direct to your customers. No warehouse. No minimums. No risk.',
  hero_image_url  = 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=1600',
  our_why_label   = 'Why POD Works',
  our_why_quote   = 'The best time to start your brand was yesterday. The second best time is right now.',
  our_why_body    = 'ThreadLaunch is built on Printify''s print-on-demand network — 900+ products, global print partners, and automatic fulfillment. You design it, we print it, Printify ships it. You keep the profit.',
  our_why_image_url = 'https://images.pexels.com/photos/3622608/pexels-photo-3622608.jpeg?auto=compress&cs=tinysrgb&w=800',
  story_image_url = 'https://images.pexels.com/photos/1884581/pexels-photo-1884581.jpeg?auto=compress&cs=tinysrgb&w=1600',
  announcement    = 'Free shipping on orders over $75 · Printed fresh for every order · Powered by Printify',
  testimonials    = '[
    {"quote":"I launched my brand in a weekend. First sale came in 3 days later. This platform handles everything.","name":"Jordan M.","location":"Austin, TX","product":"Custom Hoodie Drop"},
    {"quote":"No inventory, no headaches. I design, customers order, Printify ships. I just watch the dashboard.","name":"Taylor S.","location":"Brooklyn, NY","product":"Graphic Tee Collection"},
    {"quote":"The admin panel alone is worth it. I manage products, orders, and emails all in one place.","name":"Riley K.","location":"Denver, CO","product":"Hat & Accessories Line"}
  ]'::jsonb,
  social_links    = '{
    "instagram":{"url":"","enabled":false},
    "tiktok":{"url":"","enabled":false},
    "facebook":{"url":"","enabled":false},
    "youtube":{"url":"","enabled":false},
    "pinterest":{"url":"","enabled":false},
    "snapchat":{"url":"","enabled":false},
    "threads":{"url":"","enabled":false},
    "email":{"url":"mailto:hello@yourdomain.com","enabled":true}
  }'::jsonb
WHERE id = (SELECT id FROM settings LIMIT 1);
```

---

## `seo_settings` table

```sql
UPDATE seo_settings SET
  site_url           = 'https://yourdomain.com',
  meta_title_suffix  = '| ThreadLaunch',
  twitter_handle     = NULL,
  google_site_verification = NULL
WHERE id = (SELECT id FROM seo_settings LIMIT 1);
```

---

## Public Assets to Replace

| File                          | Action                                                    |
|-------------------------------|-----------------------------------------------------------|
| `/public/logo.png`            | Replace with a generic "TL" monogram or remove           |
| `/public/black-woman.jpg`     | Remove or replace with neutral apparel lifestyle photo    |
| `/public/bodyandsleeves.com_.png` | Remove                                               |
| `/public/deeandlalo1.png`     | Remove                                                    |

---

## Categories (keep as-is)

T-Shirts, Hoodies, Hats, Sweatpants, Accessories are universal POD categories.
No changes needed — they work perfectly for the demo.

---

## What NOT to Change

- All admin panel functionality (orders, products, settings, SEO, email, stripe)
- Checkout flow and Stripe integration
- Printify sync logic
- Supabase schema and edge function logic
- Any component that doesn't contain brand-specific copy

---

## Checklist After Applying Changes

- [ ] `npm run build` passes with no errors
- [ ] Hero image loads and looks like a real apparel store
- [ ] Marquee shows POD-focused affirmations
- [ ] Feature strip reflects POD value props
- [ ] Brand Values Band shows 900+ / 0 / 24hrs stats
- [ ] Testimonials show store-owner voices, not culture-specific names
- [ ] "Wear Your Story" CTA replaced with "Your Store Could Look Like This"
- [ ] Footer shows ThreadLaunch, no Body & Sleeves references
- [ ] About page explains POD model clearly
- [ ] Policies pages have no Body & Sleeves references
- [ ] Admin sidebar shows ThreadLaunch
- [ ] Email sender name updated in both edge functions
