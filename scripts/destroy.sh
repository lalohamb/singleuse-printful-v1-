#!/bin/bash
# =============================================================================
# destroy.sh — Full teardown: drops all tables, removes env files
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"
SQL_DIR="$ROOT_DIR/supabase/sql"
ENV_LOCAL="$ROOT_DIR/.env.local"

source "$LIB_DIR/env.sh"
source "$LIB_DIR/supabase.sh"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
hr()   { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

hr
echo -e "${RED}  Gender Apparel — DESTROY${NC}"
echo -e "  This will drop ALL tables and delete .env.live and .env.test."
echo -e "  This cannot be undone."
hr

read -rp "  Type DESTROY to confirm: " confirm
[[ "$confirm" != "DESTROY" ]] && echo "Aborted." && exit 0

SUPABASE_PROJECT_REF=$(env_get "SUPABASE_PROJECT_REF" "$ENV_LOCAL")
SERVICE_ROLE_KEY=$(env_get "SUPABASE_SERVICE_ROLE_KEY" "$ENV_LOCAL")
DB_PASSWORD=$(env_get "DB_PASSWORD" "$ENV_LOCAL")

DB_URL=""
if command -v psql &>/dev/null && [[ -n "$DB_PASSWORD" ]]; then
  DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
fi

echo ""
echo "  Dropping all tables..."
if run_sql_file "$SQL_DIR/03_destroy.sql" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL"; then
  ok "All tables dropped"
else
  fail "Destroy SQL failed"
  exit 1
fi

echo "  Removing .env.live and .env.test..."
[[ -f "$ROOT_DIR/.env.live" ]] && rm "$ROOT_DIR/.env.live" && ok ".env.live deleted"
[[ -f "$ROOT_DIR/.env.test" ]] && rm "$ROOT_DIR/.env.test" && ok ".env.test deleted"

hr
echo -e "${GREEN}  ✅ Destroy complete.${NC}"
echo -e "  Run ${CYAN}scripts/install.sh${NC} to start fresh."
hr
