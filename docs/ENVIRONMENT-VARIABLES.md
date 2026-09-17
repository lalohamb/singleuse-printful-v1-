# Environment Variables

Copy `.env.example` to `.env.local` and fill in your values. Never commit `.env.local` to Git.

---

## Security Rules

`NEXT_PUBLIC_*` variables are embedded in browser-side JavaScript and are visible to anyone who visits your site. Only non-sensitive values should use this prefix.

Server secrets — service role keys, API tokens, webhook secrets — must **never** use `NEXT_PUBLIC_*` and must never be committed to version control.

---

## Supabase

### NEXT_PUBLIC_SUPABASE_URL

| | |
|---|---|
| Required | Yes |
| Visibility | Browser-safe |
| Purpose | Your Supabase project's REST and Auth endpoint URL |
| Obtained from | Supabase Dashboard → Project Settings → API → Project URL |

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
```

---

### NEXT_PUBLIC_SUPABASE_ANON_KEY

| | |
|---|---|
| Required | Yes |
| Visibility | Browser-safe |
| Purpose | Public anon key for client-side Supabase queries (subject to RLS) |
| Obtained from | Supabase Dashboard → Project Settings → API → Project API Keys → `anon public` |

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

---

### SUPABASE_SERVICE_ROLE_KEY

| | |
|---|---|
| Required | Yes |
| Visibility | Server only — never expose to browser |
| Purpose | Privileged server-side Supabase access. Bypasses RLS. Used by API routes and edge functions. |
| Obtained from | Supabase Dashboard → Project Settings → API → Project API Keys → `service_role secret` |
| Security | Never prefix with `NEXT_PUBLIC_`. Never commit to Git. |

```
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

---

### SUPABASE_ACCESS_TOKEN

| | |
|---|---|
| Required | Required for admin Stripe setup/switch routes |
| Visibility | Server only — never expose to browser |
| Purpose | Supabase personal access token. Used by `/api/stripe-setup` and `/api/stripe-switch` to push Stripe secrets to your Supabase Edge Functions via the Supabase Management API. |
| Obtained from | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) — generate a new token |
| Security | This is a personal access token with broad account access. Never prefix with `NEXT_PUBLIC_`. Never commit to Git. |
| Ongoing requirement | This variable must remain set as long as you use the admin Stripe setup/switch UI. It is read at request time, not only during initial setup. |

```
SUPABASE_ACCESS_TOKEN=<your-supabase-personal-access-token>
```

---

### SUPABASE_PROJECT_REF

| | |
|---|---|
| Required | Required for admin Stripe setup/switch routes |
| Visibility | Server only |
| Purpose | Your Supabase project reference ID. Used alongside `SUPABASE_ACCESS_TOKEN` to target the correct project when pushing Edge Function secrets. |
| Obtained from | Supabase Dashboard → Project Settings → General → Reference ID (e.g. `abcdefghijklmnop`) |

```
SUPABASE_PROJECT_REF=<your-supabase-project-ref>
```

---

## Printify

### NEXT_PUBLIC_PRINTIFY_SHOP_ID

| | |
|---|---|
| Required | Yes |
| Visibility | Browser-safe |
| Purpose | Your Printify shop ID, used in client-side requests to the `printify-proxy` edge function |
| Obtained from | Printify Dashboard → My Stores → select your store → the numeric ID in the URL, or via API |

```
NEXT_PUBLIC_PRINTIFY_SHOP_ID=<your-printify-shop-id>
```

---

### PRINTIFY_SHOP_ID

| | |
|---|---|
| Required | Yes |
| Visibility | Server only (Edge Function secret) |
| Purpose | Same shop ID used server-side in Edge Functions (`printify-webhook`, `stripe-webhook`) |
| Obtained from | Same as above |
| Note | Set this as both a `.env.local` variable and a Supabase Edge Function secret |

```
PRINTIFY_SHOP_ID=<your-printify-shop-id>
```

---

### PRINTIFY_API_TOKEN

| | |
|---|---|
| Required | Yes |
| Visibility | Server only (Edge Function secret) |
| Purpose | Authenticates server-side requests to the Printify API. Used by `printify-proxy`, `printify-webhook`, and `stripe-webhook` edge functions. |
| Obtained from | Printify Dashboard → My Account → Connections → API Access → Generate Token |
| Security | Never prefix with `NEXT_PUBLIC_`. Never commit to Git. Set as a Supabase Edge Function secret. |

```
PRINTIFY_API_TOKEN=<your-printify-api-token>
```

---

## Stripe

### STRIPE_SECRET_KEY

| | |
|---|---|
| Required | Yes |
| Visibility | Server only |
| Purpose | Authenticates server-side Stripe API requests. Used by the `stripe-checkout` and `stripe-webhook` edge functions, and by the admin Stripe panel. |
| Obtained from | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) — use `sk_test_...` for test mode, `sk_live_...` for live |
| Security | Never prefix with `NEXT_PUBLIC_`. Never commit to Git. |

```
STRIPE_SECRET_KEY=sk_test_<your-stripe-test-secret-key>
```

---

### STRIPE_WEBHOOK_SECRET

| | |
|---|---|
| Required | Yes |
| Visibility | Server only |
| Purpose | Verifies that incoming webhook events genuinely originate from Stripe. Used by the `stripe-webhook` edge function. |
| Obtained from | Automatically registered and saved when you use the admin Stripe setup panel. Or manually from Stripe Dashboard → Webhooks → your endpoint → Signing secret. |
| Security | Never prefix with `NEXT_PUBLIC_`. Never commit to Git. |

```
STRIPE_WEBHOOK_SECRET=whsec_<your-stripe-webhook-secret>
```

---

## Email — Resend (Optional)

### RESEND_API_KEY

| | |
|---|---|
| Required | Optional |
| Visibility | Server only (Edge Function secret) |
| Purpose | Authenticates Resend API calls. Required for order confirmation emails and shipping notification emails sent by `stripe-webhook` and `printify-webhook` edge functions. Also used by the admin email panel for manual sends and broadcasts. |
| Obtained from | [resend.com](https://resend.com) → API Keys |
| Without it | Order and shipping emails will not be sent. The storefront checkout still works. |

```
RESEND_API_KEY=re_<your-resend-api-key>
```

---

### RESEND_WEBHOOK_SECRET

| | |
|---|---|
| Required | Optional |
| Visibility | Server only |
| Purpose | Verifies Resend webhook delivery events (sent, delivered, opened, bounced, etc.) received at `/api/resend/webhook`. |
| Obtained from | Resend Dashboard → Webhooks → your endpoint → Signing secret |
| Without it | The delivery events tab in the admin email panel will not receive data. |

```
RESEND_WEBHOOK_SECRET=<your-resend-webhook-secret>
```

---

## Email — MailerLite (Optional)

### MAILER_LITE_API_KEY

| | |
|---|---|
| Required | Optional |
| Visibility | Server only |
| Purpose | Authenticates MailerLite API calls. Required for the newsletter popup subscriber capture and the admin MailerLite panel (subscriber management, campaigns, groups). |
| Obtained from | [app.mailerlite.com](https://app.mailerlite.com) → Integrations → API → API Key |
| Without it | Newsletter signups will not be recorded. The admin MailerLite panel will not load. |

```
MAILER_LITE_API_KEY=<your-mailerlite-api-key>
```

---

## License

### LICENSE_HMAC_SECRET

| | |
|---|---|
| Required | Yes |
| Visibility | Server only |
| Purpose | HMAC secret used to sign and verify license tokens. Must be unique per deployment. |
| Generated by | `openssl rand -hex 32` — run this command and use the output |
| Security | Never reuse across deployments. Never use the placeholder value `demo-license-secret` in production. Never commit to Git. |

```
LICENSE_HMAC_SECRET=<run: openssl rand -hex 32>
```

---

## Site

### NEXT_PUBLIC_SITE_URL

| | |
|---|---|
| Required | Yes |
| Visibility | Browser-safe |
| Purpose | The canonical URL of your deployed storefront. Used for SEO metadata, sitemap generation, and CORS configuration in edge functions. |
| Development | `http://localhost:3000` |
| Production | `https://your-domain.com` |

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

---

## Deployment — VPS/PM2 Only

These variables are only needed for VPS deployments managed with PM2. They are not required for Vercel, Railway, or other platform deployments.

### APP_ROOT

| | |
|---|---|
| Required | VPS/PM2 only |
| Purpose | Absolute path to the application directory on the server. Used by admin API routes that read/write `.env.local`, `.env.live`, and `.env.test` files during Stripe mode switching. |

```
APP_ROOT=/var/www/your-app
```

---

### PM2_APP_NAME

| | |
|---|---|
| Required | VPS/PM2 only |
| Purpose | The PM2 process name for your application. Used by the admin Stripe setup/switch routes to trigger a PM2 restart after updating environment variables. |

```
PM2_APP_NAME=your-app
```
