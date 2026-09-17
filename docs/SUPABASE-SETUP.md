# Supabase Setup

The storefront uses Supabase for its database, authentication, and Edge Functions. You need your own Supabase project — the application does not share any database with the original developer.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in or create an account.
2. Click **New project**.
3. Choose an organization, give the project a name, set a database password, and select a region close to your customers.
4. Wait for the project to finish provisioning (about 1–2 minutes).

---

## 2. Obtain Your Credentials

From your project dashboard go to **Project Settings → API**:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g. `https://abcdefgh.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API Keys → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API Keys → `service_role secret` |

From **Project Settings → General**:

| Variable | Where to find it |
|---|---|
| `SUPABASE_PROJECT_REF` | Reference ID (the short alphanumeric string, e.g. `abcdefghijklmnop`) |

Add all four to your `.env.local`.

---

## 3. Run the Database Schema

The full schema is in `supabase/fresh_install.sql`. Run it once on a fresh project.

1. In your Supabase dashboard go to **SQL Editor**.
2. Click **New query**.
3. Open `supabase/fresh_install.sql` from your local project, copy the entire contents, and paste it into the editor.
4. Click **Run**.

This creates all tables, RLS policies, indexes, and seed data (default categories, settings row, policy rows, SEO settings row).

**Do not run `fresh_install.sql` on a project that already has data** — it uses `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` guards, but review it first if you are unsure.

---

## 4. Apply Incremental Migrations (if needed)

If you are updating an existing installation rather than starting fresh, apply the numbered migration files in `supabase/migrations/` in order using the Supabase CLI:

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Log in
npx supabase login

# Push pending migrations
npx supabase db push --project-ref <your-project-ref>
```

Or apply individual files via the SQL Editor if the CLI is not available.

---

## 5. Supabase Personal Access Token

The admin Stripe setup and mode-switch routes use the Supabase Management API to push Stripe secrets directly to your Edge Functions. This requires a personal access token.

1. Go to [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
2. Click **Generate new token**, give it a name (e.g. `storefront-admin`), and copy the value.
3. Add it to `.env.local` as `SUPABASE_ACCESS_TOKEN`.

**Security:** This token has broad access to your Supabase account. Keep it server-only. Never prefix it with `NEXT_PUBLIC_`. Never commit it to Git. It must remain set as long as you use the admin Stripe setup UI.

---

## Edge Functions

The storefront uses four Supabase Edge Functions. They run on Deno and must be deployed to your project before checkout or product sync will work.

| Function | JWT Required | Purpose |
|---|---|---|
| `printify-proxy` | Yes | Authenticated proxy to the Printify API |
| `printify-webhook` | No | Receives Printify push events (product publish, order shipped/fulfilled) |
| `stripe-checkout` | No | Creates Stripe Checkout sessions and inserts pending orders |
| `stripe-webhook` | No | Handles Stripe events to advance order state and trigger Printify fulfillment |

### Deploy All Functions

```bash
npx supabase functions deploy printify-proxy   --project-ref <your-project-ref>
npx supabase functions deploy printify-webhook --project-ref <your-project-ref>
npx supabase functions deploy stripe-checkout  --project-ref <your-project-ref>
npx supabase functions deploy stripe-webhook   --project-ref <your-project-ref>
```

Or all at once:

```bash
npx supabase functions deploy printify-proxy printify-webhook stripe-checkout stripe-webhook --project-ref <your-project-ref>
```

### Set Edge Function Secrets

Edge Functions read secrets from Supabase's secret store, not from `.env.local`. Set them once:

```bash
npx supabase secrets set \
  PRINTIFY_API_TOKEN=<your-printify-api-token> \
  PRINTIFY_SHOP_ID=<your-printify-shop-id> \
  STRIPE_SECRET_KEY=sk_test_<your-stripe-test-key> \
  STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret> \
  RESEND_API_KEY=re_<your-resend-key> \
  --project-ref <your-project-ref>
```

`RESEND_API_KEY` is optional — omit it if you are not using Resend.

The admin Stripe setup panel (`/admin/stripe`) can push `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` automatically when you connect Stripe. The Printify and Resend secrets must be set manually via the CLI.

### Verify Secrets

```bash
npx supabase secrets list --project-ref <your-project-ref>
```

This shows secret names only — values are never displayed.

---

## Row Level Security

RLS is enabled on all tables. The policies are created by `fresh_install.sql`. Do not disable RLS as a shortcut — the application is designed to work with RLS enabled.

Key access rules:
- `products`, `categories`, `settings`, `policies`, `seo_settings` — public read, admin write
- `orders` — public insert (checkout), admin read/update/delete
- `admins` — authenticated users can read their own row only; super_admin can insert/delete
- `email_events`, `affiliates`, `affiliate_*` — admin only

---

## Authentication

The admin panel uses Supabase Auth (email/password). To create your first admin account:

1. Go to **Authentication → Users** in your Supabase dashboard.
2. Click **Add user** and create a user with your email and a strong password.
3. In the **SQL Editor**, insert a row into the `admins` table:

```sql
INSERT INTO admins (id, email, role)
VALUES ('<your-auth-user-uuid>', '<your-email>', 'super_admin');
```

Replace `<your-auth-user-uuid>` with the UUID shown in the Authentication → Users list.

You can now log in at `/admin` with those credentials.
