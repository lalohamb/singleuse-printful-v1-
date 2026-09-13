# Stripe Integration

## Overview

Stripe handles all payment processing. The integration covers checkout session creation, webhook event handling, refunds, live/test mode switching, and balance/charge visibility from the admin panel. Two admin pages are involved:

| Page | Purpose |
|---|---|
| `/admin/settings/integrations` | First-time setup — register webhook + save keys |
| `/admin/stripe` | Ongoing operations — mode switching, charges, refunds, payouts |

---

## How It Works End-to-End

1. Customer checks out → `createStripeCheckout()` in `src/lib/supabase.ts` calls the `stripe-checkout` Supabase Edge Function
2. Edge Function creates a Stripe Checkout Session and returns a redirect URL
3. Customer completes payment on Stripe's hosted page
4. Stripe sends a `checkout.session.completed` webhook event to the registered endpoint
5. The `stripe-webhook` Edge Function verifies the signature, creates the order in the database, records affiliate conversions, and sends confirmation emails
6. Admin sees the charge in `/admin/stripe` matched to the order

---

## Key Storage

Keys are stored in two environment files on the server:

| File | Contents |
|---|---|
| `.env.live` | `STRIPE_SECRET_KEY=sk_live_...` + `STRIPE_WEBHOOK_SECRET=whsec_...` |
| `.env.test` | `STRIPE_SECRET_KEY=sk_test_...` + `STRIPE_WEBHOOK_SECRET=whsec_...` |
| `.env.local` | The currently active copy — whichever mode is live |

Switching modes copies the relevant file into `.env.local` and restarts the server process via PM2.

---

## First-Time Setup

### Step 1 — Register the Webhook

Go to **Admin → Settings → Integrations**.

1. Paste your Stripe secret key (`sk_live_...` or `sk_test_...`) into the Secret Key field
2. Click **Save Key & Register Webhook**

What happens automatically:
- Checks if a webhook already exists at the endpoint URL
- If no webhook exists: creates one in Stripe for `checkout.session.completed` and `payment_intent.payment_failed`, gets the signing secret
- Saves both the secret key and signing secret to `.env.live` or `.env.test` (determined by the key prefix)
- Shows: *"Stripe live/test keys saved. Webhook is live. Go to Admin → Stripe to activate this mode."*

If a webhook already exists at that URL:
- Skips creation — reuses the existing endpoint
- Shows: *"Webhook already registered. Keys are already saved."*
- No keys are overwritten

> **Important:** Stripe only exposes the webhook signing secret once — at the moment of creation. If you need to rotate it, delete the webhook in the Stripe Dashboard first, then re-run setup.

### Step 2 — Activate the Mode

Go to **Admin → Stripe**.

- The LIVE and TEST panels each show whether keys are saved
- Click **Switch to LIVE** or **Switch to TEST**
- The server copies the corresponding `.env` file to `.env.local` and restarts
- The page polls until the server is back up, then reloads automatically

You only need to do Step 1 once per mode (live and test separately). After that, switching between modes is just one click in Step 2.

---

## Setup Checklist

- [ ] Get your **live secret key** from [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
- [ ] Get your **test secret key** from [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
- [ ] Go to **Admin → Settings → Integrations**, paste live key, click Save — wait for success message
- [ ] Repeat with test key
- [ ] Go to **Admin → Stripe**, confirm both LIVE and TEST show "Saved"
- [ ] Click **Switch to LIVE** (or TEST for development)
- [ ] Confirm the active mode banner shows the correct mode
- [ ] Place a test order to verify the webhook fires and an order appears in the database

---

## Admin → Stripe Page

### Active Mode Banner
Shows whether the server is currently running in LIVE or TEST mode. Live mode processes real payments. Test mode uses Stripe's test card numbers — no real money moves.

### Key Manager
Expandable panels for LIVE and TEST. Shows masked key hints if keys are saved. Allows manually updating keys if needed (e.g. after rotating a key in Stripe).

### Balance Cards
Pulled live from the Stripe API on page load:
- **Available Balance** — funds ready to pay out to your bank
- **Pending Balance** — funds from recent charges not yet available
- **Volume (last 20)** — total of the 20 most recent succeeded charges
- **Refunded (last 20)** — total refunded across the 20 most recent charges

### Recent Charges
Table of the 20 most recent charges. Searchable by customer name, email, or order number. Filterable by status (succeeded, pending, failed, refunded).

Each row shows:
- Order number (matched from the database via `payment_intent` ID)
- Customer name and email
- Charge amount and any refunded amount
- Status badge
- Receipt link (opens Stripe-hosted receipt)
- Refund button (for succeeded, non-refunded charges)

### Issuing a Refund
1. Find the charge in the Recent Charges table
2. Click **Refund**
3. Choose full refund or partial refund (enter amount in dollars)
4. Click **Confirm Refund**

Refunds are processed immediately via `POST /api/stripe-admin` with `action: "refund"`. Stripe sends the money back to the customer's card. The charge row updates to show the refunded amount.

### Recent Payouts
Lists the 10 most recent payouts from Stripe to your bank account. Shows amount, arrival date, and status (`paid`, `in_transit`, `pending`).

---

## API Routes

### `/api/stripe-admin`

| Method | Action | Auth | Description |
|---|---|---|---|
| `GET ?action=balance` | — | Admin | Retrieve Stripe account balance |
| `GET ?action=charges` | — | Admin | List recent charges |
| `GET ?action=payouts` | — | Admin | List recent payouts |
| `POST` | `refund` | Admin | Issue full or partial refund |
| `POST` | `register_webhook` | Admin | Register webhook endpoint in Stripe (reuses existing if found) |

### `/api/stripe-mode`

| Method | Action | Auth | Description |
|---|---|---|---|
| `GET` | — | Admin | Returns saved key hints and active mode |
| `POST` | `save-keys` | Admin | Writes `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to `.env.live` or `.env.test` |

### `/api/stripe-switch`

| Method | Auth | Description |
|---|---|---|
| `POST` | Admin | Copies `.env.live` or `.env.test` to `.env.local`, restarts PM2 process |

---

## Webhook Endpoint

The webhook URL is the `stripe-webhook` Supabase Edge Function:

```
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
```

Registered events:
- `checkout.session.completed` — creates order, records affiliate conversion, sends confirmation email
- `payment_intent.payment_failed` — available for future handling

The webhook verifies every request using `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent()`. Requests with invalid signatures are rejected with a 400.

---

## Webhook Signing Secret — Important Rules

- Stripe only shows the signing secret **once** — at the moment the webhook endpoint is created
- It is saved automatically to `.env.live` or `.env.test` during setup
- If you run setup again with the same key and a webhook already exists at the URL, the existing endpoint is **reused** — no new secret is generated, no keys are overwritten
- To rotate the signing secret: delete the webhook in the [Stripe Dashboard](https://dashboard.stripe.com/webhooks), then re-run setup in **Admin → Settings → Integrations**

---

## Live vs Test Mode

| | Live Mode | Test Mode |
|---|---|---|
| Key prefix | `sk_live_...` | `sk_test_...` |
| Payments | Real money | No real money |
| Test cards | Not accepted | Use `4242 4242 4242 4242` |
| Webhooks | Stripe live account | Stripe test account |
| Orders created | Yes | Yes (marked in DB) |
| Switching | Admin → Stripe → Switch | Admin → Stripe → Switch |

Live and test are completely separate Stripe accounts — registering a webhook on one has no effect on the other.

---

## Environment Variables

| Variable | Where set | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `.env.local` (active copy) | Used by Next.js API routes for balance, charges, refunds |
| `STRIPE_WEBHOOK_SECRET` | Supabase Edge Function secrets | Used by `stripe-webhook` to verify incoming events |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.local` | Used client-side if needed |

> The `STRIPE_WEBHOOK_SECRET` must also be set as a Supabase secret so the Edge Function can access it:
> ```bash
> supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref <ref>
> ```
> This is separate from the `.env.local` file — the Edge Function runs on Supabase's infrastructure, not the Next.js server.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Could not connect to Stripe" on `/admin/stripe` | `STRIPE_SECRET_KEY` not in `.env.local` | Run setup in Integrations, then switch mode |
| Orders not appearing after payment | Webhook not firing or signature mismatch | Check `STRIPE_WEBHOOK_SECRET` is set in Supabase secrets |
| Webhook shows "Not Connected" in Integrations | Resend/Stripe status check failing auth | Refresh the page while logged in as admin |
| Switch to LIVE hangs | PM2 not running or `APP_ROOT` not set | Check server process manager on the droplet |
| Refund fails | Charge already fully refunded, or Stripe key mismatch | Check active mode matches the charge's mode |
