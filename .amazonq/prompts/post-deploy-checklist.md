# Post-Deploy Verification — Stripe & Edge Functions

After every deployment to the DigitalOcean droplet, verify the following:

## 1. Confirm deploy.sh completed the secret sync

Look for this line in the deploy output:

```
✅ Stripe secrets synced (mode: live)
```

If you see a warning instead, manually sync:

```bash
cd /var/www/countybuys && bash scripts/deploy.sh --skip-build
```

## 2. Verify the correct Stripe key is active in the edge function

```bash
curl -s https://api.supabase.com/v1/projects/{ref}/secrets \
  -H "Authorization: Bearer {SUPABASE_ACCESS_TOKEN}" \
  > /tmp/secrets.json && node -p \
  "JSON.parse(require('fs').readFileSync('/tmp/secrets.json','utf8')).map(x=>x.name).join('\n')"
```

Confirm `STRIPE_SECRET_KEY` appears in the list.

## 3. Check edge function logs for errors immediately after deploy

Supabase Dashboard → project → Edge Functions → stripe-checkout → Logs

Look for any `level: error` entries. A clean deploy shows only `booted` entries.

## 4. Test a live checkout end-to-end

- Add a product to cart on the live site
- Proceed to checkout
- Confirm Stripe hosted checkout loads without a 500 error
- Cancel out and confirm `/checkout/cancel` loads correctly (no 404)

## 5. Verify the admin panel Stripe mode is correct

Go to `/admin` → Stripe

Confirm the mode badge shows `● LIVE` (or `● TEST` if intentional).

If it shows the wrong mode, use the **Use live** / **Use test** button to switch —
this will push secrets and redeploy the edge function automatically.

## 6. If checkout is still 500 after all of the above

Force-redeploy the edge function directly:

```bash
export SUPABASE_ACCESS_TOKEN={your_token}
supabase functions deploy stripe-checkout --project-ref {your_ref}
```

Then re-test checkout immediately.

## 7. Confirm `.env.local` on the server has no Stripe keys

```bash
grep 'STRIPE\|DB_PASSWORD' /var/www/countybuys/.env.local
```

This should return nothing. If it returns any values, remove them:

```bash
sed -i '/^STRIPE_SECRET_KEY=/d' /var/www/countybuys/.env.local
sed -i '/^STRIPE_WEBHOOK_SECRET=/d' /var/www/countybuys/.env.local
sed -i '/^DB_PASSWORD=/d' /var/www/countybuys/.env.local
```

Then redeploy with `--skip-build`.
