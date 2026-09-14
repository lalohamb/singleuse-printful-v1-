#!/bin/bash
# =============================================================================
# restore-config.sh — Restore a saved configuration snapshot
#
# Usage:
#   ./scripts/restore-config.sh                          # interactive picker
#   ./scripts/restore-config.sh scripts/snapshots/config-20240101_120000.env
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"
ENV_LOCAL="$ROOT_DIR/.env.local"
SNAPSHOT_DIR="$SCRIPT_DIR/snapshots"

source "$LIB_DIR/env.sh"
source "$LIB_DIR/supabase.sh"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
hr()   { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

hr
echo -e "${CYAN}  Gender Apparel — Restore Configuration${NC}"
hr

# ── Pick snapshot file ────────────────────────────────────────────────────────
SNAPSHOT_FILE="${1:-}"

if [[ -z "$SNAPSHOT_FILE" ]]; then
  # Interactive picker — list available snapshots newest first
  mapfile -t SNAPSHOTS < <(ls -1t "$SNAPSHOT_DIR"/config-*.env 2>/dev/null || true)
  if [[ ${#SNAPSHOTS[@]} -eq 0 ]]; then
    fail "No snapshots found in scripts/snapshots/. Run save-config.sh first."
    exit 1
  fi
  echo ""
  echo "  Available snapshots:"
  for i in "${!SNAPSHOTS[@]}"; do
    LABEL=$(basename "${SNAPSHOTS[$i]}" .env | sed 's/config-//')
    echo -e "  ${CYAN}[$((i+1))]${NC} $LABEL"
  done
  echo ""
  read -rp "  Select snapshot [1-${#SNAPSHOTS[@]}]: " CHOICE
  INDEX=$((CHOICE - 1))
  if [[ $INDEX -lt 0 || $INDEX -ge ${#SNAPSHOTS[@]} ]]; then
    fail "Invalid selection"
    exit 1
  fi
  SNAPSHOT_FILE="${SNAPSHOTS[$INDEX]}"
fi

# Resolve relative path
[[ "$SNAPSHOT_FILE" != /* ]] && SNAPSHOT_FILE="$ROOT_DIR/$SNAPSHOT_FILE"

if [[ ! -f "$SNAPSHOT_FILE" ]]; then
  fail "Snapshot file not found: $SNAPSHOT_FILE"
  exit 1
fi

echo ""
echo -e "  Snapshot: ${CYAN}$(basename "$SNAPSHOT_FILE")${NC}"
echo ""
read -rp "  Type RESTORE to confirm: " confirm
[[ "$confirm" != "RESTORE" ]] && echo "Aborted." && exit 0

# ── Load snapshot ─────────────────────────────────────────────────────────────
# shellcheck disable=SC1090
source "$SNAPSHOT_FILE"

# ── Load credentials ──────────────────────────────────────────────────────────
SUPABASE_PROJECT_REF=$(env_get "SUPABASE_PROJECT_REF"      "$ENV_LOCAL")
SERVICE_ROLE_KEY=$(env_get     "SUPABASE_SERVICE_ROLE_KEY" "$ENV_LOCAL")
ACCESS_TOKEN=$(env_get         "SUPABASE_ACCESS_TOKEN"     "$ENV_LOCAL")
DB_PASSWORD=$(env_get          "DB_PASSWORD"               "$ENV_LOCAL")

if [[ -z "$SUPABASE_PROJECT_REF" || -z "$SERVICE_ROLE_KEY" ]]; then
  fail "SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY not set in .env.local"
  exit 1
fi

DB_URL=""
if command -v psql &>/dev/null && [[ -n "$DB_PASSWORD" ]]; then
  DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
fi

# ── Escape helper for SQL strings ─────────────────────────────────────────────
sql_str() {
  # Escape single quotes for SQL
  echo "${1//\'/\'\'}"
}

# ── Build and run restore SQL ─────────────────────────────────────────────────
echo ""
echo "  Restoring settings..."

RESTORE_SQL=$(python3 - <<PYEOF
import json, sys

def s(v):
    """Escape for SQL single-quoted string."""
    return str(v).replace("'", "''") if v else ""

def jsonb(v):
    """Return SQL JSONB literal or NULL."""
    v = v.strip() if v else ""
    if not v or v == "null":
        return "NULL"
    try:
        json.loads(v)
        return "'" + v.replace("'", "''") + "'::jsonb"
    except Exception:
        return "NULL"

# Read env vars (already sourced into shell, passed via env)
import os
g = os.environ.get

print("""UPDATE settings SET
  store_name              = '{store_name}',
  tagline                 = '{tagline}',
  logo_url                = '{logo_url}',
  logo_size               = {logo_size},
  footer_logo_url         = {footer_logo_url},
  footer_logo_size        = {footer_logo_size},
  footer_text             = '{footer_text}',
  footer_bottom_message   = '{footer_bottom_message}',
  announcement            = '{announcement}',
  announcement_active     = {announcement_active},
  hero_title              = '{hero_title}',
  hero_subtitle           = '{hero_subtitle}',
  hero_image_url          = '{hero_image_url}',
  hero_object_position    = '{hero_object_position}',
  hero_height_vh          = {hero_height_vh},
  hero_image_flip         = {hero_image_flip},
  hero_image_scale        = {hero_image_scale},
  hero_gradient_opacity   = {hero_gradient_opacity},
  hero_gradient_dir       = '{hero_gradient_dir}',
  hero_image_fit          = '{hero_image_fit}',
  story_image_url         = {story_image_url},
  our_why_label           = '{our_why_label}',
  our_why_quote           = '{our_why_quote}',
  our_why_body            = '{our_why_body}',
  our_why_image_url       = {our_why_image_url},
  our_why_object_position = '{our_why_object_position}',
  our_why_height_vh       = {our_why_height_vh},
  our_why_image_scale     = {our_why_image_scale},
  our_why_image_flip      = {our_why_image_flip},
  our_why_image_fit       = '{our_why_image_fit}',
  our_why_gradient_opacity= {our_why_gradient_opacity},
  our_why_gradient_dir    = '{our_why_gradient_dir}',
  shipping_free_threshold = {shipping_free_threshold},
  default_shipping_cost   = {default_shipping_cost},
  affiliate_program_enabled = {affiliate_program_enabled},
  promo_banner_active     = {promo_banner_active},
  promo_banner_title      = {promo_banner_title},
  promo_banner_body       = {promo_banner_body},
  promo_banner_cta_label  = {promo_banner_cta_label},
  promo_banner_cta_url    = {promo_banner_cta_url},
  promo_banner_bg_color   = '{promo_banner_bg_color}',
  social_links            = {social_links},
  brand_values_settings   = {brand_values},
  popup_settings          = {popup_settings},
  updated_at              = now()
WHERE id = (SELECT id FROM settings LIMIT 1);

UPDATE seo_settings SET
  site_url                  = '{site_url}',
  default_og_image          = {default_og_image},
  sitemap_enabled           = {sitemap_enabled},
  robots_noindex_admin      = {robots_noindex_admin},
  jsonld_enabled            = {jsonld_enabled},
  canonical_enabled         = {canonical_enabled},
  meta_title_suffix         = '{meta_title_suffix}',
  twitter_handle            = '{twitter_handle}',
  google_site_verification  = {google_site_verification},
  updated_at                = now()
WHERE id = '00000000-0000-0000-0000-000000000001';
""".format(
    store_name            = s(g("STORE_NAME","")),
    tagline               = s(g("STORE_TAGLINE","")),
    logo_url              = s(g("LOGO_URL","")),
    logo_size             = g("LOGO_SIZE","40") or "40",
    footer_logo_url       = ("'" + s(g("FOOTER_LOGO_URL","")) + "'") if g("FOOTER_LOGO_URL","") else "NULL",
    footer_logo_size      = g("FOOTER_LOGO_SIZE","40") or "40",
    footer_text           = s(g("FOOTER_TEXT","")),
    footer_bottom_message = s(g("FOOTER_BOTTOM_MESSAGE","")),
    announcement          = s(g("ANNOUNCEMENT","")),
    announcement_active   = "true" if g("ANNOUNCEMENT_ACTIVE","false").lower() in ("true","1") else "false",
    hero_title            = s(g("HERO_TITLE","")),
    hero_subtitle         = s(g("HERO_SUBTITLE","")),
    hero_image_url        = s(g("HERO_IMAGE_URL","")),
    hero_object_position  = s(g("HERO_OBJECT_POSITION","0px 0px")),
    hero_height_vh        = g("HERO_HEIGHT_VH","80") or "80",
    hero_image_flip       = "true" if g("HERO_IMAGE_FLIP","false").lower() in ("true","1") else "false",
    hero_image_scale      = g("HERO_IMAGE_SCALE","1") or "1",
    hero_gradient_opacity = g("HERO_GRADIENT_OPACITY","0.4") or "0.4",
    hero_gradient_dir     = s(g("HERO_GRADIENT_DIR","to right")),
    hero_image_fit        = s(g("HERO_IMAGE_FIT","cover")),
    story_image_url       = ("'" + s(g("STORY_IMAGE_URL","")) + "'") if g("STORY_IMAGE_URL","") else "NULL",
    our_why_label         = s(g("OUR_WHY_LABEL","Our Why")),
    our_why_quote         = s(g("OUR_WHY_QUOTE","")),
    our_why_body          = s(g("OUR_WHY_BODY","")),
    our_why_image_url     = ("'" + s(g("OUR_WHY_IMAGE_URL","")) + "'") if g("OUR_WHY_IMAGE_URL","") else "NULL",
    our_why_object_position = s(g("OUR_WHY_OBJECT_POSITION","0px 0px")),
    our_why_height_vh     = g("OUR_WHY_HEIGHT_VH","60") or "60",
    our_why_image_scale   = g("OUR_WHY_IMAGE_SCALE","1") or "1",
    our_why_image_flip    = "true" if g("OUR_WHY_IMAGE_FLIP","false").lower() in ("true","1") else "false",
    our_why_image_fit     = s(g("OUR_WHY_IMAGE_FIT","cover")),
    our_why_gradient_opacity = g("OUR_WHY_GRADIENT_OPACITY","0.4") or "0.4",
    our_why_gradient_dir  = s(g("OUR_WHY_GRADIENT_DIR","to right")),
    shipping_free_threshold = g("SHIPPING_FREE_THRESHOLD","75") or "75",
    default_shipping_cost = g("DEFAULT_SHIPPING_COST","6.99") or "6.99",
    affiliate_program_enabled = "true" if g("AFFILIATE_PROGRAM_ENABLED","false").lower() in ("true","1") else "false",
    promo_banner_active   = "true" if g("PROMO_BANNER_ACTIVE","false").lower() in ("true","1") else "false",
    promo_banner_title    = ("'" + s(g("PROMO_BANNER_TITLE","")) + "'") if g("PROMO_BANNER_TITLE","") else "NULL",
    promo_banner_body     = ("'" + s(g("PROMO_BANNER_BODY","")) + "'") if g("PROMO_BANNER_BODY","") else "NULL",
    promo_banner_cta_label= ("'" + s(g("PROMO_BANNER_CTA_LABEL","")) + "'") if g("PROMO_BANNER_CTA_LABEL","") else "NULL",
    promo_banner_cta_url  = ("'" + s(g("PROMO_BANNER_CTA_URL","")) + "'") if g("PROMO_BANNER_CTA_URL","") else "NULL",
    promo_banner_bg_color = s(g("PROMO_BANNER_BG_COLOR","#1a1a1a")),
    social_links          = jsonb(g("SOCIAL_LINKS_JSON","")),
    brand_values          = jsonb(g("BRAND_VALUES_JSON","")),
    popup_settings        = jsonb(g("POPUP_SETTINGS_JSON","")),
    site_url              = s(g("SITE_URL","")),
    default_og_image      = ("'" + s(g("DEFAULT_OG_IMAGE","")) + "'") if g("DEFAULT_OG_IMAGE","") else "NULL",
    sitemap_enabled       = "true" if g("SITEMAP_ENABLED","true").lower() in ("true","1") else "false",
    robots_noindex_admin  = "true" if g("ROBOTS_NOINDEX_ADMIN","true").lower() in ("true","1") else "false",
    jsonld_enabled        = "true" if g("JSONLD_ENABLED","true").lower() in ("true","1") else "false",
    canonical_enabled     = "true" if g("CANONICAL_ENABLED","true").lower() in ("true","1") else "false",
    meta_title_suffix     = s(g("META_TITLE_SUFFIX","")),
    twitter_handle        = s(g("TWITTER_HANDLE","")),
    google_site_verification = ("'" + s(g("GOOGLE_SITE_VERIFICATION","")) + "'") if g("GOOGLE_SITE_VERIFICATION","") else "NULL",
))
PYEOF
)

if run_sql "$RESTORE_SQL" "$SUPABASE_PROJECT_REF" "$SERVICE_ROLE_KEY" "$DB_URL" "$ACCESS_TOKEN"; then
  ok "settings restored"
  ok "seo_settings restored"
else
  fail "Restore SQL failed"
  exit 1
fi

hr
echo -e "${GREEN}  ✅ Configuration restored!${NC}"
echo -e "  From: ${CYAN}$(basename "$SNAPSHOT_FILE")${NC}"
hr
