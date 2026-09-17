# Local Development

---

## Prerequisites

- Node.js 18 or later
- npm (included with Node.js)
- A configured `.env.local` file (see [ENVIRONMENT-VARIABLES.md](./ENVIRONMENT-VARIABLES.md))

---

## Install Dependencies

```bash
npm install
```

---

## Minimum Environment for Local Start

The following variables must be set in `.env.local` before the development server will start without errors:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
NEXT_PUBLIC_PRINTIFY_SHOP_ID=<your-printify-shop-id>
PRINTIFY_SHOP_ID=<your-printify-shop-id>
STRIPE_SECRET_KEY=sk_test_<your-stripe-test-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret>
LICENSE_HMAC_SECRET=<run: openssl rand -hex 32>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional variables (`RESEND_API_KEY`, `MAILER_LITE_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) can be omitted locally — the features that depend on them will not function, but the application will start.

---

## Start Development Server

```bash
npm run dev
```

The application runs at [http://localhost:3000](http://localhost:3000).

The admin panel is at [http://localhost:3000/admin](http://localhost:3000/admin).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create an optimized production build |
| `npm start` | Start the production server (requires a prior build) |
| `npm run lint` | Run ESLint |

---

## Notes

- The development server uses Next.js 15 with the App Router.
- Stripe webhook events cannot be received at `localhost` without a tunnel (e.g. Stripe CLI or ngrok). For local webhook testing, use the Stripe CLI:
  ```bash
  stripe listen --forward-to localhost:3000/api/stripe-admin
  ```
  Note: the storefront's Stripe webhook is handled by the Supabase Edge Function (`stripe-webhook`), not a local Next.js route. Local webhook testing requires forwarding to the deployed edge function URL or using the Stripe CLI to forward to a local tunnel.
- Supabase Edge Functions run on Supabase's infrastructure and are not run locally by default. The storefront calls them via their deployed URLs.
