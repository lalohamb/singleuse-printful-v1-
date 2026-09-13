# Body & Sleeves — Feature Inventory

## Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (TypeScript) |
| Styling | Tailwind CSS (custom gold/secondary palette, kente-bar accent, weave texture) |
| Database / Auth | Supabase (Postgres + RLS + Edge Functions + Storage) |
| Payments | Stripe Checkout (hosted) + Stripe Admin API |
| Fulfillment | Printify (via Supabase Edge Function proxy) |
| Email Marketing | MailerLite |
| Transactional Email | Resend |
| Deployment | Docker + Docker Compose → DigitalOcean Droplet via GitHub Actions |
| Testing | Playwright E2E |

---

## Storefront — Pages & Routes

| Route | Description |
|---|---|
| `/` | Homepage |
| `/shop` | Full product catalog |
| `/product/[id]` | Product detail |
| `/checkout` | Checkout form + order summary |
| `/checkout/success` | Post-payment confirmation |
| `/about` | Brand story (Demetria, founder) |
| `/refund-policy` | 30-day returns policy |
| `/terms-of-service` | Full ToS (13 sections, Illinois law) |

---

## Storefront — Components & UI

### Header
- Sticky with scroll-triggered shadow transition
- Announcement bar (text + active toggle, driven by `settings` table)
- Logo wordmark with gold ampersand
- Desktop nav: All Products + up to 5 dynamic category links + About
- Mobile hamburger → slide-in drawer with full category list + Admin link
- Cart icon with animated item-count badge
- Search icon → navigates to `/shop`

### Footer
- Brand description copy
- Social media icon row — rendered dynamically from `settings.social_links`
  - Platforms: Instagram, TikTok, Facebook, YouTube, Pinterest, Snapchat, Threads, Email
  - Each platform has a custom SVG icon component
  - Icons only render when `enabled: true` and URL is set
- Shop column: All Products, T-Shirts, Hoodies, Hats
- Customer Care column: Refund & Returns, Terms of Service, Privacy Policy, Contact Us
- Our Story column: About Us, Our Mission, The Culture
- Copyright line

### CartDrawer
- Slide-out panel from right, backdrop blur overlay
- Body scroll lock when open
- Item list: thumbnail, title, variant label, quantity stepper (+/−), remove button, line total
- Subtotal display
- Orders-paused guard: replaces checkout button with pause notice when admin has paused orders
- "Proceed to Checkout" → `/checkout`
- "Continue Shopping" (closes drawer or navigates to `/shop` from checkout page)
- Empty state with CTA to shop

### ProductCard
- 3:4 aspect ratio image with hover scale
- Lazy-loaded image
- Badge chips driven by `ACTIVE_FLAGS` (Featured, New, Trending — extensible)
- Title, description excerpt, price, "View Details" hover text

### Reveal
- Scroll-triggered fade/slide-in animation via IntersectionObserver
- Respects `prefers-reduced-motion`
- Configurable delay prop

### ImageUpload (admin component)
- URL text input + "Library" picker button + "Upload" button
- Upload: validates image type, enforces 5MB limit, uploads to Supabase Storage bucket `store-images`
- Library picker modal: grid of all images across all folders, search, upload-new button inside modal
- Selected image highlighted with gold border + checkmark
- Optional inline preview
- Clear button

### StorefrontLayout
- Wraps Header + main + Footer + CartDrawer

### AdminLayout
- Fixed sidebar (dark) with logo, nav items, "View Store" external link
- Nav items: Dashboard, Products, Categories, Orders, Email, Stripe, MailerLite, SEO, Shipping, Media, Settings
- Admin avatar (first letter of email) + email + role display
- Sign Out button
- Mobile: hamburger toggle + backdrop overlay
- Active route highlighted

### ProtectedAdmin
- Wraps every admin page
- Checks Supabase session + `admins` table row
- Redirects to `/admin` if unauthenticated
- Renders AdminLayout around children

---

## Storefront — Homepage (`/`)

- ISR revalidation every 60 seconds
- Parallel data fetches: settings, featured products, new arrivals, trending products, categories, category representative images
- **Announcement bar** — from `settings.announcement` / `settings.announcement_active`
- **Hero section**
  - Configurable height (vh), image, position (X/Y px), zoom %, flip, gradient direction (left/right/center/top/bottom/full/none), gradient opacity, fit (cover/contain)
  - Title, subtitle, tagline from `settings`
  - "Shop Collection" + "Our Story" CTAs
- **Value props band** — Made to Order, Black-Owned, Size Inclusive, Culture First
- **Affirmations marquee** — rotating ticker with 5 brand phrases + gold dividers
- **Shop by Category grid** — full-width scrollable row, each tile shows representative product image, category name, "Shop now →" hover reveal, kente-bar accent, links to `/shop?category=slug`
- **New Arrivals editorial carousel** — full-bleed dark section, blurred background image, drop number indicator, prev/next buttons, dot navigation, product image + title + price + "Shop Now" CTA
- **Brand Values band** — 100% Black-Owned, 0 Waste Made to Order, XS–5XL Size Inclusive
- **Featured Picks grid** — up to 8 products, randomized each ISR cycle
- **"Our Why" split panel** — dark left panel with brand quote + "Read Our Story" CTA; right panel with configurable image + position
- **Social proof / reviews** — 3 static customer quote cards with 5-star ratings
- **"Wear Your Story" CTA banner** — full-width with configurable background image
- **Trending Now marquee** — auto-scrolling, pause-on-hover, numbered rank overlays, links to product pages

---

## Storefront — Shop (`/shop`)

- ISR revalidation every 60 seconds
- URL-driven category filter via `?category=slug`
- Sidebar category list (all categories from DB)
- Collections filter: New Arrivals, Trending
- Sort: Featured, New Arrivals, Trending, Newest, Price Low→High, Price High→Low
- Product count display
- Mobile collapsible filter panel (toggle button)
- 2-col mobile / 3-col desktop product grid
- Empty state message

---

## Storefront — Product Detail (`/product/[id]`)

- `generateMetadata` per product: title, description, OG image, canonical URL (toggle)
- JSON-LD Product schema (toggle): name, description, image, price, availability, brand
- Google Search Console verification meta tag (from SEO settings)
- Twitter card meta tag (from SEO settings)
- Multi-image gallery with thumbnail row switcher
- Color picker: image-based swatches when variant images exist, text buttons as fallback; hidden when only one non-"Default" color
- Size/style selector filtered by selected color
- Quantity stepper (min 1)
- Add to Cart with 2s "Added" confirmation state
- "Featured" gold badge
- Trust badges: free shipping threshold, print-on-demand notice, quality guarantee
- Related products grid (4 items)
- Back navigation button

---

## Storefront — Cart

- Persisted to `localStorage` under key `bodyandsleeves_cart`
- Hydrated on mount (survives page refresh / navigation)
- State managed via React Context + `useReducer`
- Actions: ADD (merges quantity if same product+variant), REMOVE, UPDATE_QTY (removes at 0), CLEAR, OPEN, CLOSE, TOGGLE, HYDRATE
- `itemCount` and `subtotal` derived values exposed via context

---

## Storefront — Checkout (`/checkout`)

- Contact info: email
- Shipping address: first name, last name, line1, line2 (optional), city, state, ZIP, country
- Country options: US, CA, GB, AU
- Real-time shipping cost via `getShippingQuote()` (debounced 400ms on country change)
  - Reads stored `shipping_info.profiles` from Supabase products table
  - Matches country → first item cost + additional items cost per product
  - Falls back to $6.99 flat if no profiles stored
- Free shipping threshold support
- Sticky order summary sidebar: item images, variant labels, quantities, subtotal, shipping (with loading spinner), total
- Stripe Checkout session created via Supabase Edge Function `stripe-checkout`
- Cart cleared before redirect to Stripe
- Error display on failure
- Orders-paused guard (checked on cart drawer open)

---

## Storefront — Post-Checkout (`/checkout/success`)

- Polls Supabase `orders` table by `session_id` query param
- Displays: order ID (last 8 chars uppercased), total, item count, ship-to name
- Confirmation email notice
- Links to shop and home

---

## Storefront — Static Pages

### About (`/about`)
- Hero split: dark panel with founder quote + founder photo (`/deeandlalo1.png`)
- Founder story (Demetria) — full narrative copy
- Sticky product image panel on desktop
- "What We Stand For" cards: Black Culture, Faith, Family, Freedom, Excellence
- Connect section: email link + Instagram link + Shop CTA

### Refund Policy (`/refund-policy`)
- Full 30-day returns policy
- Sections: Overview, Refunds, Late/Missing Refunds, Sale Items, Exchanges, Gifts, Shipping Returns, Contact

### Terms of Service (`/terms-of-service`)
- 13 sections: General, Products, Pricing, Orders & Payment, Production & Shipping, Returns & Refunds, Intellectual Property, User Conduct, Disclaimer of Warranties, Limitation of Liability, Governing Law (Illinois), Changes, Contact

---

## Platform Integrations

### Printify (Supabase Edge Function: `printify-proxy`)

**Product Sync (`POST /sync`)**
- Paginates through all Printify shop products (50/page)
- Per product: fetches full detail, maps enabled variants with color/size labels
- Resolves color → image mapping (single-color variant images only)
- Fetches static shipping profile per blueprint/print_provider from Printify catalog API
- Stores: title, description, images, variants (id, label, color, size, price, image_url), price, cost, blueprint_id, print_provider_id, shipping_info, status
- Content-lock: skips title/description/image_url for rows where `content_locked = true`
- Upserts on `printify_product_id` conflict
- Updates `settings.printify_connected = true` and `printify_shop_id` after sync

**Proxy Endpoints**
- `GET /shops` — list connected Printify shops
- `GET /products` — paginated product list
- `GET /products/:id` — single product detail
- `POST /products` — create product in Printify
- `PUT /products/:id` — update product
- `DELETE /products/:id` — delete product
- `POST /orders` — submit order to Printify for fulfillment
- `GET /orders/:id` — get Printify order status
- `GET /shipping` — shipping options
- `POST /shipping` — shipping calculation for address + items
- `GET /blueprints` — list catalog blueprints
- `GET /blueprints/:id/providers` — print providers for blueprint
- `GET /blueprints/:id/providers/:pid/variants` — variant list
- `GET /blueprints/:id/providers/:pid/shipping` — shipping profiles

### Stripe

**Checkout Flow (Supabase Edge Function: `stripe-checkout`)**
- Receives cart items, shipping address, email, shipping cost, subtotal, total
- Creates Stripe Checkout Session with line items (product name includes variant label, image attached)
- Shipping added as separate line item when > $0
- `success_url` → `/checkout/success?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url` → `/checkout/cancel`
- Session metadata: email, shipping_name, shipping_address, shipping_cost, subtotal, total, items (JSON)
- Collects shipping address + phone number on Stripe side
- Allowed countries: US, CA, GB, AU
- Creates pending order in Supabase `orders` table immediately

**Webhook (Supabase Edge Function: `stripe-webhook`)**
- Verifies Stripe signature (when `STRIPE_WEBHOOK_SECRET` set)
- `checkout.session.completed`: updates order status → "paid", stores `stripe_payment_intent_id`
- Sends order confirmation email via Resend (HTML template with item list + total)
- Forwards order to Printify: maps items to `line_items` with `printify_id` + `variant_id`, builds `address_to` from metadata, stores returned `printify_order_id` + `fulfillment_status`
- `payment_intent.payment_failed`: updates order status → "cancelled"

**Admin API Route (`/api/stripe-admin`)**
- `GET ?action=balance` — available + pending balance
- `GET ?action=charges&limit=N` — recent charges with billing details, amounts, refund info, receipt URLs
- `GET ?action=payouts` — recent payouts with arrival dates
- `POST { action: "refund", charge_id, amount? }` — full or partial refund via `stripe.refunds.create`

### MailerLite (API Route: `/api/mailerlite`)

**GET actions**
- `account` — account info
- `stats` — account + groups + campaigns + automations + forms in one call
- `subscribers` — paginated (cursor-based), filterable by email search + status
- `subscriber` — single subscriber by ID
- `groups` — list all groups
- `group_subscribers` — subscribers in a group
- `campaigns` — list campaigns with stats
- `campaign` — single campaign
- `automations` — list automations
- `forms` — list popup forms

**POST actions**
- `add_subscriber` — add with email, name, groups, status=active
- `update_subscriber` — update fields + status
- `delete_subscriber` — hard delete
- `unsubscribe` — set status=unsubscribed
- `create_group` — new group by name
- `rename_group` — update group name
- `delete_group` — remove group
- `create_campaign` — two-step: create campaign with subject/from/HTML/groups, then optionally schedule instantly or save as draft
- `delete_campaign` — remove campaign
- `assign_group` — add subscriber to group
- `remove_from_group` — remove subscriber from group

### Resend (API Route: `/api/resend`)
- `POST` — send email: from, to (array), subject, HTML body
- `GET ?path=/emails` — list recent sent emails
- `GET ?path=/domains` — list verified domains (used for connection status check)
- Also called server-side from `stripe-webhook` Edge Function for order confirmation emails

### Supabase Storage
- Bucket: `store-images`
- Folders: `uploads/`, `settings/hero`, `settings/our-why`, `settings/story`
- Used by: ImageUpload component, Media admin panel, Settings hero/our-why/story image fields
- Public URLs served directly from Supabase CDN

### Social Media (Footer + Settings)
- Platforms managed: Instagram, TikTok, Facebook, YouTube, Pinterest, Snapchat, Threads, Email
- Each has: URL field + enabled toggle
- Stored as JSONB in `settings.social_links`
- Footer reads live from DB (server component, no cache)
- Custom SVG icon per platform (no icon library dependency)
- Disabled platforms are hidden from footer entirely
- Admin Settings → Social Media section: per-platform toggle switch + URL input + preview link

---

## Admin Panel (`/admin/*`)

All routes protected by `ProtectedAdmin` (Supabase auth session + `admins` table row check).

### Auth (`/admin`)
- Email + password sign-in via Supabase Auth
- Error display on failure
- Redirects to `/admin/dashboard` on success

### Dashboard (`/admin/dashboard`)
- Stat cards: Total Revenue (paid/fulfilled/shipped/delivered orders), Total Orders, Pending Orders, Total Products
- Orders pause/resume toggle — sets `settings.orders_paused`; blocks customer checkout when paused
- Recent orders list (last 5): order ID, customer name/email, status icon, total
- Recent products list (last 5): thumbnail, title, price, status badge
- Quick action links: Manage Products, View Orders, Store Settings

### Products (`/admin/products`)
- Active / Inactive & Unsynced tab switcher with live counts
- Search by title (client-side filter)
- Sync from Printify button → calls `printify-proxy/sync` Edge Function, shows synced count or error
- **Active tab:**
  - Checkbox multi-select with select-all
  - Bulk toolbar: assign category dropdown, set flag buttons (New Arrival, Trending), change status, clear selection
  - Table columns: checkbox, thumbnail + title + Printify ID, category, price, status badge, flags badges, featured star toggle, edit, delete
  - Content-locked indicator (lock icon on title)
- **Inactive/Unsynced tab:**
  - Status badge (draft/archived)
  - Printify ID, blueprint data check (✓/⚠), shipping profile check (✓/⚠)
  - One-click Activate button
- **Add/Edit Product modal:**
  - Title, description (+ "Clean HTML tags" utility strips HTML entities)
  - Price + Cost fields
  - Image picker: grid of existing product images (click to select) + URL input
  - Category dropdown
  - Badge checkboxes: Featured, New Arrival, Trending, Bestseller, On Sale (Bestseller + On Sale defined but `enabled: false` — flip one line to activate)
  - Content-lock warning with unlock button (auto-locks when title/description/image edited on a synced product)

### Orders (`/admin/orders`)
- Table: order ID, customer name/email, date, total, status badge
- Search by name, email, or order ID
- Status filter dropdown: all, pending, paid, fulfilled, shipped, delivered, cancelled
- **Order detail modal:**
  - Status dropdown (updates in-place via Supabase)
  - Customer info + full shipping address
  - Itemized lines: thumbnail, title, variant label, quantity, line total
  - Subtotal / shipping / total breakdown
  - Fulfillment panel (shown when data exists): Printify order ID, fulfillment status, tracking number, tracking URL link

### Categories (`/admin/categories`)
- Grid of category cards: name, slug, description
- Add / Edit / Delete
- Auto-slug generation from name (lowercase, hyphens)
- Delete warning: products become uncategorized

### Settings (`/admin/settings`)
- **Store Information:** store name, tagline
- **Homepage Hero:** title, subtitle, image URL
  - Product image picker modal (search active products, click to use image)
  - Live preview with X/Y position sliders (−1000 to +1000px), height slider (30–100vh), zoom slider (10–100%), overlay opacity slider (0–100%), gradient direction buttons (left/right/center/top/bottom/full/none), fit toggle (cover/contain), flip toggle, reset button
- **"Wear Your Story" Section:** background image URL via ImageUpload
- **"Our Why" Section:** image URL via ImageUpload, X/Y position sliders, height slider (200–800px), live preview
- **Announcement Bar:** text input, active toggle
- **Integrations panel:**
  - Printify: connected status badge (from DB), Shop ID input field
  - Stripe: live API check on page load → Connected / Account Issue / Not Connected / Checking
  - MailerLite: live API check on page load
  - Resend: live API check on page load
  - Connection status guide (what each badge means)
  - Key management instructions with links to each platform's dashboard
- **Social Media:**
  - Per-platform toggle switch + URL input + external preview link
  - Platforms: Instagram, TikTok, Facebook, YouTube, Pinterest, Snapchat, Threads, Email
  - Saved separately from main settings (own Save button)

### SEO (`/admin/seo`)
- Overview status cards: Sitemap, Robots.txt, JSON-LD, Canonical URLs (active/disabled)
- **Site Basics:** production URL, meta title suffix, Twitter/X handle, Google Search Console verification code
- **Open Graph:** default OG image URL with live preview (used on pages without a product image)
- **Feature toggles:**
  - Sitemap XML — generates `/sitemap.xml` with all active products + 5 static pages
  - Robots.txt — blocks `/admin/`, `/checkout/`, `/api/`
  - JSON-LD Product Schema — rich snippets on product pages
  - Canonical URLs — prevents duplicate content penalties
- **Sitemap Inspector:** check product count in sitemap, links to `/sitemap.xml` and `/robots.txt`
- **Google Search Console guide:** step-by-step verification + sitemap submission

### Shipping (`/admin/shipping`)
- Live diagnostic on load: mode badge (Live Printify Rates / Partial — Mixed Rates / Fallback $6.99)
- Check rows: Printify connected, Shop ID configured, blueprint data coverage (N/total), shipping profiles coverage (N/total)
- List of products missing shipping profiles
- Sample US rate display (from first product with profiles)
- How-it-works explainer: sync → country lookup → rate calculation formula
- Printify shipping configuration guide with direct links
- Fallback note: $6.99 per item when no profile stored

### Stripe (`/admin/stripe`)
- Balance cards: Available, Pending, Volume (last 20 charges), Refunded (last 20)
- Recent charges table: customer name/email, amount, refunded amount, status badge, date, receipt link
- Refund modal: shows charge details, full or partial refund option, amount input, confirm button
- Recent payouts list: amount, arrival date, status badge
- Link to Stripe Dashboard

### Email (`/admin/email`)
- Send email form via Resend: to (comma-separated), subject, HTML body textarea
- Recent sent emails list: subject, recipients, date (pulled from Resend API)

### MailerLite (`/admin/mailerlite`)
- Account name + email display
- Stat cards: Total Subscribers, Active (current page), Groups, Campaigns, Automations
- Tabs: Subscribers, Groups, Campaigns, Automations, Forms
- **Subscribers tab:** table with email, name, status badge, join date; edit, unsubscribe, delete actions; search by email; filter by status; cursor-based pagination (25/page); Add Subscriber button
- **Groups tab:** list with name + active subscriber count; create, rename, delete
- **Campaigns tab:** table with name, status, sent count, open rate %, click rate %, unsubscribes, created date; Create Campaign button
- **Automations tab:** list with name, step count, enabled/disabled badge
- **Forms tab:** list with name, type, conversions count
- **Modals:** Add Subscriber, Edit Subscriber (name + status), Create Campaign (name/subject/from/HTML/group/send-now toggle), Create/Rename Group
- Refresh button, link to MailerLite dashboard

### Media (`/admin/media`)
- Grid view and list view toggle
- Upload images (multi-file, images only) to `store-images` bucket → `uploads/` folder
- Folder filter: uploads, settings/hero, settings/our-why, settings/story
- Search by filename
- Bulk select (checkboxes, select-all) + bulk delete
- Per-file actions: copy public URL (clipboard), rename (inline edit, Enter to save, Escape to cancel), delete
- File detail panel (sticky sidebar): preview, name, folder, size, MIME type, upload date, public URL copy
- File count + bucket name display

---

## Database Schema (Supabase / Postgres)

| Table | Key Columns |
|---|---|
| `admins` | id (auth.uid), email, role (admin/super_admin) |
| `categories` | id, name (unique), slug (unique), description |
| `products` | id, printify_id (unique), title, description, category_id (FK), price, cost, image_url, images (jsonb), status, featured, is_new_arrival, is_trending, is_bestseller, is_on_sale, content_locked, blueprint_id, print_provider_id, variants (jsonb), shipping_info (jsonb) |
| `orders` | id, stripe_session_id, stripe_payment_intent_id, printify_order_id, email, shipping_name, shipping_address (jsonb), shipping_cost, subtotal, total, currency, status, fulfillment_status, tracking_number, tracking_url, items (jsonb) |
| `settings` | id (single row), store_name, tagline, hero_title, hero_subtitle, hero_image_url, hero_object_position, hero_height_vh, hero_image_flip, hero_image_scale, hero_gradient_opacity, hero_gradient_dir, hero_image_fit, our_why_image_url, our_why_object_position, our_why_height_vh, story_image_url, announcement, announcement_active, orders_paused, shipping_free_threshold, default_shipping_cost, printify_connected, printify_shop_id, stripe_connected, social_links (jsonb) |
| `seo_settings` | id (single row), site_url, default_og_image, sitemap_enabled, robots_noindex_admin, jsonld_enabled, canonical_enabled, meta_title_suffix, twitter_handle, google_site_verification |

**RLS policies:**
- `anon` + `authenticated`: SELECT on categories, products, settings, seo_settings; INSERT on orders
- `authenticated` admin (checked via `admins` table): full CRUD on all tables
- `admins` table: users can read own row; super_admin can insert/delete

**Indexes:** category, status, featured, is_new_arrival, is_trending, is_bestseller, is_on_sale (partial), orders by status/email/created_at

---

## SEO & Technical

- `src/app/layout.tsx` — root metadata: default title template, description, OG site name, Twitter card, Google verification tag (all from `seo_settings`)
- `src/app/sitemap.ts` — dynamic XML sitemap, ISR 1hr, respects `sitemap_enabled` toggle; static routes (/, /shop, /about, /refund-policy, /terms-of-service) + all active product URLs with `updated_at`
- `src/app/robots.ts` — dynamic robots.txt, ISR 1hr; disallows /admin/, /checkout/, /api/; includes sitemap URL
- Per-product `generateMetadata`: title, description, OG image, canonical URL
- Per-product JSON-LD Product schema injected via `<Script strategy="beforeInteractive">`

---

## Product Flag System (`src/lib/productFlags.ts`)

Single source of truth for all curation badges. Each `FlagDef` has:
- `key` — boolean column on `products` table
- `label` — admin checkbox/button text
- `badge` — storefront chip text
- `badgeClass` — Tailwind classes
- `enabled` — whether it surfaces in UI

| Flag | Badge | Status |
|---|---|---|
| `featured` | Featured (gold) | Active |
| `is_new_arrival` | New (blue) | Active |
| `is_trending` | Trending (dark) | Active |
| `is_bestseller` | Best Seller (green) | Defined, disabled |
| `is_on_sale` | Sale (red) | Defined, disabled |

Adding a new badge = one line in this file + one DB column. Admin editor, bulk toolbar, product list, and ProductCard all iterate `ACTIVE_FLAGS` automatically.

---

## API Routes (Next.js)

| Route | Methods | Purpose |
|---|---|---|
| `/api/mailerlite` | GET, POST | MailerLite full proxy (subscribers, groups, campaigns, automations, forms) |
| `/api/resend` | GET, POST | Resend proxy (send email, list emails, list domains) |
| `/api/seo` | GET, POST | Read/write `seo_settings` table; `?action=sitemap_products` returns active product IDs |
| `/api/shipping-diagnostic` | GET | Printify connection + shipping profile coverage diagnostic |
| `/api/stripe-admin` | GET, POST | Stripe balance, charges, payouts, refunds |
| `/api/health` | GET | Health check endpoint |

---

## Supabase Edge Functions

| Function | Trigger | Purpose |
|---|---|---|
| `printify-proxy` | HTTP (admin + webhook) | Full Printify API proxy + product sync with content-lock logic |
| `stripe-checkout` | HTTP (checkout page) | Create Stripe session, insert pending order |
| `stripe-webhook` | Stripe webhook POST | Verify signature, update order to paid, send confirmation email via Resend, forward to Printify |

---

## Infrastructure & DevOps

- `Dockerfile` — multi-stage (deps → builder → runner), `output: standalone`
- `docker-compose.yml` — single `web` service, `env_file: .env.local`, `restart: unless-stopped`
- `.dockerignore` — excludes node_modules, .next, .env*.local, .git
- `next.config.mjs` — `output: 'standalone'`
- `scripts/deploy.sh` + `deploy.cmd` — deployment scripts
- `scripts/setup-droplet.sh` — DigitalOcean droplet provisioning
- GitHub Actions CI/CD → DigitalOcean Droplet
- Supabase migrations (7 files): initial schema, brand settings, printify_shop_id, RLS fix, curation flags + content_lock, SEO settings, social links

---

## E2E Tests (Playwright)

### `storefront.spec.ts`
- Homepage loads with hero and navigation
- Shop page displays products
- Shop category filter updates URL
- Product detail page loads with Add to Cart button
- Cart drawer opens
- Add to cart updates header badge
- About page loads
- Mobile menu opens and navigates to shop

### `checkout.spec.ts`
- Checkout flow (cart → form → Stripe redirect)

### `admin.spec.ts`
- Login page loads
- Invalid login shows error
- Dashboard: 4 stat cards, quick action links
- Products: active/inactive tabs, Sync Printify button, sync message, Add Product modal, create manual product, search filter
- Orders: status filter, order detail modal
- Settings: Printify Shop ID field, integration status badges, social media section, save settings, save social links
- Auth: sign out works
