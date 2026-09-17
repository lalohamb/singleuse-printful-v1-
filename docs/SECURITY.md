# Security

---

## Environment Secrets

Never commit secrets to Git. The following must always remain in `.env.local` (or your deployment platform's secret store) and never in source control:

| Secret | Risk if exposed |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access, bypasses RLS |
| `SUPABASE_ACCESS_TOKEN` | Broad Supabase account access via Management API |
| `STRIPE_SECRET_KEY` | Full Stripe account access, can create charges and issue refunds |
| `STRIPE_WEBHOOK_SECRET` | Allows forging webhook events |
| `PRINTIFY_API_TOKEN` | Full Printify shop access |
| `RESEND_API_KEY` | Can send email from your verified domain |
| `MAILER_LITE_API_KEY` | Full MailerLite account access |
| `LICENSE_HMAC_SECRET` | Allows forging license tokens |

Add `.env.local`, `.env.live`, and `.env.test` to `.gitignore` if they are not already excluded.

---

## NEXT_PUBLIC_* Variables

Variables prefixed with `NEXT_PUBLIC_` are embedded in the browser bundle and are visible to anyone who visits your site. Only use this prefix for values that are intentionally public:

- `NEXT_PUBLIC_SUPABASE_URL` — public endpoint
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public key, subject to RLS
- `NEXT_PUBLIC_PRINTIFY_SHOP_ID` — non-sensitive numeric ID
- `NEXT_PUBLIC_SITE_URL` — your public domain

Never use `NEXT_PUBLIC_` for service role keys, API tokens, webhook secrets, or any credential.

---

## Supabase Service Role Key

The service role key bypasses Row Level Security. It is used server-side only (API routes and edge functions). It must never appear in client-side code or be prefixed with `NEXT_PUBLIC_`.

---

## Supabase Personal Access Token

`SUPABASE_ACCESS_TOKEN` is a personal access token with broad access to your Supabase account via the Management API. It is used by the admin Stripe setup routes to push secrets to your Edge Functions.

- Never prefix with `NEXT_PUBLIC_`
- Never commit to Git
- Generate your own token — do not reuse tokens across projects
- Revoke it from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) if it is ever exposed

---

## LICENSE_HMAC_SECRET

This secret is used to sign and verify license tokens. It must be unique per deployment.

Generate a new secret for each deployment:

```bash
openssl rand -hex 32
```

Never use the placeholder value `demo-license-secret` in production. Never reuse the same secret across multiple deployments.

---

## Stripe Webhook Verification

The `stripe-webhook` edge function verifies the Stripe signature on every incoming request using `STRIPE_WEBHOOK_SECRET`. Do not remove or bypass this verification.

---

## Row Level Security

RLS is enabled on all database tables. Do not disable RLS as a shortcut. The application is designed to work with RLS enabled — disabling it would expose all data to any authenticated user.

---

## HTTPS

Always deploy behind HTTPS in production. Stripe requires HTTPS for webhook delivery. Supabase Auth cookies require HTTPS for the `Secure` flag to be set correctly.

---

## Git Security

Before pushing to a public repository, verify that no secrets are present in your commit history. If a secret is accidentally committed:

1. Immediately rotate the exposed credential (generate a new key/token in the relevant service)
2. Remove the secret from Git history using `git filter-repo` or BFG Repo Cleaner
3. Force-push the cleaned history

---

## Customer Credentials

This product does not require access to the original developer's Supabase, Stripe, Printify, or email accounts. You use your own accounts for everything. The original developer has no access to your deployment.
