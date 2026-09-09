# Body & Sleeves — Admin User Instructions

> **Access:** `/admin` — requires an authorized admin account. All pages are protected and redirect to login if unauthenticated.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Dashboard](#2-dashboard)
3. [Products](#3-products)
4. [Orders](#4-orders)
5. [Categories](#5-categories)
6. [Media Library](#6-media-library)
7. [Settings](#7-settings)
8. [Policies](#8-policies)
9. [SEO](#9-seo)
10. [Shipping](#10-shipping)
11. [Email (Resend)](#11-email-resend)
12. [MailerLite](#12-mailerlite)
13. [Database Migrations](#13-database-migrations)
14. [Environment Variables](#14-environment-variables)

---

## 1. Logging In

Navigate to `/admin`. You will be prompted for your admin email and password. Credentials are managed in Supabase under the `admins` table. Only rows in that table with a matching email are granted access.

If you are locked out, add your email directly in the Supabase dashboard under `Table Editor → admins`.

---

## 2. Dashboard

**Path:** `/admin/dashboard`

The dashboard gives you a live snapshot of the store.

### Stat Cards
| Card | What it shows |
|---|---|
| Total Revenue | Sum of all paid, fulfilled, shipped, and delivered orders |
| Total Orders | Count of all orders (last 5 shown) |
| Pending Orders | Orders with status `pending` |
| Total Products | All products in the database |

### Order Pause Toggle
A banner at the top of the dashboard shows whether orders are currently **open** or **paused**.

- **Pause Orders** — customers will be blocked from completing checkout until you resume. Use this during inventory issues, site maintenance, or holiday closures.
- **Resume Orders** — re-opens checkout immediately.

The toggle writes directly to the `settings` table (`orders_paused` field) and takes effect on the next page load for customers.

### Recent Orders
Shows the 5 most recent orders with customer name, email, total, and status. Click **View All** to go to the full Orders page.

### Quick Actions
Shortcuts to Products, Orders, and Settings.

---

## 3. Products

**Path:** `/admin/products`

### Tabs
- **Active** — products with `status = active` that are visible to customers.
- **Inactive & Unsynced** — products with `status = draft` or `archived`, or products synced from Printify that have not been activated yet.

### Syncing from Printify
Click **Sync Printify** to pull all products from your connected Printify shop. The sync:
- Creates new product records for any Printify products not yet in the database.
- Updates title, description, images, variants, blueprint ID, print provider ID, and shipping profiles for products that are **not content-locked**.
- Requires `PRINTIFY_API_TOKEN` in `.env.local` and a valid Shop ID set in Settings → Integrations.

After a sync, new products appear in the **Inactive** tab. Review them and click **Activate** to make them visible on the storefront.

### Adding a Product Manually
Click **Add Product** to open the product modal. Fill in:
- **Title** — product name shown on the storefront.
- **Description** — supports plain text with line breaks (`whitespace-pre-wrap` rendering). Use the **Clean HTML tags** button to strip any pasted HTML.
- **Price / Cost** — retail price and your cost. Cost is for internal reference only.
- **Image URL** — paste a URL or select from the image thumbnails shown (pulled from existing product images).
- **Category** — assign to a category for shop filtering.
- **Badges** — checkboxes for Featured, New Arrival, Trending, Bestseller, On Sale.

### Editing a Product
Click the pencil icon on any active product row. The same modal opens pre-filled.

> **Content Lock:** If you edit the title, description, or image of a Printify-synced product, it becomes **content-locked** automatically. A locked product's text and image will not be overwritten on future Printify syncs. You can unlock it from the edit modal.

### Product Badges
Badges control which homepage sections a product appears in:

| Badge | Homepage Section |
|---|---|
| Featured | Featured Picks grid |
| New Arrival | New Arrivals carousel |
| Trending | Trending Now carousel |
| Bestseller | Shown with a "Bestseller" label on product cards |
| On Sale | Shown with a "Sale" label on product cards |

### Bulk Actions (Active tab)
Select multiple products using the checkboxes, then:
- **Assign Category** — set a category for all selected products at once.
- **+ [Badge]** — apply a badge flag to all selected products.
- **Set Draft** — move selected products back to inactive/draft status.

### Setting a Product to Draft
Click the **Draft** button on any active product row to hide it from the storefront without deleting it. It moves to the Inactive tab.

### Deleting a Product
Click the trash icon. You will be asked to confirm. Deletion is permanent.

### Size Sorting
On the product detail page, sizes automatically sort in the order: XS → S → M → L → XL → 2XL → 3XL → 4XL → 5XL, with any other sizes sorted alphabetically after.

---

## 4. Orders

**Path:** `/admin/orders`

### Viewing Orders
All orders are listed with order ID, customer name, email, date, total, and status. Use the search bar to filter by name, email, or order ID. Use the status dropdown to filter by a specific status.

### Order Statuses
| Status | Meaning |
|---|---|
| `pending` | Order placed but payment not confirmed |
| `paid` | Payment confirmed via Stripe |
| `fulfilled` | Sent to Printify for production |
| `shipped` | Carrier has picked up the package |
| `delivered` | Package delivered to customer |
| `cancelled` | Order cancelled |

### Order Detail
Click the eye icon to open the order detail panel. From here you can:
- **Change the order status** using the dropdown.
- View customer name, email, and full shipping address.
- See all items ordered with variant, quantity, and line total.
- View subtotal, shipping cost, and order total.
- See Printify fulfillment details, tracking number, and a tracking link if available.

---

## 5. Categories

**Path:** `/admin/categories`

Categories are used to organize products and power the shop filter bar.

### Adding a Category
Click **Add Category**. Enter:
- **Name** — displayed in the shop filter and on product cards.
- **Slug** — URL-safe identifier (auto-generated from name if left blank). Used in shop filter URLs like `/shop?category=t-shirts`.
- **Description** — optional, for internal reference.

### Editing / Deleting
Click the pencil icon to edit or the trash icon to delete. Deleting a category does **not** delete its products — they become uncategorized.

---

## 6. Media Library

**Path:** `/admin/media`

The media library manages all images stored in the Supabase `store-images` bucket.

### Folders
| Folder | Used for |
|---|---|
| `uploads` | General uploads via the Upload button |
| `settings/hero` | Homepage hero images |
| `settings/our-why` | Our Why section images |
| `settings/story` | Wear Your Story section images |

### Uploading Images
Click **Upload** and select one or more image files. Multiple files can be uploaded at once. Images are stored in the `uploads` folder by default.

### Views
Toggle between **Grid** and **List** view using the buttons in the toolbar.

### Copying a URL
Hover over any image in grid view and click the copy icon, or click the copy button in the detail panel. The public URL is copied to your clipboard and can be pasted into any image URL field in Settings.

### Renaming
Hover over an image and click the pencil icon (grid view) or the rename button (list view / detail panel). Type the new name and press Enter or click Save. The file extension is preserved automatically.

### Deleting
Hover over an image and click the trash icon, or use the detail panel. You will be asked to confirm. Deletion is permanent and cannot be undone.

### Bulk Delete
Check multiple images using the checkboxes (hover to reveal in grid view, or use the checkbox column in list view), then click **Delete selected**.

### Detail Panel
Click any image to open the detail panel on the right. It shows the file name, folder, file size, MIME type, upload date, and the full public URL with a copy button.

---

## 7. Settings

**Path:** `/admin/settings`

Settings controls all storefront content and configuration. Changes are saved by clicking **Save Settings** at the bottom of the page. Social links have their own separate **Save Social Links** button.

---

### Store Information

| Field | Description |
|---|---|
| Store Name | Displayed in the browser tab and various storefront headings |
| Tagline | Short brand tagline shown in the footer and about sections |
| Logo | Upload a logo image. Replaces the text logo in the header |
| Logo Size | Slider (20–80px) to control the height of the logo in the header. Live preview shown inline |

---

### Announcement Bar

A thin bar displayed at the very top of every page.

| Field | Description |
|---|---|
| Announcement Text | The message shown in the bar (e.g. "Free shipping on orders over $75!") |
| Show announcement bar | Toggle to show or hide the bar sitewide |

#### Promotional Drop Banner

A separate full-width card that drops down from the top of the homepage. It is dismissible by the user and appears a maximum of **2 times per browser session** (tracked via `sessionStorage`). After 2 views or a manual close, it will not appear again until the user starts a new session.

| Field | Description |
|---|---|
| Active | Toggle to enable or disable the banner |
| Headline | Bold title text shown at the top of the banner |
| Body Text | Supporting text below the headline (e.g. promo code, expiry) |
| CTA Button Label | Text for the call-to-action button |
| CTA URL | Where the button links to (e.g. `/shop`, `/shop?category=hoodies`) |
| Banner Background Color | Color picker for the banner background. A live mini-preview updates as you pick |

---

### Homepage Hero

Controls the full-width hero section at the top of the homepage.

| Field | Description |
|---|---|
| Hero Title | Large headline text |
| Hero Subtitle | Supporting paragraph text below the title |
| Hero Image URL | Upload or paste a URL for the background image |
| Pick from Product Library | Opens a picker to select any active product image |

#### Image Controls (appear after an image is set)

| Control | Description |
|---|---|
| X slider | Horizontal position of the image |
| Height slider (left of preview) | Controls the hero section height in `vh` units (30–100vh) |
| Y slider (right of preview) | Vertical position of the image |
| Zoom | Scales the image (10–100%) |
| Overlay | Opacity of the dark gradient overlay (0–100%) |
| Gradient | Direction of the overlay gradient: Left, Right, Center, Top, Bottom, Full, None |
| Fit | `cover` fills the frame; `contain` fits the whole image inside |
| Flip | Mirrors the image horizontally |
| Reset | Restores all image controls to defaults |

A **live preview** shows exactly how the image will look on the storefront as you adjust controls.

---

### Our Why Section

Controls the full-width "Our Why" section on the homepage.

| Field | Description |
|---|---|
| Label | Small text above the quote (e.g. "Our Why") |
| Quote | Large pull-quote text |
| Body Text | Paragraph body copy below the quote |
| Image URL | Upload or paste a URL for the background image |
| Pick from Product Library | Opens a picker to select any active product image |

Image controls are identical to the Hero section (X/Y position, height, zoom, overlay, gradient, fit, flip, reset) with a live preview.

---

### Wear Your Story Section

Controls the full-width "Wear Your Story" call-to-action section on the homepage.

| Field | Description |
|---|---|
| Background Image URL | Upload or paste a URL for the section background |

Image controls are identical to the Hero section (X/Y position, zoom, overlay, gradient, fit, flip, reset) with a live preview. The zoom slider is displayed vertically on the left side of the preview.

---

### Customer Love

Controls the three testimonial cards in the "What the Culture is Saying" section on the homepage.

Each of the 3 review cards has:

| Field | Description |
|---|---|
| Quote | The customer review text |
| Name | Customer's name (e.g. "Jasmine T.") |
| Location | City and state (e.g. "Atlanta, GA") |
| Product | Product name the customer purchased |

---

### Integrations

| Integration | Description |
|---|---|
| Printify | Shows connection status. Set the **Printify Shop ID** here (found in your Printify dashboard URL). Required for product syncing and shipping rate calculation |
| Stripe | Shows live connection status based on your `STRIPE_SECRET_KEY` |
| MailerLite | Shows live connection status based on your `MAILER_LITE_API_KEY` |
| Resend | Shows live connection status based on your `RESEND_API_KEY` |

**Connection Status Guide:**
- **Connected** — API key is valid and active.
- **Account Issue** — Key found but access denied (suspended or missing permissions).
- **Not Connected** — API key is missing or invalid.
- **Checking…** — Status is being verified on page load.

---

### Social Media

Toggle and update the social links shown in the footer. Each platform has:
- An **on/off toggle** — disabled icons are hidden from visitors.
- A **URL field** — the full link for that platform.
- A **preview link** icon to open the URL in a new tab.

Platforms: Instagram, TikTok, Facebook, YouTube, Pinterest, Snapchat, Threads, Email.

Click **Save Social Links** (separate from the main Save Settings button).

---

## 8. Policies

**Path:** `/admin/policies`

Manage the three legal policy pages. Changes are published live to the public-facing pages immediately on save.

### Policies
- Terms of Service → `/terms-of-service`
- Privacy Policy → `/privacy-policy`
- Refund and Returns Policy → `/refund-policy`

### Controls (per policy)

| Control | Description |
|---|---|
| Textarea | Edit the policy content in plain text. Line breaks are preserved |
| Preview | Toggle between edit mode and a formatted preview of the content |
| Lock / Unlock | Lock a policy to prevent accidental edits. A locked policy cannot be saved until unlocked |
| Push Update | Saves and publishes the content to the live page. Disabled if locked or no unsaved changes |
| Unsaved changes indicator | A blue badge appears when there are edits not yet pushed |
| Last updated | Timestamp of the last successful save |
| External link icon | Opens the live public page in a new tab |

---

## 9. SEO

**Path:** `/admin/seo`

### Site Basics

| Field | Description |
|---|---|
| Production URL | Your live domain (e.g. `https://bodyandsleeves.com`). Used in sitemap, canonical URLs, and JSON-LD. No trailing slash |
| Meta Title Suffix | Appended to all page titles (e.g. `| Body & Sleeves`) |
| Twitter / X Handle | Used in Twitter card meta tags |
| Google Search Console Verification | Paste the content value from Google's HTML meta tag verification method |

### Open Graph / Social Sharing

| Field | Description |
|---|---|
| Default OG Image URL | Image shown when pages are shared on social media. Recommended size: 1200×630px. Product pages use the product image automatically |

### SEO Feature Toggles

| Toggle | Description |
|---|---|
| Sitemap XML | Generates `/sitemap.xml` with all active product pages plus static pages. Submit to Google Search Console |
| Robots.txt — Block Admin & Checkout | Generates `/robots.txt` blocking `/admin/`, `/checkout/`, and `/api/` from crawlers |
| JSON-LD Product Schema | Adds structured data to product pages for Google rich snippets (price, availability, brand) |
| Canonical URLs | Adds canonical `<link>` tags to product pages to prevent duplicate content penalties |

### Sitemap Inspector
Click **Check Sitemap** to see how many product URLs are currently indexed. Use **View /sitemap.xml** and **View /robots.txt** to inspect the live files.

### Submitting to Google Search Console
1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Add property → URL prefix → enter your site URL
3. Choose "HTML tag" verification → copy the content value → paste in the field above → Save SEO Settings
4. Click Verify in Search Console
5. Go to Sitemaps → submit `https://yourdomain.com/sitemap.xml`

---

## 10. Shipping

**Path:** `/admin/shipping`

Shipping rates are managed by Printify and stored locally during product syncs. This page shows the current shipping status and diagnostic information.

### Shipping Modes

| Mode | Meaning |
|---|---|
| Live Printify Rates | All products have stored shipping profiles. Customers see real rates |
| Partial — Mixed Rates | Some products have profiles, others use the $6.99 fallback |
| Fallback Rate ($6.99) | No profiles stored. All items use the flat fallback rate |

### Diagnostic Checks
The page runs 4 checks automatically:
1. **Printify connected** — shop is marked connected in settings.
2. **Shop ID configured** — a Printify Shop ID is set in Settings → Integrations.
3. **Blueprint data** — all products have blueprint and provider IDs (required for rate lookup).
4. **Shipping profiles stored** — all products have Printify shipping rate profiles stored locally.

Any products missing shipping profiles are listed. Fix them by going to **Products → Sync Printify**.

### How Shipping is Calculated at Checkout
1. During a product sync, the shipping rate profile for each product's blueprint and print provider is fetched from Printify's catalog API and stored in the database.
2. At checkout, the customer selects their country.
3. The stored profile for each cart item is looked up and the rate for that country is applied.
4. Cost = first item rate + (quantity − 1) × additional item rate, summed across all products.
5. If a product has no stored profile, a flat **$6.99** fallback is used for that item.

> After changing shipping rates in Printify, run a product sync to pull the updated profiles.

---

## 11. Email (Resend)

**Path:** `/admin/email`

Send transactional emails directly from the admin using the Resend API.

### Sending an Email

| Field | Description |
|---|---|
| To | One or more recipient email addresses, comma-separated |
| Subject | Email subject line |
| Body (HTML) | Email body. Accepts plain text or HTML markup |

Click **Send Email**. A success confirmation appears and the email is logged in the Recent Emails list below.

### Recent Emails
Shows the last emails sent via Resend with subject, recipients, and date. Click the refresh icon to reload the list.

> Requires `RESEND_API_KEY` in `.env.local`. The sending domain must be verified in your Resend account.

---

## 12. MailerLite

**Path:** `/admin/mailerlite`

Full MailerLite account management from within the admin.

### Stat Cards
Total subscribers, active subscribers (current page), groups, campaigns, and automations.

### Tabs

#### Subscribers
- Lists all subscribers with email, name, status, and join date.
- **Search** by email using the search box (press Enter to search).
- **Filter** by status: Active, Unsubscribed, Bounced, Junk.
- **Add Subscriber** — opens a modal to add a new subscriber with optional name and group assignment.
- **Edit** — change a subscriber's name or status.
- **Unsubscribe** — marks the subscriber as unsubscribed without deleting them.
- **Delete** — permanently removes the subscriber.
- **Pagination** — navigate through subscribers 25 at a time using the arrow buttons.

#### Groups
- Lists all subscriber groups with name and active subscriber count.
- **New Group** — create a new group.
- **Rename** — edit a group's name.
- **Delete** — remove a group (subscribers are not deleted).

#### Campaigns
- Lists all campaigns with name, status, sent count, open rate, click rate, unsubscribes, and creation date.
- **New Campaign** — opens a modal to create a campaign with subject, from name/email, HTML body, group targeting, and an option to send immediately or save as draft.

#### Automations
- Lists all automations with name, step count, and enabled/disabled status. Automations are managed in the MailerLite dashboard.

#### Forms
- Lists all signup forms with name, type, and conversion count. Forms are managed in the MailerLite dashboard.

> Requires `MAILER_LITE_API_KEY` in `.env.local`.

---

## 13. Database Migrations

When deploying new features, run the following SQL files in order in the **Supabase SQL Editor** (`supabase.com → your project → SQL Editor`).

| File | What it adds |
|---|---|
| `supabase/migrations/20260903191649_create_ecommerce_schema.sql` | Base schema: products, orders, categories, settings, admins |
| `supabase/migrations/20260903192903_update_brand_settings.sql` | Brand settings fields |
| `supabase/migrations/20260903200000_add_printify_shop_id.sql` | `printify_shop_id` column |
| `supabase/migrations/20260904000000_fix_admins_rls_recursion.sql` | RLS policy fix for admins table |
| `supabase/migrations/20260904120000_add_curation_flags_and_content_lock.sql` | `is_new_arrival`, `is_trending`, `is_bestseller`, `is_on_sale`, `content_locked` |
| `supabase/migrations/20260905000000_add_seo_settings.sql` | SEO settings table |
| `supabase/migrations/20260906000000_add_social_links.sql` | `social_links` JSONB column |
| `supabase/migrations/20260907000000_add_our_why_text.sql` | `our_why_label`, `our_why_quote`, `our_why_body` |
| `supabase/migrations/20260908000000_add_story_image_controls.sql` | `story_*` image control columns |
| `supabase/migrations/20260909000000_add_logo.sql` | `logo_url`, `logo_size` |
| `supabase/migrations/20260910000000_add_policies.sql` | `policies` table with RLS, seeded with 3 rows |
| `supabase/migrations/20260911000000_add_testimonials.sql` | `testimonials` JSONB column |
| `supabase/migrations/20260912000000_add_promo_banner.sql` | `promo_banner_*` columns |

> **Fresh install:** Run `supabase/fresh_install.sql` instead of individual migrations. It creates the full schema in one pass.

---

## 14. Environment Variables

All variables go in `.env.local` at the project root. Never commit this file.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for payment processing |
| `PRINTIFY_API_TOKEN` | Yes | Printify API token for product sync |
| `MAILER_LITE_API_KEY` | Yes | MailerLite API key for email marketing |
| `RESEND_API_KEY` | Yes | Resend API key for transactional email |

### Where to get each key

- **Supabase** — [supabase.com](https://supabase.com) → your project → Settings → API
- **Stripe** — [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
- **Printify** — Printify dashboard → My Profile → Connections → API access
- **MailerLite** — [dashboard.mailerlite.com/integrations/api](https://dashboard.mailerlite.com/integrations/api)
- **Resend** — [resend.com/api-keys](https://resend.com/api-keys) (sending domain must be verified)

---

*Last updated: Body & Sleeves Admin — full feature set as of current build.*
