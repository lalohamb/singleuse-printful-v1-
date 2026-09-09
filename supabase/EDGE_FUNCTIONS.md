# Supabase Edge Functions — Body & Sleeves

All functions run on Deno. Secrets are set via `supabase secrets set`.

---

## Required Secrets

| Secret | Used By |
|---|---|
| `PRINTIFY_API_TOKEN` | printify-proxy, printify-webhook, stripe-webhook |
| `PRINTIFY_SHOP_ID` | printify-webhook, stripe-webhook |
| `STRIPE_SECRET_KEY` | stripe-checkout, stripe-webhook |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook (optional — skips sig verification if absent) |
| `RESEND_API_KEY` | stripe-webhook, printify-webhook |

Set them all at once:
```bash
supabase secrets set \
  PRINTIFY_API_TOKEN=<token> \
  PRINTIFY_SHOP_ID=<shop_id> \
  STRIPE_SECRET_KEY=<sk_...> \
  STRIPE_WEBHOOK_SECRET=<whsec_...> \
  RESEND_API_KEY=<re_...>
```

---

## 1. `printify-proxy`

**JWT required:** yes (`verify_jwt = true`)  
**Purpose:** Authenticated proxy to the Printify API. Prevents exposing the Printify token to the browser.

### Routes

| Method | Path | Description |
|---|---|---|
| GET | `/printify-proxy/shops` | List connected Printify shops |
| GET | `/printify-proxy/products?shop_id=` | List products (paginated: `page`, `limit`) |
| GET | `/printify-proxy/products/:id?shop_id=` | Get a single product |
| POST | `/printify-proxy/products?shop_id=` | Create a product |
| PUT | `/printify-proxy/products/:id?shop_id=` | Update a product |
| DELETE | `/printify-proxy/products/:id?shop_id=` | Delete a product |
| POST | `/printify-proxy/orders?shop_id=` | Submit an order to Printify |
| GET | `/printify-proxy/orders/:id?shop_id=` | Get order status from Printify |
| GET | `/printify-proxy/shipping?shop_id=&products=` | Get shipping options |
| POST | `/printify-proxy/shipping?shop_id=` | Calculate shipping for address + items |
| GET | `/printify-proxy/blueprints` | List all Printify catalog blueprints |
| GET | `/printify-proxy/blueprints/:id/providers` | List print providers for a blueprint |
| GET | `/printify-proxy/blueprints/:id/providers/:pid/variants` | List variants |
| GET | `/printify-proxy/blueprints/:id/providers/:pid/shipping` | Shipping profiles |
| POST | `/printify-proxy/sync?shop_id=` | Sync all Printify products → local `products` table |
| POST | `/printify-proxy/cleanup?shop_id=` | Delete DB products no longer in Printify |

### Sync behavior
- Paginates through all Printify products (50/page).
- Upserts on `printify_id` conflict.
- Respects `content_locked = true` — locked products keep their admin-edited `title`, `description`, and `image_url`; only commerce fields (`price`, `variants`, `status`, etc.) are refreshed.
- Fetches and stores the static shipping profile per blueprint/provider into `products.shipping_info`.
- Updates `settings.printify_connected = true` and `settings.printify_shop_id` on success.

### Cleanup behavior
- Collects all live Printify product IDs.
- Deletes any `products` rows whose `printify_id` is no longer present in Printify.

---

## 2. `printify-webhook`

**JWT required:** no (`verify_jwt = false`)  
**Purpose:** Receives push events from Printify. Register this URL in your Printify shop's webhook settings.

**Webhook URL:** `https://<project-ref>.supabase.co/functions/v1/printify-webhook`

### Handled Events

| Event Type | Action |
|---|---|
| `product:publish` / `product:publish:started` | Fetches full product from Printify, upserts to `products`, calls `publishing_succeeded.json` back to Printify, sets `status = 'active'`. On failure calls `publishing_failed.json`. |
| `order:shipment:created` | Updates `orders.fulfillment_status = 'shipped'`, stores `tracking_number` / `tracking_url`, sends shipping confirmation email via Resend. |
| `order:fulfilled` | Updates `orders.fulfillment_status = 'fulfilled'` and `orders.status = 'fulfilled'`. |

### Shipping email
Sent via Resend from `orders@bodyandsleeves.com` when `order:shipment:created` fires. Includes a tracking button if `tracking_url` is present.

---

## 3. `stripe-checkout`

**JWT required:** no (`verify_jwt = false`)  
**Purpose:** Creates a Stripe Checkout session and inserts a pending order.

**Method:** `POST`

### Request body

```json
{
  "items": [
    {
      "product_id": "uuid",
      "printify_id": "printify_product_id",
      "variant_id": "printify_variant_id",
      "title": "Heritage Crown Tee",
      "variant_label": "Black / M",
      "price": 32.00,
      "quantity": 1,
      "image_url": "https://..."
    }
  ],
  "email": "customer@example.com",
  "shipping_name": "Jane Doe",
  "shipping_address": { "line1": "...", "city": "...", "state": "...", "zip": "...", "country": "US" },
  "shipping_cost": 6.99,
  "subtotal": 32.00,
  "total": 38.99,
  "origin": "https://bodyandsleeves.com"
}
```

### Response

```json
{ "url": "https://checkout.stripe.com/...", "session_id": "cs_..." }
```

### Behavior
- Builds Stripe line items from `items`; appends shipping as a separate line item if `shipping_cost > 0`.
- Allowed shipping countries: US, CA, GB, AU.
- Inserts an `orders` row with `status = 'pending'` and the Stripe session ID.
- Redirects to `/checkout/success?session_id=...` on success, `/checkout/cancel` on cancel.

---

## 4. `stripe-webhook`

**JWT required:** no (`verify_jwt = false`)  
**Purpose:** Handles Stripe events to advance order state and trigger fulfillment.

**Webhook URL:** `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`  
Register in Stripe Dashboard → Webhooks. Set `STRIPE_WEBHOOK_SECRET` for signature verification.

### Handled Events

| Event | Action |
|---|---|
| `checkout.session.completed` | Updates order `status = 'paid'`, stores `stripe_payment_intent_id`, sends order confirmation email via Resend, submits order to Printify, stores `printify_order_id`. |
| `payment_intent.payment_failed` | Updates order `status = 'cancelled'`. |

### Order confirmation email
Sent via Resend from `orders@bodyandsleeves.com`. Includes itemized list and total.

### Printify fulfillment
- Reads `printify_shop_id` from `settings` (falls back to `PRINTIFY_SHOP_ID` env).
- Posts to `https://api.printify.com/v1/shops/:shopId/orders.json`.
- On success, updates `orders.printify_order_id` and `orders.fulfillment_status`.

---

## Deploy

```bash
# Deploy all functions
supabase functions deploy printify-proxy
supabase functions deploy printify-webhook
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```
