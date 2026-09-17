# Printify POD Storefront — Supabase CLI Command Reference
# Project ref: <your-project-ref>
# Run all commands from: /var/www/your-app

PROJECT=<your-project-ref>

# =============================================================================
# AUTH
# =============================================================================

# Login (opens browser)
npx supabase login

# Check current logged-in user
npx supabase projects list


# =============================================================================
# DATABASE — MIGRATIONS
# =============================================================================

# Push only pending migrations to remote
npx supabase db push --project-ref $PROJECT

# Pull remote schema changes into local migrations
npx supabase db pull --project-ref $PROJECT

# Check migration status (what has / hasn't been applied)
npx supabase migration list --project-ref $PROJECT

# Run a specific SQL file directly (bypasses migration tracking)
# Use this when db push fails on old migrations
psql "$(npx supabase db remote-url --project-ref $PROJECT)" -f supabase/migrations/<filename>.sql


# =============================================================================
# DATABASE — REMOTE URL (for psql access)
# =============================================================================

# Get the remote DB connection string
npx supabase db remote-url --project-ref $PROJECT

# Connect to remote DB via psql
psql "$(npx supabase db remote-url --project-ref $PROJECT)"


# =============================================================================
# EDGE FUNCTIONS — DEPLOY
# =============================================================================

# Deploy all functions
npx supabase functions deploy printify-proxy   --project-ref $PROJECT
npx supabase functions deploy printify-webhook --project-ref $PROJECT
npx supabase functions deploy stripe-checkout  --project-ref $PROJECT
npx supabase functions deploy stripe-webhook   --project-ref $PROJECT

# Deploy all at once
npx supabase functions deploy printify-proxy printify-webhook stripe-checkout stripe-webhook --project-ref $PROJECT


# =============================================================================
# EDGE FUNCTIONS — SECRETS
# =============================================================================

# View all secrets (names only, values are hidden)
npx supabase secrets list --project-ref $PROJECT

# Set all secrets at once (initial setup)
npx supabase secrets set \
  PRINTIFY_API_TOKEN=<token> \
  PRINTIFY_SHOP_ID=<shop_id> \
  STRIPE_SECRET_KEY=<sk_...> \
  STRIPE_WEBHOOK_SECRET=<whsec_...> \
  RESEND_API_KEY=<re_...> \
  --project-ref $PROJECT

# Switch to LIVE Stripe keys
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_<your-live-key> \
  STRIPE_WEBHOOK_SECRET=whsec_<your-live-webhook-secret> \
  --project-ref $PROJECT

# Switch to TEST Stripe keys
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_<your-test-key> \
  STRIPE_WEBHOOK_SECRET=whsec_<your-test-webhook-secret> \
  --project-ref $PROJECT

# Update a single secret
npx supabase secrets set PRINTIFY_API_TOKEN=<new_token> --project-ref $PROJECT

# Delete a secret
npx supabase secrets unset SECRET_NAME --project-ref $PROJECT


# =============================================================================
# EDGE FUNCTIONS — LOGS
# =============================================================================

# Tail live logs for a function
npx supabase functions logs stripe-webhook   --project-ref $PROJECT
npx supabase functions logs stripe-checkout  --project-ref $PROJECT
npx supabase functions logs printify-proxy   --project-ref $PROJECT
npx supabase functions logs printify-webhook --project-ref $PROJECT


# =============================================================================
# STRIPE MODE SWITCH (manual — if admin UI switch fails)
# =============================================================================

# Switch to TEST mode
bash switch-to-test.sh

# Switch to LIVE mode
bash switch-to-live.sh


# =============================================================================
# FULL REDEPLOY (after code changes)
# =============================================================================

# 1. Deploy Next.js app
bash scripts/deploy.sh

# 2. Deploy all edge functions
npx supabase functions deploy printify-proxy printify-webhook stripe-checkout stripe-webhook --project-ref $PROJECT

# 3. Apply any new migrations
npx supabase db push --project-ref $PROJECT


# =============================================================================
# USEFUL DASHBOARD LINKS
# =============================================================================

# Supabase project dashboard
# https://supabase.com/dashboard/project/<your-project-ref>

# SQL editor
# https://supabase.com/dashboard/project/<your-project-ref>/sql

# Edge functions
# https://supabase.com/dashboard/project/<your-project-ref>/functions

# Auth users
# https://supabase.com/dashboard/project/<your-project-ref>/auth/users

# Database tables
# https://supabase.com/dashboard/project/<your-project-ref>/editor

# Stripe live dashboard
# https://dashboard.stripe.com

# Stripe test dashboard
# https://dashboard.stripe.com/test
