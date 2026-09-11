# Demo Version — Out-of-the-Box Setup Guide

This document lists every attribute, value, and configuration that must be changed
to convert this codebase from the **Body & Sleeves** brand into a clean, generic,
white-label demo for a Printify print-on-demand storefront.

---

## 1. Environment Variables (`.env.local`)

| Variable | Current Value | Demo Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Body & Sleeves Supabase project | New Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Body & Sleeves anon key | New project anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Body & Sleeves service role key | New project service role key |
| `STRIPE_SECRET_KEY` | Live/test key for Body & Sleeves | New Stripe account key |
| `STRIPE_WEBHOOK_SECRET` | Body & Sleeves webhook secret | New webhook secret |
| `PRINTIFY_API_TOKEN` | Body & Sleeves Printify token | New Printify account token |
| `PRINTIFY_SHOP_ID` | `28824139` | New shop ID |
| `RESEND_API_KEY` | Body & Sleeves Resend key | New Resend account key |
| `MAILER_LITE_API_KEY` | Body & Sleeves MailerLite key | New MailerLite key |

---

## 2. Database — `settings` Table (single row)

These are set via **Admin → Settings** after install, or seeded via SQL.

| Field | Current Value | Demo Value |
|---|---|---|
| `store_name` | `Body & Sleeves` | `My Store` or `Your Brand` |
| `tagline` | `Black-Owned. Made to Order.` | `Made to Order. Made for You.` |
| `hero_title` | `Empower Yourself. Empower the Culture.` | `Your Brand. Your Story.` |
| `hero_subtitle` | `Apparel celebrating Black culture...` | `Premium print-on-demand apparel, shipped to your door.` |
| `hero_image_url` | Pexels photo URL | Generic apparel/lifestyle image |
| `story_image_url` | Body & Sleeves specific image | Generic image or `null` |
| `our_why_label` | `Our Why` | `Our Story` |
| `our_why_quote` | `We don't just sell clothes. We tell stories.` | `Quality you can feel. Style you can own.` |
| `our_why_body` | Body & Sleeves brand story | Generic brand story placeholder |
| `our_why_image_url` | Body & Sleeves specific image | Generic image or `null` |
| `announcement` | `Made to order. Made with love. — Free shipping on orders over $75` | `Free shipping on orders over $75` |
| `logo_url` | Body & Sleeves logo | `null` (uses text fallback) |
| `printify_shop_id` | `28824139` | New shop ID |
| `social_links` | All Body & Sleeves social URLs | All set to `""` with `enabled: false` |
| `testimonials` | Jasmine T., Marcus W., Aaliyah R. | Generic placeholder testimonials or empty array |

---

## 3. Database — `seo_settings` Table

| Field | Current Value | Demo Value |
|---|---|---|
| `site_url` | `https://bodyandsleeves.com` | `https://yourdomain.com` |
| `meta_title_suffix` | `\| Body & Sleeves` | `\| My Store` |
| `twitter_handle` | `@body_and_sleeves` | `null` or new handle |
| `google_site_verification` | Body & Sleeves verification code | `null` |
| `default_og_image` | Body & Sleeves OG image | Generic OG image or `null` |

---

## 4. Database — `categories` Table

| Current Categories | Demo Action |
|---|---|
| T-Shirts, Hoodies, Hats, Sweatpants, Accessories | Keep as generic defaults — these are universal POD categories |

> These are fine as-is for a demo. New stores can rename or add via Admin → Categories.

---

## 5. Source Code — Hardcoded Brand References

### `src/app/layout.tsx`
- `title.default` → `"Body & Sleeves"` → `"My Store"`
- `description` → Body & Sleeves brand description → generic POD description

### `src/app/page.tsx`
- `metadata.title` → `"Body & Sleeves — Black-Owned Apparel"` → `"My Store"`
- `metadata.description` → Body & Sleeves description → generic

### `src/app/HomeClient.tsx`
- `AFFIRMATIONS` array → 5 Body & Sleeves specific phrases → generic brand phrases
- Feature strip icons/text: `"Black-Owned"`, `"Culture First"` → `"Quality First"`, `"Your Brand"`
- Brand Values Band stats: `"100% Black-Owned"`, `"0 Waste"` → generic POD values
- `"What the Culture is Saying"` section heading → `"What Customers Are Saying"`
- `"Wear Your Story"` CTA section → `"Wear Your Brand"`
- Fallback hero image URL (Pexels) → generic apparel image

### `src/components/Header.tsx`
- Fallback logo `/logo.png` → generic logo or text fallback
- `"Body & Sleeves"` alt text → `"My Store"`

### `src/components/Footer.tsx`
- `"Body & Sleeves"` brand name in footer → `"My Store"`
- `"A Black-owned, made-to-order apparel brand..."` description → generic
- `"Made to order. Made with love."` tagline → generic
- `DEFAULT_SOCIAL` all URLs → empty strings, `enabled: false`
- `mailto:Hello.BodyandSleeves@gmail.com` → `mailto:hello@yourdomain.com`
- Footer nav links (T-Shirts, Hoodies, Hats) → keep or update to match categories
- Copyright `"Body & Sleeves"` → `"My Store"`

### `src/components/AdminLayout.tsx`
- `"Body & Sleeves"` sidebar brand name → `"My Store"`

### `supabase/functions/stripe-webhook/index.ts`
- `from: "Body & Sleeves <orders@bodyandsleeves.com>"` → `"My Store <orders@yourdomain.com>"`
- Order confirmation email HTML — all Body & Sleeves references
- `"Thanks for supporting our small business!"` → generic

### `supabase/functions/printify-webhook/index.ts`
- `from: "Body & Sleeves <orders@bodyandsleeves.com>"` → `"My Store <orders@yourdomain.com>"`
- `"BODY & SLEEVES"` email header → `"MY STORE"`
- `Hello.BodyandSleeves@gmail.com` contact email → `hello@yourdomain.com`

---

## 6. Public Assets (`/public`)

| File | Current | Demo Action |
|---|---|---|
| `/public/logo.png` | Body & Sleeves logo | Replace with generic logo or placeholder |
| `/public/black-woman.jpg` | Brand-specific photo | Replace or remove |
| `/public/bodyandsleeves.com_.png` | Brand screenshot | Remove |
| `/public/deeandlalo1.png` | Personal photo | Remove |

---

## 7. Policies Pages (`src/app/`)

| Page | Current | Demo Action |
|---|---|---|
| `privacy-policy/page.tsx` | Body & Sleeves specific | Replace with generic template |
| `refund-policy/page.tsx` | Body & Sleeves specific | Replace with generic template |
| `terms-of-service/page.tsx` | Body & Sleeves specific | Replace with generic template |
| `about/page.tsx` | Body & Sleeves brand story | Replace with generic placeholder |

---

## 8. Email Sending Domain (Resend)

| Current | Demo Action |
|---|---|
| `orders@bodyandsleeves.com` | Change to `orders@yourdomain.com` |
| Domain verified in Resend for `bodyandsleeves.com` | Verify new domain in Resend dashboard |

---

## 9. Supabase Edge Function Secrets

Set these in **Supabase → Edge Functions → Secrets**:

| Secret | Demo Action |
|---|---|
| `PRINTIFY_API_TOKEN` | New Printify account token |
| `PRINTIFY_SHOP_ID` | New shop ID |
| `STRIPE_SECRET_KEY` | New Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | New webhook secret |
| `RESEND_API_KEY` | New Resend key |
| `MAILER_LITE_API_KEY` | New MailerLite key |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase |

---

## 10. Admin Setup Checklist (Post-Install)

After deploying with new env vars and running `fresh_install.sql`:

- [ ] Go to **Admin → Settings** — update store name, tagline, hero image, logo
- [ ] Go to **Admin → Settings** — update social links
- [ ] Go to **Admin → SEO** — update site URL, meta suffix, OG image
- [ ] Go to **Admin → Stripe** — save live and test keys, set active mode
- [ ] Go to **Admin → Products** — click Sync Printify to pull products
- [ ] Go to **Admin → Categories** — rename/add categories to match products
- [ ] Go to **Admin → Policies** — update privacy, refund, and terms content
- [ ] Add Resend webhook URL in Resend dashboard for delivery tracking
- [ ] Register Printify webhook URL in Printify dashboard for order status updates

---

## 11. `ecosystem.config.js` (PM2 — Production Only)

All env vars in this file are Body & Sleeves specific. Regenerated automatically
by `scripts/deploy.sh` from `.env.local` — no manual edit needed if deploy script is used.

---

## Quick Summary

| Category | Files / Tables | Count |
|---|---|---|
| Env vars | `.env.local`, `ecosystem.config.js` | 9 vars |
| DB settings | `settings`, `seo_settings` tables | ~20 fields |
| Source code | 7 files | ~30 string references |
| Public assets | `/public` folder | 4 files |
| Edge functions | 2 Supabase functions | ~8 email strings |
| Policies | 4 pages | Full rewrites |
