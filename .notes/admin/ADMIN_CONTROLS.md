# Admin Dashboard Controls

Route prefix: `/admin`  
All pages are protected by `ProtectedAdmin` — requires a valid admin session.

---

## Dashboard `/admin/dashboard`

The home screen. Read-only overview with one interactive control.

| Control | What it does |
|---|---|
| **Stripe mode badge** | Shows LIVE or TEST. Clicking navigates to `/admin/stripe`. Refreshes on tab focus and on `stripe-mode-changed` events. |
| **Pause / Resume Orders** | Toggles `settings.orders_paused`. When paused, customers cannot complete checkout. Button turns red (Pause) or green (Resume). |
| **Stat cards** | Total Revenue, Total Orders, Pending Orders, Total Products — read-only, computed from DB on load. |
| **Recent Orders list** | Last 5 orders. "View All" navigates to `/admin/orders`. |
| **Quick Actions** | Links to Products, Orders, and Settings. |
| **Recent Products** | Last 5 products with image, price, and status badge. |

---

## Orders `/admin/orders`

Full order management table with real-time Supabase subscription.

| Control | What it does |
|---|---|
| **Search** | Filters by customer name, email, or order ID (last 8 chars). |
| **Status filter** | Dropdown: All / pending / paid / fulfilled / partially-fulfilled / shipped / delivered / cancelled. |
| **Mode filter** | Dropdown: Live + Test / Live only / Test only. Filters by `orders.livemode`. |
| **Refresh button** | Re-fetches all orders from Supabase. |
| **Info banner (×)** | Dismissible explainer about the order lifecycle. Dismissed state is local (resets on page reload). |
| **Row click / Eye icon** | Opens the Order Detail Modal for that order. |
| **Delete icon** | Only visible on test orders (`livemode = false`). Permanently deletes the order after confirmation. |

### Order Detail Modal

| Control | What it does |
|---|---|
| **Status dropdown** | Updates `orders.status`. Setting to `cancelled` also attempts to cancel in Printify via the `printify-proxy` edge function. If Printify rejects it, the DB status is NOT changed. |
| **Check Printify button** | Fetches live fulfillment status from Printify for orders with a `printify_order_id`. Displays status, tracking number, and contextual labels. |
| **Sync to Order button** | Appears after a successful Printify check. Writes Printify status, fulfillment status, tracking number, and tracking URL back to the DB. |

---

## Products `/admin/products`

Product catalog management with Printify sync.

| Control | What it does |
|---|---|
| **Search** | Filters product list by title. |
| **Active / Inactive tabs** | Switches between active products and draft/archived/unsynced products. Each tab shows a count badge. |
| **Sync Printify button** | Calls `printify-proxy/sync` edge function. Pulls all products from the connected Printify shop, upserts them into the DB, and revalidates `/` and `/shop`. Reports synced and deleted counts. |
| **Add Product button** | Opens the Product Modal in create mode. |
| **Select all checkbox** | Selects all active products for bulk operations. |
| **Row checkbox** | Selects individual products for bulk operations. |

### Bulk Actions Bar (appears when rows are selected)

| Control | What it does |
|---|---|
| **Category dropdown + Assign** | Sets `category_id` on all selected products. Choose "Uncategorized" to clear. |
| **Flag buttons** (New Arrival, Trending, etc.) | Sets the corresponding boolean flag to `true` on all selected products. |
| **Set Draft** | Sets `status = "draft"` on all selected products, moving them to the Inactive tab. |
| **Clean HTML** | Strips HTML tags and entities from `description` on selected products that contain HTML. Also sets `content_locked = true`. |
| **Clear** | Deselects all. |

### Active Products Table — Per-Row Actions

| Control | What it does |
|---|---|
| **Star icon** | Toggles `products.featured`. Gold = featured. |
| **Draft button** | Sets `status = "draft"` for that product. |
| **Edit (pencil) icon** | Opens the Product Modal in edit mode. |
| **Delete (trash) icon** | Permanently deletes the product after confirmation. |

### Inactive Products Table — Per-Row Actions

| Control | What it does |
|---|---|
| **Activate button** | Sets `status = "active"` for that product. |

### Product Modal (Add / Edit)

| Control | What it does |
|---|---|
| **Title field** | Product name. Emoji picker below inserts emoji at cursor position. |
| **Description textarea** | Product description. Emoji picker below inserts emoji at cursor. "Clean HTML tags" button strips markup inline. |
| **Price / Cost fields** | Retail price and cost of goods. |
| **Image URL field** | Primary image. Thumbnail picker above shows all images from `products.images` array; clicking one sets it as primary. |
| **Category dropdown** | Assigns the product to a category. |
| **Badges checkboxes** | Featured, New Arrival, Trending, Bestseller, On Sale, Personalizable. |
| **Content lock toggle** | When locked, Printify re-syncs will not overwrite title, description, or image. Automatically locks when you edit those fields on a Printify-linked product. |
| **Personalization label** | Visible when "Allow personalization" is checked. Sets the prompt label shown to customers on the product page. |
| **Cancel / Save buttons** | Cancel closes without saving. Save validates title + price, then inserts or updates the product and revalidates `/` and `/shop`. |

---

## Categories `/admin/categories`

Visual category management with gradient controls.

| Control | What it does |
|---|---|
| **Add Category button** | Opens the Category Modal in create mode. |

### Category Card — Per-Card Controls

| Control | What it does |
|---|---|
| **Image icon (top-right)** | Opens the Image Picker Modal to choose a category image. If no image is set, the first active product image in that category is used automatically (shown with an "auto" badge). |
| **Edit icon (top-right)** | Opens the Category Modal to rename the category or change its slug/description. |
| **Delete icon (top-right)** | Deletes the category after confirmation. Products in that category become uncategorized. |
| **Gradient direction buttons** | Bottom→Top / Top→Bottom / Full overlay / No gradient. Controls the CSS gradient applied over the category image. |
| **Opacity slider** | 0–100%. Controls gradient darkness. Disabled when direction is "No gradient". |
| **Save Changes button** | Appears only when gradient settings are dirty. Saves `gradient_dir` and `gradient_opacity` to the DB and revalidates `/` and `/shop`. |

### Image Picker Modal

| Tab | What it does |
|---|---|
| **Products** | Grid of all active product images. Click to select. |
| **Media Library** | Grid of all images in the `store-images` Supabase Storage bucket. Upload button adds new images. |
| **Paste URL** | Text field to enter any public image URL. Preview shown below. |

### Category Modal (Name / Slug / Description)

| Control | What it does |
|---|---|
| **Name field** | Category display name. |
| **Slug field** | URL slug (auto-generated from name if left blank). |
| **Description field** | Optional short description. |
| **Cancel / Create/Save buttons** | Saves to DB and revalidates `/` and `/shop`. |

---

## Media `/admin/media`

File manager for the `store-images` Supabase Storage bucket.

| Control | What it does |
|---|---|
| **Search** | Filters files by filename. |
| **Folder filter** | Dropdown: All folders / uploads / settings/hero / settings/our-why / settings/story / settings/logo. |
| **Grid / List toggle** | Switches between grid view and table view. |
| **Refresh button** | Re-fetches all files from storage. |
| **Upload button** | Opens file picker. Accepts images only. Uploads to `uploads/` folder. |
| **Select all checkbox** (list view) | Selects all visible files. |
| **Row checkbox** (list view) | Selects individual files. |
| **Delete selected** (bulk bar) | Permanently deletes all selected files from storage. |

### Per-File Actions (grid hover / list row)

| Control | What it does |
|---|---|
| **Copy URL icon** | Copies the public URL to clipboard. Shows a checkmark for 2 seconds. |
| **Rename (pencil) icon** | Inline rename. Saves with Enter, cancels with Escape. Non-alphanumeric characters are replaced with `_`. |
| **Delete (trash) icon** | Permanently deletes the file from storage. |

### File Detail Panel (right sidebar, appears on file click)

Shows name, folder, size, MIME type, upload date, and public URL with a copy button. Also has Rename and Delete buttons.

---

## Email `/admin/email`

Transactional and broadcast email via Resend.

### Send Email tab

| Control | What it does |
|---|---|
| **To field** | Comma-separated recipient addresses. |
| **Subject field** | Email subject line. |
| **Body (HTML) textarea** | Raw HTML email body. |
| **Send Email button** | POSTs to `/api/resend`. Shows success/error state. |
| **Recent Sent list** | Last emails sent via Resend API. Refresh button re-fetches. |

### Broadcast tab

| Control | What it does |
|---|---|
| **Customer count badge** | Shows number of unique emails from live paid orders. |
| **Subject / Body fields** | Same as single send. |
| **Send to N customers button** | Sends the email to all live paid customer emails in batches of 10. Requires confirmation. |

### Delivery Events tab

| Control | What it does |
|---|---|
| **Webhook URL display** | Shows the URL to register in Resend dashboard (`/api/resend/webhook`). |
| **Refresh button** | Re-fetches events from `email_events` table. |
| **Events list** | Shows last 50 events with status badges: Sent / Delivered / Opened / Clicked / Bounced / Spam. |

---

## SEO `/admin/seo`

Search engine optimization settings.

### Site Basics section

| Control | What it does |
|---|---|
| **Production URL** | Sets `seo_settings.site_url`. Used in sitemap, canonical URLs, and JSON-LD. No trailing slash. |
| **Meta Title Suffix** | Appended to all page `<title>` tags (e.g. `| Store Name`). |
| **Twitter / X Handle** | Used in `twitter:site` meta tag. |
| **Google Search Console Verification Code** | Injected as a `<meta name="google-site-verification">` tag. |

### Open Graph section

| Control | What it does |
|---|---|
| **Default OG Image URL** | Used on pages without a specific image. Recommended 1200×630px. Preview shown below the field. |

### SEO Features section (toggles)

| Toggle | What it does |
|---|---|
| **Sitemap XML** | Enables/disables `/sitemap.xml` generation. |
| **Robots.txt — Block Admin & Checkout** | Enables/disables `/robots.txt` that disallows `/admin/`, `/checkout/`, and `/api/`. |
| **JSON-LD Product Schema** | Adds structured data to product pages for Google rich snippets. |
| **Canonical URLs** | Adds `<link rel="canonical">` to product pages. |

### Sitemap Inspector section

| Control | What it does |
|---|---|
| **Check Sitemap button** | Fetches active product count from the API and displays total URL count. |
| **View /sitemap.xml link** | Opens the live sitemap in a new tab. |
| **View /robots.txt link** | Opens the live robots.txt in a new tab. |

### Save SEO Settings button

Sticky save bar. POSTs all settings to `/api/seo` and revalidates `/`.

---

## Shipping `/admin/shipping`

Shipping rate diagnostics and fallback configuration.

### Shipping Status section

| Control | What it does |
|---|---|
| **Refresh button** | Re-runs the shipping diagnostic via `/api/shipping-diagnostic`. |
| **Mode banner** | Shows Live Printify Rates / Partial — Mixed Rates / Fallback Rate ($6.99) based on how many products have stored shipping profiles. |
| **Check rows** | Four status indicators: Printify connected, Shop ID configured, Blueprint data coverage, Shipping profiles coverage. |
| **Missing products list** | Lists products without shipping profiles when in partial/fallback mode. |

### Fallback Shipping Rate section

| Control | What it does |
|---|---|
| **Rate input** | Sets `settings.default_shipping_cost`. Used when a product has no Printify shipping profile. |
| **Save button** | Writes the value to the DB. |

---

## Stripe `/admin/stripe`

Stripe account management, charges, and payouts.

### Stripe Setup panel

| Control | What it does |
|---|---|
| **Live / Test status cards** | Shows which keys are configured and which mode is active. "Use live" / "Use test" buttons switch active mode via `/api/stripe-switch`, which restarts the PM2 process and polls until the new mode is confirmed. |
| **Secret key input** | Accepts `sk_live_...` or `sk_test_...`. Shows key type label (Live / Test / Invalid). Toggle eye icon shows/hides the value. |
| **Save Only button** | Stores the key via `/api/stripe-setup` without switching active mode. |
| **Save & Activate button** | Stores the key and immediately switches to that mode. Polls for server restart confirmation. |

### Stripe Dashboard

| Control | What it does |
|---|---|
| **Active mode banner** | Shows current mode (LIVE / TEST) with a description. |
| **Open Stripe Dashboard link** | External link to `dashboard.stripe.com`. |
| **Refresh button** | Re-fetches balance, charges, and payouts from Stripe. |
| **Balance cards** | Available Balance, Pending Balance, Volume (last 20), Refunded (last 20). Read-only. |
| **Charge search** | Filters by order number, customer name, or email. |
| **Charge status filter** | All / Succeeded / Pending / Failed / Refunded. |
| **Receipt link** | Opens Stripe-hosted receipt in a new tab. |
| **Refund button** | Opens the Refund Modal for succeeded, non-refunded charges. |

### Refund Modal

| Control | What it does |
|---|---|
| **Partial refund checkbox** | Enables the amount field for a partial refund. |
| **Amount field** | Dollar amount to refund (max = refundable amount). |
| **Confirm Refund button** | POSTs to `/api/stripe-admin` with `action: "refund"`. |

---

## Affiliates `/admin/affiliates`

Affiliate program management.

| Control | What it does |
|---|---|
| **Program toggle** | Enables or disables the affiliate program. When disabled, `/affiliates/signup` returns 404. Writes to `settings.affiliate_program_enabled`. |
| **Pending applications banner** | Shows count of affiliates with `status = "pending"`. |
| **Search** | Filters by name, email, or affiliate code. |
| **Status filter** | All / pending / active / suspended / rejected. |
| **Refresh button** | Re-fetches affiliates from DB. |
| **Row click / expand** | Expands the affiliate row to show details, actions, notes, and conversions. |

### Expanded Affiliate Row

| Control | What it does |
|---|---|
| **Approve button** | Sets `status = "active"` and triggers an approval email via `/api/affiliates`. |
| **Reject button** | Sets `status = "rejected"`. |
| **Suspend button** | Sets `status = "suspended"` (only shown for active affiliates). |
| **Reactivate button** | Sets `status = "active"` (only shown for suspended affiliates). |
| **Admin Notes textarea** | Internal notes field. Not visible to the affiliate. |
| **Save Notes button** | Writes notes to `affiliates.notes`. |
| **Conversions table** | Shows all conversions for that affiliate with date, order subtotal, commission amount, and status. Displays total earned at the bottom. |

---

## Affiliate Payouts `/admin/affiliates/payouts`

Commission payout processing.

| Control | What it does |
|---|---|
| **Run Approval button** | Auto-approves all `pending` conversions older than 14 days (past the refund window). Updates `status = "approved"` and sets `approved_at`. |
| **Refresh button** | Re-fetches the payout queue and history. |

### Payout Queue

Shows affiliates with ≥ $99 in approved commissions.

| Control | What it does |
|---|---|
| **Memo input** | Optional Stripe transfer ID or internal memo. |
| **Stripe Connect account input** | Optional `acct_xxx` ID for Stripe Connect transfers. |
| **Mark Paid button** | Creates a record in `affiliate_payouts`, links the conversions to it, then calls `/api/affiliates` with `action: "payout"` to trigger a Stripe transfer and notification email. |

### Payout History

Read-only table of all past payouts: affiliate name/code, period, amount, payout method, memo, and paid date.

---

## MailerLite `/admin/mailerlite`

Email list management via MailerLite API.

### Stat Cards (read-only)

Total Subscribers, Active (current page), Groups, Campaigns, Automations.

### Subscribers tab

| Control | What it does |
|---|---|
| **Search field** | Searches by email. Press Enter to fetch. |
| **Status filter** | All / active / unsubscribed / bounced / junk. |
| **Add button** | Opens Add Subscriber Modal. |
| **Edit icon** | Opens Edit Subscriber Modal. |
| **Unsubscribe icon** | Sets subscriber status to `unsubscribed` via MailerLite API. |
| **Delete icon** | Permanently deletes subscriber from MailerLite. |
| **Pagination arrows** | Navigates pages using MailerLite cursor-based pagination (25 per page). |

### Groups tab

| Control | What it does |
|---|---|
| **New Group button** | Opens Group Modal in create mode. |
| **Edit icon** | Opens Group Modal in rename mode. |
| **Delete icon** | Deletes the group from MailerLite. |

### Campaigns tab

| Control | What it does |
|---|---|
| **New Campaign button** | Opens Create Campaign Modal. |
| **Campaign table** | Read-only: name, status, sent count, open rate, click rate, unsubscribes, created date. |

### Automations tab

Read-only list of automations with enabled/disabled status.

### Forms tab

Read-only list of forms with type and conversion count.

### Modals

| Modal | Key controls |
|---|---|
| **Add Subscriber** | Email (required), Name, Group assignment. |
| **Edit Subscriber** | Name, Status dropdown (active / unsubscribed / bounced / junk). |
| **Create Campaign** | Name, Subject, From Name, From Email (must be a verified domain), Send To Group, HTML body, Send Now checkbox (uncheck to save as draft). |
| **Group Modal** | Group name. Creates or renames a group. |

---

## Settings `/admin/settings`

Redirects to `/admin/settings/store-information`. Each section is a separate route under `/admin/settings/[section]`.

### Store Information

Store name, contact email, phone, address, currency, timezone.

### Branding

Logo upload, favicon, primary/accent colors, font choices.

### Homepage Hero

Hero image, headline, subheadline, CTA button text and link. Gradient direction and opacity controls.

### Announcements / Promo Banner

Banner text, background color, text color, enable/disable toggle.

### Our Why

Section headline, body text, image.

### Wear Your Story

Section headline, body text, image.

### About

About page headline, body text, image.

### Brand Values

Values list (label + icon), background color, accent color, column count, divider style, padding, animation toggle.

### New Arrivals

Section headline, subtitle, product count to display, enable/disable toggle.

### Customer Love

Testimonials list (name, quote, rating), section headline.

### Newsletter Popup

Popup headline, body text, button label, delay (seconds), enable/disable toggle, MailerLite group to subscribe to.

### Social

Links for Instagram, TikTok, Facebook, Twitter/X, Pinterest, YouTube.

### Footer

Footer tagline, copyright text, column links.

### Admin Menu

Reorder and show/hide items in the admin sidebar navigation.

### Integrations

Printify Shop ID, Printify API key, MailerLite API key, Resend API key, Resend webhook signing secret.

---

## Policies `/admin/policies`

Rich-text editor for the three store policy pages.

| Control | What it does |
|---|---|
| **Formatting toolbar** | Bold, Italic, Underline, H2, H3, Bullet list, Numbered list, Insert link. Uses `document.execCommand`. |
| **Preview / Edit toggle** | Switches between the rich-text editor and a rendered HTML preview. |
| **Lock / Unlock button** | Locks the policy to prevent accidental edits. Locked policies cannot be saved. |
| **Push Update button** | Upserts the policy content to the `policies` table and revalidates the corresponding public page (`/terms-of-service`, `/privacy-policy`, `/refund-policy`). Disabled when locked or no unsaved changes. |
| **View live page icon** | Opens the public policy page in a new tab. |

Policies: Terms of Service, Privacy Policy, Refund and Returns Policy.

---

## Danger Zone `/admin/danger`

Irreversible data reset operations.

### Soft Reset

Clears orders, products, email events, and resets Printify/Stripe connection flags. Preserves settings, categories, SEO settings, policies, and admin accounts.

### Full Reset — New Store

Wipes orders, products, email events, categories (re-seeded with defaults), policies content, all settings and branding, and SEO settings. Admin accounts are preserved.

### Confirmation flow (both resets)

1. Type the exact confirmation string (`SOFT RESET` or `FULL RESET`) into the input field.
2. Click the reset button — a second confirmation modal appears listing everything that will be deleted.
3. Click "Yes, delete everything" to execute via `POST /api/admin/reset`.

There is no undo.
