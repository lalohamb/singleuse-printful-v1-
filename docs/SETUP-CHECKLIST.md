# Setup Checklist

Use this checklist to track your progress from installation to launch.

---

## System

- [ ] Node.js 18 or later installed
- [ ] ZIP extracted
- [ ] `npm install` completed without errors

---

## Supabase

- [ ] Supabase project created
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configured in `.env.local`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured in `.env.local`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured in `.env.local`
- [ ] `SUPABASE_PROJECT_REF` configured in `.env.local`
- [ ] `SUPABASE_ACCESS_TOKEN` configured in `.env.local`
- [ ] `supabase/fresh_install.sql` run in SQL Editor
- [ ] Admin user created in Supabase Auth
- [ ] Admin row inserted into `admins` table
- [ ] Admin login verified at `/admin`
- [ ] Edge functions deployed: `printify-proxy`, `printify-webhook`, `stripe-checkout`, `stripe-webhook`
- [ ] Edge function secrets set: `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Optional: `RESEND_API_KEY` set as edge function secret

---

## Printify

- [ ] Printify account active with at least one shop
- [ ] `PRINTIFY_API_TOKEN` configured in `.env.local` and as edge function secret
- [ ] `NEXT_PUBLIC_PRINTIFY_SHOP_ID` configured in `.env.local`
- [ ] `PRINTIFY_SHOP_ID` configured in `.env.local` and as edge function secret
- [ ] Product sync tested from admin panel
- [ ] Products appear in storefront

---

## Stripe

- [ ] Stripe account created
- [ ] Test keys connected via admin Stripe panel
- [ ] Webhook registered (done automatically by admin panel)
- [ ] Test checkout completed with card `4242 4242 4242 4242`
- [ ] Order appears in admin orders panel with status `paid`
- [ ] Printify order submitted (verified in Printify dashboard)
- [ ] Live keys configured only after test checkout verified

---

## Store Configuration

- [ ] Store name updated (replace "Your Store")
- [ ] Tagline updated
- [ ] Logo uploaded
- [ ] Hero image and content configured
- [ ] Social links updated
- [ ] Contact email updated
- [ ] Footer text updated
- [ ] SEO site URL set to production domain
- [ ] Meta title suffix updated
- [ ] Terms of Service added
- [ ] Privacy Policy added
- [ ] Refund Policy added
- [ ] Newsletter popup configured (or disabled)

---

## Email (Optional)

- [ ] Resend account created
- [ ] Sending domain verified in Resend
- [ ] `RESEND_API_KEY` set in `.env.local` and as edge function secret
- [ ] Order confirmation email tested
- [ ] Optional: `RESEND_WEBHOOK_SECRET` set for delivery tracking
- [ ] Optional: MailerLite account created
- [ ] Optional: `MAILER_LITE_API_KEY` set in `.env.local`
- [ ] Optional: MailerLite group created for newsletter subscribers

---

## Security

- [ ] `.env.local` is in `.gitignore` and not committed
- [ ] `.env.live` and `.env.test` are in `.gitignore` (if present)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-only (no `NEXT_PUBLIC_` prefix)
- [ ] `SUPABASE_ACCESS_TOKEN` is server-only
- [ ] `STRIPE_SECRET_KEY` is server-only
- [ ] `STRIPE_WEBHOOK_SECRET` is server-only
- [ ] `PRINTIFY_API_TOKEN` is server-only
- [ ] `LICENSE_HMAC_SECRET` generated with `openssl rand -hex 32` (unique per deployment)
- [ ] No placeholder value `demo-license-secret` in production

---

## Production

- [ ] `NEXT_PUBLIC_SITE_URL` set to production domain
- [ ] All environment variables set on deployment platform
- [ ] `npm run build` passes
- [ ] HTTPS enabled
- [ ] Domain DNS pointed at deployment
- [ ] Stripe live keys connected via admin panel
- [ ] Stripe webhook reachable at Supabase Edge Function URL
- [ ] Live checkout tested end-to-end
- [ ] Order fulfillment verified in Printify
