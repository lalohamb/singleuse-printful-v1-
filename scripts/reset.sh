#!/bin/bash
# =============================================================================
# reset.sh — Wipe data and re-seed defaults
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

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
hr()   { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

hr
echo -e "${YELLOW}  Gender Apparel — Reset${NC}"
echo -e "  This will wipe all orders, customer profile rows, products, and content."
echo -e "  Admins and Supabase Auth users are preserved. Settings are restored to defaults."
hr

read -rp "  Type RESET to confirm: " confirm
[[ "$confirm" != "RESET" ]] && echo "Aborted." && exit 0

# Load credentials
SUPABASE_PROJECT_REF=$(env_get "SUPABASE_PROJECT_REF" "$ENV_LOCAL")
SERVICE_ROLE_KEY=$(env_get "SUPABASE_SERVICE_ROLE_KEY" "$ENV_LOCAL")
ACCESS_TOKEN=$(env_get "SUPABASE_ACCESS_TOKEN" "$ENV_LOCAL")
DB_PASSWORD=$(env_get "DB_PASSWORD" "$ENV_LOCAL")

DB_URL=""
if command -v psql &>/dev/null && [[ -n "$DB_PASSWORD" ]]; then
  DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
fi

echo ""
echo "  Running reset SQL..."
if run_sql_file "$SQL_DIR/02_reset.sql" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$ACCESS_TOKEN"; then
  ok "Data wiped"
  ok "Customer profile rows cleared"
else
  fail "Reset SQL failed"
  exit 1
fi

# Re-seed settings from defaults
source "$DEFAULTS" 2>/dev/null || true

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
  brand_values_settings = '{"advanced":false,"values":[{"stat":"100%","label":"Made for Every Body","sub":"Clothing that meets you where you are","icon":"✨","enabled":true},{"stat":"0 Waste","label":"Made to Order","sub":"Every piece printed fresh - nothing sits on a shelf","icon":"♻️","enabled":true},{"stat":"XS-5XL","label":"Size Inclusive","sub":"Style without a size limit","icon":"💯","enabled":true}],"backgroundColor":"#171717","textColor":"#ffffff","accentColor":"#d4af37","backgroundImage":"","cardBackgroundColor":"transparent","cardBorderColor":"rgba(255,255,255,0.1)","dividerColor":"rgba(255,255,255,0.1)","columns":3,"alignment":"center","divider":"vertical","padding":"spacious","animate":true}'::jsonb,
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
EOSQL
)

if run_sql "$SEED_SQL" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$ACCESS_TOKEN"; then
  ok "Settings restored to defaults"
else
  warn "Settings seed failed — configure manually via admin UI"
fi

hr
echo -e "${GREEN}  ✅ Reset complete!${NC}"
hr
