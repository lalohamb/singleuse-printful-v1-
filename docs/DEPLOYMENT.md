# Deployment

---

## General Requirements

Any deployment platform must satisfy:

- Node.js 18 or later runtime
- Ability to set environment variables (not committed to Git)
- HTTPS — required for Stripe webhooks and secure cookies
- Persistent external services (Supabase, Stripe) — these are not bundled with the app
- Stripe webhook reachability — your deployed URL must be publicly accessible so Stripe can deliver events to the Supabase Edge Function
- A production domain with DNS pointed at your deployment

---

## Production Build

Before deploying, verify the build passes locally:

```bash
npm run build
```

Fix any TypeScript or ESLint errors before proceeding.

---

## Environment Variables

Set all required environment variables on your deployment platform. Do not commit `.env.local` to Git.

For production, update:

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
STRIPE_SECRET_KEY=sk_live_<your-live-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-live-webhook-secret>
```

See [ENVIRONMENT-VARIABLES.md](./ENVIRONMENT-VARIABLES.md) for the full list.

---

## Platform Deployments

### Vercel

1. Push your code to a GitHub repository.
2. Import the repository in [vercel.com](https://vercel.com).
3. Set all environment variables in the Vercel project settings.
4. Deploy.

`APP_ROOT` and `PM2_APP_NAME` are not needed on Vercel. The admin Stripe mode-switch feature that writes `.env.local` and restarts PM2 is VPS-specific — on Vercel, update environment variables through the Vercel dashboard and redeploy.

### Railway

1. Connect your repository to [railway.app](https://railway.app).
2. Set environment variables in the Railway service settings.
3. Railway detects Next.js automatically and runs `npm run build` and `npm start`.

### VPS with PM2

For a VPS deployment managed with PM2:

1. Install Node.js 18+ and PM2 on your server.
2. Clone or copy your project to the server (e.g. `/var/www/your-app`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create `.env.local` with all production environment variables.
5. Set `APP_ROOT` and `PM2_APP_NAME` in `.env.local`:
   ```
   APP_ROOT=/var/www/your-app
   PM2_APP_NAME=your-app
   ```
6. Build the application:
   ```bash
   npm run build
   ```
7. Start with PM2:
   ```bash
   pm2 start npm --name your-app -- start
   pm2 save
   ```

The admin Stripe setup and mode-switch routes (`/api/stripe-setup`, `/api/stripe-switch`) write to `.env.local` and trigger a PM2 restart automatically when you switch Stripe modes through the admin panel. This requires `APP_ROOT` and `PM2_APP_NAME` to be set correctly.

---

## After Deployment

1. Point your domain's DNS to your deployment.
2. Verify HTTPS is active.
3. Update `NEXT_PUBLIC_SITE_URL` to your production domain.
4. In the admin Stripe panel, connect your live Stripe key.
5. Verify the Stripe webhook is registered and pointing to your Supabase Edge Function URL (not your Next.js app URL).
6. Place a live test order to confirm the full flow.
