# Standalone POD Storefront — Stripe + Printify / Stripe + Printful

This document is a self-contained reference for building **two separate projects** from scratch:

- **Project A** — Stripe + Printify
- **Project B** — Stripe + Printful

Each project is independent. No shared code, no mixed-cart complexity. Pick one and build it.

---

## Project A — Stripe + Printify

### How It Works End-to-End

```
Customer adds product to cart
  → Checkout page calls /api/checkout
    → Calls Printify shipping API to get live shipping cost
    → Creates Stripe Checkout Session with line items + shipping
  → Customer pays on Stripe hosted page
  → Stripe fires checkout.session.completed webhook
    → Verify Stripe signature
    → Create order in DB
    → POST to Printify orders API to submit for fulfillment
    → Send confirmation email
  → Printify ships the order
    → Printify fires order:shipment:created webhook
    → Update order tracking_number + tracking_url in DB
    → Send shipping email
```

---

### Printify API Reference

```
Base URL:  https://api.printify.com/v1
Auth:      Authorization: Bearer <PRINTIFY_API_TOKEN>
```

#### Products

```
GET  /shops/{shop_id}/products.json?limit=100&page=1
     → list all products (paginate with ?page=)

GET  /shops/{shop_id}/products/{product_id}.json
     → single product with full variant + image data
```

Product response shape (key fields):

```json
{
  "id": "abc123",
  "title": "Classic Tee",
  "description": "...",
  "images": [{ "src": "https://images-api.printify.com/...", "variant_ids": [12345] }],
  "variants": [
    {
      "id": 12345,
      "title": "Black / S",
      "price": 2499,
      "is_enabled": true,
      "options": [{ "id": 1, "value": "Black" }, { "id": 2, "value": "S" }]
    }
  ],
  "blueprint_id": 5,
  "print_provider_id": 99,
  "shipping_info": { ... }
}
```

> Prices are in **cents** (2499 = $24.99).

#### Shipping Quote

```
POST /shops/{shop_id}/orders/shipping.json
Content-Type: application/json

{
  "line_items": [
    { "product_id": "abc123", "variant_id": 12345, "quantity": 1 }
  ],
  "address_to": {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "555-555-5555",
    "country": "US",
    "region": "CA",
    "address1": "123 Main St",
    "city": "Los Angeles",
    "zip": "90001"
  }
}

Response:
{
  "shipping_methods": [
    { "id": 1, "title": "Standard", "rank": "standard", "cost": { "amount": 499, "currency": "USD" } }
  ]
}
```

> Use `shipping_methods[0].cost.amount` (cheapest / standard). Amount is in cents.

#### Submit Order

```
POST /shops/{shop_id}/orders.json
Content-Type: application/json

{
  "external_id": "your-order-id",
  "label": "Order #1001",
  "line_items": [
    { "product_id": "abc123", "variant_id": 12345, "quantity": 1 }
  ],
  "shipping_method": 1,
  "address_to": {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "555-555-5555",
    "country": "US",
    "region": "CA",
    "address1": "123 Main St",
    "city": "Los Angeles",
    "zip": "90001"
  }
}

Response:
{
  "id": "printify-order-id-xyz",
  "status": "pending"
}
```

#### Printify Webhook Events

Register webhook URL in Printify Dashboard → Webhooks:

```
URL: https://yourdomain.com/api/printify-webhook
Events to subscribe:
  - order:shipment:created   → order shipped, has tracking
  - order:shipment:delivered → optional
  - product:publish:succeeded → optional, for product sync
```

Webhook payload for `order:shipment:created`:

```json
{
  "type": "order:shipment:created",
  "resource": {
    "id": "printify-order-id-xyz",
    "data": {
      "shipment": {
        "carrier": "USPS",
        "number": "9400111899223397846046",
        "url": "https://tools.usps.com/go/TrackConfirmAction?tLabels=...",
        "delivered_at": ""
      }
    }
  }
}
```

> Printify does not sign webhooks with HMAC. Validate by checking the order exists in your DB.

#### Printify Environment Variables

```env
PRINTIFY_API_TOKEN=your_printify_personal_access_token
PRINTIFY_SHOP_ID=your_shop_id
```

Get your token: Printify Dashboard → My Profile → Connections → Personal Access Tokens
Get your shop ID: `GET /shops.json` returns `[{ "id": 12345678, "title": "My Store" }]`

---

### Stripe API Reference (Project A)

#### Create Checkout Session

```ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [
    {
      price_data: {
        currency: 'usd',
        unit_amount: 2499, // cents
        product_data: { name: 'Classic Tee — Black / S' },
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: 'usd',
        unit_amount: 499, // shipping
        product_data: { name: 'Shipping' },
      },
      quantity: 1,
    },
  ],
  success_url: 'https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://yourdomain.com/cart',
  metadata: {
    order_id: 'your-internal-order-id',
    items: JSON.stringify(cartItems), // store cart snapshot
  },
});

// Redirect customer to session.url
```

#### Verify Webhook

```ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// In your POST /api/stripe-webhook handler:
const sig = request.headers.get('stripe-signature')!;
const rawBody = await request.text();

let event: Stripe.Event;
try {
  event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
} catch {
  return new Response('Invalid signature', { status: 400 });
}

if (event.type === 'checkout.session.completed') {
  const session = event.data.object as Stripe.Checkout.Session;
  const items = JSON.parse(session.metadata?.items ?? '[]');
  // → create order in DB
  // → submit to Printify
}
```

#### Register Webhook in Stripe Dashboard

```
Dashboard → Developers → Webhooks → Add endpoint
URL: https://yourdomain.com/api/stripe-webhook
Events: checkout.session.completed
```

Copy the **Signing secret** (whsec_...) — shown only once.

#### Stripe Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_...          # or sk_test_... for testing
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

#### Test Cards

```
Success:  4242 4242 4242 4242  (any future date, any CVC)
Decline:  4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

---

### Project A — Minimal File Structure

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                    ← homepage, fetch + display products
│   │   ├── product/[id]/page.tsx       ← product detail, variant picker
│   │   ├── cart/page.tsx               ← cart review
│   │   ├── success/page.tsx            ← post-payment confirmation
│   │   └── api/
│   │       ├── checkout/route.ts       ← get shipping quote + create Stripe session
│   │       ├── stripe-webhook/route.ts ← verify + create order + submit to Printify
│   │       └── printify-webhook/route.ts ← update tracking
│   ├── lib/
│   │   ├── printify.ts                 ← Printify API client
│   │   ├── stripe.ts                   ← Stripe client
│   │   └── cart.tsx                    ← cart context (localStorage)
│   └── types.ts                        ← Product, CartItem, Order types
├── .env.local
└── next.config.mjs                     ← add images-api.printify.com to remotePatterns
```

#### `next.config.mjs` — image hostnames for Printify

```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'images-api.printify.com' },
    { protocol: 'https', hostname: '*.cloudfront.net' },
  ],
  formats: ['image/webp'],
  minimumCacheTTL: 86400,
}
```

---

### Project A — Key Implementation Notes

- **Product sync**: Fetch from Printify API at build time (SSG) or on-demand. Cache in your DB or use ISR (`revalidate: 3600`).
- **Variant price**: Printify prices are in cents. Divide by 100 for display. Pass cents directly to Stripe.
- **Shipping**: Always call Printify shipping API at checkout time — do not hardcode. Cache the result in the session, not the DB.
- **Order submission**: Submit to Printify inside the Stripe webhook handler, not the checkout handler. The webhook is the source of truth for payment confirmation.
- **Printify order ID**: Store the returned `id` from Printify on your order row for tracking.
- **Webhook validation**: Printify has no HMAC signing. Protect the endpoint by checking the order exists in your DB before processing.

---

---

## Project B — Stripe + Printful

### How It Works End-to-End

```
Customer adds product to cart
  → Checkout page calls /api/checkout
    → Calls Printful /shipping/rates to get live shipping cost
    → Creates Stripe Checkout Session with line items + shipping
  → Customer pays on Stripe hosted page
  → Stripe fires checkout.session.completed webhook
    → Verify Stripe signature
    → Create order in DB
    → POST to Printful /orders to submit for fulfillment
    → Send confirmation email
  → Printful ships the order
    → Printful fires package_shipped webhook
    → Update order tracking_number + tracking_url in DB
    → Send shipping email
```

---

### Printful API Reference

```
Base URL:  https://api.printful.com
Auth:      Authorization: Bearer <PRINTFUL_API_TOKEN>
```

#### Products

```
GET  /store/products?limit=100&offset=0
     → list sync products (paginate with ?offset=)

GET  /store/products/{sync_product_id}
     → single product with sync_variants
```

Product response shape (key fields):

```json
{
  "result": {
    "sync_product": {
      "id": 987654321,
      "name": "Classic Hoodie",
      "thumbnail_url": "https://files.cdn.printful.com/..."
    },
    "sync_variants": [
      {
        "id": 111111111,
        "variant_id": 4011,
        "name": "Black / S",
        "retail_price": "39.99",
        "files": [
          { "type": "preview", "preview_url": "https://files.cdn.printful.com/..." }
        ]
      }
    ]
  }
}
```

> `sync_variants[].variant_id` is the **catalog variant ID** — use this for orders and shipping.
> `sync_variants[].id` is the store-specific sync variant ID — use this for product management only.
> Prices are **strings** in dollars ("39.99"). Multiply by 100 for Stripe (cents).

#### Shipping Quote

```
POST /shipping/rates
Content-Type: application/json
Authorization: Bearer <PRINTFUL_API_TOKEN>

{
  "recipient": {
    "address1": "123 Main St",
    "city": "Los Angeles",
    "state_code": "CA",
    "country_code": "US",
    "zip": "90001"
  },
  "items": [
    { "variant_id": 4011, "quantity": 1 }
  ],
  "currency": "USD",
  "locale": "en_US"
}

Response:
{
  "result": [
    {
      "id": "STANDARD",
      "name": "Standard",
      "rate": "4.99",
      "currency": "USD",
      "minDeliveryDays": 3,
      "maxDeliveryDays": 7
    }
  ]
}
```

> Use `result[0].rate` (cheapest). It's a string — parse to float, multiply by 100 for Stripe.

#### Submit Order

```
POST /orders
Content-Type: application/json
Authorization: Bearer <PRINTFUL_API_TOKEN>

{
  "external_id": "your-order-id",
  "shipping": "STANDARD",
  "recipient": {
    "name": "Jane Doe",
    "address1": "123 Main St",
    "city": "Los Angeles",
    "state_code": "CA",
    "country_code": "US",
    "zip": "90001",
    "email": "jane@example.com",
    "phone": "555-555-5555"
  },
  "items": [
    {
      "variant_id": 4011,
      "quantity": 1,
      "retail_price": "39.99",
      "name": "Classic Hoodie — Black / S"
    }
  ]
}

Response:
{
  "result": {
    "id": 123456789,
    "status": "draft",
    "external_id": "your-order-id"
  }
}
```

> By default Printful creates orders in **draft** status. To auto-confirm (charge your Printful wallet and start production), append `?confirm=true` to the URL:
> `POST /orders?confirm=true`

#### Printful Webhook Events

Register webhook in Printful Dashboard → Settings → Webhooks:

```
URL: https://yourdomain.com/api/printful-webhook
Events to subscribe:
  - package_shipped    → order shipped, has tracking info
  - order_updated      → status changes (optional)
  - order_canceled     → optional
```

Webhook payload for `package_shipped`:

```json
{
  "type": "package_shipped",
  "data": {
    "order": {
      "id": 123456789,
      "external_id": "your-order-id",
      "status": "fulfilled"
    },
    "shipment": {
      "id": 1,
      "carrier": "USPS",
      "service": "First Class",
      "tracking_number": "9400111899223397846046",
      "tracking_url": "https://tools.usps.com/go/TrackConfirmAction?tLabels=...",
      "ship_date": "2025-07-15",
      "shipped_at": "2025-07-15T10:00:00Z"
    }
  }
}
```

#### Printful Webhook Signature Verification

Printful signs webhooks with HMAC-SHA256:

```ts
import { createHmac } from 'crypto';

const sig = request.headers.get('X-PF-Signature');
const rawBody = await request.text();
const expected = createHmac('sha256', process.env.PRINTFUL_WEBHOOK_SECRET!)
  .update(rawBody)
  .digest('hex');

if (sig !== expected) {
  return new Response('Invalid signature', { status: 401 });
}
```

Get the webhook secret from Printful Dashboard → Settings → Webhooks → your endpoint → Secret.

#### Printful Environment Variables

```env
PRINTFUL_API_TOKEN=your_printful_api_token
PRINTFUL_STORE_ID=your_store_id
PRINTFUL_WEBHOOK_SECRET=your_webhook_signing_secret
```

Get your token: Printful Dashboard → Settings → API → Generate API token
Get your store ID: `GET /stores` returns `[{ "id": 12345, "name": "My Store" }]`

---

### Stripe API Reference (Project B)

Identical to Project A. See the Stripe section above — same session creation, same webhook verification, same environment variables.

The only difference: Printful prices are dollar strings (`"39.99"`), so convert before passing to Stripe:

```ts
const unitAmount = Math.round(parseFloat(variant.retail_price) * 100); // → 3999
```

---

### Project B — Minimal File Structure

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                    ← homepage, fetch + display products
│   │   ├── product/[id]/page.tsx       ← product detail, variant picker
│   │   ├── cart/page.tsx               ← cart review
│   │   ├── success/page.tsx            ← post-payment confirmation
│   │   └── api/
│   │       ├── checkout/route.ts       ← get shipping quote + create Stripe session
│   │       ├── stripe-webhook/route.ts ← verify + create order + submit to Printful
│   │       └── printful-webhook/route.ts ← update tracking
│   ├── lib/
│   │   ├── printful.ts                 ← Printful API client
│   │   ├── stripe.ts                   ← Stripe client
│   │   └── cart.tsx                    ← cart context (localStorage)
│   └── types.ts                        ← Product, CartItem, Order types
├── .env.local
└── next.config.mjs                     ← add Printful CDN hostnames
```

#### `next.config.mjs` — image hostnames for Printful

```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'files.cdn.printful.com' },
    { protocol: 'https', hostname: 'ucarecdn.com' },
  ],
  formats: ['image/webp'],
  minimumCacheTTL: 86400,
}
```

---

### Project B — Key Implementation Notes

- **Variant ID**: Use `sync_variants[].variant_id` (catalog ID) for orders and shipping — NOT `sync_variants[].id` (sync ID).
- **Price format**: Printful returns prices as dollar strings (`"39.99"`). Parse with `parseFloat()` and multiply by 100 for Stripe.
- **Order confirmation**: Append `?confirm=true` to `POST /orders` to auto-confirm and start production. Without it, orders sit in draft and are never fulfilled.
- **Shipping method**: Pass the `id` from the shipping rates response (e.g. `"STANDARD"`) as the `shipping` field in the order payload.
- **Webhook secret**: Printful does sign webhooks — always verify the `X-PF-Signature` header.
- **Draft vs confirmed**: If you use `?confirm=true`, Printful charges your Printful wallet immediately. Make sure your wallet has funds or a payment method attached.
- **Store ID**: Required for some API calls. Store in env and pass as needed.

---

---

## Shared Stripe Notes (Both Projects)

### Webhook Setup Checklist

- [ ] Create endpoint in Stripe Dashboard → Developers → Webhooks
- [ ] Set URL to `https://yourdomain.com/api/stripe-webhook`
- [ ] Subscribe to `checkout.session.completed`
- [ ] Copy the signing secret (`whsec_...`) — shown only once
- [ ] Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`
- [ ] For local testing: use `stripe listen --forward-to localhost:3000/api/stripe-webhook`

### Test Mode vs Live Mode

| | Test | Live |
|---|---|---|
| Key prefix | `sk_test_...` | `sk_live_...` |
| Real money | No | Yes |
| Test cards | Yes | No |
| Webhooks | Separate endpoint | Separate endpoint |

Always test end-to-end in test mode before switching to live keys.

### Stripe Packages

```bash
npm install stripe @stripe/stripe-js
```

```ts
// Server-side (API routes, webhooks)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Client-side (if using Stripe.js directly)
import { loadStripe } from '@stripe/stripe-js';
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
```

---

## Quick Comparison — Printify vs Printful

| | Printify | Printful |
|---|---|---|
| Base URL | `https://api.printify.com/v1` | `https://api.printful.com` |
| Auth header | `Authorization: Bearer TOKEN` | `Authorization: Bearer TOKEN` |
| Product list | `GET /shops/{id}/products.json` | `GET /store/products` |
| Variant price | Integer cents (`2499`) | String dollars (`"24.99"`) |
| Shipping endpoint | `POST /shops/{id}/orders/shipping.json` | `POST /shipping/rates` |
| Order endpoint | `POST /shops/{id}/orders.json` | `POST /orders` |
| Auto-confirm orders | Always | Requires `?confirm=true` |
| Webhook signing | None (no HMAC) | HMAC-SHA256 (`X-PF-Signature`) |
| Shipped event | `order:shipment:created` | `package_shipped` |
| Image CDN | `images-api.printify.com`, `*.cloudfront.net` | `files.cdn.printful.com`, `ucarecdn.com` |
| Variant ID field | `variants[].id` | `sync_variants[].variant_id` |
