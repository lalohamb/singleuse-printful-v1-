# Prompt: Strip Printify — Add Printful

Use this prompt verbatim in a new VS Code project (separate from Body&Sleeves).
It gives the AI full context on what exists, what to remove, and what to build.

---

## THE PROMPT

You are working on a Next.js 15 / Supabase / Stripe print-on-demand storefront.
The project currently uses Printify as its fulfillment provider.
Your job is to completely remove all Printify integration and replace it with Printful.
Do not mix providers. When you are done, Printify must not exist anywhere in the codebase.

---

### PART 1 — What Printify currently does (remove all of this)

**Supabase edge functions (delete these files entirely):**
- `supabase/functions/printify-proxy/index.ts` — product sync, CRUD, shipping, orders proxy
- `supabase/functions/printify-webhook/index.ts` — handles product publish and order shipment events

**`supabase/functions/stripe-checkout/index.ts`** — contains a `getLiveShippingCost()` function that calls:
```
POST https://api.printify.com/v1/shops/{shop_id}/orders/shipping.json
```
with `{ line_items: [{ product_id, variant_id, quantity }], address_to: { country: "US" } }`
and reads `data.standard` (integer cents). Remove this entire function and replace with Printful shipping.

**`supabase/functions/stripe-webhook/index.ts`** — after payment confirmed, submits order to:
```
POST https://api.printify.com/v1/shops/{shop_id}/orders.json
```
with `{ external_id, label, line_items: [{ product_id, variant_id, quantity }], shipping_method: 1, address_to }`.
Reads `PRINTIFY_API_TOKEN` and `printify_shop_id` from settings table.
Remove this block and replace with Printful order submission.

**`src/types.ts`** — remove these fields from `Product`:
- `printify_id: string | null`
- `blueprint_id: string | null`
- `print_provider_id: string | null`

Remove these fields from `CartItem`:
- `printify_id: string | null`
- `blueprint_id: string | null`
- `print_provider_id: string | null`

Remove from `Order`:
- `printify_order_id: string | null`

Remove from `StoreSettings`:
- `printify_connected: boolean`
- `printify_shop_id: string | null`

**`src/lib/cart.tsx`** — in `addToCart`, the CartItem snapshot includes:
```ts
printify_id: product.printify_id,
blueprint_id: product.blueprint_id,
print_provider_id: product.print_provider_id,
```
Remove all three. Add:
```ts
printful_id: product.printful_id,
```

**`src/app/admin/products/page.tsx`** — remove:
- `handleSyncPrintify` function
- "Sync Printify" button
- The info banner that references Printify webhook flow
- All `p.printify_id` references in the table (the "Printify: {id}" subtitle, "via Printify" badge, "Not synced" check on `printify_id`)
- The inactive tab columns "Printify ID" and "Blueprint" that check `p.printify_id` and `p.blueprint_id`

Add:
- `handleSyncPrintful` function (mirrors the old Printify sync but calls `printful-proxy/sync`)
- "Sync Printful" button in the same position
- Show `p.printful_id` as the provider ID subtitle
- "via Printful" badge where "via Printify" was

**`src/app/admin/settings/sections/Integrations.tsx`** — remove:
- The entire Printify section (shop ID input, validate button, sync warning, `printify_connected` badge)
- `validateShopId` function
- `shopValidating`, `shopValidation`, `syncedProductCount`, `originalShopId`, `isChanged`, `showSyncWarning` state
- The `supabase.from("settings").select("printify_shop_id")` query
- The `supabase.from("products")...not("printify_id", "is", null)` count query
- `SaveBar` call that saves `printify_shop_id`

Add:
- Printful section with: Store ID input, API token status indicator, "Test Connection" button, connected badge
- Save the `printful_store_id` field to the settings table

**`next.config.mjs`** — remove from `remotePatterns`:
- `images-api.printify.com`
- `*.cloudfront.net`

Add:
- `files.cdn.printful.com`
- `ucarecdn.com`

**Database** — run this migration:
```sql
ALTER TABLE products
  DROP COLUMN IF EXISTS printify_id,
  DROP COLUMN IF EXISTS blueprint_id,
  DROP COLUMN IF EXISTS print_provider_id,
  ADD COLUMN IF NOT EXISTS printful_id text UNIQUE;

ALTER TABLE orders
  DROP COLUMN IF EXISTS printify_order_id,
  ADD COLUMN IF NOT EXISTS printful_order_id text;

ALTER TABLE settings
  DROP COLUMN IF EXISTS printify_connected,
  DROP COLUMN IF EXISTS printify_shop_id,
  ADD COLUMN IF NOT EXISTS printful_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printful_store_id text;
```

---

### PART 2 — What Printful replaces it with

#### Environment variables / Supabase secrets needed
```
PRINTFUL_API_TOKEN      — Bearer token from Printful Dashboard → Settings → API
PRINTFUL_STORE_ID       — from GET /stores, e.g. "12345"
PRINTFUL_WEBHOOK_SECRET — from Printful Dashboard → Settings → Webhooks → your endpoint → Secret
```

---

#### New file: `supabase/functions/printful-proxy/index.ts`

Printful API base: `https://api.printful.com`
Auth header: `Authorization: Bearer PRINTFUL_API_TOKEN`

Implement these routes (mirror the structure of the old printify-proxy):

**GET /stores** — list Printful stores
```
GET https://api.printful.com/stores
Response: { result: [{ id, name }] }
```

**GET /products** — list sync products
```
GET https://api.printful.com/store/products?limit=100&offset=0
Response: { result: [{ id, name, thumbnail_url }] }
Paginate with ?offset= until result.length < limit
```

**GET /products/:id** — single product with variants
```
GET https://api.printful.com/store/products/{sync_product_id}
Response: {
  result: {
    sync_product: { id, name, thumbnail_url },
    sync_variants: [{
      id,           ← sync variant id (store-specific, do NOT use for orders)
      variant_id,   ← catalog variant id (USE THIS for orders and shipping)
      name,         ← "Black / S" format
      retail_price, ← string dollars "29.99"
      files: [{ type: "preview", preview_url }]
    }]
  }
}
```

**POST /sync** — sync all Printful products to the `products` DB table

Sync logic:
1. Paginate `GET /store/products` until all products fetched
2. For each product, fetch `GET /store/products/{id}` for full variant detail
3. Map to DB row:
   - `printful_id` = `String(sync_product.id)`
   - `title` = `sync_product.name`
   - `image_url` = `sync_variants[0].files.find(f => f.type === "preview")?.preview_url || sync_product.thumbnail_url`
   - `images` = array of all unique preview_urls across variants
   - `price` = `parseFloat(sync_variants[0].retail_price)` (use first variant as base price)
   - `variants` = sync_variants mapped to `{ id: String(v.variant_id), label: v.name, color, size, price: parseFloat(v.retail_price), image_url: preview_url }`
     - Parse color and size from `v.name` by splitting on " / ": `color = parts[0]`, `size = parts[1] || ""`
   - `status` = "active"
   - `shipping_info` = `{}` (Printful shipping is always live at checkout, no static profile)
4. Upsert on conflict `printful_id`
5. Delete DB rows whose `printful_id` is no longer in Printful
6. Update `settings` table: `printful_connected = true`, `printful_store_id = storeId`

**POST /orders** — submit order to Printful
```
POST https://api.printful.com/orders?confirm=true
Body: {
  external_id: "your-order-id",
  shipping: "STANDARD",
  recipient: { name, address1, city, state_code, country_code, zip, email, phone },
  items: [{ variant_id: Number, quantity, retail_price: "29.99", name: "title — label" }]
}
Response: { result: { id, status, external_id } }
```

**POST /shipping** — get shipping rates
```
POST https://api.printful.com/shipping/rates
Body: {
  recipient: { address1, city, state_code, country_code, zip },
  items: [{ variant_id: Number, quantity }],
  currency: "USD",
  locale: "en_US"
}
Response: { result: [{ id: "STANDARD", name: "Standard", rate: "4.99", currency: "USD" }] }
Use result[0].rate (cheapest). Parse to float.
```

---

#### New file: `supabase/functions/printful-webhook/index.ts`

Printful signs webhooks with HMAC-SHA256. Verify every request:
```ts
import { createHmac } from "node:crypto"; // Deno: use crypto.subtle or npm:crypto
const sig = req.headers.get("X-PF-Signature");
const rawBody = await req.text();
const expected = createHmac("sha256", Deno.env.get("PRINTFUL_WEBHOOK_SECRET")!)
  .update(rawBody).digest("hex");
if (sig !== expected) return json({ error: "Invalid signature" }, 401);
```

Handle these events:

**`package_shipped`**
```json
{
  "type": "package_shipped",
  "data": {
    "order": { "id": 123456789, "external_id": "your-order-id", "status": "fulfilled" },
    "shipment": {
      "carrier": "USPS",
      "tracking_number": "9400...",
      "tracking_url": "https://tools.usps.com/...",
      "shipped_at": "2025-07-15T10:00:00Z"
    }
  }
}
```
Action: update `orders` where `printful_order_id = String(data.order.id)`:
- `fulfillment_status = "shipped"`
- `tracking_number = data.shipment.tracking_number`
- `tracking_url = data.shipment.tracking_url`
Then send shipping email via Resend (same template as the old printify-webhook shipping email).

**`order_updated`**
Map `data.order.status` to `fulfillment_status`:
- `"fulfilled"` → `fulfillment_status = "fulfilled"`, `status = "fulfilled"`
- `"canceled"` → `fulfillment_status = "cancelled"`, `status = "cancelled"`

---

#### Modify: `supabase/functions/stripe-checkout/index.ts`

Replace `getLiveShippingCost()` with `getPrintfulShipping()`:

```ts
async function getPrintfulShipping(
  supabase: ReturnType<typeof createClient>,
  items: { printful_id: string | null; variant_id: string; quantity: number }[]
): Promise<number> {
  const FALLBACK = 6.99;
  try {
    const { data: settings } = await supabase
      .from("settings")
      .select("default_shipping_cost")
      .limit(1).maybeSingle();
    const fallback = Number(settings?.default_shipping_cost) || FALLBACK;
    const token = Deno.env.get("PRINTFUL_API_TOKEN");
    if (!token) return fallback;

    const lineItems = items
      .filter(i => i.variant_id)
      .map(i => ({ variant_id: Number(i.variant_id), quantity: i.quantity }));
    if (!lineItems.length) return fallback;

    const res = await fetch("https://api.printful.com/shipping/rates", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { address1: "1 Main St", city: "New York", state_code: "NY", country_code: "US", zip: "10001" },
        items: lineItems,
        currency: "USD",
        locale: "en_US",
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const rate = parseFloat(data?.result?.[0]?.rate ?? "0");
    return rate > 0 ? rate : fallback;
  } catch {
    return 6.99;
  }
}
```

Also update the DB select in stripe-checkout from:
```ts
.select("id, title, image_url, images, printify_id, variants, price")
```
to:
```ts
.select("id, title, image_url, images, printful_id, variants, price")
```

And in `verifiedItems`, replace `printify_id: product.printify_id` with `printful_id: product.printful_id`.

In the Stripe session metadata `items` array, replace:
```ts
{ printify_id: item.printify_id, variant_id, quantity }
```
with:
```ts
{ printful_id: item.printful_id, variant_id, quantity }
```

In the Stripe `product_data.metadata`, replace:
```ts
printify_product_id: item.printify_id || "",
printify_variant_id: item.variant_id,
```
with:
```ts
printful_product_id: item.printful_id || "",
printful_variant_id: item.variant_id,
```

---

#### Modify: `supabase/functions/stripe-webhook/index.ts`

Replace the entire Printify order submission block with Printful:

REMOVE this block:
```ts
const printifyToken = Deno.env.get("PRINTIFY_API_TOKEN");
const { data: settingsData } = await supabase.from("settings").select("printify_shop_id")...
const printifyShopId = settingsData?.printify_shop_id || Deno.env.get("PRINTIFY_SHOP_ID");
if (printifyToken && printifyShopId && session.metadata?.items) {
  // ... POST to printify orders.json ...
  // ... update printify_order_id ...
}
```

ADD this block in its place:
```ts
const printfulToken = Deno.env.get("PRINTFUL_API_TOKEN");
if (printfulToken && session.metadata?.items) {
  try {
    const items = JSON.parse(session.metadata.items);
    const shippingAddress = JSON.parse(session.metadata.shipping_address || "{}");
    const nameParts = (session.metadata.shipping_name || "").split(" ");

    const printfulOrder = {
      external_id: session.id,
      shipping: "STANDARD",
      recipient: {
        name: session.metadata.shipping_name || "",
        address1: shippingAddress.line1 || "",
        address2: shippingAddress.line2 || "",
        city: shippingAddress.city || "",
        state_code: shippingAddress.state || "",
        country_code: shippingAddress.country || "US",
        zip: shippingAddress.zip || "",
        email: session.metadata.email || "",
        phone: session.customer_details?.phone || session.metadata?.phone || "",
      },
      items: items.map((item: any) => ({
        variant_id: Number(item.variant_id),
        quantity: item.quantity,
        retail_price: String((item.price || 0).toFixed(2)),
        name: item.title || "",
        ...(item.personalization_text || item.pt
          ? { files: [{ type: "default", url: "", options: [{ id: "text", value: item.personalization_text || item.pt }] }] }
          : {}),
      })),
    };

    const printfulRes = await fetch("https://api.printful.com/orders?confirm=true", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${printfulToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(printfulOrder),
    });

    if (printfulRes.ok) {
      const printfulData = await printfulRes.json();
      await supabase
        .from("orders")
        .update({
          printful_order_id: String(printfulData.result.id),
          fulfillment_status: printfulData.result.status || "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", session.id);
    } else {
      const errText = await printfulRes.text();
      console.error("Printful order failed:", printfulRes.status, errText.replace(/[\r\n]/g, " "));
    }
  } catch (printfulErr) {
    console.error("Printful order submission failed:", String((printfulErr as any)?.message ?? printfulErr).replace(/[\r\n]/g, " "));
  }
}
```

---

### PART 3 — Types after migration

**`src/types.ts` — Product interface** (replace Printify fields):
```ts
export interface Product {
  id: string;
  printful_id: string | null;   // ← replaces printify_id
  title: string;
  description: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  image_url: string | null;
  images: string[];
  status: string;
  featured: boolean;
  is_new_arrival: boolean;
  is_trending: boolean;
  is_bestseller: boolean;
  is_on_sale: boolean;
  content_locked: boolean;
  is_personalizable: boolean;
  personalization_label: string | null;
  variants: ProductVariant[];
  shipping_info: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // blueprint_id, print_provider_id REMOVED — not used by Printful
}
```

**`src/types.ts` — CartItem interface**:
```ts
export interface CartItem {
  product_id: string;
  title: string;
  price: number;
  image_url: string;
  quantity: number;
  variant_id: string;
  variant_label: string;
  printful_id: string | null;   // ← replaces printify_id, blueprint_id, print_provider_id
  personalization_text?: string;
}
```

**`src/types.ts` — Order interface** (replace):
```ts
printful_order_id: string | null;  // ← replaces printify_order_id
```

**`src/types.ts` — StoreSettings interface** (replace):
```ts
printful_connected: boolean;       // ← replaces printify_connected
printful_store_id: string | null;  // ← replaces printify_shop_id
```

---

### PART 4 — Admin UI changes

**`src/app/admin/products/page.tsx`**

Replace `handleSyncPrintify` with:
```ts
const handleSyncPrintful = async () => {
  setSyncing(true); setSyncMsg(null);
  try {
    const { data: settingsData } = await supabase.from("settings").select("printful_store_id").limit(1).maybeSingle();
    const storeId = settingsData?.printful_store_id || process.env.NEXT_PUBLIC_PRINTFUL_STORE_ID;
    if (!storeId) { setSyncMsg("No Printful Store ID set. Add it in Admin → Settings."); setSyncing(false); return; }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${supabaseUrl}/functions/v1/printful-proxy/sync?store_id=${storeId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: "Sync failed" })); throw new Error(err.error || "Sync failed"); }
    const data = await res.json();
    setSyncMsg(`Synced ${data.synced || 0} products from Printful${data.deleted ? ` · ${data.deleted} removed` : ""}.`);
    fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/", "/shop"] }) });
    fetchData();
  } catch (err) { setSyncMsg(err instanceof Error ? err.message : "Sync failed"); }
  finally { setSyncing(false); }
};
```

Replace the "Sync Printify" button with:
```tsx
<button onClick={handleSyncPrintful} disabled={syncing} className="btn-outline py-2">
  {syncing ? <Loader2 size={18} className="mr-2 animate-spin" /> : <RefreshCw size={18} className="mr-2" />}
  Sync Printful
</button>
```

In the product table rows, replace `p.printify_id` references:
- Subtitle: `{p.printful_id && <p className="text-xs text-secondary-400 truncate">Printful: {p.printful_id}</p>}`
- Badge: `{p.status === "active" && p.printful_id && <span className="ml-1.5 text-[10px] text-secondary-400">via Printful</span>}`
- Manual badge: `{p.status === "active" && !p.printful_id && <span className="ml-1.5 text-[10px] text-gold-500">via Manual</span>}`

In the inactive tab, rename the "Printify ID" column to "Printful ID" and check `p.printful_id`.
Remove the "Blueprint" column entirely (Printful has no blueprint concept).

**`src/app/admin/settings/sections/Integrations.tsx`**

Replace the entire Printify section with:
```tsx
{/* Printful */}
<div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
  <div className="flex items-center gap-3">
    <Printer size={22} className={form.printful_connected ? "text-success-500" : "text-secondary-400"} />
    <div>
      <p className="font-medium text-secondary-900">Printful</p>
      <p className="text-sm text-secondary-500">Print-on-demand fulfillment</p>
    </div>
  </div>
  <span className={`text-xs px-3 py-1 rounded-full ${form.printful_connected ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}>
    {form.printful_connected ? "Connected" : "Not Connected"}
  </span>
</div>
<div className="space-y-2">
  <label className="label-text">Printful Store ID</label>
  <div className="flex gap-2">
    <input
      value={form.printful_store_id || ""}
      onChange={(e) => set("printful_store_id", e.target.value)}
      placeholder="e.g. 12345"
      className="input-field flex-1"
    />
    <button
      onClick={validatePrintfulStore}
      disabled={storeValidating || !(form.printful_store_id || "").trim()}
      className="btn-outline px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-50"
    >
      {storeValidating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
      {storeValidating ? "Checking..." : "Validate"}
    </button>
  </div>
  <p className="text-xs text-secondary-400">Find this in Printful Dashboard → Settings → Stores, or via GET /stores.</p>
  {storeValidation && (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${storeValidation.ok ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>
      {storeValidation.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
      {storeValidation.msg}
    </div>
  )}
</div>
```

Add `validatePrintfulStore` function:
```ts
const validatePrintfulStore = async () => {
  const storeId = (form.printful_store_id || "").trim();
  if (!storeId) return;
  setStoreValidating(true); setStoreValidation(null);
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${supabaseUrl}/functions/v1/printful-proxy/stores`, {
      headers: { Authorization: `Bearer ${anonKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      const store = (data.result || []).find((s: any) => String(s.id) === storeId);
      if (store) setStoreValidation({ ok: true, msg: `Store found: "${store.name}"` });
      else setStoreValidation({ ok: false, msg: "Store ID not found in your Printful account" });
    } else {
      setStoreValidation({ ok: false, msg: "Could not reach Printful — check your API token" });
    }
  } catch {
    setStoreValidation({ ok: false, msg: "Connection failed" });
  }
  setStoreValidating(false);
};
```

Update `SaveBar` to save `printful_store_id` instead of `printify_shop_id`:
```tsx
<SaveBar onSave={() => save({ printful_store_id: form.printful_store_id })} saved={saved} error={error} />
```

---

### PART 5 — Printful key differences to keep in mind

| Topic | Detail |
|---|---|
| Variant ID | Use `sync_variants[].variant_id` (catalog ID) for orders/shipping — NOT `sync_variants[].id` (sync ID) |
| Prices | String dollars `"29.99"` — use `parseFloat()`, multiply by 100 for Stripe |
| Order confirmation | Always append `?confirm=true` to `POST /orders` — without it orders stay in draft and are never produced |
| Webhook signing | Printful signs with HMAC-SHA256 in `X-PF-Signature` header — always verify |
| Shipping | No static profile — always call `POST /shipping/rates` live at checkout |
| Image CDN | `files.cdn.printful.com` and `ucarecdn.com` — add both to `next.config.mjs` remotePatterns |
| No blueprint/provider | Printful has no `blueprint_id` or `print_provider_id` — remove those columns and fields entirely |
| Store ID | Some Printful endpoints are store-scoped. Store the ID in settings and pass as needed |

---

### PART 6 — Files summary

| File | Action |
|---|---|
| `supabase/functions/printify-proxy/index.ts` | DELETE entirely |
| `supabase/functions/printify-webhook/index.ts` | DELETE entirely |
| `supabase/functions/printful-proxy/index.ts` | CREATE new |
| `supabase/functions/printful-webhook/index.ts` | CREATE new |
| `supabase/functions/stripe-checkout/index.ts` | MODIFY — replace shipping function |
| `supabase/functions/stripe-webhook/index.ts` | MODIFY — replace fulfillment block |
| `src/types.ts` | MODIFY — swap all Printify fields for Printful |
| `src/lib/cart.tsx` | MODIFY — swap CartItem snapshot fields |
| `src/app/admin/products/page.tsx` | MODIFY — swap sync button and ID references |
| `src/app/admin/settings/sections/Integrations.tsx` | MODIFY — swap Printify section for Printful |
| `next.config.mjs` | MODIFY — swap image hostnames |
| `supabase/migrations/YYYYMMDD_printify_to_printful.sql` | CREATE — DB column swap |

**Files that do NOT change:**
- All storefront pages (`/shop`, `/product/[id]`, homepage, checkout)
- Cart UI components
- All Stripe configuration and keys
- Resend email templates (reuse as-is)
- MailerLite integration
- All other admin pages
- RLS policies
