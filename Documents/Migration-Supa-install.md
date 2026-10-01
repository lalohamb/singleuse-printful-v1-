# Supabase Migration — Fresh Install Guide

How to rebuild the database from scratch on a new Supabase project.
Captures every issue hit during the original migration and how to resolve them.

---

## Prerequisites

### 1. Install the real Supabase CLI (not the npm wrapper)

```bash
curl -fsSL https://github.com/supabase/cli/releases/download/v2.26.9/supabase_linux_amd64.tar.gz -o /tmp/supabase.tar.gz
tar -xzf /tmp/supabase.tar.gz -C /tmp
mv /tmp/supabase ~/.local/bin/supabase
supabase --version
```

> Do NOT use `npm install -g supabase` — that installs a broken wrapper that
> rejects valid `sbp_` tokens.

### 2. Install psql (needed to fix stuck migrations)

```bash
sudo apt-get install -y postgresql-client
```

---

## Step 1 — Get your credentials

| What | Where to find it |
|---|---|
| Personal access token (`sbp_...`) | supabase.com/dashboard/account/tokens → Generate new token |
| Project ref | supabase.com/dashboard/project/**`xuojbqklykhbawgnnisf`** |
| DB password | Supabase dashboard → Settings → Database → Database password |

---

## Step 2 — Fix .env.local before linking

The Supabase CLI parses `.env.local` and will fail if it contains bare values
with no variable name or an incomplete URL.

Check for these two issues:

```bash
cat -A .env.local | head -30
```

Fix any line that looks like:
```
sbp_fc41f938c9a4afdced98025a0a3f665b718c3635   ← bare token, no variable name — DELETE this line
NEXT_PUBLIC_SUPABASE_URL=https://.supabase.com  ← incomplete URL — fix to full URL
```

Correct values:
```
NEXT_PUBLIC_SUPABASE_URL=https://xuojbqklykhbawgnnisf.supabase.co
```

---

## Step 3 — Login and link

```bash
supabase login --token sbp_YOUR_TOKEN_HERE
supabase link --project-ref xuojbqklykhbawgnnisf
```

Enter your DB password when prompted.

---

## Step 4 — Fix migration file ordering issues

Several migration files had timestamps that caused ordering problems.
These renames are already done in this repo — document them here for reference.

### Files moved to `migrations/old/` (skip entirely — superseded or Printify-specific)
- `20260903200000_add_printify_shop_id.sql`
- `20260913000000_delete_stale_printify_products.sql`
- `20260914000000_reset_unpublished_products_to_draft.sql`
- `20261013000000_add_printful.sql` (superseded by `20261014000000_printify_to_printful.sql`)

### Files renamed to fix sort order
| Original name | Renamed to | Reason |
|---|---|---|
| `20240101_affiliate_rls.sql` | `20261001000001_affiliate_rls.sql` | Ran before `affiliates` table existed |
| `20250715_cleanup_unconfirmed_users.sql` | `20261015000000_cleanup_unconfirmed_users.sql` | Ran before schema existed |
| `20260920000000_fix_gradient_opacity_types.sql` | `20260920000002_fix_gradient_opacity_types.sql` | Timestamp collision + column didn't exist yet |
| `20250727_printify_to_printful.sql` | `20261014000000_printify_to_printful.sql` | Must run last, after all other migrations |

### File rewritten to be safe on fresh DB
`20260920000002_fix_gradient_opacity_types.sql` — original assumed columns
already existed. Rewritten to `ADD COLUMN IF NOT EXISTS` first:

```sql
alter table settings
  add column if not exists hero_gradient_opacity    numeric,
  add column if not exists our_why_gradient_opacity numeric;

alter table settings
  alter column hero_gradient_opacity    type numeric using hero_gradient_opacity::numeric,
  alter column our_why_gradient_opacity type numeric using our_why_gradient_opacity::numeric;
```

---

## Step 5 — Push migrations

```bash
supabase db push
```

If you see:
```
Found local migration files to be inserted before the last migration on remote database.
```
Run:
```bash
supabase db push --include-all
```

---

## Known errors and fixes

### `relation "affiliates" does not exist`
The RLS file ran before the affiliates table was created.
Fix: rename `20240101_affiliate_rls.sql` → `20261001000001_affiliate_rls.sql` ✓ already done.

### `column "hero_gradient_opacity" does not exist`
The fix migration assumed the column existed. Rewrite it to add the column
first with `ADD COLUMN IF NOT EXISTS`. ✓ already done.

### `duplicate key value violates unique constraint "schema_migrations_pkey"`
Happens when a migration runs successfully but fails to record itself (e.g.
because the file was edited after a partial run). Fix by deleting the stuck
record and re-running:

```bash
psql "postgresql://postgres:DB_PASSWORD@db.xuojbqklykhbawgnnisf.supabase.co:5432/postgres" \
  -c "DELETE FROM supabase_migrations.schema_migrations WHERE version = 'STUCK_VERSION';"
supabase db push
```

Replace `STUCK_VERSION` with the version shown in the error (e.g. `20260920000001`).

### `schema "cron" does not exist`
`pg_cron` is not enabled. The cleanup migration is optional — move it to `old/`:

```bash
mv supabase/migrations/20261015000000_cleanup_unconfirmed_users.sql \
   supabase/migrations/old/
```

---

## Step 6 — Verify the schema

```bash
psql "postgresql://postgres:DB_PASSWORD@db.xuojbqklykhbawgnnisf.supabase.co:5432/postgres" \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('printful_id','printify_id','blueprint_id','print_provider_id') ORDER BY column_name;"

psql "postgresql://postgres:DB_PASSWORD@db.xuojbqklykhbawgnnisf.supabase.co:5432/postgres" \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name IN ('printful_order_id','printify_order_id') ORDER BY column_name;"

psql "postgresql://postgres:DB_PASSWORD@db.xuojbqklykhbawgnnisf.supabase.co:5432/postgres" \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name IN ('printful_connected','printful_store_id','printify_connected','printify_shop_id') ORDER BY column_name;"
```

Expected output:
- `products` → `printful_id` only (no printify_id, blueprint_id, print_provider_id)
- `orders` → `printful_order_id` only (no printify_order_id)
- `settings` → `printful_connected`, `printful_store_id` only (no printify_* columns)

---

## Step 7 — Set edge function secrets

```bash
supabase secrets set PRINTFUL_API_TOKEN=your_token_here
supabase secrets set PRINTFUL_STORE_ID=your_store_id_here
supabase secrets set PRINTFUL_WEBHOOK_SECRET=your_webhook_secret_here
```

Get these from:
- `PRINTFUL_API_TOKEN` — Printful Dashboard → Settings → API → Generate token
- `PRINTFUL_STORE_ID` — Printful Dashboard → Stores, or call `GET /stores` after deploying
- `PRINTFUL_WEBHOOK_SECRET` — Printful Dashboard → Settings → Webhooks → your endpoint → Secret

---

## Step 8 — Deploy edge functions

```bash
supabase functions deploy printful-proxy
supabase functions deploy printful-webhook
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```

---

## Step 9 — Register the Printful webhook

In Printful Dashboard → Settings → Webhooks → Add endpoint:

```
https://xuojbqklykhbawgnnisf.supabase.co/functions/v1/printful-webhook
```

Subscribe to these events:
- `package_shipped`
- `order_updated`

Copy the **Secret** shown after saving — use it for `PRINTFUL_WEBHOOK_SECRET` in Step 7.

> Note: Set secrets (Step 7) and deploy functions (Step 8) before registering
> the webhook, otherwise Printful can't reach the endpoint.

---

## Step 10 — Test the integration

**Validate Printful connection:**
1. Admin → Settings → Integrations → enter Printful Store ID → click **Validate**
2. Should show `Store found: "Your Store Name"`

**Sync products:**
3. Admin → Products → click **Sync Printful**
4. Confirm products appear with `via Printful` badge
5. Check images load correctly (must come from `files.cdn.printful.com` or `ucarecdn.com`)

**Test checkout end-to-end:**
6. Place a test order in Stripe test mode
7. Confirm order appears in Admin → Orders with a Printful Order ID
8. Confirm order appears in Printful Dashboard → Orders

**Test shipping webhook:**
9. In Printful Dashboard → Orders → find your test order → manually trigger a shipment event
10. Confirm the order in Admin → Orders updates to `shipped` with a tracking number
11. Confirm the shipping email is sent via Resend

---

## Supabase secrets reference

All secrets set via `supabase secrets set` are available to edge functions as
`Deno.env.get("SECRET_NAME")`. To view currently set secrets:

```bash
supabase secrets list
```

Full list of secrets this project uses:

| Secret | Required | Description |
|---|---|---|
| `PRINTFUL_API_TOKEN` | ✓ | Bearer token from Printful Dashboard → Settings → API |
| `PRINTFUL_STORE_ID` | ✓ | Numeric store ID, e.g. `12345` |
| `PRINTFUL_WEBHOOK_SECRET` | ✓ | HMAC secret from Printful webhook settings |
| `STRIPE_SECRET_KEY` | ✓ | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | ✓ | `whsec_...` from Stripe webhook endpoint |
| `SUPABASE_URL` | auto | Set automatically by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | auto | Set automatically by Supabase |
| `RESEND_API_KEY` | optional | For order confirmation and shipping emails |
| `MAILER_LITE_API_KEY` | optional | For newsletter subscriber sync |
| `SITE_URL` | ✓ | Your production domain, e.g. `https://yourdomain.com` |
| `EMAIL_FROM` | optional | Fallback sender address if not set in DB settings |
