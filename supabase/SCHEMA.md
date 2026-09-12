# Gender Apparel — Application Schema & Relationships

## Database Tables

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  auth.users  (Supabase managed)                                             │
│  ─────────────────────────────                                              │
│  id  uuid  PK                                                               │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │ 1:1  (id = auth.uid())
                       ▼
┌──────────────────────────────────┐
│  admins                          │
│  ────────────────────────────    │
│  id          uuid  PK            │  ← matches auth.users.id
│  email       text  NOT NULL      │
│  role        text  'admin'       │  'admin' | 'super_admin'
│  created_at  timestamptz         │
└──────────────────────────────────┘


┌──────────────────────────────────┐        ┌──────────────────────────────────────────────────────────────────┐
│  categories                      │        │  products                                                        │
│  ────────────────────────────    │        │  ────────────────────────────────────────────────────────────    │
│  id           uuid  PK           │◄───────│  id                uuid  PK                                      │
│  name         text  UNIQUE       │  N:1   │  printify_id       text  UNIQUE  (nullable)                      │
│  slug         text  UNIQUE       │        │  title             text  NOT NULL                                 │
│  description  text               │        │  description       text                                          │
│  created_at   timestamptz        │        │  category_id       uuid  FK → categories (SET NULL on delete)    │
└──────────────────────────────────┘        │  price             numeric(10,2)                                 │
                                            │  cost              numeric(10,2)                                 │
                                            │  image_url         text                                          │
                                            │  images            jsonb  []                                     │
                                            │  status            text   'active'|'draft'|'archived'            │
                                            │  featured          boolean                                       │
                                            │  is_new_arrival    boolean                                       │
                                            │  is_trending       boolean                                       │
                                            │  is_bestseller     boolean                                       │
                                            │  is_on_sale        boolean                                       │
                                            │  content_locked    boolean  ← prevents sync from overwriting     │
                                            │  blueprint_id      text   (Printify blueprint)                   │
                                            │  print_provider_id text   (Printify provider)                    │
                                            │  variants          jsonb  [{id,label,color,size,price,image_url}]│
                                            │  shipping_info     jsonb  (static shipping profile from Printify)│
                                            │  created_at        timestamptz                                   │
                                            │  updated_at        timestamptz                                   │
                                            └──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│  orders                                                          │
│  ────────────────────────────────────────────────────────────    │
│  id                       uuid  PK                               │
│  stripe_session_id        text  (nullable)                       │
│  stripe_payment_intent_id text  (nullable)                       │
│  printify_order_id        text  (nullable)                       │
│  email                    text  NOT NULL                         │
│  shipping_name            text  NOT NULL                         │
│  shipping_address         jsonb NOT NULL                         │
│  shipping_method          text                                   │
│  shipping_cost            numeric(10,2)                          │
│  subtotal                 numeric(10,2)                          │
│  total                    numeric(10,2)                          │
│  currency                 text  'USD'                            │
│  status                   text  'pending'|'paid'|'cancelled'|'fulfilled' │
│  fulfillment_status       text  'pending'|'shipped'|'fulfilled'  │
│  tracking_number          text                                   │
│  tracking_url             text                                   │
│  items                    jsonb NOT NULL  (snapshot of cart)     │
│  created_at               timestamptz                            │
│  updated_at               timestamptz                            │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│  settings  (single row)                                          │
│  ────────────────────────────────────────────────────────────    │
│  id                       uuid  PK                               │
│  store_name               text                                   │
│  tagline                  text                                   │
│  hero_image_url           text                                   │
│  hero_title               text                                   │
│  hero_subtitle            text                                   │
│  announcement             text                                   │
│  announcement_active      boolean                                │
│  logo_url                 text                                   │
│  logo_size                numeric                                │
│  shipping_free_threshold  numeric                                │
│  default_shipping_cost    numeric                                │
│  printify_connected       boolean                                │
│  printify_shop_id         text                                   │
│  stripe_connected         boolean                                │
│  social_links             jsonb  {instagram,tiktok,facebook,...} │
│  testimonials             jsonb  [{quote,name,location,product}] │
│  our_why_label/quote/body text fields                            │
│  our_why_image_*          image control fields                   │
│  story_*                  story section image control fields     │
│  promo_banner_*           promo banner fields                    │
│  updated_at               timestamptz                            │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│  policies                                                        │
│  ────────────────────────────────────────────────────────────    │
│  id          text  PK  'terms'|'privacy'|'refund'                │
│  title       text  NOT NULL                                      │
│  content     text                                                │
│  locked      boolean                                             │
│  updated_at  timestamptz                                         │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│  seo_settings  (single row)                                      │
│  ────────────────────────────────────────────────────────────    │
│  id                       uuid  PK (fixed: 000...0001)           │
│  site_url                 text                                   │
│  default_og_image         text                                   │
│  sitemap_enabled          boolean                                │
│  robots_noindex_admin     boolean                                │
│  jsonld_enabled           boolean                                │
│  canonical_enabled        boolean                                │
│  meta_title_suffix        text                                   │
│  twitter_handle           text                                   │
│  google_site_verification text                                   │
│  updated_at               timestamptz                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## RLS Access Matrix

| Table | anon SELECT | auth SELECT | admin INSERT/UPDATE/DELETE |
|---|---|---|---|
| `admins` | ✗ | own row only | super_admin only |
| `categories` | ✓ | ✓ | ✓ |
| `products` | ✓ | ✓ | ✓ |
| `orders` | ✗ (INSERT only) | ✗ | ✓ |
| `settings` | ✓ | ✓ | UPDATE only |
| `policies` | ✓ | ✓ | ✓ |
| `seo_settings` | ✓ | ✓ | ✓ |

---

## System Data Flow

```
                        ┌─────────────────────────────────────────────────────┐
                        │                   PRINTIFY                          │
                        │  (print-on-demand fulfillment)                      │
                        └──────┬──────────────────────────────────────────────┘
                               │                          ▲
              webhook push     │                          │  order submit
         product:publish       │                          │  (stripe-webhook)
         order:shipment:created│                          │
         order:fulfilled       │                          │
                               ▼                          │
                    ┌──────────────────────┐   ┌──────────────────────┐
                    │  printify-webhook    │   │  stripe-webhook      │
                    │  (edge function)     │   │  (edge function)     │
                    └──────────┬───────────┘   └──────────┬───────────┘
                               │                          │
                               │  upsert products         │  update orders
                               │  update orders           │  send confirm email
                               │  send shipping email     │
                               ▼                          ▼
                        ┌─────────────────────────────────────────────────────┐
                        │                  SUPABASE DB                        │
                        │  products  │  orders  │  settings  │  categories    │
                        │  policies  │  seo_settings  │  admins               │
                        └──────────────────────────┬──────────────────────────┘
                                                   │
                               ┌───────────────────┼───────────────────┐
                               │                   │                   │
                               ▼                   ▼                   ▼
                    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
                    │  printify-proxy  │  │  stripe-checkout │  │  Next.js App     │
                    │  (edge function) │  │  (edge function) │  │  (storefront +   │
                    │  JWT required    │  │  no JWT          │  │   admin panel)   │
                    └──────────────────┘  └────────┬─────────┘  └──────────────────┘
                               ▲                   │
                               │  sync/manage       │  create session
                               │  products          │  insert pending order
                    ┌──────────┴─────────┐          ▼
                    │  Admin Panel       │  ┌──────────────────┐
                    │  /admin/*          │  │     STRIPE       │
                    └────────────────────┘  │  (payments)      │
                                            └──────────────────┘


                    ┌────────────────────────────────────────────────┐
                    │  EXTERNAL SERVICES                             │
                    │                                                │
                    │  Resend  — order confirmation + shipping emails│
                    │  MailerLite — newsletter signups               │
                    └────────────────────────────────────────────────┘
```

---

## Order Lifecycle

```
Customer adds to cart
        │
        ▼
POST stripe-checkout  ──► Stripe Checkout Session created
        │                  orders row inserted (status: pending)
        │
        ▼
Customer pays on Stripe
        │
        ▼
stripe-webhook: checkout.session.completed
        │
        ├──► orders.status = 'paid'
        ├──► Resend: order confirmation email
        └──► POST to Printify orders API
                    │
                    ▼
             orders.printify_order_id set
             orders.fulfillment_status = 'pending'
                    │
                    ▼
        printify-webhook: order:shipment:created
                    │
                    ├──► orders.fulfillment_status = 'shipped'
                    ├──► orders.tracking_number / tracking_url
                    └──► Resend: shipping notification email
                                │
                                ▼
                    printify-webhook: order:fulfilled
                                │
                                └──► orders.status = 'fulfilled'
                                     orders.fulfillment_status = 'fulfilled'
```

---

## Product Sync Lifecycle

```
Admin clicks "Sync from Printify"
        │
        ▼
POST printify-proxy/sync?shop_id=
        │
        ├── Paginates all Printify products
        ├── For each product:
        │     ├── Fetches full detail + shipping profile
        │     ├── Resolves variants (color, size, price, image)
        │     └── Upserts to products table
        │           ├── content_locked=false → overwrites title/description/images
        │           └── content_locked=true  → preserves admin edits, updates commerce fields only
        │
        └── Updates settings.printify_connected = true

OR via Printify webhook (product:publish):
        │
        ▼
printify-webhook receives product:publish
        ├── Fetches product from Printify
        ├── Upserts to products table
        ├── Calls publishing_succeeded.json back to Printify
        └── Sets products.status = 'active'
```

---

## Next.js Route Map

```
src/app/
├── page.tsx                    Home (storefront)
├── shop/page.tsx               Product listing
├── product/[id]/               Product detail
├── checkout/
│   ├── page.tsx                Checkout form
│   └── success/                Post-payment success
├── about/                      About page
├── privacy-policy/             Pulls from policies table
├── refund-policy/              Pulls from policies table
├── terms-of-service/           Pulls from policies table
├── admin/
│   ├── page.tsx                Admin login gate
│   ├── dashboard/              Stats overview
│   ├── products/               Product management + Printify sync
│   ├── orders/                 Order management
│   ├── categories/             Category management
│   ├── settings/               Brand/store settings
│   ├── seo/                    SEO settings
│   ├── shipping/               Shipping settings
│   ├── email/                  Email templates
│   ├── mailerlite/             Newsletter integration
│   ├── media/                  Image uploads
│   ├── policies/               Legal page editor
│   └── stripe/                 Stripe connection status
└── api/
    ├── mailerlite/             Newsletter subscribe endpoint
    ├── resend/                 Email send endpoint
    ├── seo/                    SEO data endpoint
    ├── shipping-diagnostic/    Shipping debug endpoint
    └── stripe-admin/           Stripe admin actions
```
