#!/bin/bash
# =============================================================================
# save-config.sh — Snapshot current store configuration
#
# Reads all customizable settings from the live Supabase DB and writes them
# to scripts/snapshots/config-<timestamp>.env so they can be restored after
# a reset.sh or soft-reset.sh run via restore-config.sh.
#
# Saved:  store settings, SEO settings, social links, brand values,
#         popup settings, promo banner, hero/our-why/story images,
#         announcement, shipping thresholds, affiliate program flag
# NOT saved: orders, products, admins, Stripe/Supabase credentials
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
echo -e "${CYAN}  Gender Apparel — Save Configuration${NC}"
hr

# Load credentials
SUPABASE_PROJECT_REF=$(env_get "SUPABASE_PROJECT_REF"      "$ENV_LOCAL")
SERVICE_ROLE_KEY=$(env_get     "SUPABASE_SERVICE_ROLE_KEY" "$ENV_LOCAL")

if [[ -z "$SUPABASE_PROJECT_REF" || -z "$SERVICE_ROLE_KEY" ]]; then
  fail "SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY not set in .env.local"
  exit 1
fi

SUPABASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co"

# ── Fetch settings row via REST API ──────────────────────────────────────────
echo ""
echo "  Fetching settings from Supabase..."

SETTINGS_JSON=$(curl -sf \
  "${SUPABASE_URL}/rest/v1/settings?select=*&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Accept: application/json")

SEO_JSON=$(curl -sf \
  "${SUPABASE_URL}/rest/v1/seo_settings?select=*&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Accept: application/json")

if [[ -z "$SETTINGS_JSON" || "$SETTINGS_JSON" == "[]" ]]; then
  fail "No settings row found in DB"
  exit 1
fi

# ── Parse fields with python3 ─────────────────────────────────────────────────
read_field() {
  local json="$1" field="$2"
  echo "$json" | python3 -c "
import json, sys
rows = json.load(sys.stdin)
row = rows[0] if isinstance(rows, list) else rows
val = row.get('$field', '')
if val is None:
    print('')
elif isinstance(val, (dict, list)):
    print(json.dumps(val))
else:
    print(str(val))
"
}

# settings fields
STORE_NAME=$(read_field            "$SETTINGS_JSON" "store_name")
STORE_TAGLINE=$(read_field         "$SETTINGS_JSON" "tagline")
HERO_TITLE=$(read_field            "$SETTINGS_JSON" "hero_title")
HERO_SUBTITLE=$(read_field         "$SETTINGS_JSON" "hero_subtitle")
HERO_IMAGE_URL=$(read_field        "$SETTINGS_JSON" "hero_image_url")
HERO_OBJECT_POSITION=$(read_field  "$SETTINGS_JSON" "hero_object_position")
HERO_HEIGHT_VH=$(read_field        "$SETTINGS_JSON" "hero_height_vh")
HERO_IMAGE_FLIP=$(read_field       "$SETTINGS_JSON" "hero_image_flip")
HERO_IMAGE_SCALE=$(read_field      "$SETTINGS_JSON" "hero_image_scale")
HERO_GRADIENT_OPACITY=$(read_field "$SETTINGS_JSON" "hero_gradient_opacity")
HERO_GRADIENT_DIR=$(read_field     "$SETTINGS_JSON" "hero_gradient_dir")
HERO_IMAGE_FIT=$(read_field        "$SETTINGS_JSON" "hero_image_fit")
LOGO_URL=$(read_field              "$SETTINGS_JSON" "logo_url")
LOGO_SIZE=$(read_field             "$SETTINGS_JSON" "logo_size")
FOOTER_LOGO_URL=$(read_field       "$SETTINGS_JSON" "footer_logo_url")
FOOTER_LOGO_SIZE=$(read_field      "$SETTINGS_JSON" "footer_logo_size")
FOOTER_TEXT=$(read_field           "$SETTINGS_JSON" "footer_text")
FOOTER_BOTTOM_MESSAGE=$(read_field "$SETTINGS_JSON" "footer_bottom_message")
ANNOUNCEMENT=$(read_field          "$SETTINGS_JSON" "announcement")
ANNOUNCEMENT_ACTIVE=$(read_field   "$SETTINGS_JSON" "announcement_active")
STORY_IMAGE_URL=$(read_field       "$SETTINGS_JSON" "story_image_url")
OUR_WHY_LABEL=$(read_field         "$SETTINGS_JSON" "our_why_label")
OUR_WHY_QUOTE=$(read_field         "$SETTINGS_JSON" "our_why_quote")
OUR_WHY_BODY=$(read_field          "$SETTINGS_JSON" "our_why_body")
OUR_WHY_IMAGE_URL=$(read_field     "$SETTINGS_JSON" "our_why_image_url")
OUR_WHY_OBJECT_POSITION=$(read_field "$SETTINGS_JSON" "our_why_object_position")
OUR_WHY_HEIGHT_VH=$(read_field     "$SETTINGS_JSON" "our_why_height_vh")
OUR_WHY_IMAGE_SCALE=$(read_field   "$SETTINGS_JSON" "our_why_image_scale")
OUR_WHY_IMAGE_FLIP=$(read_field    "$SETTINGS_JSON" "our_why_image_flip")
OUR_WHY_IMAGE_FIT=$(read_field     "$SETTINGS_JSON" "our_why_image_fit")
OUR_WHY_GRADIENT_OPACITY=$(read_field "$SETTINGS_JSON" "our_why_gradient_opacity")
OUR_WHY_GRADIENT_DIR=$(read_field  "$SETTINGS_JSON" "our_why_gradient_dir")
SHIPPING_FREE_THRESHOLD=$(read_field "$SETTINGS_JSON" "shipping_free_threshold")
DEFAULT_SHIPPING_COST=$(read_field "$SETTINGS_JSON" "default_shipping_cost")
AFFILIATE_PROGRAM_ENABLED=$(read_field "$SETTINGS_JSON" "affiliate_program_enabled")
PROMO_BANNER_ACTIVE=$(read_field   "$SETTINGS_JSON" "promo_banner_active")
PROMO_BANNER_TITLE=$(read_field    "$SETTINGS_JSON" "promo_banner_title")
PROMO_BANNER_BODY=$(read_field     "$SETTINGS_JSON" "promo_banner_body")
PROMO_BANNER_CTA_LABEL=$(read_field "$SETTINGS_JSON" "promo_banner_cta_label")
PROMO_BANNER_CTA_URL=$(read_field  "$SETTINGS_JSON" "promo_banner_cta_url")
PROMO_BANNER_BG_COLOR=$(read_field "$SETTINGS_JSON" "promo_banner_bg_color")
SOCIAL_LINKS_JSON=$(read_field     "$SETTINGS_JSON" "social_links")
BRAND_VALUES_JSON=$(read_field     "$SETTINGS_JSON" "brand_values_settings")
POPUP_SETTINGS_JSON=$(read_field   "$SETTINGS_JSON" "popup_settings")

# seo_settings fields
SITE_URL=$(read_field              "$SEO_JSON" "site_url")
DEFAULT_OG_IMAGE=$(read_field      "$SEO_JSON" "default_og_image")
SITEMAP_ENABLED=$(read_field       "$SEO_JSON" "sitemap_enabled")
ROBOTS_NOINDEX_ADMIN=$(read_field  "$SEO_JSON" "robots_noindex_admin")
JSONLD_ENABLED=$(read_field        "$SEO_JSON" "jsonld_enabled")
CANONICAL_ENABLED=$(read_field     "$SEO_JSON" "canonical_enabled")
META_TITLE_SUFFIX=$(read_field     "$SEO_JSON" "meta_title_suffix")
TWITTER_HANDLE=$(read_field        "$SEO_JSON" "twitter_handle")
GOOGLE_SITE_VERIFICATION=$(read_field "$SEO_JSON" "google_site_verification")

ok "Settings fetched"

# ── Write snapshot file ───────────────────────────────────────────────────────
mkdir -p "$SNAPSHOT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SNAPSHOT_FILE="$SNAPSHOT_DIR/config-${TIMESTAMP}.env"

# Ensure snapshots are gitignored
GITIGNORE="$ROOT_DIR/.gitignore"
if ! grep -qF "scripts/snapshots/" "$GITIGNORE" 2>/dev/null; then
  echo "scripts/snapshots/" >> "$GITIGNORE"
  ok "Added scripts/snapshots/ to .gitignore"
fi

cat > "$SNAPSHOT_FILE" <<EOSNAP
# =============================================================================
# Config snapshot — saved $(date "+%Y-%m-%d %H:%M:%S")
# Restore with:  ./scripts/restore-config.sh $SNAPSHOT_FILE
# =============================================================================

# ── Store ─────────────────────────────────────────────────────────────────────
STORE_NAME=$(printf '%q' "$STORE_NAME")
STORE_TAGLINE=$(printf '%q' "$STORE_TAGLINE")
LOGO_URL=$(printf '%q' "$LOGO_URL")
LOGO_SIZE=$(printf '%q' "$LOGO_SIZE")
FOOTER_LOGO_URL=$(printf '%q' "$FOOTER_LOGO_URL")
FOOTER_LOGO_SIZE=$(printf '%q' "$FOOTER_LOGO_SIZE")
FOOTER_TEXT=$(printf '%q' "$FOOTER_TEXT")
FOOTER_BOTTOM_MESSAGE=$(printf '%q' "$FOOTER_BOTTOM_MESSAGE")
ANNOUNCEMENT=$(printf '%q' "$ANNOUNCEMENT")
ANNOUNCEMENT_ACTIVE=$(printf '%q' "$ANNOUNCEMENT_ACTIVE")

# ── Hero ──────────────────────────────────────────────────────────────────────
HERO_TITLE=$(printf '%q' "$HERO_TITLE")
HERO_SUBTITLE=$(printf '%q' "$HERO_SUBTITLE")
HERO_IMAGE_URL=$(printf '%q' "$HERO_IMAGE_URL")
HERO_OBJECT_POSITION=$(printf '%q' "$HERO_OBJECT_POSITION")
HERO_HEIGHT_VH=$(printf '%q' "$HERO_HEIGHT_VH")
HERO_IMAGE_FLIP=$(printf '%q' "$HERO_IMAGE_FLIP")
HERO_IMAGE_SCALE=$(printf '%q' "$HERO_IMAGE_SCALE")
HERO_GRADIENT_OPACITY=$(printf '%q' "$HERO_GRADIENT_OPACITY")
HERO_GRADIENT_DIR=$(printf '%q' "$HERO_GRADIENT_DIR")
HERO_IMAGE_FIT=$(printf '%q' "$HERO_IMAGE_FIT")

# ── Our Why ───────────────────────────────────────────────────────────────────
STORY_IMAGE_URL=$(printf '%q' "$STORY_IMAGE_URL")
OUR_WHY_LABEL=$(printf '%q' "$OUR_WHY_LABEL")
OUR_WHY_QUOTE=$(printf '%q' "$OUR_WHY_QUOTE")
OUR_WHY_BODY=$(printf '%q' "$OUR_WHY_BODY")
OUR_WHY_IMAGE_URL=$(printf '%q' "$OUR_WHY_IMAGE_URL")
OUR_WHY_OBJECT_POSITION=$(printf '%q' "$OUR_WHY_OBJECT_POSITION")
OUR_WHY_HEIGHT_VH=$(printf '%q' "$OUR_WHY_HEIGHT_VH")
OUR_WHY_IMAGE_SCALE=$(printf '%q' "$OUR_WHY_IMAGE_SCALE")
OUR_WHY_IMAGE_FLIP=$(printf '%q' "$OUR_WHY_IMAGE_FLIP")
OUR_WHY_IMAGE_FIT=$(printf '%q' "$OUR_WHY_IMAGE_FIT")
OUR_WHY_GRADIENT_OPACITY=$(printf '%q' "$OUR_WHY_GRADIENT_OPACITY")
OUR_WHY_GRADIENT_DIR=$(printf '%q' "$OUR_WHY_GRADIENT_DIR")

# ── Shipping ──────────────────────────────────────────────────────────────────
SHIPPING_FREE_THRESHOLD=$(printf '%q' "$SHIPPING_FREE_THRESHOLD")
DEFAULT_SHIPPING_COST=$(printf '%q' "$DEFAULT_SHIPPING_COST")

# ── Affiliate ─────────────────────────────────────────────────────────────────
AFFILIATE_PROGRAM_ENABLED=$(printf '%q' "$AFFILIATE_PROGRAM_ENABLED")

# ── Promo Banner ──────────────────────────────────────────────────────────────
PROMO_BANNER_ACTIVE=$(printf '%q' "$PROMO_BANNER_ACTIVE")
PROMO_BANNER_TITLE=$(printf '%q' "$PROMO_BANNER_TITLE")
PROMO_BANNER_BODY=$(printf '%q' "$PROMO_BANNER_BODY")
PROMO_BANNER_CTA_LABEL=$(printf '%q' "$PROMO_BANNER_CTA_LABEL")
PROMO_BANNER_CTA_URL=$(printf '%q' "$PROMO_BANNER_CTA_URL")
PROMO_BANNER_BG_COLOR=$(printf '%q' "$PROMO_BANNER_BG_COLOR")

# ── SEO ───────────────────────────────────────────────────────────────────────
SITE_URL=$(printf '%q' "$SITE_URL")
DEFAULT_OG_IMAGE=$(printf '%q' "$DEFAULT_OG_IMAGE")
SITEMAP_ENABLED=$(printf '%q' "$SITEMAP_ENABLED")
ROBOTS_NOINDEX_ADMIN=$(printf '%q' "$ROBOTS_NOINDEX_ADMIN")
JSONLD_ENABLED=$(printf '%q' "$JSONLD_ENABLED")
CANONICAL_ENABLED=$(printf '%q' "$CANONICAL_ENABLED")
META_TITLE_SUFFIX=$(printf '%q' "$META_TITLE_SUFFIX")
TWITTER_HANDLE=$(printf '%q' "$TWITTER_HANDLE")
GOOGLE_SITE_VERIFICATION=$(printf '%q' "$GOOGLE_SITE_VERIFICATION")

# ── JSON blobs (do not edit manually) ────────────────────────────────────────
SOCIAL_LINKS_JSON=$(printf '%q' "$SOCIAL_LINKS_JSON")
BRAND_VALUES_JSON=$(printf '%q' "$BRAND_VALUES_JSON")
POPUP_SETTINGS_JSON=$(printf '%q' "$POPUP_SETTINGS_JSON")
EOSNAP

ok "Snapshot saved → ${SNAPSHOT_FILE#$ROOT_DIR/}"

# ── Keep only the 10 most recent snapshots ────────────────────────────────────
SNAPSHOT_COUNT=$(ls -1 "$SNAPSHOT_DIR"/config-*.env 2>/dev/null | wc -l)
if [[ "$SNAPSHOT_COUNT" -gt 10 ]]; then
  ls -1t "$SNAPSHOT_DIR"/config-*.env | tail -n +11 | xargs rm -f
  ok "Old snapshots pruned (kept 10 most recent)"
fi

hr
echo -e "${GREEN}  ✅ Configuration saved!${NC}"
echo -e "  Restore after a reset with:"
echo -e "  ${CYAN}./scripts/restore-config.sh ${SNAPSHOT_FILE#$ROOT_DIR/}${NC}"
hr
