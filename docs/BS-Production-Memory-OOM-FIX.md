# Body&Sleeves — Production Memory / OOM Fix Guide

**Application:** Next.js 15.5.25 (App Router, standalone output)
**Server:** DigitalOcean Droplet — 1 vCPU, ~2 GB RAM, no swap
**Process manager:** PM2 → `.next/standalone/server.js`
**Node.js:** 22.x
**Reverse proxy:** Nginx

---

## Background

Linux kernel OOM events have been confirmed in production. The Node.js process has been observed growing from a healthy baseline of 140–165 MB RSS to 530–580 MB (repeated incidents) and up to 1.2 GB (largest observed incident) before the OOM killer terminates it. After restart, memory returns to baseline.

This document covers every identified contributing factor, explains the full process flow for each, and provides the exact remediation steps ranked by impact, risk, and effort.

**Read the full investigation report before making any changes.**
Each fix section below references the investigation finding it addresses.

---

## Table of Contents

1. [FIX-01 — Remove AVIF, use WebP only](#fix-01--remove-avif-use-webp-only)
2. [FIX-02 — Add PM2 memory restart limit](#fix-02--add-pm2-memory-restart-limit)
3. [FIX-03 — Add Node.js heap size limit](#fix-03--add-nodejs-heap-size-limit)
4. [FIX-04 — Restrict image remotePatterns](#fix-04--restrict-image-remotepatterms)
5. [FIX-05 — Increase image cache TTL](#fix-05--increase-image-cache-ttl)
6. [FIX-06 — Add deviceSizes and imageSizes constraints](#fix-06--add-devicesizes-and-imagesizes-constraints)
7. [FIX-07 — Rate-limit /_next/image at Nginx](#fix-07--rate-limit-_nextimage-at-nginx)
8. [FIX-08 — Set homepage revalidate to ISR](#fix-08--set-homepage-revalidate-to-isr)
9. [FIX-09 — Add limits to unbounded product queries](#fix-09--add-limits-to-unbounded-product-queries)
10. [FIX-10 — Add swap space to the Droplet](#fix-10--add-swap-space-to-the-droplet)
11. [FIX-11 — Authenticate exposed diagnostic routes](#fix-11--authenticate-exposed-diagnostic-routes)
12. [FIX-12 — Offload image optimization to external CDN](#fix-12--offload-image-optimization-to-external-cdn)
13. [Verification Checklist](#verification-checklist)
14. [Runtime Measurements to Confirm Root Cause](#runtime-measurements-to-confirm-root-cause)

---

## FIX-01 — Remove AVIF, use WebP only

**Priority:** #1 — Implement first
**Impact:** Critical
**Risk:** None
**Effort:** 5 minutes + rebuild
**Investigation finding:** Image Optimization Findings / Memory-Risk table row 2
**Status:** ✅ APPLIED
**Date:** 2025-07-14
**Change:** `next.config.mjs` — `formats` changed from `['image/avif', 'image/webp']` to `['image/webp']`.
**Pending:** `npm run build` + deploy to production.

---

### What is happening

`next.config.mjs` currently declares:

```js
images: {
  formats: ['image/avif', 'image/webp'],
  ...
}
```

Next.js reads this list in order. When a browser sends an `Accept` header that includes `image/avif` (all modern Chrome, Firefox, Safari, Edge), Next.js selects AVIF as the output format for that request.

**AVIF encoding is 3–10× more CPU and memory intensive than WebP encoding.** The `sharp` library (v0.35.4, confirmed installed) performs the encoding. During AVIF encoding, `sharp` holds:

- The full decoded source image as a raw pixel buffer (e.g., a 2000×2000 source image = ~16 MB uncompressed RGBA)
- The intermediate resize buffer
- The AVIF encoder working memory (libheif/libaom — the AV1 codec used for AVIF is extremely memory hungry)

For a single large product image this can peak at 40–80 MB of native memory per concurrent encode. On a 2 GB Droplet with a single Node.js process, 10–15 concurrent AVIF encodes from a crawler burst can consume 400–800 MB of RSS before any of them complete and release their buffers.

---

### Full process flow (current — broken)

```
1. Crawler or browser requests /product/[id]
2. Page HTML is rendered server-side, contains:
      <img src="/_next/image?url=https%3A%2F%2Fimages.printify.com%2F...&w=1080&q=75">
      (plus thumbnails, color swatches, related product cards — up to 20+ image tags)

3. Browser/crawler fetches each /_next/image URL

4. Next.js image optimizer checks .next/cache/images/ for a cached result
   → Cache MISS (first visit, or TTL expired after 1 hour, or URL changed)

5. Node.js opens HTTP connection to remote CDN (Printify / CloudFront / Unsplash)
   → Downloads full source image into a Node.js Buffer
   → Source image: typically 1–5 MB compressed, 10–80 MB uncompressed

6. sharp.decode() — decompresses source into raw pixel buffer (~16–80 MB)

7. sharp.resize() — resizes to requested width (e.g., 1080px)

8. sharp.avif() — encodes to AVIF
   → libaom AV1 encoder allocates large working buffers
   → Peak memory during encode: 40–80 MB per image

9. Result written to .next/cache/images/
   Buffers released — but only AFTER encode completes

10. If 10–20 concurrent requests arrive (crawler hitting all product images):
    → 10–20 simultaneous encode pipelines
    → 400–1200 MB peak RSS
    → OOM killer terminates process
```

---

### Full process flow (after fix — WebP only)

```
Steps 1–7 identical.

8. sharp.webp() — encodes to WebP
   → libwebp encoder: ~5–15 MB working memory per image
   → 3–10× less memory than AVIF

9. Result written to .next/cache/images/
   Buffers released

10. 10–20 concurrent requests:
    → 50–150 MB peak additional RSS
    → Process stays well within safe limits
```

---

### The fix

**File:** `next.config.mjs`

```js
// BEFORE
images: {
  formats: ['image/avif', 'image/webp'],
  remotePatterns: [...],
  minimumCacheTTL: 3600,
},

// AFTER
images: {
  formats: ['image/webp'],   // Remove 'image/avif' — WebP is sufficient for all modern browsers
  remotePatterns: [...],
  minimumCacheTTL: 3600,
},
```

---

### Why WebP is sufficient

- WebP is supported by 97%+ of global browsers (Chrome 23+, Firefox 65+, Safari 14+, Edge 18+).
- WebP quality at `q=75` (Next.js default) is visually indistinguishable from AVIF at `q=75` for product photography.
- WebP encoding memory overhead is 5–15 MB per image vs 40–80 MB for AVIF.
- Next.js will still serve the original format to browsers that support neither (extremely rare).

---

### After the fix

1. Run `npm run build` locally to verify the build passes.
2. Deploy to production.
3. The existing `.next/cache/images/` directory contains AVIF-encoded files. They will continue to be served until their TTL expires (1 hour). After expiry, new requests will encode WebP instead.
4. To force immediate re-encoding: `rm -rf .next/cache/images/` on the server (safe — files will be regenerated on next request). Do this during low-traffic hours.

---

### Verification

```bash
# After deploying, request a product image and check the Content-Type header:
curl -I "https://bodyandsleeves.com/_next/image?url=<encoded-product-url>&w=800&q=75" \
  -H "Accept: image/avif,image/webp,*/*"

# Should return:
# Content-Type: image/webp   ← correct after fix
# NOT: Content-Type: image/avif
```

---

## FIX-02 — Add PM2 memory restart limit

**Priority:** #2 — Implement immediately (no rebuild required)
**Impact:** Critical — converts hard OOM crash into graceful restart
**Risk:** None
**Effort:** 2 minutes
**Investigation finding:** PM2 Findings
**Status:** ✅ APPLIED (corrected)
**Date:** 2025-07-14

**How ecosystem.config.js actually works on this server:**
The repo `ecosystem.config.js` is gitignored and is never deployed. Both `scripts/deploy.sh` and `scripts/setup-droplet.sh` contain an inline Node.js script that reads `.env.local` and generates a fresh `ecosystem.config.js` on the server at every deploy. Any changes to the repo template file are silently discarded on the next deploy. The correct fix is in the generator scripts.

**Changes made:**
- `scripts/deploy.sh` — inline Node.js generator now builds the app object with `max_memory_restart: '400M'` and `node_args: '--max-old-space-size=512'` as top-level fields alongside `env`.
- `scripts/setup-droplet.sh` — same generator updated identically.
- `ecosystem.config.js` (repo template) — also updated for reference, but has no effect on production.

**Production verification (2025-07-14):**
```
pm2 describe bodyandsleeves | grep memory
│ max memory restart │ 419430400
```
419430400 bytes = 400 × 1024 × 1024 = exactly 400 MB. ✅ Confirmed active on production.

**To apply to the live server NOW without a full redeploy:**
```bash
# Run this on the production server as root:
cd /var/www/bodyandsleeves
node - << 'EOF'
const fs = require('fs');
const raw = fs.readFileSync('.env.local', 'utf8');
const env = {};
raw.split('\n').forEach(l => { const m = l.match(/^([^#=]+)=(.*)/); if (m) env[m[1].trim()] = m[2].trim(); });
env.APP_ROOT = '/var/www/bodyandsleeves';
env.PM2_APP_NAME = 'bodyandsleeves';
env.PORT = '3000';
const app = { name: 'bodyandsleeves', script: 'server.js', interpreter: 'node', cwd: '/var/www/bodyandsleeves/.next/standalone', max_memory_restart: '400M', node_args: '--max-old-space-size=512', env };
fs.writeFileSync('ecosystem.config.js', 'module.exports = { apps: [' + JSON.stringify(app) + '] };');
console.log('Done');
EOF
pm2 reload ecosystem.config.js --update-env

# Verify:
pm2 describe bodyandsleeves | grep -E 'memory|node_args'
# Expected:
#   max memory restart: 400.0 MB
#   node args:          --max-old-space-size=512
```

---

### What is happening

The current `ecosystem.config.js` contains no `max_memory_restart` field:

```js
module.exports = { apps: [{ 
  name: '<PM2_APP_NAME>', 
  script: '.next/standalone/server.js',
  interpreter: 'node',
  cwd: '<APP_ROOT>',
  env: { ... }
  // max_memory_restart is MISSING
}] };
```

Without this setting, PM2 never intervenes regardless of how much memory the process consumes. The process grows unchecked until the Linux kernel's OOM killer forcibly terminates it. This is a hard kill — no graceful shutdown, no cleanup, no warning. The application is simply gone until PM2 detects the exit and restarts it (which can take several seconds, during which the site is down).

---

### Process flow (current — no protection)

```
Memory grows: 165 MB → 300 MB → 500 MB → 800 MB → 1200 MB
                                                         ↓
                                              Linux OOM killer: SIGKILL
                                                         ↓
                                              Process terminated instantly
                                              No graceful shutdown
                                              In-flight requests dropped
                                                         ↓
                                              PM2 detects exit, restarts
                                              ~3–10 second downtime
                                              Memory resets to 165 MB baseline
```

---

### Process flow (after fix — graceful restart)

```
Memory grows: 165 MB → 300 MB → 400 MB
                                   ↓
                         PM2 detects threshold exceeded
                                   ↓
                         PM2 sends SIGTERM (graceful shutdown)
                         Next.js finishes in-flight requests
                         Process exits cleanly
                                   ↓
                         PM2 starts new process
                         ~1–2 second restart
                         Memory resets to 165 MB baseline
                         OOM killer never involved
```

---

### The fix

**File:** `ecosystem.config.js`

```js
module.exports = { apps: [{ 
  name: '<PM2_APP_NAME>',
  script: '.next/standalone/server.js',
  interpreter: 'node',
  cwd: '<APP_ROOT>',
  max_memory_restart: '400M',   // ADD THIS LINE
  env: { ... }
}] };
```

**Why 400 MB?**
- Normal baseline: 140–165 MB RSS
- Safe operating range: up to ~300 MB under normal load
- First OOM incidents observed at: 530–580 MB
- 400 MB gives ~235 MB headroom above baseline before restart
- 400 MB is well below the 530 MB danger threshold
- If restarts happen too frequently at 400 MB, raise to 450 MB

---

### Applying without a full redeploy

On the production server, after editing `ecosystem.config.js`:

```bash
pm2 reload ecosystem.config.js --update-env
# or
pm2 restart <PM2_APP_NAME> --update-env

# Verify the setting was applied:
pm2 describe <PM2_APP_NAME> | grep memory
```

This change takes effect immediately without a Next.js rebuild.

---

### Important note

`max_memory_restart` measures RSS (Resident Set Size), which is what the OOM killer also measures. This is the correct metric to use. Do not confuse it with V8 heap size — RSS includes native memory used by `sharp`, libuv, and other native modules, which is where the bulk of image optimization memory lives.

---

## FIX-03 — Add Node.js heap size limit

**Priority:** #3
**Impact:** High — forces V8 to GC aggressively before RSS grows out of control
**Risk:** Low (if set correctly)
**Effort:** 2 minutes
**Investigation finding:** PM2 Findings
**Status:** ✅ APPLIED (corrected)
**Date:** 2025-07-14
**Change:** `node_args: '--max-old-space-size=512'` added to the ecosystem generator in `scripts/deploy.sh` and `scripts/setup-droplet.sh`. Applied to the live server via the same inline Node.js command as FIX-02 above.

---

### What is happening

Without a `--max-old-space-size` flag, Node.js 22 will attempt to use as much V8 heap as the OS allows, deferring garbage collection until memory pressure forces it. On a 2 GB machine, V8 may allow the heap to grow to 1.4 GB before triggering a full GC cycle. By that point, combined with native memory from `sharp`, the process is already in OOM territory.

Setting `--max-old-space-size` tells V8 to run GC more aggressively and throw a JavaScript `RangeError: JavaScript heap out of memory` if the limit is exceeded. PM2 catches this exit and restarts the process — a much cleaner failure mode than the OOM killer.

---

### The fix

**File:** `ecosystem.config.js`

```js
module.exports = { apps: [{ 
  name: '<PM2_APP_NAME>',
  script: '.next/standalone/server.js',
  interpreter: 'node',
  cwd: '<APP_ROOT>',
  max_memory_restart: '400M',
  node_args: '--max-old-space-size=512',   // ADD THIS LINE
  env: { ... }
}] };
```

**Why 512 MB?**
- The V8 heap limit should be set higher than normal operating heap usage but lower than total RSS budget.
- Normal V8 heap at baseline: ~80–120 MB
- 512 MB gives V8 room to operate while forcing GC before the heap contributes to an OOM event.
- `max_memory_restart: '400M'` (RSS) and `--max-old-space-size=512` (V8 heap) work together: PM2 watches RSS, V8 watches its own heap. Either can trigger a restart before the OOM killer acts.

---

### Relationship between RSS and V8 heap

```
Total RSS (~165 MB baseline)
├── V8 heap (JS objects, closures, module cache): ~80–120 MB
├── sharp / libvips native buffers: variable (0 MB idle, up to 80 MB per encode)
├── libuv / OS buffers: ~10–20 MB
└── Node.js internals: ~20–30 MB

--max-old-space-size controls only the V8 heap portion.
max_memory_restart controls total RSS.
Both limits are needed for full protection.
```

---

### Applying without a full redeploy

```bash
# Edit ecosystem.config.js on the server, then:
pm2 reload ecosystem.config.js --update-env

# Verify:
pm2 describe <PM2_APP_NAME> | grep -E "node_args|memory"
```

---

## FIX-04 — Restrict image remotePatterns

**Priority:** #4
**Impact:** Medium — closes open proxy risk, reduces attack surface
**Risk:** Low (requires knowing all image hostnames in use)
**Effort:** 15 minutes
**Investigation finding:** Image Optimization Findings
**Status:** ✅ APPLIED
**Date:** 2025-07-14
**Hostnames confirmed from production DB query (2025-07-14):**
- `images-api.printify.com` — Printify product images
- `*.cloudfront.net` — Printify CloudFront CDN (wildcard covers any distribution rotation)
- `bdazupyepobieyjzuamf.supabase.co` — Supabase Storage
- `images.pexels.com` — template/fallback images
- `images.unsplash.com` — template/fallback images
**Change:** `next.config.mjs` — replaced `hostname: '**'` wildcard with explicit 5-entry allowlist.
**Pending:** `npm run build` + deploy to production.

---

### What is happening

`next.config.mjs` currently uses a double wildcard:

```js
remotePatterns: [
  { protocol: 'https', hostname: '**' },
  { protocol: 'http',  hostname: '**' },
],
```

`hostname: '**'` matches any domain. This means:

1. Any URL passed to `/_next/image?url=<anything>` will be accepted and processed.
2. A malicious actor or misconfigured crawler can cause this server to download and encode images from any host on the internet.
3. If a bot discovers the `/_next/image` endpoint and passes large image URLs from arbitrary hosts, the server will faithfully download and encode all of them.
4. There is no way to distinguish a legitimate product image request from an abusive one at the Next.js level.

---

### Process flow (current — open proxy)

```
Attacker/bot sends:
GET /_next/image?url=https%3A%2F%2Fsome-huge-image-host.com%2F50mb-image.jpg&w=1920&q=75

Next.js checks: is 'some-huge-image-host.com' in remotePatterns?
→ hostname: '**' matches everything → YES

Server downloads 50 MB image, decodes, encodes AVIF, holds buffers
→ Memory spike from a single crafted request
```

---

### Process flow (after fix — allowlist)

```
Same request arrives.

Next.js checks: is 'some-huge-image-host.com' in remotePatterns?
→ Not in allowlist → REJECTED with 400 Bad Request
→ No download, no encode, no memory impact
```

---

### Known image hostnames in this application

From code review, product images originate from:

| Source | Hostname pattern |
|---|---|
| Printify CDN | `images.printify.com` |
| Printify CDN (alternate) | `cdn.printify.com` |
| Supabase Storage | `<project-ref>.supabase.co` |
| Unsplash (template/demo) | `images.unsplash.com` |
| Pexels (template/demo) | `images.pexels.com` |

Check your actual Printify CDN hostname by inspecting a product image URL in the admin panel or Supabase `products` table.

---

### The fix

**File:** `next.config.mjs`

```js
// BEFORE
remotePatterns: [
  { protocol: 'https', hostname: '**' },
  { protocol: 'http',  hostname: '**' },
],

// AFTER — replace with explicit allowlist
remotePatterns: [
  // Printify CDN — verify exact hostname from your product image URLs
  { protocol: 'https', hostname: 'images.printify.com' },
  { protocol: 'https', hostname: 'cdn.printify.com' },
  // Supabase Storage — replace <project-ref> with your actual project ref
  { protocol: 'https', hostname: '<project-ref>.supabase.co' },
  // Template/demo images — remove these once real products are in place
  { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'https', hostname: 'images.pexels.com' },
],
```

---

### How to find your Printify CDN hostname

```bash
# Query your Supabase products table for a sample image URL:
# In the admin panel → Products → click any product → copy the image URL
# The hostname is the part between https:// and the first /

# Example Printify image URL:
# https://images-api.printify.com/mockup/abc123/0/0/preview.jpg
#                                  ↑ this is the hostname
```

Add every unique hostname you find. If you later add products from a new CDN, you must add that hostname here and rebuild.

---

### After the fix

Rebuild and deploy. Test that product images still load on the storefront. If any images break (404 or blank), the hostname for that image source is missing from the allowlist — add it and rebuild.

---

## FIX-05 — Increase image cache TTL

**Priority:** #5
**Impact:** Medium — reduces re-encode frequency after restarts
**Risk:** None
**Effort:** 2 minutes + rebuild
**Investigation finding:** Image Optimization Findings
**Status:** ✅ APPLIED
**Date:** 2025-07-14
**Change:** `next.config.mjs` — `minimumCacheTTL` changed from `3600` (1h) to `86400` (24h).
**Pending:** `npm run build` + deploy to production.

---

### What is happening

```js
minimumCacheTTL: 3600,  // 1 hour
```

The `minimumCacheTTL` controls how long Next.js keeps an encoded image in `.next/cache/images/` before considering it stale. After the TTL expires, the next request for that image triggers a full re-download and re-encode.

**The problem:** Every time PM2 restarts the process (due to OOM or `max_memory_restart`), the in-memory cache is cleared. The on-disk cache in `.next/cache/images/` persists across restarts, but with a 1-hour TTL, images encoded before the restart may already be expired by the time the process comes back up. This means the first wave of traffic after a restart hits a cold cache and triggers a burst of concurrent encodes — exactly the condition that caused the OOM in the first place.

---

### Process flow (current — 1 hour TTL)

```
09:00 — Process starts, cache is cold
09:00–09:05 — First visitors trigger encodes, cache warms up
09:00–10:00 — Cache is warm, requests served from disk
10:00 — TTL expires for images encoded at 09:00
10:00 — Crawler hits shop page, all 20+ product images are stale
10:00 — 20+ concurrent re-encodes triggered
10:00 — Memory spike → OOM → restart
10:00 — Cache partially cleared, cycle repeats
```

---

### Process flow (after fix — 24 hour TTL)

```
09:00 — Process starts, cache is cold
09:00–09:05 — First visitors trigger encodes, cache warms up
09:00–09:00+24h — Cache stays warm for 24 hours
Crawler hits at any point → images served from disk cache
No re-encode burst
```

---

### The fix

**File:** `next.config.mjs`

```js
// BEFORE
minimumCacheTTL: 3600,      // 1 hour

// AFTER
minimumCacheTTL: 86400,     // 24 hours — product images rarely change
```

For a POD storefront where product images are stable (they only change when you update a product in Printify), 24 hours is conservative. You could safely use 604800 (7 days). If you update a product image, you can manually clear `.next/cache/images/` on the server to force re-encoding.

---

### Note on cache invalidation

Next.js image cache entries are keyed by the full URL + width + quality. If Printify changes the image URL when you update a product (which they do — they generate new CDN URLs), the old cache entry becomes orphaned and a new one is created automatically. The TTL only matters for stable URLs.

---

## FIX-06 — Add deviceSizes and imageSizes constraints

**Priority:** #6
**Impact:** Medium — reduces number of distinct cached variants
**Risk:** None
**Effort:** 10 minutes + rebuild
**Investigation finding:** Image Optimization Findings
**Status:** ✅ APPLIED
**Date:** 2025-07-14
**Change:** `next.config.mjs` — added `deviceSizes: [640, 828, 1080, 1200, 1920]` and `imageSizes: [64, 128, 256, 384]`. Removes 750, 2048, 3840 from device sizes.
**Pending:** `npm run build` + deploy to production.

---

### What is happening

Without explicit `deviceSizes` and `imageSizes`, Next.js uses its built-in defaults:

```
deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
imageSizes:  [16, 32, 48, 64, 96, 128, 256, 384]
```

Next.js selects the smallest size from this list that is larger than the requested width. For a `sizes="(max-width: 640px) 50vw, 33vw"` attribute, a browser on a 1440px screen requests width ~480px, which maps to the 640px bucket. A browser on a 4K screen requests ~960px, which maps to the 1080px bucket.

**The problem:** The default list includes 1920, 2048, and 3840. If any browser or crawler requests an image at a large viewport width, Next.js will encode a 1920px or 3840px variant. A 3840px AVIF encode of a product image can consume 200+ MB of memory by itself. Even with WebP, large-width encodes are expensive.

Additionally, every distinct (URL, width, quality) combination is a separate cache entry. With 8 device sizes × N products × multiple quality values, the cache can contain thousands of entries, each requiring a separate encode on first access.

---

### The fix

**File:** `next.config.mjs`

```js
// AFTER — add these two arrays
images: {
  formats: ['image/webp'],
  remotePatterns: [...],
  minimumCacheTTL: 86400,
  // Limit to sizes actually used by the UI
  deviceSizes: [640, 828, 1080, 1200, 1920],
  imageSizes: [64, 128, 256, 384],
},
```

**Rationale for these values:**
- `640` — mobile full-width images
- `828` — iPhone retina (414px × 2)
- `1080` — tablet / small desktop
- `1200` — standard desktop product images
- `1920` — large desktop / hero images (keep for hero, remove if not needed)
- Removed: `750`, `2048`, `3840` — no UI component requests these widths
- `imageSizes` covers thumbnail/swatch sizes used in `ProductDetailClient` (80px swatches → 128px bucket)

---

### How to audit which sizes are actually used

```bash
# After deploying, check what widths are being requested:
grep "/_next/image" /var/log/nginx/access.log | grep -oP "w=\d+" | sort | uniq -c | sort -rn | head -20
```

Remove any `deviceSizes` entries that never appear in the logs.

---

## FIX-07 — Rate-limit `/_next/image` at Nginx

**Priority:** #7
**Impact:** Critical for crawler protection — prevents burst concurrency
**Risk:** Low (may slow legitimate image loads on first visit)
**Effort:** 20 minutes
**Investigation finding:** `/_next/image` Resource Risk
**Status:** ✅ APPLIED
**Date:** 2025-07-14
**Changes made:**
- `scripts/setup-droplet.sh` — added `limit_req_zone` injection into `nginx.conf` http block and added dedicated `location /_next/image` block with `limit_req zone=nextimage burst=20 nodelay` and `limit_req_status 429` before the catch-all `location /` block.

**To apply to the live production server NOW (no rebuild):**

```bash
# Step 1 — Add the rate-limit zone to the http {} block in nginx.conf
# Check if it already exists first:
grep 'nextimage' /etc/nginx/nginx.conf

# If nothing returned, add it:
sudo sed -i '/http {/a \
    limit_req_zone $binary_remote_addr zone=nextimage:10m rate=5r/s;' /etc/nginx/nginx.conf

# Step 2 — Add the /_next/image location block to the site config.
# Open the file:
sudo nano /etc/nginx/sites-available/bodyandsleeves

# Add this block ABOVE the existing "location / {" block:
#
#     location /_next/image {
#         limit_req zone=nextimage burst=20 nodelay;
#         limit_req_status 429;
#         proxy_pass http://localhost:3000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#     }

# Step 3 — Test and reload (zero downtime):
sudo nginx -t && sudo nginx -s reload

# Step 4 — Verify rate limiting is active:
# Watch for 429s in the access log after a crawler burst:
tail -f /var/log/nginx/access.log | grep '429'
```

**Verification result:** Pending — confirm after applying on server.

---

### What is happening

Nginx currently passes all `/_next/image` requests directly to the Next.js process with no rate limiting. A single crawler (Googlebot, Bingbot, SEMrush, Ahrefs, or a malicious scanner) can:

1. Fetch `/shop` — receives HTML with 20–30 product image tags
2. Immediately fetch all 20–30 `/_next/image` URLs in parallel
3. Each is a cache miss on first crawl → 20–30 concurrent AVIF/WebP encodes
4. Memory spikes, OOM event occurs

This is not a theoretical attack — it is the normal behavior of any web crawler. Googlebot is explicitly designed to crawl aggressively.

---

### Process flow (current — no rate limit)

```
Googlebot fetches /shop at 09:00:00
Googlebot fetches 30 /_next/image URLs at 09:00:01 (parallel)
→ 30 concurrent sharp encode pipelines
→ Peak memory: 30 × 15 MB (WebP) = 450 MB additional RSS
→ Total RSS: 165 + 450 = 615 MB → OOM territory
```

---

### Process flow (after fix — rate limited)

```
Googlebot fetches /shop at 09:00:00
Googlebot fetches 30 /_next/image URLs at 09:00:01 (parallel)
→ Nginx allows 5 requests/second per IP, queues the rest
→ 5 concurrent encodes at a time
→ Peak memory: 5 × 15 MB = 75 MB additional RSS
→ Total RSS: 165 + 75 = 240 MB → safe
→ Remaining 25 requests served as queue drains over ~6 seconds
```

---

### The fix

**File:** Your Nginx site configuration (typically `/etc/nginx/sites-available/bodyandsleeves` or `/etc/nginx/conf.d/bodyandsleeves.conf`)

Add a rate limit zone in the `http {}` block (usually in `/etc/nginx/nginx.conf` or included from there):

```nginx
# In the http {} block — add this ONCE
limit_req_zone $binary_remote_addr zone=nextimage:10m rate=5r/s;
```

Then in your server block, add a location for `/_next/image`:

```nginx
server {
    # ... your existing config ...

    # Rate-limit the Next.js image optimizer
    location /_next/image {
        limit_req zone=nextimage burst=20 nodelay;
        limit_req_status 429;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Cache optimized images at Nginx level too (belt and suspenders)
        proxy_cache_valid 200 24h;
        add_header X-Image-Cache $upstream_cache_status;
    }

    # ... rest of your config ...
}
```

**Parameter explanation:**
- `rate=5r/s` — allow 5 image optimization requests per second per IP
- `burst=20` — allow a burst of up to 20 requests before rate limiting kicks in
- `nodelay` — process burst requests immediately (don't queue them, just allow the burst then enforce the rate)
- `limit_req_status 429` — return HTTP 429 (Too Many Requests) when rate exceeded, not 503
- `10m` — 10 MB shared memory zone, sufficient for ~160,000 IP addresses

---

### Tuning guidance

| Scenario | Recommended rate | Burst |
|---|---|---|
| Conservative (current OOM risk) | `3r/s` | `10` |
| Balanced (recommended start) | `5r/s` | `20` |
| Permissive (after other fixes applied) | `10r/s` | `30` |

Start conservative. If legitimate users report slow image loading on first visit, increase the rate.

---

### Testing the rate limit

```bash
# Test from your local machine (replace with a real image URL from your site):
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "https://bodyandsleeves.com/_next/image?url=<encoded-url>&w=800&q=75" &
done
wait

# You should see mostly 200s with some 429s after the burst is exhausted
```

---

### Apply without downtime

```bash
nginx -t          # Test config syntax first
nginx -s reload   # Reload Nginx (zero downtime)
```

---

## FIX-08 — Set homepage revalidate to ISR

**Priority:** #8
**Impact:** High — eliminates per-request server rendering of the homepage under crawler load
**Risk:** Low (homepage data may be up to 60 seconds stale)
**Effort:** 2 minutes + rebuild
**Investigation finding:** Static vs Dynamic Work / Memory-Risk table
**Status:** ✅ APPLIED
**Date:** 2025-07-14
**Changes made:**
- `src/app/page.tsx` — `revalidate` changed from `0` to `60`.
- `src/components/Footer.tsx` — `noStore()` call removed. The import is retained but unused (suppressed with eslint comment) to avoid a build error if anything else references it; it can be fully removed in a cleanup pass.
**Pending:** `npm run build` + deploy to production.

---

### What is happening

`src/app/page.tsx` line 111:

```js
export const revalidate = 0;
// Comment in code: "Always fetch fresh data from Supabase on every request."
```

`revalidate = 0` is equivalent to `dynamic = 'force-dynamic'`. It means:

- **Every single request to `/` triggers a full server-side render.**
- 6 parallel Supabase queries execute on every request.
- The full product catalog (featured, new arrivals, trending, categories, category images) is fetched, serialized into the RSC payload, and sent to the client.
- There is no page-level cache. The 100th concurrent crawler request to `/` costs exactly as much as the 1st.

On a 1 vCPU machine, concurrent server renders compete for the same CPU. Combined with concurrent image optimization requests, the event loop becomes saturated.

---

### Supabase queries executed on every homepage request

```js
Promise.all([
  supabase.from("settings").select("*").limit(1),                          // 1. Full settings row
  supabase.from("products").select("*").eq("featured", true).limit(8),    // 2. Featured products (full rows)
  supabase.from("products").select("*").eq("is_new_arrival", true).limit(12), // 3. New arrivals (full rows)
  supabase.from("products").select("*").eq("is_trending", true).limit(12), // 4. Trending (full rows)
  supabase.from("categories").select("*"),                                  // 5. All categories
  supabase.from("products").select("category_id, image_url"),              // 6. All product images (no limit)
])
```

Query 6 has no `.limit()` — it fetches `category_id` and `image_url` for every active product in the database. As the catalog grows, this payload grows.

---

### Process flow (current — fully dynamic)

```
Googlebot crawls / at 09:00:00
Bingbot crawls / at 09:00:01
SEMrush crawls / at 09:00:02
→ 3 concurrent full server renders
→ 18 concurrent Supabase queries
→ 3 full RSC payloads serialized in memory simultaneously
→ Combined with image optimization → memory pressure
```

---

### Process flow (after fix — ISR)

```
First request to / at 09:00:00:
→ Full server render executes once
→ Result cached as static HTML + RSC payload on disk

All subsequent requests for 60 seconds:
→ Served from disk cache instantly
→ Zero Supabase queries
→ Zero server-side rendering work
→ Near-zero memory impact

At 09:01:00 (revalidate interval):
→ Next.js regenerates the page in the background
→ One render, not N concurrent renders
→ New cache replaces old cache
```

---

### The fix

**File:** `src/app/page.tsx`

```js
// BEFORE
// Always fetch fresh data from Supabase on every request.
export const revalidate = 0;

// AFTER
export const revalidate = 60; // Regenerate at most once per minute (ISR)
```

**Why 60 seconds is appropriate:**
- Homepage shows featured products, new arrivals, trending, and categories.
- These change when an admin updates products — not on every page view.
- A 60-second delay between an admin update and the homepage reflecting it is acceptable for a POD storefront.
- If you need faster updates, use the existing `/api/revalidate` endpoint after admin saves (it already calls `revalidatePath('/')` — this will work correctly with ISR).

---

### Also fix the Footer's noStore() call

**File:** `src/components/Footer.tsx` line 91

```js
// BEFORE — forces dynamic render on every page that includes Footer
noStore();

// AFTER — remove this line, or replace with a revalidation strategy
// The Footer fetches store_name, social_links, logo_url — these rarely change.
// Remove noStore() and let Next.js cache the Footer data normally.
```

The `unstable_noStore()` call in the Footer component forces every page that renders the Footer (homepage, shop, product pages, etc.) to be treated as dynamic, even if the page itself has a `revalidate` value set. Removing it allows ISR to work correctly for those pages.

---

## FIX-09 — Add limits to unbounded product queries

**Priority:** #9
**Impact:** Medium — prevents memory growth as catalog scales
**Risk:** None (limits are generous)
**Effort:** 20 minutes + rebuild
**Investigation finding:** Memory-Risk Findings / API Route Findings
**Status:** ✅ APPLIED
**Date:** 2025-07-14
**Changes made:**
- `src/app/shop/page.tsx` — products query: added `.limit(500)`.
- `src/app/page.tsx` — category image query: added `.limit(500)`.
**Pending:** `npm run build` + deploy to production.

---

### What is happening

Several queries fetch the entire products table with `select("*")` and no `.limit()`:

| File | Query | Risk |
|---|---|---|
| `src/app/shop/page.tsx` | `select("*").eq("status","active")` | All active products, full rows |
| `src/app/page.tsx` | `select("category_id, image_url").eq("status","active")` | All products, no limit |
| `src/app/admin/products/page.tsx` | `select("*").order("title")` | All products including drafts |
| `src/app/admin/dashboard/page.tsx` | `select("*").order("created_at")` | All products |
| `src/app/sitemap.ts` | `select("id, updated_at").eq("status","active")` | All active products |

Each `Product` row includes `variants` (a JSON array of all size/color combinations — potentially 50–100 objects per product), `shipping_info` (a JSON object with shipping profiles), `images` (array of image URLs), and all other fields. A catalog of 200 products with 50 variants each could produce a 2–5 MB JSON payload per query.

This payload is:
1. Received from Supabase into a Node.js Buffer
2. JSON-parsed into a JavaScript object tree
3. Serialized into the RSC payload
4. Sent to the client

All three copies exist in memory simultaneously during rendering.

---

### The fix

**File:** `src/app/shop/page.tsx`

```js
// BEFORE
supabase.from("products").select("*").eq("status", "active").order("featured", { ascending: false }),

// AFTER — add a generous limit; if you have more than 500 active products, implement pagination
supabase.from("products").select("*").eq("status", "active").order("featured", { ascending: false }).limit(500),
```

**File:** `src/app/page.tsx` — the category image query

```js
// BEFORE
supabase.from("products").select("category_id, image_url").eq("status", "active").not("image_url", "is", null).not("category_id", "is", null),

// AFTER
supabase.from("products").select("category_id, image_url").eq("status", "active").not("image_url", "is", null).not("category_id", "is", null).limit(500),
```

**File:** `src/app/admin/products/page.tsx`

```js
// BEFORE
supabase.from("products").select("*").order("title", { ascending: true }),

// AFTER
supabase.from("products").select("*").order("title", { ascending: true }).limit(1000),
```

**File:** `src/app/admin/dashboard/page.tsx`

```js
// BEFORE
supabase.from("products").select("*").order("created_at", { ascending: false }),

// AFTER
supabase.from("products").select("*").order("created_at", { ascending: false }).limit(200),
```

---

### Why these limits are safe

- A POD storefront with 500+ active products is large. These limits will not affect normal operation.
- The admin products page with 1000 limit covers any realistic catalog size.
- If you genuinely exceed these limits, the correct fix is server-side pagination, not removing the limit.
- The sitemap query (`select("id, updated_at")`) is already low-cost per row — leave it unlimited or add a high limit (10000) to be safe.

---

## FIX-10 — Add swap space to the Droplet

**Priority:** #10
**Impact:** Medium — prevents hard OOM kills during brief spikes
**Risk:** None (swap is slower than RAM but prevents crashes)
**Effort:** 5 minutes on the server
**Investigation finding:** Infrastructure

---

### What is happening

The Droplet currently has no swap space. When physical RAM is exhausted, the Linux kernel has no fallback — it must immediately invoke the OOM killer to free memory by terminating processes. With swap, the kernel can page out less-frequently-used memory to disk, buying time for PM2's `max_memory_restart` to trigger a graceful restart instead.

**Important:** Swap does not fix the memory problem. It is a safety net. The correct fix is reducing memory usage (FIX-01 through FIX-09). Swap prevents the worst-case scenario (hard kill) while the other fixes are deployed and verified.

---

### Process flow (current — no swap)

```
RAM usage reaches 1.9 GB (out of 2 GB)
→ Kernel has no fallback
→ OOM killer selects largest process (Node.js)
→ SIGKILL — instant termination
→ Site down until PM2 restarts
```

---

### Process flow (after fix — with 2 GB swap)

```
RAM usage reaches 1.9 GB
→ Kernel begins paging less-used memory to swap
→ Process continues running (slower)
→ PM2 max_memory_restart detects RSS threshold
→ PM2 sends SIGTERM — graceful shutdown
→ Process exits cleanly, swap freed
→ New process starts at 165 MB baseline
```

---

### The fix

Run these commands on the production Droplet as root:

```bash
# 1. Create a 2 GB swap file
fallocate -l 2G /swapfile

# 2. Set correct permissions
chmod 600 /swapfile

# 3. Format as swap
mkswap /swapfile

# 4. Enable swap
swapon /swapfile

# 5. Verify swap is active
free -h
# Should show: Swap: 2.0G

# 6. Make swap permanent across reboots
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 7. Tune swappiness (optional but recommended for a server)
# Default swappiness is 60 — too aggressive for a server
# Set to 10: only use swap when RAM is 90% full
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl vm.swappiness=10
```

---

### Verify

```bash
swapon --show
# NAME      TYPE  SIZE USED PRIO
# /swapfile file    2G   0B   -2

cat /proc/sys/vm/swappiness
# 10
```

---

## FIX-11 — Authenticate exposed diagnostic routes

**Priority:** #11
**Impact:** Low for OOM, High for security
**Risk:** None
**Effort:** 10 minutes + rebuild
**Investigation finding:** API / Server Action Findings
**Status:** ✅ APPLIED
**Date:** 2025-07-14
**Changes made:**
- `src/app/api/debug-auth/route.ts` — added `requireAdmin()` guard at top of GET handler.
- `src/app/api/shipping-diagnostic/route.ts` — added `requireAdmin()` guard at top of GET handler.
**Pending:** `npm run build` + deploy to production.

---

### What is happening

Two API routes are publicly accessible with no authentication:

**`/api/debug-auth`** (`src/app/api/debug-auth/route.ts`)
- Returns: project ref, cookie names, raw cookie length, token prefix, user ID, admin row
- This is a debugging endpoint that was left enabled in production
- Any visitor can call it and learn details about the authentication implementation

**`/api/shipping-diagnostic`** (`src/app/api/shipping-diagnostic/route.ts`)
- Returns: Printify connection status, shop ID, full product list with blueprint IDs, print provider IDs, and shipping profile data
- No authentication required
- Exposes internal fulfillment configuration to anyone who calls it

Neither of these routes contributes directly to the OOM issue, but both represent unnecessary attack surface and information disclosure.

---

### The fix

**File:** `src/app/api/debug-auth/route.ts`

Option A — Add admin authentication (recommended for keeping the endpoint for debugging):

```js
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  // ... rest of existing handler
}
```

Option B — Remove the file entirely if it is no longer needed for debugging.

---

**File:** `src/app/api/shipping-diagnostic/route.ts`

```js
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  // ... rest of existing handler
}
```

The `requireAdmin` function already exists in `src/lib/require-admin.ts` and is used by all other admin routes. Adding it here is a one-line change per file.

---

## FIX-12 — Offload image optimization to external CDN

**Priority:** #12 — Long-term architectural fix
**Impact:** Critical — removes the most memory-intensive workload from the Droplet entirely
**Risk:** Medium (requires CDN account, DNS/URL changes, testing)
**Effort:** High (several hours)
**Investigation finding:** Image Optimization Findings / Confirmed Architecture

---

### What is happening

All fixes above reduce the memory impact of `/_next/image` processing. This fix eliminates it entirely by moving image optimization off the Droplet to a dedicated external service.

The fundamental architectural problem is that a 1 vCPU / 2 GB Droplet running a Next.js application server is also being asked to act as an image processing server for every product image from every CDN. These are two very different workloads with very different resource profiles:

- **Application server:** CPU-light, memory-moderate, latency-sensitive
- **Image processor:** CPU-heavy, memory-heavy, throughput-oriented

Separating them is the correct long-term solution.

---

### Option A — Cloudflare Images (recommended)

Cloudflare Images is a paid service ($5/month for 100,000 images) that handles resizing, format conversion, and CDN delivery.

**Process flow after migration:**

```
Browser requests product image
→ Cloudflare Images CDN serves resized/converted image from edge
→ Droplet receives zero image processing requests
→ Droplet memory stays at 165 MB baseline regardless of traffic
```

**Implementation:**

1. Upload product images to Cloudflare Images (or configure it to pull from Printify CDN)
2. Add a custom loader to `next.config.mjs`:

```js
// next.config.mjs
const nextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './src/lib/cloudflare-image-loader.js',
  },
};
```

3. Create `src/lib/cloudflare-image-loader.js`:

```js
export default function cloudflareLoader({ src, width, quality }) {
  const url = new URL(src);
  // Cloudflare Images URL format:
  // https://imagedelivery.net/<account-hash>/<image-id>/w=<width>,q=<quality>
  return `https://imagedelivery.net/<your-account-hash>/${encodeURIComponent(src)}/w=${width},q=${quality || 75}`;
}
```

---

### Option B — Cloudflare free tier image proxy

If you use Cloudflare as your DNS/proxy (free tier), you can configure Cloudflare to cache `/_next/image` responses at the edge. This does not eliminate the first encode on the Droplet, but subsequent requests for the same image are served from Cloudflare's edge cache without hitting the Droplet at all.

**Implementation:**

1. Add a Cloudflare Page Rule (or Cache Rule) for `bodyandsleeves.com/_next/image*`:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 day

2. This means each unique (URL, width, quality) combination is encoded once on the Droplet, then cached at Cloudflare's edge for 24 hours. Crawlers hitting the same images get Cloudflare-cached responses.

This is the lowest-effort path to CDN-level image caching and is compatible with the existing Next.js image optimizer.

---

### Option C — Disable Next.js image optimization entirely

If product images are already served from a CDN (Printify's CDN, Supabase Storage with CDN, etc.) at appropriate sizes, you can disable Next.js image optimization entirely:

```js
// next.config.mjs
images: {
  unoptimized: true,
},
```

This means browsers receive the original image URLs directly. The Droplet never processes images. The trade-off is that images are not automatically resized for different screen sizes — browsers download the full-size image and scale it in CSS.

For a POD storefront where Printify already serves optimized mockup images, this may be acceptable. Evaluate image quality and page load performance before committing to this approach.

---

---

## Verification Checklist

Use this checklist to track implementation and verify each fix is working correctly.

### Phase 1 — Immediate (no rebuild required)

- [ ] **FIX-02** — `max_memory_restart: '400M'` added to `ecosystem.config.js`
  - Verify: `pm2 describe <app-name> | grep memory`
  - Expected: `max memory restart: 400.0 MB`

- [ ] **FIX-03** — `node_args: '--max-old-space-size=512'` added to `ecosystem.config.js`
  - Verify: `pm2 describe <app-name> | grep node_args`
  - Expected: `node args: --max-old-space-size=512`

- [ ] **FIX-07** — Nginx rate limit for `/_next/image` configured
  - Verify: `nginx -t` passes, `nginx -s reload` succeeds
  - Test: burst 30 concurrent image requests, confirm 429s after burst

- [ ] **FIX-10** — Swap space added
  - Verify: `free -h` shows 2.0G swap
  - Verify: `cat /proc/sys/vm/swappiness` shows `10`
  - Verify: `/swapfile` entry in `/etc/fstab`

### Phase 2 — Next build + deploy

- [ ] **FIX-01** — AVIF removed from formats list
  - Verify: `curl -I "https://bodyandsleeves.com/_next/image?url=...&w=800&q=75" -H "Accept: image/avif,image/webp,*/*"`
  - Expected: `Content-Type: image/webp`
  - NOT expected: `Content-Type: image/avif`

- [ ] **FIX-04** — remotePatterns restricted to known hostnames
  - Verify: request `/_next/image?url=https://example.com/test.jpg&w=800&q=75`
  - Expected: `400 Bad Request` (hostname not in allowlist)
  - Verify: product images still load on storefront

- [ ] **FIX-05** — minimumCacheTTL increased to 86400
  - Verify: `grep minimumCacheTTL next.config.mjs` shows `86400`

- [ ] **FIX-06** — deviceSizes and imageSizes constrained
  - Verify: `grep deviceSizes next.config.mjs` shows reduced list

- [ ] **FIX-08** — Homepage revalidate changed from 0 to 60
  - Verify: `grep "revalidate" src/app/page.tsx` shows `60`
  - Verify: `grep "noStore" src/components/Footer.tsx` — line removed
  - Test: load homepage, check response headers for `x-nextjs-cache: HIT` on second request

- [ ] **FIX-09** — Limits added to unbounded product queries
  - Verify: `grep -n "\.limit(" src/app/shop/page.tsx` shows limit added
  - Verify: `grep -n "\.limit(" src/app/page.tsx` shows limit on category image query

- [ ] **FIX-11** — Diagnostic routes authenticated
  - Verify: `curl https://bodyandsleeves.com/api/debug-auth` returns `401`
  - Verify: `curl https://bodyandsleeves.com/api/shipping-diagnostic` returns `401`

### Phase 3 — Monitoring (48 hours after deploy)

- [ ] PM2 memory stays below 400 MB under normal traffic
  - Monitor: `pm2 monit` or `watch -n 5 "pm2 list"`

- [ ] No OOM events in kernel log
  - Check: `dmesg | grep -i "out of memory"` — should be empty after deploy

- [ ] Image responses are WebP
  - Check Nginx access log: `grep "/_next/image" /var/log/nginx/access.log | tail -20`

- [ ] Homepage serving from ISR cache
  - Check: `curl -I https://bodyandsleeves.com/` — look for `x-nextjs-cache: HIT`

- [ ] Rate limiting working
  - Check: `grep "429" /var/log/nginx/access.log | wc -l` — some 429s expected from crawlers

---

## Runtime Measurements to Confirm Root Cause

These measurements are safe to run in production and will confirm which factor is the primary OOM driver.

### Measurement 1 — Confirm image optimizer is the memory driver

```bash
# Watch PM2 memory in real time while a crawler is active:
watch -n 2 "pm2 list | grep -E 'name|memory'"

# Simultaneously watch /_next/image request rate:
tail -f /var/log/nginx/access.log | grep "/_next/image"

# If memory spikes correlate with /_next/image bursts → image optimizer confirmed as driver
```

### Measurement 2 — Check image cache hit rate

```bash
# Count total image optimizer requests in the last hour:
grep "/_next/image" /var/log/nginx/access.log | \
  awk -v d="$(date -d '1 hour ago' '+%d/%b/%Y:%H')" '$4 > "["d' | wc -l

# Check the on-disk cache size:
du -sh /var/www/bodyandsleeves/.next/cache/images/
ls /var/www/bodyandsleeves/.next/cache/images/ | wc -l

# A large number of files with recent modification times = high cache miss rate
find /var/www/bodyandsleeves/.next/cache/images/ -newer /tmp/one-hour-ago -type f | wc -l
# (create /tmp/one-hour-ago with: touch -d '1 hour ago' /tmp/one-hour-ago)
```

### Measurement 3 — Identify which crawlers are hitting image optimizer

```bash
# Top User-Agents requesting /_next/image:
grep "/_next/image" /var/log/nginx/access.log | \
  awk '{print $12}' | sort | uniq -c | sort -rn | head -20

# Top IPs requesting /_next/image:
grep "/_next/image" /var/log/nginx/access.log | \
  awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# Requests per minute for /_next/image (last 60 minutes):
grep "/_next/image" /var/log/nginx/access.log | \
  awk '{print $4}' | cut -d: -f1,2,3 | sort | uniq -c
```

### Measurement 4 — Confirm homepage is dynamic (before FIX-08)

```bash
# Check if homepage responses include cache headers:
curl -sI https://bodyandsleeves.com/ | grep -iE "cache|x-nextjs|age"

# If no x-nextjs-cache header → fully dynamic (confirms revalidate=0 is active)
# After FIX-08: should see x-nextjs-cache: HIT on second request
```

### Measurement 5 — Baseline memory after all fixes

```bash
# After deploying all fixes, record baseline:
pm2 describe <app-name> | grep "memory usage"

# Monitor over 24 hours:
# Every 5 minutes, log memory:
while true; do
  echo "$(date): $(pm2 list | grep <app-name> | awk '{print $NF}')" >> /tmp/memory-log.txt
  sleep 300
done

# Review:
cat /tmp/memory-log.txt
```

### Measurement 6 — Verify AVIF is no longer being encoded (after FIX-01)

```bash
# Check file extensions in the image cache:
find /var/www/bodyandsleeves/.next/cache/images/ -type f | \
  sed 's/.*\.//' | sort | uniq -c

# Before fix: should show .avif files
# After fix: should show only .webp files (and possibly .jpg/.png for unoptimized)
```

### Measurement 7 — Confirm no OOM events after fixes

```bash
# Check kernel OOM log:
dmesg --ctime | grep -i "out of memory\|oom\|killed process" | tail -20

# Check system log:
journalctl -k | grep -i "oom\|out of memory" | tail -20

# Should be empty after fixes are deployed and 24 hours have passed
```

---

## Summary — Implementation Order

| Order | Fix | Time Required | Rebuild? | Expected Impact |
|---|---|---|---|---|
| 1 | FIX-02 — PM2 max_memory_restart | 2 min | No | Prevents hard OOM kills immediately |
| 2 | FIX-03 — Node.js heap limit | 2 min | No | Forces GC before heap grows out of control |
| 3 | FIX-10 — Add swap space | 5 min | No | Safety net for brief spikes |
| 4 | FIX-07 — Nginx rate limit | 20 min | No | Prevents crawler burst concurrency |
| 5 | FIX-01 — Remove AVIF | 5 min | Yes | Reduces per-encode memory by 3–10× |
| 6 | FIX-08 — Homepage ISR | 2 min | Yes | Eliminates per-request server rendering |
| 7 | FIX-05 — Increase cache TTL | 2 min | Yes | Reduces re-encode frequency |
| 8 | FIX-04 — Restrict remotePatterns | 15 min | Yes | Closes open proxy risk |
| 9 | FIX-06 — Constrain image sizes | 10 min | Yes | Reduces distinct cache variants |
| 10 | FIX-09 — Add query limits | 20 min | Yes | Prevents payload growth at scale |
| 11 | FIX-11 — Auth diagnostic routes | 10 min | Yes | Security fix |
| 12 | FIX-12 — External CDN (optional) | Hours | Yes | Eliminates image processing entirely |

**Phases 1 (FIX-02, FIX-03, FIX-10, FIX-07) can be deployed today without a rebuild and will immediately reduce OOM risk.**

**Phase 2 (FIX-01, FIX-08, FIX-05, FIX-04, FIX-06, FIX-09, FIX-11) requires a single `npm run build` + deploy and should be batched together.**

---

*Investigation conducted: Body&Sleeves production environment*
*Application: Next.js 15.5.25 / Node.js 22 / PM2 / DigitalOcean 1 vCPU 2 GB*
*Report basis: Static code analysis — no production files were modified during investigation*
