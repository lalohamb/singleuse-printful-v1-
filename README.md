# Printify POD Storefront

A self-hosted Next.js storefront for selling print-on-demand products through Printify. You own the code and deploy it on your own infrastructure.

## Customer Quickstart

1. Read [docs/GETTING-STARTED.md](./docs/GETTING-STARTED.md)
2. Copy `.env.example` to `.env.local` and fill in your values — see [docs/ENVIRONMENT-VARIABLES.md](./docs/ENVIRONMENT-VARIABLES.md)
3. Set up Supabase and run the database schema — see [docs/SUPABASE-SETUP.md](./docs/SUPABASE-SETUP.md)
4. Connect Printify — see [docs/PRINTIFY-SETUP.md](./docs/PRINTIFY-SETUP.md)
5. Connect Stripe — see [docs/STRIPE-SETUP.md](./docs/STRIPE-SETUP.md)
6. Configure optional email — see [docs/EMAIL-SETUP.md](./docs/EMAIL-SETUP.md)
7. Run locally — see [docs/LOCAL-DEVELOPMENT.md](./docs/LOCAL-DEVELOPMENT.md)
8. Configure your store through the admin panel at `/admin` — see [docs/ADMIN-GUIDE.md](./docs/ADMIN-GUIDE.md)
9. Test checkout end-to-end in Stripe test mode
10. Run `npm run build` and verify it passes
11. Deploy — see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

Use [docs/SETUP-CHECKLIST.md](./docs/SETUP-CHECKLIST.md) to track your progress.

---

## Documentation

| Document | Description |
|---|---|
| [GETTING-STARTED.md](./docs/GETTING-STARTED.md) | Full setup sequence |
| [ENVIRONMENT-VARIABLES.md](./docs/ENVIRONMENT-VARIABLES.md) | Every environment variable documented |
| [SUPABASE-SETUP.md](./docs/SUPABASE-SETUP.md) | Database, edge functions, auth |
| [PRINTIFY-SETUP.md](./docs/PRINTIFY-SETUP.md) | Printify connection and product sync |
| [STRIPE-SETUP.md](./docs/STRIPE-SETUP.md) | Stripe connection and webhook setup |
| [EMAIL-SETUP.md](./docs/EMAIL-SETUP.md) | Resend and MailerLite configuration |
| [RESEND-SETUP.md](./docs/RESEND-SETUP.md) | Resend full setup, API key, webhooks, troubleshooting |
| [LOCAL-DEVELOPMENT.md](./docs/LOCAL-DEVELOPMENT.md) | Running locally |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Deploying to production |
| [ADMIN-GUIDE.md](./docs/ADMIN-GUIDE.md) | Admin panel walkthrough |
| [SECURITY.md](./docs/SECURITY.md) | Security best practices |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Common issues and fixes |
| [SETUP-CHECKLIST.md](./docs/SETUP-CHECKLIST.md) | Launch checklist |

---

## Tech Stack

- Next.js 15 (App Router)
- React 19
- Supabase (PostgreSQL, Auth, Edge Functions)
- Stripe (Checkout, Webhooks)
- Printify (Print-on-demand fulfillment)
- Tailwind CSS
- TypeScript
