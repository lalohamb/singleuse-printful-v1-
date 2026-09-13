# Affiliate Program

## Overview

The Affiliate Program allows content creators and influencers to earn a 10% commission on every sale they drive to the store through a unique referral link. It includes a public-facing landing page, an application form, an affiliate dashboard, and a full admin management interface.

---

## User Stories

### As a Content Creator
- I want to apply to the affiliate program so I can earn money promoting products I believe in.
- I want a unique referral link I can share on my social platforms.
- I want to see my clicks, conversions, and earnings in real time from a personal dashboard.
- I want to receive a payout automatically once my balance reaches the threshold.
- I want to be notified by email when I make a sale and when I get paid.

### As a Store Admin
- I want to review affiliate applications and approve or reject them.
- I want to suspend or reactivate affiliates at any time.
- I want to see all conversions per affiliate and leave internal notes.
- I want to approve pending conversions after the refund window closes.
- I want to issue payouts manually or via Stripe Connect and have confirmation emails sent automatically.
- I want to be able to turn the entire affiliate program on or off without deleting any data.

### As a Shopper
- I want my affiliate referral to be remembered for 30 days so the creator gets credit even if I don't buy immediately.

---

## Installation

The affiliate program is built into the application. No separate package installation is required. The only setup steps are:

### 1. Run the Database Migration

Apply the migration that creates the affiliate tables and adds `affiliate_code` to orders:

```
supabase/migrations/20261001000000_add_affiliates.sql
```

Run it via the Supabase SQL editor or Management API:

```sql
-- Creates: affiliates, affiliate_clicks, affiliate_conversions, affiliate_payouts
-- Adds: affiliate_code column to orders table
```

Also apply the toggle migration:

```
supabase/migrations/20261002000000_add_affiliate_program_enabled.sql
```

```sql
ALTER TABLE settings ADD COLUMN IF NOT EXISTS affiliate_program_enabled boolean DEFAULT true;
```

### 2. Environment Variables

Ensure the following are set in `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Used in Edge Functions |
| `RESEND_API_KEY` | Email delivery via Resend |
| `STRIPE_SECRET_KEY` | Stripe payouts (optional) |

### 3. Stripe Connect (Optional)

Stripe Connect is only needed if you want automated bank transfers. If you pay manually via Cash App, PayPal, Venmo, or Zelle, no Stripe Connect setup is required. To enable automated transfers, enter the affiliate's Stripe Connect account ID in the payout queue before issuing a payout.

---

## Configuration

### Program Toggle

**Location:** Admin → Affiliates (top of page)

Flip the toggle to enable or disable the entire program. When disabled:
- `/affiliates` returns a 404
- `/affiliates/signup` returns a 404
- Existing affiliate data is preserved
- Tracking and conversions stop recording

### Commission Rate

Default: **10%** of order subtotal.

To change the rate per affiliate, update the `commission_rate` column directly in the `affiliates` table via the Supabase dashboard. Per-affiliate rates are supported.

### Payout Threshold

Default: **$99 minimum balance** before a payout can be issued.

Enforced in the admin payout queue UI — affiliates below the threshold are not shown in the queue.

### Cookie Duration

Default: **30 days** from the last click.

Configured in `src/components/StorefrontLayout.tsx`:

```ts
const AFFILIATE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
```

### Pending Window

Default: **14 days** before a conversion can be approved for payout.

Enforced in the admin payout queue. Conversions less than 14 days old are not eligible.

### Eligibility Requirements

Applicants must meet at least one of:
- 20,000+ followers on any single platform
- 100,000+ total views across content

Validated client-side on the signup form (`src/app/affiliates/signup/page.tsx`).

### Payout Schedule

Payouts are processed manually on the **1st of each month** by the admin via Admin → Affiliate Payouts.

---

## Pages & Routes

| Route | Description |
|---|---|
| `/affiliates` | Public landing page — perks, how it works, rules, CTA |
| `/affiliates/signup` | Application form for new affiliates |
| `/affiliates/dashboard` | Affiliate self-service dashboard (magic link auth) |
| `/admin/affiliates` | Admin management — approve, reject, suspend, notes |
| `/admin/affiliates/payouts` | Admin payout queue — approve conversions, issue payouts |
| `/api/affiliates` | Internal API — `approve` and `payout` actions |

---

## Database Tables

### `affiliates`
Stores affiliate accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Full name |
| `email` | text | Unique |
| `code` | text | Unique referral code |
| `status` | text | `pending`, `active`, `suspended`, `rejected` |
| `commission_rate` | numeric | Default 0.10 (10%) |
| `payout_method` | text | `cashapp`, `paypal`, `venmo`, `zelle` |
| `payout_handle` | text | Handle/username for payout method |
| `platform_url` | text | Primary social profile URL |
| `follower_count` | integer | Followers on primary platform |
| `total_views` | integer | Total content views |
| `stripe_account_id` | text | Optional Stripe Connect ID |
| `notes` | text | Internal admin notes |

### `affiliate_clicks`
Logs every referral link click.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `code` | text | Referral code clicked |
| `referrer` | text | `document.referrer` |
| `user_agent` | text | Browser user agent |
| `created_at` | timestamptz | Click timestamp |

### `affiliate_conversions`
Records a sale attributed to an affiliate.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `affiliate_id` | uuid | FK → affiliates |
| `order_id` | uuid | FK → orders |
| `order_subtotal` | numeric | Order subtotal at time of sale |
| `commission_amount` | numeric | Calculated commission |
| `status` | text | `pending`, `approved`, `paid`, `voided` |

### `affiliate_payouts`
Records issued payouts.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `affiliate_id` | uuid | FK → affiliates |
| `amount` | numeric | Total payout amount |
| `method` | text | Payout method used |
| `memo` | text | Admin memo |
| `stripe_transfer_id` | text | Stripe transfer ID if applicable |
| `created_at` | timestamptz | Payout date |

---

## Referral Tracking Flow

1. Visitor arrives at the store with `?ref=CODE` in the URL.
2. `AffiliateTracker` (inside `StorefrontLayout`) reads the code, stores it in `localStorage` with a 30-day TTL, and logs a click to `affiliate_clicks`.
3. When the visitor checks out, `getAffiliateCode()` reads the code from `localStorage` and passes it to the Stripe checkout session.
4. The Stripe Edge Function includes `affiliate_code` in the order insert.
5. On `checkout.session.completed`, the webhook records a conversion in `affiliate_conversions` and sends a notification email to the affiliate via Resend.

---

## Email Notifications

All emails are sent via **Resend** from `Body & Sleeves <no-reply@genderapparel.example>`.

| Trigger | Recipient | Content |
|---|---|---|
| Affiliate approved | Affiliate | Welcome email with dashboard link |
| Sale recorded | Affiliate | Conversion notification with order amount and commission earned |
| Payout issued | Affiliate | Payout confirmation with amount and method |

---

## Admin Workflow

### Reviewing Applications
1. Go to **Admin → Affiliates**.
2. New applications appear with `pending` status and a banner showing the count.
3. Expand a row to see platform details, follower counts, and payout method.
4. Click **Approve** (sends welcome email) or **Reject**.
5. Use **Suspend** / **Reactivate** for existing affiliates.
6. Add internal notes and save.

### Issuing Payouts
1. Go to **Admin → Affiliate Payouts**.
2. Review pending conversions older than 14 days — click **Approve** to mark them ready.
3. Affiliates with ≥ $99 approved balance appear in the payout queue.
4. Enter an optional memo and Stripe Connect account ID (if using automated transfer).
5. Click **Mark Paid** — this creates a payout record, links the conversions, optionally triggers a Stripe transfer, and sends a payout email.

### Disabling the Program
1. Go to **Admin → Affiliates**.
2. Click the toggle at the top of the page.
3. The public pages return 404 immediately. No data is lost.

---

## Rules Summary

- 10% commission on order subtotal (excluding shipping and taxes)
- 30-day last-click attribution cookie
- 14-day pending window before conversions are eligible for payout
- $99 minimum balance required to receive a payout
- Payouts processed on the 1st of each month
- Commissions voided on refunded or charged-back orders
- One affiliate account per person
- Eligibility: 20,000+ followers on one platform OR 100,000+ total views
