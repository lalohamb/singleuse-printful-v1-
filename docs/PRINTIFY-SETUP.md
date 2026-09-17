# Printify Setup

The storefront connects to Printify for product catalog management and order fulfillment. All Printify API calls are made server-side through Supabase Edge Functions — your API token is never exposed to the browser.

---

## 1. Obtain Your Printify API Token

1. Log in to [printify.com](https://printify.com).
2. Go to **My Account → Connections**.
3. Under **API Access**, click **Generate new token**.
4. Copy the token — it is only shown once.

Add it to `.env.local`:
```
PRINTIFY_API_TOKEN=<your-printify-api-token>
```

Also set it as a Supabase Edge Function secret:
```bash
npx supabase secrets set PRINTIFY_API_TOKEN=<your-printify-api-token> --project-ref <your-project-ref>
```

---

## 2. Obtain Your Printify Shop ID

Your shop ID is the numeric identifier for your Printify store.

1. In Printify, go to **My Stores**.
2. Select your store — the shop ID appears in the URL: `printify.com/app/store/<shop-id>/...`
3. Alternatively, after setting your API token you can call the Printify API to list your shops.

Add it to `.env.local` in two places:

```
NEXT_PUBLIC_PRINTIFY_SHOP_ID=<your-printify-shop-id>
PRINTIFY_SHOP_ID=<your-printify-shop-id>
```

Also set it as a Supabase Edge Function secret:
```bash
npx supabase secrets set PRINTIFY_SHOP_ID=<your-printify-shop-id> --project-ref <your-project-ref>
```

---

## Variable Differences

| Variable | Visibility | Used by |
|---|---|---|
| `NEXT_PUBLIC_PRINTIFY_SHOP_ID` | Browser-safe | Client-side requests to `printify-proxy` edge function |
| `PRINTIFY_SHOP_ID` | Server only | `printify-webhook` and `stripe-webhook` edge functions |
| `PRINTIFY_API_TOKEN` | Server only | All three Printify-related edge functions |

The shop ID itself is not sensitive — it is a numeric identifier. The API token is sensitive and must remain server-only.

---

## 3. Product Sync

After deploying the edge functions and setting secrets, sync your Printify products to the storefront database:

1. Log in to the admin panel at `/admin`.
2. Go to **Products**.
3. Click **Sync from Printify**.

The `printify-proxy` edge function paginates through all your Printify products (50 per page), fetches full product details and shipping profiles, and upserts them into the `products` table.

**Content lock:** If you edit a product's title, description, or images in the admin panel and enable the content lock, those fields will not be overwritten on the next sync. Commerce fields (price, variants, status) are always refreshed.

---

## 4. Printify Webhook (Optional)

The `printify-webhook` edge function receives push events from Printify for:

- `product:publish` / `product:publish:started` — automatically upserts the product to the database
- `order:shipment:created` — updates order fulfillment status and sends a shipping notification email
- `order:fulfilled` — marks the order as fulfilled

To register the webhook in Printify:

1. In Printify, go to **My Account → Connections → Webhooks**.
2. Add a new webhook with the URL:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/printify-webhook
   ```
3. Select the events you want to receive.

This is optional — product sync via the admin panel works without it.

---

## 5. Order Fulfillment

When a customer completes checkout, the `stripe-webhook` edge function automatically submits the order to Printify via the Printify Orders API. No manual action is required.

The `printify_shop_id` used for fulfillment is read from the `settings` table (set during admin Stripe/Printify connection), with a fallback to the `PRINTIFY_SHOP_ID` edge function secret.
