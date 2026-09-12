#!/bin/bash
set -e
cp .env.test .env.local
echo "✅ .env.local updated with test keys"
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_replace_me \
  STRIPE_WEBHOOK_SECRET=whsec_replace_me_test \
  --project-ref SUPABASE_PROJECT_REF_REDACTED
npx supabase functions deploy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED
echo "🧪 Now in TEST mode. Restart your dev server."
