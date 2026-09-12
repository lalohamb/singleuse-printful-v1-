#!/bin/bash
set -e
cp .env.live .env.local
echo "✅ .env.local updated with live keys"
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_replace_me \
  STRIPE_WEBHOOK_SECRET=whsec_replace_me_live \
  --project-ref SUPABASE_PROJECT_REF_REDACTED
npx supabase functions deploy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED
echo "🟢 Now in LIVE mode. Restart your dev server."
