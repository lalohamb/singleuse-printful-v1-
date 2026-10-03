# Stripe Edge Function Key Sync — Setup & Hardening

## Architecture

Stripe keys are managed exclusively through the admin panel (`/admin` → Stripe → Connect).
They are stored in the `settings` table in Supabase and pushed to edge function secrets
via `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` from `.env.local`.

Edge functions (`stripe-checkout`, `stripe-webhook`) read `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` from `Deno.env` — NOT from the DB at runtime.

## Rules

### Server `.env.local` must NOT contain:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DB_PASSWORD`

Remove if present:
```bash
sed -i '/^STRIPE_SECRET_KEY=/d' /var/www/countybuys/.env.local
sed -i '/^STRIPE_WEBHOOK_SECRET=/d' /var/www/countybuys/.env.local
sed -i '/^DB_PASSWORD=/d' /var/www/countybuys/.env.local
```

### After any key change, force-redeploy the edge function:
```bash
export SUPABASE_ACCESS_TOKEN=your_token
supabase functions deploy stripe-checkout --project-ref your_project_ref
```

### Verify the edge function is using the live key:
Send a probe request — a `cs_live_` session ID confirms live key is active:
```bash
curl -s -X POST "https://<project>.supabase.co/functions/v1/stripe-checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon_key>" \
  -d '{"items":[{"product_id":"<uuid>","variant_id":"<uuid>","quantity":1}],"shipping_address":{"name":"Test","line1":"123 Main","city":"Austin","state":"TX","postal_code":"78701","country":"US"},"shipping_rate_id":"shr_test_fake","origin":"https://www.countybuys.com"}'
```

## What `scripts/deploy.sh` does after edge function deploy

1. Reads `stripe_mode` from the `settings` table via Supabase REST API
2. Picks the active mode's `stripe_live_secret_key` or `stripe_test_secret_key`
3. Pushes it to edge function secrets via `POST https://api.supabase.com/v1/projects/{ref}/secrets`

This ensures every deploy automatically syncs the correct key.

## What `stripe-switch/route.ts` does

1. Pushes new secrets to Supabase edge function secrets
2. Force-redeploys `stripe-checkout` via `POST https://api.supabase.com/v1/projects/{ref}/functions/stripe-checkout/deploy`
3. Sets `stripe_mode` in the DB

The forced redeploy makes the key switch take effect immediately instead of waiting
for the next natural cold boot.

## Silent failure pattern to watch for

If `SUPABASE_ACCESS_TOKEN` in `.env.local` is expired or from the wrong account:
- `stripe-switch` will fail silently (or return 500)
- The edge function continues running with whatever key it had at last cold boot
- Symptom: admin panel shows "live" mode but checkout returns test session IDs (`cs_test_`)

Fix: regenerate the token at https://supabase.com/dashboard/account/tokens and update `.env.local`.

## SUPABASE_SERVICE_ROLE_KEY verification

Decode the JWT at https://jwt.io and confirm the `ref` field matches `NEXT_PUBLIC_SUPABASE_URL`.
A mismatch means all admin panel DB operations silently fail.

## Webhook endpoint

- URL: `https://<project>.supabase.co/functions/v1/stripe-webhook`
- Required events: `checkout.session.completed`, `payment_intent.payment_failed`
- Signature verification must remain enabled — never disable for troubleshooting
