# Troubleshooting

---

## Application Won't Start

**Symptom:** `npm run dev` fails immediately or the page shows an error.

**Check:**
- All required environment variables are set in `.env.local`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- No syntax errors in `.env.local` (no quotes around values, no trailing spaces)

---

## Supabase Connection Failure

**Symptom:** Pages fail to load data, console shows Supabase errors.

**Check:**
- `NEXT_PUBLIC_SUPABASE_URL` matches your project URL exactly (no trailing slash)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the `anon public` key, not the service role key
- Your Supabase project is active (free tier projects pause after inactivity — resume from the dashboard)
- The database schema has been applied (`fresh_install.sql` was run)

---

## Admin Panel Won't Load / Login Fails

**Symptom:** `/admin` shows a login error or redirects unexpectedly.

**Check:**
- You created a Supabase Auth user for your email
- You inserted a row into the `admins` table with the correct `id` (matching the auth user UUID) and `role = 'super_admin'`
- `SUPABASE_SERVICE_ROLE_KEY` is set correctly in `.env.local`

---

## Migration Not Applied

**Symptom:** Database queries fail with "relation does not exist" errors.

**Fix:** Run `supabase/fresh_install.sql` in the Supabase SQL Editor, or apply the specific missing migration file.

To check which migrations have been applied:
```bash
npx supabase migration list --project-ref <your-project-ref>
```

---

## Printify Products Not Syncing

**Symptom:** Clicking "Sync from Printify" in the admin panel shows an error or syncs 0 products.

**Check:**
- `PRINTIFY_API_TOKEN` is set as a Supabase Edge Function secret (not just in `.env.local`)
- `PRINTIFY_SHOP_ID` is set as a Supabase Edge Function secret
- The `printify-proxy` edge function is deployed
- Your Printify API token has not expired or been revoked
- Your Printify shop has published products

Verify secrets are set:
```bash
npx supabase secrets list --project-ref <your-project-ref>
```

---

## Printify API Authorization Failure

**Symptom:** Edge function logs show `401 Unauthorized` from Printify.

**Fix:** Regenerate your Printify API token and update the `PRINTIFY_API_TOKEN` secret:
```bash
npx supabase secrets set PRINTIFY_API_TOKEN=<new-token> --project-ref <your-project-ref>
```
Then redeploy the affected functions.

---

## Wrong Printify Shop ID

**Symptom:** Sync succeeds but shows products from the wrong shop, or returns 0 products.

**Fix:** Verify your shop ID in the Printify dashboard URL. Update both `NEXT_PUBLIC_PRINTIFY_SHOP_ID` in `.env.local` and the `PRINTIFY_SHOP_ID` edge function secret.

---

## Stripe Checkout Not Working

**Symptom:** Clicking checkout shows an error or the Stripe session is not created.

**Check:**
- `STRIPE_SECRET_KEY` is set as a Supabase Edge Function secret
- The `stripe-checkout` edge function is deployed
- The key format is correct (`sk_test_...` or `sk_live_...`)
- You are not mixing test and live keys (test key with live products or vice versa)

---

## Stripe Webhook Not Updating Orders

**Symptom:** Payment succeeds on Stripe but the order status stays `pending` in the admin panel.

**Check:**
- `STRIPE_WEBHOOK_SECRET` is set as a Supabase Edge Function secret
- The `stripe-webhook` edge function is deployed
- The webhook endpoint in Stripe Dashboard points to `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
- The webhook is enabled for `checkout.session.completed` events
- Check edge function logs: `npx supabase functions logs stripe-webhook --project-ref <your-project-ref>`

---

## Order Confirmation Email Not Sent

**Symptom:** Order is paid but customer receives no confirmation email.

**Check:**
- `RESEND_API_KEY` is set as a Supabase Edge Function secret
- Your sending domain is verified in Resend
- The `from` address in the edge function matches your verified domain
- Check `stripe-webhook` function logs for Resend errors

---

## MailerLite Not Connecting

**Symptom:** Admin MailerLite panel shows "Could not connect to MailerLite".

**Check:**
- `MAILER_LITE_API_KEY` is set in `.env.local`
- The API key is valid and has not been revoked
- Your MailerLite account is active

---

## Build Failure

**Symptom:** `npm run build` fails with TypeScript or ESLint errors.

**Fix:** Read the error output carefully. Common causes:
- Missing type imports
- Unused variables (ESLint `no-unused-vars`)
- Type mismatches in component props

Run `npm run lint` to see ESLint errors separately from TypeScript errors.

---

## Admin Stripe Mode Switch Not Working

**Symptom:** Clicking "Save & Activate" in the admin Stripe panel shows an error about Supabase secrets.

**Check:**
- `SUPABASE_ACCESS_TOKEN` is set in `.env.local`
- `SUPABASE_PROJECT_REF` is set in `.env.local`
- The access token has not expired or been revoked

If `SUPABASE_ACCESS_TOKEN` is not set, the keys are saved locally but not pushed to Supabase Edge Function secrets. You must push them manually:
```bash
npx supabase secrets set STRIPE_SECRET_KEY=<key> STRIPE_WEBHOOK_SECRET=<secret> --project-ref <your-project-ref>
```

---

## PM2 Restart Not Triggering After Mode Switch (VPS)

**Symptom:** Stripe mode switch completes but the app still uses the old key.

**Check:**
- `APP_ROOT` is set to the correct absolute path of your application directory
- `PM2_APP_NAME` matches the name of your PM2 process (`pm2 list` to verify)
- PM2 is installed at `/usr/bin/pm2`

Manually restart if needed:
```bash
pm2 restart <your-app-name> --update-env
```
