#!/bin/bash
set -e
cp .env.test .env.local
echo "✅ .env.local updated with test keys"

STRIPE_SECRET_KEY=$(grep '^STRIPE_SECRET_KEY=' .env.test | cut -d '=' -f2-)
STRIPE_WEBHOOK_SECRET=$(grep '^STRIPE_WEBHOOK_SECRET=' .env.test | cut -d '=' -f2-)

npx supabase secrets set \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  --project-ref SUPABASE_PROJECT_REF_REDACTED
npx supabase functions deploy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED
echo "🧪 Now in TEST mode. Restart your dev server."
