# Gender Apparel — User-Facing Features

## Production-Ready with Free Accounts

This application can be taken to production using the free tier of every third-party service it depends on — no paid plan required to launch.

| Service | Role | Free Tier Includes | Sign Up |
|---|---|---|---|
| **Printify** | Print-on-demand fulfillment | Unlimited products, all print providers | https://printify.com |
| **Stripe** | Payments | No monthly fee; pay-per-transaction only | https://stripe.com |
| **Resend** | Transactional email | 3,000 emails/month, 1 custom domain | https://resend.com |
| **MailerLite** | Email marketing | 1,000 subscribers, 12,000 emails/month | https://mailerlite.com |
| **Supabase** | Database, Auth & Storage | 500 MB DB, 1 GB storage, 50,000 MAUs | https://supabase.com |

> All services above offer free tiers sufficient to run a real store at early-stage volume with no upfront cost.

----

## Browsing & Discovery

- **Homepage** — Hero banner, featured picks, new arrivals carousel, trending now marquee, shop-by-category grid, brand values, and customer reviews
- **Shop page** (`/shop`) — Filter by category, sort by featured / new / trending / price; 2-col mobile, 3-col desktop grid
- **Product detail** (`/product/[id]`) — Multi-image gallery, color swatches, size selector, quantity stepper, related products
- **Search** — Search icon in header navigates to `/shop`

## Cart

- Persistent cart (survives page refresh) stored in browser
- Slide-out cart drawer from any page
- Adjust quantities or remove items inline
- Live subtotal; checkout blocked with notice when orders are paused

## Checkout & Payment

- Enter contact info + shipping address (US, CA, GB, AU)
- Real-time shipping cost estimate based on country and items
- Free shipping threshold applied automatically
- Secure payment via Stripe Checkout (hosted)
- Order confirmation page with order ID, total, and item count after payment

## Account & Post-Purchase

- Order confirmation page at `/checkout/success` with order summary
- Confirmation email sent after purchase (via Resend)

## Content Pages

| Page | What users find |
|---|---|
| `/about` | Founder story, brand values, contact links |
| `/refund-policy` | 30-day returns policy, exchange and gift info |
| `/terms-of-service` | Full terms (13 sections, Illinois law) |



---

## Accessibility & Experience

- Scroll-triggered animations (respects `prefers-reduced-motion`)
- Sticky header with cart badge and mobile hamburger drawer
- Announcement bar for promotions and notices
- Social media links in footer (Instagram, TikTok, Facebook, YouTube, Pinterest, Snapchat, Threads, Email)
- Size-inclusive sizing (XS–5XL), print-on-demand, zero-waste model
