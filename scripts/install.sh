#!/bin/bash
# =============================================================================
# install.sh — Gender Apparel Fresh Install
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"
SQL_DIR="$ROOT_DIR/supabase/sql"
ENV_LOCAL="$ROOT_DIR/.env.local"
DEFAULTS="$SCRIPT_DIR/defaults.env"

source "$LIB_DIR/env.sh"
source "$LIB_DIR/supabase.sh"
source "$LIB_DIR/stripe.sh"

# Colors
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
step()  { echo -e "\n${CYAN}[$1/8]${NC} $2"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }
hr()    { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

hr
echo -e "${CYAN}  Storefront — Fresh Install${NC}"
hr

# =============================================================================
# [1/8] Prerequisites
# =============================================================================
step 1 "Checking prerequisites"

check_cmd() {
  if command -v "$1" &>/dev/null; then ok "$1 found"; else fail "$1 not found — please install it"; exit 1; fi
}

check_cmd node
check_cmd npm
check_cmd curl
check_cmd python3

if command -v psql &>/dev/null; then
  ok "psql found — will use direct DB connection"
  USE_PSQL=true
else
  warn "psql not found — will use Supabase REST API fallback"
  USE_PSQL=false
fi

# =============================================================================
# [2/8] Collect credentials
# =============================================================================
step 2 "Collecting credentials"

touch "$ENV_LOCAL"

echo -e "\n  ${YELLOW}Supabase${NC}"
SUPABASE_PROJECT_REF=$(env_require  "SUPABASE_PROJECT_REF"       "$ENV_LOCAL" "Supabase Project Ref")
SUPABASE_ACCESS_TOKEN=$(env_require "SUPABASE_ACCESS_TOKEN"      "$ENV_LOCAL" "Supabase Access Token")
SUPABASE_URL=$(env_require          "NEXT_PUBLIC_SUPABASE_URL"   "$ENV_LOCAL" "Supabase URL" "https://${SUPABASE_PROJECT_REF}.supabase.co")
SUPABASE_ANON_KEY=$(env_require     "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$ENV_LOCAL" "Supabase Anon Key")
SERVICE_ROLE_KEY=$(env_require      "SUPABASE_SERVICE_ROLE_KEY"  "$ENV_LOCAL" "Supabase Service Role Key")

echo -e "\n  ${YELLOW}Stripe${NC}"
STRIPE_TEST_SECRET=$(env_require    "STRIPE_TEST_SECRET_KEY"     "$ENV_LOCAL" "Stripe Test Secret Key (sk_test_...)")
STRIPE_LIVE_SECRET=$(env_require    "STRIPE_LIVE_SECRET_KEY"     "$ENV_LOCAL" "Stripe Live Secret Key (sk_live_...)")

echo -e "\n  ${YELLOW}Other services${NC}"
RESEND_KEY=$(env_require            "RESEND_API_KEY"             "$ENV_LOCAL" "Resend API Key")
MAILER_LITE_KEY=$(env_require       "MAILER_LITE_API_KEY"        "$ENV_LOCAL" "MailerLite API Key")

warn "Printful API key — add PRINTFUL_API_KEY manually to .env.local after this script"

echo -e "\n  ${YELLOW}Admin account${NC}"
ADMIN_EMAIL=$(env_require           "ADMIN_EMAIL"                "$ENV_LOCAL" "Admin Email")
ADMIN_PASSWORD=$(env_require        "ADMIN_PASSWORD"             "$ENV_LOCAL" "Admin Password (min 6 chars)")

echo -e "\n  ${YELLOW}Server (production only)${NC}"
APP_ROOT=$(env_require              "APP_ROOT"                   "$ENV_LOCAL" "App Root on server" "/var/www/countybuys")
PM2_APP_NAME=$(env_require          "PM2_APP_NAME"               "$ENV_LOCAL" "PM2 App Name" "countybuys")
SITE_URL=$(env_require              "NEXT_PUBLIC_SITE_URL"       "$ENV_LOCAL" "Site URL" "http://localhost:3000")

# Write remaining required vars
env_set "PLATFORM_DOMAIN"           "$(echo "$SITE_URL" | sed 's|https\?://||' | cut -d'/' -f1)" "$ENV_LOCAL"
env_set "SUPABASE_PROJECT_REF"      "$SUPABASE_PROJECT_REF"     "$ENV_LOCAL"
env_set "LICENSE_HMAC_SECRET"       "$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')" "$ENV_LOCAL"

ok "All credentials collected"

# =============================================================================
# [3/8] Write .env files
# =============================================================================
step 3 "Writing env files"

# Stripe keys are stored in DB — not in env files
GITIGNORE="$ROOT_DIR/.gitignore"
if ! grep -qF "scripts/defaults.env" "$GITIGNORE" 2>/dev/null; then
  echo "scripts/defaults.env" >> "$GITIGNORE"
  ok "Added scripts/defaults.env to .gitignore"
fi

ok "Env files ready"

# =============================================================================
# [4/8] Run schema SQL
# =============================================================================
step 4 "Running schema SQL"

# Build DB URL if psql available
DB_URL=""
if [[ "$USE_PSQL" == "true" ]]; then
  DB_PASSWORD=$(env_get "DB_PASSWORD" "$ENV_LOCAL")
  if [[ -z "$DB_PASSWORD" ]]; then
    read -rp "  Supabase DB Password (from dashboard → Settings → Database): " DB_PASSWORD
    env_set "DB_PASSWORD" "$DB_PASSWORD" "$ENV_LOCAL"
  fi
  DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
fi

echo "  Running 01_schema.sql..."
if run_sql_file "$SQL_DIR/01_schema.sql" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$SUPABASE_ACCESS_TOKEN"; then
  ok "Base schema created"
else
  fail "Schema SQL failed — check your DB credentials"
  exit 1
fi

echo "  Running migrations..."
for f in $(ls "$ROOT_DIR/supabase/migrations"/*.sql | sort); do
  echo "    → $(basename $f)"
  run_sql_file "$f" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$SUPABASE_ACCESS_TOKEN" || warn "Migration $(basename $f) failed — continuing"
done
ok "Migrations complete"

# =============================================================================
# [5/8] Create admin user + seed data
# =============================================================================
step 5 "Creating admin user and seeding data"

echo "  Creating Supabase auth user..."
USER_ID=$(create_auth_user "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
if [[ -z "$USER_ID" ]]; then
  fail "Could not create admin user"
  exit 1
fi
ok "Auth user ready (id: ${USER_ID:0:8}...)"

echo "  Inserting into admins table..."
insert_admin "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$USER_ID" "$ADMIN_EMAIL"
ok "Admin record inserted"

# Load defaults
source "$DEFAULTS" 2>/dev/null || true

echo "  Seeding store settings..."
SEED_SQL=$(cat <<EOSQL
UPDATE settings SET
  store_name            = '${STORE_NAME}',
  tagline               = '${STORE_TAGLINE}',
  hero_title            = '${HERO_TITLE}',
  hero_subtitle         = '${HERO_SUBTITLE}',
  hero_image_url        = '${HERO_IMAGE_URL}',
  logo_url              = '${LOGO_URL}',
  our_why_label         = '${OUR_WHY_LABEL}',
  our_why_quote         = '${OUR_WHY_QUOTE}',
  our_why_body          = '${OUR_WHY_BODY}',
  footer_text           = '${FOOTER_TEXT}',
  footer_bottom_message = '${FOOTER_BOTTOM_MESSAGE}',
  announcement          = '${ANNOUNCEMENT}',
  announcement_active   = true,
  social_links          = '{
    "instagram": {"url": "${INSTAGRAM_URL}", "enabled": true},
    "tiktok":    {"url": "${TIKTOK_URL}",    "enabled": true},
    "facebook":  {"url": "${FACEBOOK_URL}",  "enabled": true},
    "youtube":   {"url": "${YOUTUBE_URL}",   "enabled": true},
    "pinterest": {"url": "${PINTEREST_URL}", "enabled": true},
    "snapchat":  {"url": "${SNAPCHAT_URL}",  "enabled": true},
    "threads":   {"url": "${THREADS_URL}",   "enabled": true},
    "email":     {"url": "${EMAIL_URL}",     "enabled": true}
  }'::jsonb,
  updated_at = now()
WHERE id = (SELECT id FROM settings LIMIT 1);

UPDATE seo_settings SET
  site_url           = '${SITE_URL}',
  meta_title_suffix  = '${META_TITLE_SUFFIX}',
  twitter_handle     = '${TWITTER_HANDLE}',
  updated_at         = now()
WHERE id = '00000000-0000-0000-0000-000000000001';
EOSQL
)

if run_sql "$SEED_SQL" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$SUPABASE_ACCESS_TOKEN"; then
  ok "Store settings seeded"
else
  warn "Settings seed failed — configure manually via admin UI"
fi

# =============================================================================
# [6/8] Push Supabase secrets + deploy edge functions
# =============================================================================
step 6 "Pushing Supabase secrets and deploying edge functions"

echo "  Pushing secrets..."
if push_secrets "$SUPABASE_PROJECT_REF" "$SUPABASE_ACCESS_TOKEN" \
  "SUPABASE_URL"               "$SUPABASE_URL" \
  "SUPABASE_SERVICE_ROLE_KEY"  "$SERVICE_ROLE_KEY" \
  "RESEND_API_KEY"             "$RESEND_KEY" \
  "MAILER_LITE_API_KEY"        "$MAILER_LITE_KEY" \
  "SITE_URL"                   "$SITE_URL"; then
  ok "Secrets pushed"
else
  warn "Secrets push failed — run: supabase secrets set ... --project-ref $SUPABASE_PROJECT_REF"
fi

echo "  Deploying edge functions..."
deploy_functions "$SUPABASE_PROJECT_REF" \
  stripe-webhook stripe-checkout printful-proxy printful-webhook
ok "Edge functions deployed"

# =============================================================================
# [7/8] Register Stripe webhooks + save keys to DB
# =============================================================================
step 7 "Registering Stripe webhooks and saving keys to database"

WEBHOOK_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/stripe-webhook"
TEST_WHSEC=""
LIVE_WHSEC=""

echo "  Registering test webhook..."
delete_existing_webhooks "$STRIPE_TEST_SECRET" "$WEBHOOK_URL" 2>/dev/null || true
TEST_WHSEC=$(register_webhook "$STRIPE_TEST_SECRET" "$WEBHOOK_URL" 2>/dev/null || echo "")
[[ -n "$TEST_WHSEC" ]] && ok "Test webhook registered" || warn "Test webhook failed — add whsec via /admin/stripe"

echo "  Registering live webhook..."
delete_existing_webhooks "$STRIPE_LIVE_SECRET" "$WEBHOOK_URL" 2>/dev/null || true
LIVE_WHSEC=$(register_webhook "$STRIPE_LIVE_SECRET" "$WEBHOOK_URL" 2>/dev/null || echo "")
[[ -n "$LIVE_WHSEC" ]] && ok "Live webhook registered" || warn "Live webhook failed — add whsec via /admin/stripe"

# Save all Stripe keys to settings table
STRIPE_SQL="UPDATE settings SET
  stripe_test_secret_key     = '${STRIPE_TEST_SECRET}',
  stripe_test_webhook_secret = '${TEST_WHSEC}',
  stripe_live_secret_key     = '${STRIPE_LIVE_SECRET}',
  stripe_live_webhook_secret = '${LIVE_WHSEC}',
  stripe_mode                = 'test'
WHERE id = (SELECT id FROM settings LIMIT 1);"

if run_sql "$STRIPE_SQL" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$SUPABASE_ACCESS_TOKEN"; then
  ok "Stripe keys saved to database"
else
  warn "Could not save Stripe keys to DB — add them via /admin/stripe"
fi

# =============================================================================
# [8/8] npm install + build
# =============================================================================
step 8 "Installing dependencies and building"

echo "  Running npm install..."
cd "$ROOT_DIR"
npm install --silent
ok "Dependencies installed"

echo "  Running npm run build..."
if npm run build 2>&1 | tail -5; then
  ok "Build successful"
else
  warn "Build failed — fix errors before deploying to production"
fi

# =============================================================================
# Summary
# =============================================================================
hr
echo -e "${GREEN}  ✅ Install complete!${NC}"
hr
echo ""
echo -e "  ${CYAN}Store:${NC}       ${STORE_NAME}"
echo -e "  ${CYAN}Admin:${NC}       ${ADMIN_EMAIL}"
echo -e "  ${CYAN}Supabase:${NC}    ${SUPABASE_URL}"
echo -e "  ${CYAN}Mode:${NC}        TEST (switch to LIVE via /admin/stripe)"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "  1. npm run dev"
echo -e "  2. Go to ${SITE_URL}/admin and log in"
echo -e "  3. Connect Printify via /admin/settings"
echo -e "  4. Switch to LIVE mode when ready via /admin/stripe"
echo ""
hr
