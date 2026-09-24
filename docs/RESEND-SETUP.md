# Resend Setup

## What is Resend?

Resend is a transactional email API built for developers. It handles sending, delivery, and tracking of emails triggered by events in your store — order confirmations, shipping notifications, and admin-initiated emails. Unlike newsletter platforms (MailerLite), Resend is for one-to-one transactional emails tied to specific customer actions.

Resend is used by both the Next.js API routes and the Supabase Edge Functions. The API key must be configured in both places.

---

## What Resend Is Used For

| Trigger | Email | Sent From |
|---|---|---|
| Customer completes Stripe checkout | Order confirmation with item list and total | `stripe-webhook` Edge Function |
| Printify marks order as shipped | Shipping notification with tracking link | `printify-webhook` Edge Function |
| Affiliate makes a sale | Commission notification to affiliate | `stripe-webhook` Edge Function |
| Admin → Email → Send Email tab | Manual one-off email to any address | Next.js API route |
| Admin → Email → Broadcast tab | Bulk email to all customers with paid live orders | Next.js API route |

---

## Pricing

- **Free tier**: 3,000 emails/month, 100/day
- **Pro**: $20/month for 50,000 emails/month
- No per-email fees on paid plans — flat monthly rate

For most small stores the free tier is sufficient indefinitely.

---

## Step 1 — Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your email address

---

## Step 2 — Verify Your Sending Domain

Resend requires a verified domain to send emails in production. Emails from unverified domains will be rejected or land in spam.

1. In Resend, go to **Domains → Add Domain**
2. Enter your domain (e.g. `bodyandsleeves.com`)
3. Resend will give you DNS records to add — typically:
   - An MX record
   - Two TXT records (SPF + DKIM)
   - A CNAME record (DMARC)
4. Add these records at your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
5. Click **Verify** in Resend — verification usually takes a few minutes

Once verified, you can send from any address at that domain (e.g. `orders@bodyandsleeves.com`).

---

## Step 3 — Create an API Key

1. In Resend, go to **API Keys → Create API Key**
2. Give it a name (e.g. `bodyandsleeves-production`)
3. Set permission to **Full Access** — the key needs to send emails AND be validated from the admin panel
4. Copy the key — it starts with `re_` and is only shown once

> ⚠️ Do not use a "Sending Access" restricted key. The admin panel validation check calls the `/domains` endpoint which requires full access. A restricted key will always show as invalid even if it can send.

---

## Step 4 — Configure the API Key

The API key must be set in two places: the database (used by Next.js API routes) and Supabase secrets (used by Edge Functions).

### Option A — Admin Panel (Recommended)

1. Go to **Admin → Email → API Key tab**
2. Enter your `re_` key
3. Click **Validate** — should show "Key is valid ✓"
4. Click **Save Key** — saves to the database
5. Then push to Supabase secrets from the server:
   ```bash
   npx supabase secrets set RESEND_API_KEY=re_your_key --project-ref your-project-ref
   npx supabase functions deploy stripe-webhook --project-ref your-project-ref
   npx supabase functions deploy printify-webhook --project-ref your-project-ref
   ```

### Option B — Environment Variables

Add to `.env.local`:
```
RESEND_API_KEY=re_your_key
```

Then push to Supabase secrets:
```bash
npx supabase secrets set RESEND_API_KEY=re_your_key --project-ref your-project-ref
```

> **Priority**: The database key takes priority over the environment variable. If a key is saved in Admin → Email, it overrides `.env.local` for all Next.js API routes. Edge Functions always read from Supabase secrets.

---

## Step 5 — Set the From Address

The `from` address must use your verified domain.

1. Go to **Admin → Email → API Key tab**
2. Set **From Address** to e.g. `orders@bodyandsleeves.com`
3. Set **Support Address** to e.g. `hello@bodyandsleeves.com` (shown in email footers)
4. Click **Save Key**

These are stored in the `settings` table and used by both the Edge Functions and the admin email panel.

---

## Step 6 — Configure Delivery Event Tracking (Optional but Recommended)

Delivery events let you see whether emails are delivered, opened, bounced, or marked as spam — visible in **Admin → Email → Delivery Events**.

### Create the Webhook in Resend

1. In Resend, go to **Webhooks → Add Webhook**
2. Set the endpoint URL to:
   ```
   https://bodyandsleeves.com/api/resend/webhook
   ```
3. Select the events to track:
   - `email.sent`
   - `email.delivered`
   - `email.opened`
   - `email.clicked`
   - `email.bounced`
   - `email.complained`
4. Click **Create**
5. Copy the **Signing Secret** (starts with `whsec_`)

### Add the Webhook Secret

Add to `.env.local`:
```
RESEND_WEBHOOK_SECRET=whsec_your_signing_secret
```

This enables HMAC-SHA256 signature verification on incoming webhook events. Without it, the webhook still receives events but skips signature verification (less secure).

---

## How the Key Is Read

### Next.js API Routes (`/api/resend`, `/api/affiliates`)

```
1. Read resend_api_key from settings table in Supabase DB
2. If not set, fall back to RESEND_API_KEY environment variable
3. If neither is set, return error
```

### Supabase Edge Functions (`stripe-webhook`, `printify-webhook`)

```
1. Read RESEND_API_KEY from Deno.env (Supabase secrets)
2. If not set, email sending is skipped silently
```

This means updating the key in Admin → Email only affects Next.js routes immediately. Edge Functions require a `supabase secrets set` + redeploy to pick up the new key.

---

## Email Templates

### Order Confirmation

Sent automatically on `checkout.session.completed`. Contains:
- Customer first name
- Order reference number (last 8 chars of Stripe session ID, uppercased)
- Item list with product images, variant labels, quantities, and line totals
- Order total
- Support email address with pre-filled subject line

### Shipping Notification

Sent automatically on `order:shipment:created` from Printify. Contains:
- Customer first name
- Order reference number
- Tracking number (if available)
- "Track Your Order" button linking to carrier tracking URL
- Item list
- Support contact

### Affiliate Commission Notification

Sent automatically when a referred order is paid. Contains:
- Order value
- Commission amount (10% of subtotal)
- Commission status (Pending — 14-day review)
- Link to affiliate dashboard

---

## Delivery Events

Events are received via webhook and stored in the `email_events` table in Supabase. Visible in **Admin → Email → Delivery Events**.

| Event | Meaning | Action |
|---|---|---|
| `sent` | Resend accepted and queued the email | None needed |
| `delivered` | Recipient's mail server confirmed delivery | None needed |
| `opened` | Recipient opened the email | None needed |
| `clicked` | Recipient clicked a link | None needed |
| `bounced` | Email couldn't be delivered | Check the email address — may be invalid |
| `complained` | Recipient marked as spam | Remove from future sends — repeated complaints hurt sender reputation |

The Delivery Events tab shows stat cards for each event type. Click a card to filter the list to that event type.

---

## Troubleshooting

### "Key is valid" on an obviously wrong key
The validate button was testing the stored DB key instead of the typed key. This was fixed — the validate button now tests exactly what you type. If you see this on an old version, deploy the latest Next.js build.

### Emails not sending after updating the key in admin
The admin panel saves to the DB (used by Next.js routes) but Edge Functions read from Supabase secrets. After saving a new key in the admin panel, also run:
```bash
npx supabase secrets set RESEND_API_KEY=re_your_key --project-ref your-project-ref
npx supabase functions deploy stripe-webhook --project-ref your-project-ref
npx supabase functions deploy printify-webhook --project-ref your-project-ref
```

### Order confirmation email not received after checkout
1. Check that the Stripe webhook fired — go to Stripe Dashboard → Developers → Webhooks → check for `checkout.session.completed` delivery
2. If the webhook returned a signature error, the `STRIPE_WEBHOOK_SECRET` in Supabase secrets is out of sync — see [STRIPE-SETUP.md](./STRIPE-SETUP.md)
3. If the webhook returned 200 but no email arrived, check that `session.metadata.email` is populated — the `stripe trigger` CLI command sends synthetic events with empty metadata and will never send a real email
4. Check Resend dashboard → Logs for any send attempts and errors

### Webhook secret mismatch (signature verification failed)
The `RESEND_WEBHOOK_SECRET` in `.env.local` doesn't match the signing secret in Resend. Go to Resend → Webhooks → click your endpoint → copy the signing secret → update `.env.local` and redeploy.

### Emails landing in spam
- Ensure your sending domain is verified in Resend
- Ensure SPF, DKIM, and DMARC DNS records are all set and verified
- Do not use a free email address (Gmail, Yahoo) as the `from` address
- Check the `complained` event count in Delivery Events — repeated spam complaints lower sender reputation

### "This API key is restricted to only send emails"
You created a restricted API key in Resend. Delete it and create a new one with **Full Access** permission.

---

## Environment Variables Reference

| Variable | Where | Required | Description |
|---|---|---|---|
| `RESEND_API_KEY` | `.env.local` + Supabase secrets | Yes | Full access API key from resend.com |
| `RESEND_WEBHOOK_SECRET` | `.env.local` | No | Signing secret for webhook signature verification |

The `RESEND_API_KEY` in `.env.local` is the fallback for Next.js routes. The primary key is stored in the `settings` table via Admin → Email → API Key tab.

---

## Related

- [EMAIL-SETUP.md](./EMAIL-SETUP.md) — MailerLite setup
- [STRIPE-SETUP.md](./STRIPE-SETUP.md) — Stripe webhook setup (required for order confirmation emails)
- [ADMIN-GUIDE.md](./ADMIN-GUIDE.md) — Admin email panel walkthrough
