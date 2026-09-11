#!/bin/bash
set -e
echo "🔴 Switching to LIVE mode..."

cp .env.live .env.local
echo "✅ .env.local updated with live keys"

npx supabase secrets set \
  STRIPE_SECRET_KEY=STRIPE_LIVE_SECRET_KEY_REDACTED \
  STRIPE_WEBHOOK_SECRET=whsec_08V5JvZ6KocRdBB2PDoj6xrxaJEKfmXG \
  --project-ref SUPABASE_PROJECT_REF_REDACTED
echo "✅ Supabase secrets updated"

npx supabase functions deploy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED
echo "✅ Edge functions redeployed"

echo ""
echo "🟢 Now in LIVE mode. Restart your dev server."
