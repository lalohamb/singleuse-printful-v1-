# Stripe Setup

The storefront uses Stripe for payment processing. Checkout sessions are created by the `stripe-checkout` Supabase Edge Function. Order state is advanced by the `stripe-webhook` edge function.

Always start in test mode and verify the full checkout flow before switching to live keys.

---

## 1. Create a Stripe Account

Go to [stripe.com](https://stripe.com) and create an account if you don't have one.

---

## 2. Get Your Test Keys

1. In the Stripe Dashboard, make sure you are in **Test mode** (toggle in the top-left).
2. Go to **Developers → API keys**.
3. Copy your **Secret key** (`sk_test_...`).

You do not need the publishable key — the storefront uses Stripe Checkout (server-side session creation), not Stripe.js.

---

## 3. Connect Stripe via the Admin Panel

The admin panel at `/admin/stripe` handles Stripe connection automatically:

1. Log in to the admin panel.
2. Go to **Stripe** in the sidebar.
3. Paste your `sk_test_...` key into the **Connect Stripe** form.
4. Click **Save & Activate**.

This performs the following steps automatically:
- Validates the key format
- Registers the webhook endpoint in your Stripe account
- Saves the key and webhook secret to `.env.local` (`.env.test` for test keys, `.env.live` for live keys)
- Pushes `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to your Supabase Edge Function secrets via the Management API
- Updates `.env.local` with the active keys
- Triggers a PM2 restart (VPS deployments only)

**Requirement:** `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` must be set in `.env.local` for the automatic Supabase secrets push to work. If they are not set, the keys are saved locally but you must push the secrets to Supabase manually.

---

## 4. Webhook Configuration

The webhook URL registered by the admin panel is:

```
https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
```

The following events are registered:

| Event | Action |
|---|---|
| `checkout.session.completed` | Updates order to `paid`, sends confirmation email, submits to Printify |
| `payment_intent.payment_failed` | Updates order to `cancelled` |

The webhook secret (`whsec_...`) is automatically saved and set as an Edge Function secret during the admin setup flow. You do not need to copy it manually.

---

## 5. Manual Webhook Setup (Alternative)

If you prefer to register the webhook manually:

1. In Stripe Dashboard → **Developers → Webhooks**, click **Add endpoint**.
2. Set the endpoint URL to `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`.
3. Select events: `checkout.session.completed` and `payment_intent.payment_failed`.
4. After creating the endpoint, reveal the **Signing secret** (`whsec_...`).
5. Add to `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_<your-key>
   STRIPE_WEBHOOK_SECRET=whsec_<your-secret>
   ```
6. Set as Edge Function secrets:
   ```bash
   npx supabase secrets set \
     STRIPE_SECRET_KEY=sk_test_<your-key> \
     STRIPE_WEBHOOK_SECRET=whsec_<your-secret> \
     --project-ref <your-project-ref>
   ```

---

## 6. Test Checkout

With test keys active, place a test order using Stripe's test card:

```
Card number: 4242 4242 4242 4242
Expiry: any future date
CVC: any 3 digits
ZIP: any 5 digits
```

Verify:
- Checkout session is created and you are redirected to Stripe
- After payment, you are redirected to `/checkout/success`
- The order appears in the admin orders panel with status `paid`
- Order confirmation email is sent (if Resend is configured)
- Printify order is submitted (check your Printify dashboard)

---

## 7. Switching to Live Mode

Only switch to live keys after verifying the full test checkout flow.

1. In the Stripe Dashboard, switch to **Live mode**.
2. Go to **Developers → API keys** and copy your live secret key (`sk_live_...`).
3. In the admin panel at `/admin/stripe`, paste the live key and click **Save & Activate**.

The admin panel shows which mode is currently active and allows switching between test and live at any time.

---

## 8. Allowed Shipping Countries

The `stripe-checkout` edge function currently allows shipping to: **US, CA, GB, AU**.

To change this, edit `supabase/functions/stripe-checkout/index.ts` and update the `allowed_countries` array, then redeploy the function.

---

## Security Notes

- `STRIPE_SECRET_KEY` must never use `NEXT_PUBLIC_*`
- `STRIPE_WEBHOOK_SECRET` must never use `NEXT_PUBLIC_*`
- The `stripe-checkout` edge function performs server-side price verification — it never trusts client-supplied prices
- The `stripe-webhook` edge function verifies the Stripe signature on every request
