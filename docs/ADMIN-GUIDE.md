# Admin Guide

The admin panel is at `/admin`. Access requires a Supabase Auth account with a corresponding row in the `admins` table. See [SUPABASE-SETUP.md](./SUPABASE-SETUP.md#authentication) for how to create your first admin account.

---

## Initial Configuration Sequence

When setting up a new store, complete these steps in order:

1. **Settings** — Set your store name, tagline, and logo
2. **SEO** — Set your site URL and meta title suffix
3. **Stripe** — Connect your Stripe test key and verify checkout
4. **Products** — Sync from Printify and configure your catalog
5. **Settings** — Configure homepage content (hero, about, testimonials)
6. **Policies** — Add your Terms of Service, Privacy Policy, and Refund Policy
7. **Stripe** — Switch to live key after testing

---

## Admin Sections

### Dashboard

Overview of recent orders, revenue, and store status.

---

### Products

- View all products synced from Printify
- Edit product title, description, images, price, and category
- Enable **content lock** on a product to prevent sync from overwriting your edits
- Set product flags: featured, new arrival, trending, bestseller, on sale
- Manage product status: active, draft, archived
- **Sync from Printify** — pulls all products from your Printify shop and upserts them to the database

---

### Orders

- View all orders with status, customer email, items, and totals
- Filter by status (pending, paid, cancelled, fulfilled)
- View fulfillment status and tracking information
- Orders are created automatically by the `stripe-checkout` edge function and updated by `stripe-webhook` and `printify-webhook`

---

### Categories

- Create, edit, and delete product categories
- Categories are assigned to products and used for storefront filtering

---

### Settings

Store-wide configuration organized into sections:

| Section | What you configure |
|---|---|
| Brand | Store name, tagline, logo, logo size |
| Hero | Hero image, title, subtitle, image position/scale/fit |
| About / Our Why | About section image and text content |
| Story | Story section image controls |
| Affirmations | Affirmations section content |
| New Arrivals | New arrivals section settings |
| Brand Values | Brand values section content |
| Testimonials | Customer testimonial quotes |
| Promo Banner | Announcement banner (text, CTA, background color, active toggle) |
| Footer | Footer text, bottom message, footer logo |
| Social Links | Instagram, TikTok, Facebook, YouTube, Pinterest, Snapchat, Threads, email |
| Newsletter Popup | Popup settings (active, title, body, delay, image, position) |
| Shipping | Free shipping threshold, default shipping cost |
| Announcement | Top-of-page announcement bar |

The product ships with neutral placeholder defaults (`Your Store`, `your-store.example`, etc.). Replace all of these through the Settings panel.

---

### SEO

- Site URL (used for canonical tags, sitemap, and JSON-LD)
- Default Open Graph image
- Meta title suffix
- Twitter/X handle
- Google Site Verification code
- Toggle sitemap, robots noindex for admin, JSON-LD, canonical tags

---

### Stripe

- View current active mode (test or live)
- Connect a new Stripe key (test or live)
- Switch between test and live mode
- View recent charges, balance, and payouts
- Issue refunds

See [STRIPE-SETUP.md](./STRIPE-SETUP.md) for the full connection walkthrough.

---

### Email (Resend)

- **Send Email** — send a one-off email to any address
- **Broadcast** — send an email to all customers with paid live orders
- **Delivery Events** — view email delivery tracking (requires Resend webhook)

See [EMAIL-SETUP.md](./EMAIL-SETUP.md).

---

### MailerLite

- View account stats (total subscribers, groups, campaigns)
- Manage subscribers (add, edit, unsubscribe, delete)
- Manage groups
- Create and send campaigns
- View automations and forms

See [EMAIL-SETUP.md](./EMAIL-SETUP.md).

---

### Media

Image upload management for store assets.

---

### Policies

Edit the content of your legal pages:
- Terms of Service
- Privacy Policy
- Refund and Returns Policy

These pages are publicly accessible at `/terms-of-service`, `/privacy-policy`, and `/refund-policy`.

---

### Shipping

Configure shipping settings (free shipping threshold, default shipping cost).

---

### Affiliates

Manage your affiliate program:
- View and approve affiliate applications
- Track clicks, conversions, and commissions
- Record payouts

The affiliate program can be enabled or disabled in Settings.

---

### Customers

View customer profiles created from storefront accounts.

---

### Danger Zone

Administrative reset and maintenance operations. Use with caution.
