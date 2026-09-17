# Printify POD Storefront
## Getting Started

This is a self-hosted, source-code storefront for selling print-on-demand products through Printify. You own the code and deploy it on your own infrastructure. No recurring platform fees.

---

## Prerequisites

| Requirement | Version / Notes |
|---|---|
| Node.js | 18 or later (20+ recommended) |
| npm | Included with Node.js |
| Supabase account | Free tier is sufficient to start — [supabase.com](https://supabase.com) |
| Printify account | [printify.com](https://printify.com) — you need an active shop |
| Stripe account | [stripe.com](https://stripe.com) — start in test mode |
| Resend account | Optional — required for order confirmation and shipping emails |
| MailerLite account | Optional — required for newsletter integration |

---

## Setup Sequence

1. [Extract the package and install dependencies](#1-extract-and-install)
2. [Create a Supabase project and run the database schema](#2-supabase-setup)
3. [Deploy the four Supabase Edge Functions](#3-deploy-edge-functions)
4. [Configure your environment variables](#4-configure-environment)
5. [Connect Printify](#5-connect-printify)
6. [Connect Stripe](#6-connect-stripe)
7. [Configure optional email services](#7-configure-email)
8. [Start the development server](#8-start-development-server)
9. [Configure your store through the admin panel](#9-admin-configuration)
10. [Test checkout end-to-end](#10-test-checkout)
11. [Create a production build](#11-production-build)
12. [Deploy](#12-deploy)

---

## 1. Extract and Install

```bash
unzip printify-pod-storefront-1.0.0.zip
cd printify-pod-storefront-1.0.0
npm install
```

---

## 2. Supabase Setup

See [SUPABASE-SETUP.md](./SUPABASE-SETUP.md) for the full walkthrough.

Summary:
- Create a new Supabase project
- Run `supabase/fresh_install.sql` in the SQL Editor
- Obtain your project URL, anon key, and service role key

---

## 3. Deploy Edge Functions

The storefront uses four Supabase Edge Functions for Stripe and Printify integration. These must be deployed before checkout or product sync will work.

See [SUPABASE-SETUP.md](./SUPABASE-SETUP.md#edge-functions) for deployment commands and required secrets.

---

## 4. Configure Environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

See [ENVIRONMENT-VARIABLES.md](./ENVIRONMENT-VARIABLES.md) for documentation of every variable.

---

## 5. Connect Printify

See [PRINTIFY-SETUP.md](./PRINTIFY-SETUP.md).

Summary:
- Obtain your Printify API token and shop ID
- Add them to `.env.local`
- Set them as Supabase Edge Function secrets
- Use the admin panel to sync products

---

## 6. Connect Stripe

See [STRIPE-SETUP.md](./STRIPE-SETUP.md).

Summary:
- Start with Stripe test keys
- Use the admin panel (`/admin/stripe`) to connect and register the webhook automatically
- Verify test checkout before switching to live keys

---

## 7. Configure Email

See [EMAIL-SETUP.md](./EMAIL-SETUP.md).

Both Resend and MailerLite are optional. The storefront functions without them, but order confirmation and shipping notification emails require Resend.

---

## 8. Start Development Server

```bash
npm run dev
```

The application runs at [http://localhost:3000](http://localhost:3000).

The admin panel is at [http://localhost:3000/admin](http://localhost:3000/admin).

See [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md) for minimum required environment variables.

---

## 9. Admin Configuration

Log in to the admin panel and complete initial store configuration:

- Store name, tagline, logo
- Hero image and homepage content
- Social links
- SEO settings
- Sync products from Printify

See [ADMIN-GUIDE.md](./ADMIN-GUIDE.md) for the full walkthrough.

---

## 10. Test Checkout

With Stripe in test mode, place a test order using Stripe's test card `4242 4242 4242 4242`. Verify:

- Order appears in the admin orders panel
- Order confirmation email is sent (if Resend is configured)
- Printify order is submitted (check Printify dashboard)

---

## 11. Production Build

```bash
npm run build
```

The build must pass before deploying.

---

## 12. Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for platform-neutral deployment requirements and VPS/PM2 instructions.

---

## Further Reading

- [ENVIRONMENT-VARIABLES.md](./ENVIRONMENT-VARIABLES.md)
- [SUPABASE-SETUP.md](./SUPABASE-SETUP.md)
- [PRINTIFY-SETUP.md](./PRINTIFY-SETUP.md)
- [STRIPE-SETUP.md](./STRIPE-SETUP.md)
- [EMAIL-SETUP.md](./EMAIL-SETUP.md)
- [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ADMIN-GUIDE.md](./ADMIN-GUIDE.md)
- [SECURITY.md](./SECURITY.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [SETUP-CHECKLIST.md](./SETUP-CHECKLIST.md)
