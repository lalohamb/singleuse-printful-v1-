#!/bin/bash
# =============================================================================
# soft-reset.sh — Clear transactional data only
#
# Clears:  orders, products, email events
# Resets:  Printify/Stripe connection flags, brand_values_settings to defaults
# Keeps:   settings & branding, categories, SEO settings, policies, admins
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"
ENV_LOCAL="$ROOT_DIR/.env.local"

source "$LIB_DIR/env.sh"
source "$LIB_DIR/supabase.sh"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
hr()   { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

hr
echo -e "${YELLOW}  Gender Apparel — Soft Reset${NC}"
echo -e "  Clears:  orders, products, email events"
echo -e "  Resets:  Printify/Stripe flags, brand values to defaults"
echo -e "  Keeps:   settings, categories, SEO, policies, admins"
hr

read -rp "  Type SOFT RESET to confirm: " confirm
[[ "$confirm" != "SOFT RESET" ]] && echo "Aborted." && exit 0

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
echo "  Clearing transactional data..."

SOFT_RESET_SQL=$(cat <<'EOSQL'
DELETE FROM orders        WHERE created_at >= '1970-01-01';
DELETE FROM products      WHERE created_at >= '1970-01-01';
DELETE FROM email_events  WHERE created_at >= '1970-01-01';

UPDATE settings SET
  printify_connected   = false,
  printify_shop_id     = null,
  stripe_connected     = false,
  brand_values_settings = '{
    "advanced": false,
    "values": [
      {"stat": "100%",    "label": "Made for Every Body", "sub": "Clothing that meets you where you are",              "icon": "✨", "enabled": true},
      {"stat": "0 Waste", "label": "Made to Order",       "sub": "Every piece printed fresh - nothing sits on a shelf","icon": "♻️", "enabled": true},
      {"stat": "XS-5XL",  "label": "Size Inclusive",      "sub": "Style without a size limit",                         "icon": "💯", "enabled": true}
    ],
    "backgroundColor":    "#171717",
    "textColor":          "#ffffff",
    "accentColor":        "#d4af37",
    "backgroundImage":    "",
    "cardBackgroundColor":"transparent",
    "cardBorderColor":    "rgba(255,255,255,0.1)",
    "dividerColor":       "rgba(255,255,255,0.1)",
    "columns":            3,
    "alignment":          "center",
    "divider":            "vertical",
    "padding":            "spacious",
    "animate":            true
  }'::jsonb,
  updated_at = now()
WHERE id = (SELECT id FROM settings LIMIT 1);
EOSQL
)

if run_sql "$SOFT_RESET_SQL" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$ACCESS_TOKEN"; then
  ok "Orders cleared"
  ok "Products cleared"
  ok "Email events cleared"
  ok "Printify / Stripe flags reset"
  ok "Brand values restored to defaults"
else
  fail "Soft reset SQL failed"
  exit 1
fi

hr
echo -e "${GREEN}  ✅ Soft reset complete!${NC}"
echo -e "  Settings, categories, SEO, policies, and admins are untouched."
hr
