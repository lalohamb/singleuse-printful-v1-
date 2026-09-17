# Email Setup

The storefront supports two email integrations. Both are optional — the storefront checkout and order flow work without them, but customers will not receive email notifications unless Resend is configured.

---

## Resend — Transactional Email

Resend handles order confirmation emails and shipping notification emails. It is also used by the admin email panel for manual sends and customer broadcasts.

### What Resend is used for

| Trigger | Email sent |
|---|---|
| `checkout.session.completed` (Stripe webhook) | Order confirmation to customer |
| `order:shipment:created` (Printify webhook) | Shipping notification with tracking link |
| Admin email panel — Send Email tab | Manual one-off email to any address |
| Admin email panel — Broadcast tab | Bulk email to all customers with paid live orders |

### Setup

1. Create an account at [resend.com](https://resend.com).
2. Go to **API Keys** and create a new key.
3. Add to `.env.local`:
   ```
   RESEND_API_KEY=re_<your-resend-api-key>
   ```
4. Set as a Supabase Edge Function secret:
   ```bash
   npx supabase secrets set RESEND_API_KEY=re_<your-resend-api-key> --project-ref <your-project-ref>
   ```

### Sending Domain

Resend requires a verified sending domain for production use. Emails sent from unverified domains may be rejected or land in spam.

1. In Resend, go to **Domains** and add your domain.
2. Add the DNS records Resend provides to your domain registrar.
3. Wait for verification (usually a few minutes).

The `from` address used in automated emails defaults to `orders@your-store.example`. Update this to match your verified domain after configuring your store.

### Delivery Event Tracking (Optional)

To track email delivery events (delivered, opened, bounced, etc.) in the admin email panel:

1. In Resend, go to **Webhooks** and add a new webhook.
2. Set the URL to:
   ```
   https://your-domain.com/api/resend/webhook
   ```
3. Add `RESEND_WEBHOOK_SECRET` to `.env.local`:
   ```
   RESEND_WEBHOOK_SECRET=<your-resend-webhook-secret>
   ```

Without this, the Delivery Events tab in the admin panel will show no data.

---

## MailerLite — Newsletter Integration

MailerLite handles newsletter subscriber management. It is used by the newsletter popup on the storefront and by the admin MailerLite panel.

### What MailerLite is used for

- Newsletter popup on the storefront captures subscriber email addresses
- Admin MailerLite panel provides subscriber management, group management, and campaign creation
- Subscribers are added to MailerLite when they sign up via the popup

### Setup

1. Create an account at [mailerlite.com](https://www.mailerlite.com).
2. Go to **Integrations → API** and copy your API key.
3. Add to `.env.local`:
   ```
   MAILER_LITE_API_KEY=<your-mailerlite-api-key>
   ```

### Requirements

- **Verified custom domain** — MailerLite requires a verified sending domain for campaigns. Free email addresses (Gmail, Yahoo, etc.) cannot be used as the `from` address. Verify your domain under MailerLite → Settings → Domains.
- **At least one group** — MailerLite's API requires subscribers to be assigned to a group. Create at least one group in the admin MailerLite panel before the newsletter popup will successfully add subscribers.

### Without MailerLite

If `MAILER_LITE_API_KEY` is not set, the newsletter popup will not capture subscribers and the admin MailerLite panel will display a connection error. All other storefront functionality is unaffected.
