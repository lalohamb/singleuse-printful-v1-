#!/bin/bash
# build-and-push.sh — Build locally, push artifact to production server.
#
# Solves the OOM-during-deploy problem on a 1 vCPU / 2 GB Droplet:
#   - npm run build runs on your local machine (no RAM contention with live app)
#   - Only the compiled .next/standalone artifact is pushed to the server
#   - Server runs deploy.sh --skip-sync to reload PM2 with zero downtime
#
# Prerequisites:
#   - SSH access to the server (key-based)
#   - rsync installed locally
#   - DEPLOY_HOST set to root@<your-droplet-ip>
#
# Usage:
#   DEPLOY_HOST=root@<droplet-ip> bash scripts/build-and-push.sh
#
# Or set DEPLOY_HOST permanently in your shell profile:
#   export DEPLOY_HOST=root@<droplet-ip>

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST=root@<droplet-ip>}"
APP_DIR="/var/www/bodyandsleeves"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "\n${CYAN}[$1/4]${NC} $2"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Body&Sleeves — Local Build + Push${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# ── [1/4] Build locally ───────────────────────────────────────────────────────
step 1 "Building locally (keeps production server free)"
npm run build
ok "Build complete — $(cat .next/BUILD_ID)"

# ── [2/4] Prepare standalone artifact ────────────────────────────────────────
step 2 "Preparing standalone artifact"
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
ok "Assets copied to standalone"

# ── [3/4] Push artifact to server ────────────────────────────────────────────
step 3 "Pushing artifact to $DEPLOY_HOST"

# Sync the standalone build output — excludes node_modules (already on server)
rsync -az --delete \
  -e "ssh -i $SSH_KEY" \
  --exclude='.env.local' \
  .next/standalone/ \
  "$DEPLOY_HOST:$APP_DIR/.next/standalone/"

# Sync the static assets separately (immutable, content-addressed)
rsync -az --delete \
  -e "ssh -i $SSH_KEY" \
  .next/static/ \
  "$DEPLOY_HOST:$APP_DIR/.next/static/"

# Sync public folder
rsync -az --delete \
  -e "ssh -i $SSH_KEY" \
  public/ \
  "$DEPLOY_HOST:$APP_DIR/public/"

# Sync source files (for deploy.sh to reference)
rsync -az \
  -e "ssh -i $SSH_KEY" \
  --include='scripts/***' \
  --include='package.json' \
  --exclude='*' \
  ./ \
  "$DEPLOY_HOST:$APP_DIR/"

ok "Artifact pushed to server"

# ── [4/4] Trigger zero-downtime reload on server ─────────────────────────────
step 4 "Triggering zero-downtime reload on server"

ssh -i "$SSH_KEY" "$DEPLOY_HOST" "cd $APP_DIR && bash scripts/deploy.sh --skip-sync"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Deploy complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
