# SEO

## Overview

SEO is managed through a dedicated `seo_settings` table in the database and a full admin interface at **Admin → SEO**. Settings control sitemap generation, robots.txt, JSON-LD structured data, canonical URLs, Open Graph tags, and Google Search Console verification — all without touching code.

---

## User Stories

### As a Store Admin
- I want to set my production URL once so all canonical links, sitemaps, and JSON-LD are correct automatically.
- I want to control which SEO features are active without editing code.
- I want to verify my site with Google Search Console by pasting a single code.
- I want to see how many product URLs are in my sitemap at a glance.
- I want social shares to show a branded image when no product image is available.

### As a Search Engine
- I want a valid `sitemap.xml` listing all public pages with correct priorities and change frequencies.
- I want a `robots.txt` that allows public pages and blocks admin, checkout, and API routes.
- I want JSON-LD structured data on product pages to generate rich snippets.
- I want canonical URLs on product pages to avoid duplicate content penalties.

---

## Database Table — `seo_settings`

Singleton table (one row, fixed ID `00000000-0000-0000-0000-000000000001`).

| Column | Type | Default | Description |
|---|---|---|---|
| `site_url` | text | `https://genderapparel.example` | Production domain, no trailing slash |
| `default_og_image` | text | `""` | Fallback OG image URL for pages without a specific image |
| `sitemap_enabled` | boolean | `true` | Whether `/sitemap.xml` returns URLs |
| `robots_noindex_admin` | boolean | `true` | Whether `/robots.txt` blocks admin/checkout/api |
| `jsonld_enabled` | boolean | `true` | Whether product pages include JSON-LD schema |
| `canonical_enabled` | boolean | `true` | Whether product pages include a canonical `<link>` tag |
| `meta_title_suffix` | text | `\| Gender Apparel` | Appended to all page `<title>` tags |
| `twitter_handle` | text | `@body_and_sleeves` | Used in Twitter/X card meta tags |
| `google_site_verification` | text | `""` | Google Search Console verification code |

---

## Admin Interface

**Route:** `/admin/seo`

### Overview Cards
Four status cards at the top show whether Sitemap, Robots.txt, JSON-LD, and Canonical URLs are currently active or disabled.

### Site Basics
| Field | Purpose |
|---|---|
| Production URL | Base URL used in sitemap, canonical tags, and JSON-LD. No trailing slash. |
| Meta Title Suffix | Appended to every page title — e.g. `Black Excellence Tee \| Body & Sleeves` |
| Twitter / X Handle | Populates `twitter:site` meta tag for Twitter card previews |
| Google Search Console Verification | Paste the `content` value from the HTML tag Google provides |

### Open Graph / Social Sharing
- **Default OG Image** — shown when a page has no specific image (home, shop, about). Recommended size: 1200×630px.
- Product pages automatically use the product's own image as the OG image, falling back to this default if none exists.
- Live image preview shown below the input.

### SEO Feature Toggles
| Toggle | Effect when ON |
|---|---|
| Sitemap XML | `/sitemap.xml` returns all active product URLs + 5 static pages |
| Robots.txt — Block Admin & Checkout | `/robots.txt` disallows `/admin/`, `/checkout/`, `/api/` |
| JSON-LD Product Schema | Product pages include `<script type="application/ld+json">` with Product schema |
| Canonical URLs | Product pages include `<link rel="canonical">` pointing to the canonical URL |

### Sitemap Inspector
- **Check Sitemap** button — queries the DB and shows how many active products are indexed
- **View /sitemap.xml** — opens the live sitemap in a new tab
- **View /robots.txt** — opens the live robots file in a new tab
- Count display: `{products} active products + 5 static pages = {total} total URLs`

### Google Search Console Setup (step-by-step shown in UI)
1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Add property → URL prefix → enter your site URL
3. Choose HTML tag verification → copy the `content` value → paste in the field above → Save
4. Click Verify in Search Console
5. Go to Sitemaps → submit `{site_url}/sitemap.xml`

---

## How Each Feature Works

### `/sitemap.xml`

**File:** `src/app/sitemap.ts`

Generated server-side by Next.js. Revalidates every hour (`revalidate = 3600`).

- Reads `site_url` and `sitemap_enabled` from `seo_settings`
- If `sitemap_enabled` is false, returns an empty array (sitemap is blank)
- Static routes included:

| URL | Change Frequency | Priority |
|---|---|---|
| `/` | daily | 1.0 |
| `/shop` | daily | 0.9 |
| `/about` | monthly | 0.6 |
| `/refund-policy` | yearly | 0.3 |
| `/terms-of-service` | yearly | 0.3 |

- Product routes: all products with `status = active`, `changeFrequency: weekly`, `priority: 0.8`, `lastModified` from `updated_at`

### `/robots.txt`

**File:** `src/app/robots.ts`

Generated server-side. Revalidates every hour.

- Reads `site_url` from `seo_settings`
- Always allows all user agents on `/`
- Always disallows `/admin/`, `/checkout/`, `/api/`
- Includes `Sitemap:` directive pointing to `{site_url}/sitemap.xml`

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /checkout/
Disallow: /api/
Sitemap: https://your-domain.com/sitemap.xml
```

> Note: The `robots_noindex_admin` toggle in the admin UI controls whether this file is generated, but the disallow rules are always the same when enabled.

### JSON-LD Product Schema

**File:** `src/app/product/[id]/page.tsx`

When `jsonld_enabled` is true, every product page injects a `<script type="application/ld+json">` tag with the following schema:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Title",
  "description": "Product description...",
  "image": "https://cdn.example.com/product.jpg",
  "url": "https://your-domain.com/product/{id}",
  "offers": {
    "@type": "Offer",
    "price": "34.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": "https://your-domain.com/product/{id}"
  },
  "brand": {
    "@type": "Brand",
    "name": "Gender Apparel"
  }
}
```

This enables Google rich snippets — price, availability, and brand can appear directly in search results.

### Canonical URLs

**File:** `src/app/product/[id]/page.tsx`

When `canonical_enabled` is true, Next.js injects:

```html
<link rel="canonical" href="https://your-domain.com/product/{id}" />
```

This prevents duplicate content penalties if the same product is accessible via multiple URL variations (e.g. with query strings).

### Open Graph Tags

**File:** `src/app/product/[id]/page.tsx` and `src/app/layout.tsx`

Product pages generate full OG tags via `generateMetadata()`:

```html
<meta property="og:title" content="Product Title" />
<meta property="og:description" content="Product description" />
<meta property="og:url" content="https://your-domain.com/product/{id}" />
<meta property="og:image" content="https://cdn.example.com/product.jpg" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Gender Apparel" />
```

- Product image is used if available
- Falls back to `default_og_image` from `seo_settings` if no product image
- Root layout sets `og:site_name` and Twitter card tags globally

### Twitter / X Cards

Set globally in `src/app/layout.tsx` via `generateMetadata()`:

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@body_and_sleeves" />
```

Populated from `twitter_handle` in `seo_settings`.

### Google Site Verification

Set globally in `src/app/layout.tsx`:

```html
<meta name="google-site-verification" content="{your-code}" />
```

Only injected when `google_site_verification` is non-empty in `seo_settings`.

### Favicon

**File:** `src/app/api/favicon/route.ts`

Favicon is served dynamically from `settings.favicon_url`. Set the favicon image in **Admin → Settings → Store Information**. Recommended: square PNG, 32×32 or 64×64px.

---

## Page-Level Metadata Summary

| Page | Title | Description | OG Image | Canonical | JSON-LD |
|---|---|---|---|---|---|
| `/` | "Gender Apparel" | Store description | `default_og_image` | — | — |
| `/shop` | "Shop" | Static | `default_og_image` | — | — |
| `/about` | "About Us" | Static | `default_og_image` | — | — |
| `/product/[id]` | Product title | Product description | Product image → fallback | ✓ (if enabled) | ✓ (if enabled) |
| `/affiliates` | "Affiliate Program" | Static | `default_og_image` | — | — |
| `/refund-policy` | "Refund & Returns" | Static | — | — | — |
| `/terms-of-service` | "Terms of Service" | Static | — | — | — |
| `/privacy-policy` | "Privacy Policy" | Static | — | — | — |

---

## API Route — `/api/seo`

**File:** `src/app/api/seo/route.ts`

| Method | Auth | Action |
|---|---|---|
| `GET` | Public | Returns full `seo_settings` row |
| `GET ?action=sitemap_products` | Public | Returns `id` + `updated_at` for all active products (used by sitemap inspector) |
| `POST` | Admin only | Updates `seo_settings` row |

---

## Configuration Checklist

Before going live, complete these steps:

- [ ] Set **Production URL** to your real domain (e.g. `https://bodyandsleeves.com`)
- [ ] Upload a **Default OG Image** (1200×630px, branded)
- [ ] Set **Meta Title Suffix** to match your brand name
- [ ] Set **Twitter Handle** if you have one
- [ ] Enable all four SEO feature toggles
- [ ] Paste **Google Search Console verification code** and verify
- [ ] Submit `{site_url}/sitemap.xml` to Google Search Console
- [ ] Run a product sync so all products appear in the sitemap
- [ ] Confirm `/robots.txt` and `/sitemap.xml` are accessible in browser

---

## Revalidation

The sitemap and robots.txt revalidate automatically every **1 hour** (`revalidate = 3600`). After saving SEO settings in the admin, the home page is also revalidated immediately via `/api/revalidate`. Product pages are server-rendered on demand (`ƒ Dynamic`) so metadata is always fresh.
