#!/bin/bash
set -e
echo "🧪 Switching to TEST / Sandbox mode..."

cp .env.test .env.local
echo "✅ .env.local updated with test keys"

npx supabase secrets set \
  STRIPE_SECRET_KEY=STRIPE_SECRET_KEY_REDACTED \
  STRIPE_WEBHOOK_SECRET=whsec_j0pXblTz4FdVBON9vKEkA2ZpTtGrvgud \
  --project-ref SUPABASE_PROJECT_REF_REDACTED
echo "✅ Supabase secrets updated"

npx supabase functions deploy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED
echo "✅ Edge functions redeployed"

echo ""
echo "🧪 Now in TEST mode. Restart your dev server."
