# Supabase Edge Functions

Four Deno edge functions run on Supabase infrastructure. They handle all server-side logic that requires secret keys or trusted execution — things the browser should never do directly.

---

## 1. `printify-proxy`

**What it does**
Acts as a secure middleman between the app and the Printify API. All Printify API calls go through here so the `PRINTIFY_API_TOKEN` secret never touches the browser.

**Routes**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/shops` | List connected Printify shops |
| GET | `/products?shop_id=` | List all products in a shop |
| GET | `/products/:id?shop_id=` | Get a single product |
| POST | `/products?shop_id=` | Create a product in Printify |
| PUT | `/products/:id?shop_id=` | Update a product |
| DELETE | `/products/:id?shop_id=` | Delete a product |
| POST | `/orders?shop_id=` | Submit an order to Printify for fulfillment |
| GET | `/orders/:id?shop_id=` | Get order status from Printify |
| POST | `/orders/cancel` | Cancel a Printify order |
| GET | `/shipping?shop_id=` | Get shipping options |
| POST | `/shipping?shop_id=` | Calculate shipping for an address + items |
| GET | `/blueprints` | List all Printify product blueprints (templates) |
| GET | `/blueprints/:id/providers` | List print providers for a blueprint |
| GET | `/blueprints/:id/providers/:pid/variants` | List variants for a blueprint/provider |
| GET | `/blueprints/:id/providers/:pid/shipping` | Get shipping profile for a blueprint/provider |
| POST | `/sync?shop_id=` | **Full sync** — pulls all Printify products into Supabase `products` table |
| POST | `/cleanup?shop_id=` | Removes DB products that no longer exist in Printify |

**When to use**
- Run `/sync` from the admin panel whenever you add/update products in Printify and want them reflected in the store.
- Run `/cleanup` if products were deleted in Printify but are still showing in the store.
- The storefront calls `/shipping` at checkout to get live shipping rates.

**Sync behavior**
- Detects personalization options per product via Printify's `personalization_options` API and sets `is_personalizable` + `personalization_label` automatically.
- Respects `content_locked` flag — locked products keep their admin-edited title/description/image but still get price, variants, and status refreshed.
- Stale products (deleted from Printify) are removed from the DB at the end of each sync.
- Caches shipping profiles per blueprint/provider to avoid redundant API calls.

**Required secrets**
- `PRINTIFY_API_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. `printify-webhook`

**What it does**
Receives real-time event pushes from Printify. Printify calls this URL automatically when products are published or orders ship/deliver.

**Events handled**

| Event | Action |
|-------|--------|
| `product:publish` / `product:publish:started` | Upserts the product into Supabase, then confirms publish back to Printify (required for custom integration shops — without this the product stays stuck at "Publishing" in Printify) |
| `order:shipment:created` | Updates order `fulfillment_status` to `shipped`, saves tracking number/URL, sends shipping confirmation email via Resend |
| `order:shipment:delivered` / `order:fulfilled` | Updates order status to `fulfilled` |

**When to use**
You don't call this manually — Printify calls it. Register the URL in your Printify shop settings under **Webhooks**:
```
https://<your-project-ref>.supabase.co/functions/v1/printify-webhook
```

**Required secrets**
- `PRINTIFY_API_TOKEN`
- `PRINTIFY_SHOP_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (optional — for shipping emails)

---

## 3. `stripe-checkout`

**What it does**
Creates a Stripe Checkout session and a pending order in Supabase. The browser is redirected to Stripe's hosted payment page. The Stripe secret key never touches the client.

**Flow**
1. Checkout page POSTs cart items + shipping address + email to this function.
2. Function creates a Stripe session with line items (products + shipping).
3. Function inserts a `pending` order row in Supabase with the `stripe_session_id`.
4. Returns the Stripe-hosted checkout URL — browser redirects there.
5. After payment, Stripe calls `stripe-webhook` to finalize the order.

**When to use**
Called automatically when the customer clicks "Pay with Stripe" on the checkout page. You should never need to call this manually.

**Required secrets**
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. `stripe-webhook`

**What it does**
Receives Stripe payment events and handles post-payment fulfillment logic. This is the most critical function — it's what turns a Stripe payment into a real order.

**Events handled**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Marks order as `paid`, sends order confirmation email via Resend, adds customer to MailerLite, submits order to Printify for fulfillment (live mode only) |
| `payment_intent.payment_failed` | Marks order as `cancelled` |

**When to use**
You don't call this manually — Stripe calls it. Register the URL in your Stripe dashboard under **Webhooks**:
```
https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
```
Set the webhook to listen for `checkout.session.completed` and `payment_intent.payment_failed`.

> **Important:** Printify order submission only runs in `livemode`. Test payments will not create Printify orders.

**Required secrets**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (optional but recommended — verifies the request is genuinely from Stripe)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (optional — for order confirmation emails)
- `MAILER_LITE_API_KEY` (optional — for adding customers to mailing list)

---

## Deploy All Functions

```bash
supabase functions deploy --project-ref SUPABASE_PROJECT_REF_REDACTED
```

Or individually:

```bash
supabase functions deploy printify-proxy --project-ref SUPABASE_PROJECT_REF_REDACTED
supabase functions deploy printify-webhook --project-ref SUPABASE_PROJECT_REF_REDACTED
supabase functions deploy stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED
supabase functions deploy stripe-webhook --project-ref SUPABASE_PROJECT_REF_REDACTED
```

## Set Secrets

```bash
supabase secrets set PRINTIFY_API_TOKEN=your_token --project-ref SUPABASE_PROJECT_REF_REDACTED
supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref SUPABASE_PROJECT_REF_REDACTED
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref SUPABASE_PROJECT_REF_REDACTED
supabase secrets set RESEND_API_KEY=re_... --project-ref SUPABASE_PROJECT_REF_REDACTED
supabase secrets set MAILER_LITE_API_KEY=your_key --project-ref SUPABASE_PROJECT_REF_REDACTED
```
