#!/bin/bash
# =============================================================================
# install_fresh.sh — Rebuild DB from all migration scripts in order
# Reads credentials from .env.local (run install.sh first if not set up)
# Skips destructive scripts: 02_reset.sql, 03_destroy.sql
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
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
hr()   { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

hr
echo -e "${CYAN}  Fresh DB Build — Migration Runner${NC}"
hr

# =============================================================================
# Load credentials from .env.local
# =============================================================================
[[ ! -f "$ENV_LOCAL" ]] && fail ".env.local not found — run install.sh first"

SUPABASE_PROJECT_REF=$(env_get "SUPABASE_PROJECT_REF"       "$ENV_LOCAL")
SERVICE_ROLE_KEY=$(env_get     "SUPABASE_SERVICE_ROLE_KEY"  "$ENV_LOCAL")
SUPABASE_ACCESS_TOKEN=$(env_get "SUPABASE_ACCESS_TOKEN"     "$ENV_LOCAL")

[[ -z "$SUPABASE_PROJECT_REF" ]] && fail "SUPABASE_PROJECT_REF missing from .env.local"
[[ -z "$SERVICE_ROLE_KEY"     ]] && fail "SUPABASE_SERVICE_ROLE_KEY missing from .env.local"

# =============================================================================
# Build DB_URL if psql available
# =============================================================================
DB_URL=""
if command -v psql &>/dev/null; then
  DB_PASSWORD=$(env_get "DB_PASSWORD" "$ENV_LOCAL")
  if [[ -z "$DB_PASSWORD" ]]; then
    read -rp "  Supabase DB Password (Settings → Database): " DB_PASSWORD
    env_set "DB_PASSWORD" "$DB_PASSWORD" "$ENV_LOCAL"
  fi
  DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  ok "psql found — using direct DB connection"
else
  warn "psql not found — using Supabase REST API fallback"
fi

# =============================================================================
# Confirm DB connection
# =============================================================================
echo -e "\n  Confirming DB connection..."

PING_SQL="SELECT 1 AS ok;"
if run_sql "$PING_SQL" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$SUPABASE_ACCESS_TOKEN"; then
  ok "DB connection confirmed"
else
  fail "Cannot reach database — check credentials and try again"
fi

# =============================================================================
# Collect migration files (sorted, skip destructive scripts)
# =============================================================================
SKIP_PATTERN="02_reset|03_destroy"

mapfile -t SQL_FILES < <(
  find "$SQL_DIR" -maxdepth 1 -name '[0-9]*.sql' | sort | grep -Ev "$SKIP_PATTERN"
)

if [[ ${#SQL_FILES[@]} -eq 0 ]]; then
  fail "No migration SQL files found in $SQL_DIR"
fi

echo -e "\n  Migration files to run:"
for f in "${SQL_FILES[@]}"; do
  echo -e "    ${CYAN}→${NC} $(basename "$f")"
done
echo ""

# =============================================================================
# Run each migration in order
# =============================================================================
PASS=0; FAIL=0

for file in "${SQL_FILES[@]}"; do
  name="$(basename "$file")"
  echo -n "  Running $name ... "
  if run_sql_file "$file" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$SUPABASE_ACCESS_TOKEN"; then
    echo -e "${GREEN}✓${NC}"
    (( PASS++ ))
  else
    echo -e "${RED}✗ FAILED${NC}"
    (( FAIL++ ))
    fail "$name failed — aborting"
  fi
done

# =============================================================================
# Summary
# =============================================================================
hr
echo -e "${GREEN}  ✅ DB build complete — ${PASS} migration(s) applied${NC}"
[[ $FAIL -gt 0 ]] && echo -e "${RED}  ✗ ${FAIL} migration(s) failed${NC}"
hr
