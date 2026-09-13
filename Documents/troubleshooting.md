# Troubleshooting

A system-wide reference for diagnosing and fixing issues across every major feature area.

---

## Stripe

| Symptom | Likely Cause | Fix |
|---|---|---|
| "Could not connect to Stripe" on `/admin/stripe` | `STRIPE_SECRET_KEY` not in `.env.local` | Run setup in **Settings → Integrations**, then switch mode in **Admin → Stripe** |
| Balance shows $0 / no charges | Wrong mode active (test vs live) | Check the Active Mode banner on `/admin/stripe` — switch if needed |
| Orders not created after payment | Webhook not firing or signature mismatch | Verify `STRIPE_WEBHOOK_SECRET` is set in Supabase Edge Function secrets (see Stripe docs) |
| Webhook shows "Not Connected" in Integrations | Status check hitting auth guard before session loads | Refresh the page while logged in as admin |
| "Switch to LIVE" hangs indefinitely | PM2 not running, or `APP_ROOT` env var not set on server | SSH into the droplet, run `pm2 list` to confirm the process is running |
| Switch succeeds but mode doesn't change | `SUPABASE_ACCESS_TOKEN` or `SUPABASE_PROJECT_REF` not set — Supabase secrets not updated | Set both in `.env.local`, then re-switch |
| Refund fails with "No such charge" | Active mode doesn't match the charge's mode (e.g. trying to refund a live charge while in test mode) | Switch to the correct mode first |
| Webhook registered but orders still not appearing | `STRIPE_WEBHOOK_SECRET` set in `.env.local` but not in Supabase Edge Function secrets | Run: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref <ref>` |
| "Webhook registered but keys could not be saved to disk" | Server filesystem is read-only or `APP_ROOT` path is wrong | Check file permissions on the server; verify `APP_ROOT` points to the app directory |
| Re-running setup overwrites nothing / shows "already registered" | Correct — existing webhook is reused, no new secret generated | If you need to rotate: delete the webhook in the Stripe Dashboard first, then re-run setup |

---

## Checkout & Orders

| Symptom | Likely Cause | Fix |
|---|---|---|
| Checkout button does nothing | Cart is empty, or `createStripeCheckout` threw silently | Open browser console — look for a failed fetch to the `stripe-checkout` Edge Function |
| "Your cart is empty" after adding items | Cart state not persisting — `CartProvider` missing from layout | Confirm `CartProvider` wraps the app in `src/app/layout.tsx` |
| Shipping shows $6.99 for all products | No Printify shipping profiles stored | Go to **Admin → Products → Sync from Printify** to pull shipping data |
| Shipping cost is $0 | Product has a free shipping profile in Printify | Expected — not a bug |
| Order created but status stays "pending" | Webhook fired but Printify fulfillment not triggered | Check **Admin → Orders** — manually submit to Printify if needed |
| Duplicate orders for one payment | Webhook fired twice (Stripe retries on timeout) | Orders table has no unique constraint on `stripe_session_id` — add one if this recurs |
| Checkout success page spins forever | `session_id` query param missing, or order not yet written by webhook | Page polls 6 times over 9 seconds — if still spinning, check webhook logs in Supabase |
| Affiliate code not tracked | Cookie expired (30 days), or `?ref=CODE` not in URL | Confirm the referral link includes `?ref=CODE`; check localStorage for `affiliate_ref` key |

---

## Printify / Products

| Symptom | Likely Cause | Fix |
|---|---|---|
| Products not syncing | `PRINTIFY_API_TOKEN` not set, or wrong Shop ID | Set token in `.env.local`; set Shop ID in **Settings → Integrations** |
| Sync runs but products don't appear | Products are in `draft` status after sync | Go to **Admin → Products**, filter by Draft, publish the ones you want |
| Product images broken after sync | Printify CDN URL changed or image was deleted | Re-sync the product; Printify images are served from their CDN |
| Variants missing from product page | `variants` jsonb column is empty | Re-sync — variants are pulled fresh on each sync |
| Shipping shows "Fallback Rate" for a product | `shipping_info` not populated for that product | Re-sync from Printify; check **Admin → Shipping** for which products are missing profiles |
| "No products have shipping profiles" | First sync hasn't run yet, or sync failed silently | Run a full sync from **Admin → Products**; check browser console for errors |
| Printify order submission fails | Order total mismatch, or variant no longer available in Printify | Check the error in **Admin → Orders**; the variant may have been discontinued |

---

## Supabase / Database

| Symptom | Likely Cause | Fix |
|---|---|---|
| All admin pages show blank / loading forever | `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` not set | Check `.env.local` — both must be present |
| "Row Level Security" errors in console | RLS policy missing for the operation | Check Supabase Dashboard → Authentication → Policies for the affected table |
| Settings not saving | `settings` table has no row (fresh install) | Run `fresh_install.sql` in the Supabase SQL editor |
| Images not uploading | `store-images` bucket doesn't exist, or `SUPABASE_SERVICE_ROLE_KEY` not set | Create the bucket in Supabase Storage; set the service role key in `.env.local` |
| Image upload returns "Not an image" | File type check failing | Only `image/*` MIME types are accepted; max 5MB |
| Admin login fails | User not in `admins` table | Run in SQL editor: `INSERT INTO admins (id, email, role) VALUES ('<auth-uid>', 'you@example.com', 'admin')` |
| Admin login works but pages show "Access Denied" | User is in `admins` table but `requireAdmin()` check fails | Confirm the Supabase auth session cookie is being sent — try clearing cookies and logging in again |
| Affiliate tables missing | Migration `20261001000000_add_affiliates.sql` not run | Run the migration SQL in the Supabase SQL editor, or use `fresh_install.sql` on a fresh project |
| `affiliate_program_enabled` column missing | Migration `20261002000000_add_affiliate_program_enabled.sql` not run | Run: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS affiliate_program_enabled boolean DEFAULT true;` |

---

## Email (Resend)

| Symptom | Likely Cause | Fix |
|---|---|---|
| Resend shows "Not Connected" in Integrations | API key is send-only (restricted) — can't call `GET /domains` | Replace `RESEND_API_KEY` with a Full Access key from [resend.com/api-keys](https://resend.com/api-keys) |
| Transactional emails not sending | `RESEND_API_KEY` not set in Supabase Edge Function secrets | Run: `supabase secrets set RESEND_API_KEY=re_... --project-ref <ref>` |
| Emails going to spam | Sending domain not verified in Resend | Verify your domain at [resend.com/domains](https://resend.com/domains) and add the DNS records |
| "From address not allowed" error | Using a free email address (Gmail, Yahoo, etc.) | Use a custom domain address — e.g. `orders@yourdomain.com` |
| Affiliate approval email not sent | `/api/affiliates` route failed silently | Check the browser console on the admin affiliates page for a failed fetch |
| Order confirmation email not sent | Webhook fired but Resend call failed | Check Supabase Edge Function logs in the Supabase Dashboard → Edge Functions → stripe-webhook |
| Email events not appearing in `/admin/email` | `resend/webhook` route not registered in Resend | Add `https://yourdomain.com/api/resend/webhook` as a webhook in the Resend Dashboard |

---

## MailerLite

| Symptom | Likely Cause | Fix |
|---|---|---|
| MailerLite shows "Not Connected" | `MAILER_LITE_API_KEY` not set in `.env.local` | Add the key from [dashboard.mailerlite.com/integrations/api](https://dashboard.mailerlite.com/integrations/api) |
| Newsletter signup fails silently | Group ID not set, or subscriber already exists | Check **Settings → Announcements** — set a Newsletter Group ID; MailerLite returns 200 for duplicates |
| Campaigns not sending | No groups in MailerLite account | Create at least one group in MailerLite before creating a campaign |
| Subscriber count not updating | MailerLite API has a delay | Wait a few minutes and refresh — the Classic API is not real-time |
| "Account Issue" status badge | API key exists but has restricted permissions | Regenerate the key with full access in MailerLite |

---

## SEO

| Symptom | Likely Cause | Fix |
|---|---|---|
| `/sitemap.xml` returns empty | `sitemap_enabled` is false in SEO settings | Go to **Admin → SEO** and enable Sitemap XML |
| `/sitemap.xml` has wrong domain | `site_url` not set | Go to **Admin → SEO** and set the Production URL |
| Google Search Console verification failing | Verification code not saved, or page cache stale | Save the code in **Admin → SEO**, then wait for Next.js revalidation (up to 1 hour) or trigger manually |
| Product pages missing JSON-LD | `jsonld_enabled` is false | Enable JSON-LD Product Schema in **Admin → SEO** |
| OG image not showing when sharing | `default_og_image` not set, or image URL is relative | Set an absolute URL (e.g. `https://yourdomain.com/og.jpg`) in **Admin → SEO** |
| `/robots.txt` not blocking admin | `robots_noindex_admin` is false | Enable "Robots.txt — Block Admin & Checkout" in **Admin → SEO** |

---

## Media / Image Upload

| Symptom | Likely Cause | Fix |
|---|---|---|
| Upload fails with "Not an image" | Wrong file type | Only JPG, PNG, GIF, WebP accepted |
| Upload fails with size error | File over 5MB | Compress the image before uploading |
| Upload succeeds but image doesn't appear | Supabase Storage bucket is private | Set the `store-images` bucket to public in Supabase Dashboard → Storage |
| Old images not showing in media library | Images uploaded to a different bucket or folder | The media library reads from 7 specific folders in `store-images` — check the folder structure |
| Product image picker shows no products | All products are in draft status | The picker loads all products regardless of status — if empty, no products exist yet |

---

## Affiliate Program

| Symptom | Likely Cause | Fix |
|---|---|---|
| `/affiliates` returns 404 | Program is disabled | Go to **Admin → Affiliates** and flip the toggle to Enabled |
| Affiliate signup form rejects application | Eligibility check failing (< 20k followers AND < 100k views) | This is by design — both thresholds must be missed to reject |
| Clicks not being tracked | `AffiliateTracker` Suspense boundary missing, or `?ref=CODE` not in URL | Confirm `StorefrontLayout` wraps the page; check localStorage for `affiliate_ref` |
| Conversions not recording | `affiliate_code` not passed through checkout, or webhook failed | Check that `getAffiliateCode()` is called in `checkout/page.tsx`; check webhook logs |
| Approval email not sending | Resend not configured, or `/api/affiliates` route error | Check Resend connection in **Settings → Integrations**; check browser console on approve click |
| Payout shows "Stripe transfer failed" | Affiliate has no `stripe_account_id`, or Stripe Connect not set up | Enter the affiliate's Stripe Connect account ID in the payout queue, or pay manually |
| Dashboard magic link not working | Link expired (Supabase magic links expire after 1 hour) | Affiliate must request a new link from the dashboard login page |

---

## Admin Panel

| Symptom | Likely Cause | Fix |
|---|---|---|
| Admin sidebar shows "Admin" instead of store name/logo | Settings not loaded yet, or `store_name` is empty | Set Store Name in **Settings → Store Information** |
| Settings not saving | Supabase RLS blocking the update | Confirm you are logged in as an admin; check the browser console for a 403 error |
| `/admin/settings` redirects to store-information | Expected — the old monolithic settings page was replaced with a redirect | Use the sidebar links to navigate to specific sections |
| Section shows blank after navigating | `useSettings` hook failed to load — Supabase connection issue | Check browser console; confirm Supabase env vars are set |
| Danger Zone reset fails | `SUPABASE_SERVICE_ROLE_KEY` not set | Add the service role key to `.env.local` |
| Orders paused banner not showing | `orders_paused` is false in settings | Toggle in **Admin → Dashboard** or set directly in the database |

---

## Build & Deployment

| Symptom | Likely Cause | Fix |
|---|---|---|
| `useSearchParams()` build error | Component using `useSearchParams` not wrapped in `<Suspense>` | Wrap the component in `<Suspense fallback={null}>` |
| `ENOENT: .next/export/500.html` build error | Stale `.next` cache | Run `rm -rf .next && npm run build` |
| Build succeeds but pages show old content | Next.js ISR cache not cleared | Call `POST /api/revalidate` with the affected paths, or restart the server |
| `npm run build` type errors | TypeScript errors introduced | Run `npx tsc --noEmit` to see all errors before building |
| PM2 process not restarting after mode switch | `PM2_APP_NAME` env var not set, or PM2 not installed | Set `PM2_APP_NAME` in `.env.local` to match the name in `ecosystem.config.js` |
| Environment variables missing in production | `.env.local` not copied to server, or `APP_ROOT` wrong | Confirm `.env.local` exists at the path `APP_ROOT` points to on the droplet |
