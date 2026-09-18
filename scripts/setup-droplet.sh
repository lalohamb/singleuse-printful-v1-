#!/bin/bash
# Run ONCE on a fresh Ubuntu 22.04 droplet as root.
#
# Usage:
#   DOMAIN=yourdomain.com \
#   REPO=git@github.com:youruser/yourrepo.git \
#   bash setup-droplet.sh
#
# Before running, upload your .env.local next to this script:
#   scp -i ~/.ssh/id_rsa .env.local root@YOUR_IP:/root/
#
# .env.local must contain at minimum:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   SUPABASE_PROJECT_REF
#   SUPABASE_ACCESS_TOKEN   ← needed to deploy edge functions

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bodyandsleeves}"
PM2_NAME="bodyandsleeves"
DOMAIN="${DOMAIN:?Set DOMAIN, e.g. DOMAIN=yourdomain.com}"
REPO="${REPO:?Set REPO, e.g. REPO=git@github.com:user/repo.git}"

# ── Node.js 22 + Nginx ────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git nginx
npm install -g pm2

# ── Clone repo ────────────────────────────────────────────────────────────────
mkdir -p "$APP_DIR"
GIT_SSH_COMMAND='ssh -i /root/.ssh/github_deploy' git clone "$REPO" "$APP_DIR"
cd "$APP_DIR"

# ── Copy .env.local ───────────────────────────────────────────────────────────
ENV_SRC="$(dirname "$0")/.env.local"
if [ ! -f "$ENV_SRC" ]; then
  ENV_SRC="/root/.env.local"
fi
if [ ! -f "$ENV_SRC" ]; then
  echo "❌ .env.local not found. Upload it to /root/.env.local before running."
  exit 1
fi
cp "$ENV_SRC" "$APP_DIR/.env.local"
chmod 600 "$APP_DIR/.env.local"

# ── Build ─────────────────────────────────────────────────────────────────────
npm install
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp .env.local .next/standalone/.env.local

# ── ecosystem.config.js ───────────────────────────────────────────────────────
node - << 'JSEOF'
const fs = require('fs');
const raw = fs.readFileSync('/var/www/bodyandsleeves/.env.local', 'utf8');
const env = {};
raw.split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)/);
  if (m) env[m[1].trim()] = m[2].trim();
});
env.APP_ROOT = '/var/www/bodyandsleeves';
env.PM2_APP_NAME = 'bodyandsleeves';
env.PORT = '3000';
const config = 'module.exports = { apps: [{ name: "bodyandsleeves", script: "server.js", interpreter: "node", cwd: "/var/www/bodyandsleeves/.next/standalone", env: ' + JSON.stringify(env) + ' }] };';
fs.writeFileSync('/var/www/bodyandsleeves/ecosystem.config.js', config);
console.log('ecosystem.config.js written');
JSEOF

# ── PM2 ───────────────────────────────────────────────────────────────────────
pm2 start ecosystem.config.js
pm2 startup systemd -u root --hp /root
pm2 save

# ── Nginx ─────────────────────────────────────────────────────────────────────
cat > /etc/nginx/sites-available/bodyandsleeves << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /_next/static/ {
        alias ${APP_DIR}/.next/standalone/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /public/ {
        alias ${APP_DIR}/.next/standalone/public/;
        expires 1y;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/bodyandsleeves /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── Supabase Edge Functions ───────────────────────────────────────────────────
# Read vars from .env.local
source_env() {
  local key=$1
  grep "^${key}=" "$APP_DIR/.env.local" | cut -d'=' -f2- | tr -d '\r'
}

SUPABASE_ACCESS_TOKEN=$(source_env SUPABASE_ACCESS_TOKEN)
SUPABASE_PROJECT_REF=$(source_env SUPABASE_PROJECT_REF)
PRINTIFY_API_TOKEN=$(source_env PRINTIFY_API_TOKEN)
PRINTIFY_SHOP_ID=$(source_env PRINTIFY_SHOP_ID)
SITE_URL="https://$DOMAIN"

if [ -z "$SUPABASE_ACCESS_TOKEN" ] || [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "⚠️  SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF not set — skipping edge function deployment."
else
  echo "Deploying Supabase edge functions..."

  # Install Supabase CLI if not present
  if ! command -v supabase &> /dev/null; then
    npm install -g supabase
  fi

  cd "$APP_DIR"
  export SUPABASE_ACCESS_TOKEN

  supabase functions deploy printify-proxy printify-webhook stripe-checkout stripe-webhook \
    --project-ref "$SUPABASE_PROJECT_REF"

  # Set edge function secrets
  supabase secrets set \
    SITE_URL="$SITE_URL" \
    PRINTIFY_SHOP_ID="$PRINTIFY_SHOP_ID" \
    --project-ref "$SUPABASE_PROJECT_REF"

  # Set Printify token separately to avoid shell interpolation issues
  if [ -n "$PRINTIFY_API_TOKEN" ]; then
    printf 'PRINTIFY_API_TOKEN=%s' "$PRINTIFY_API_TOKEN" > /tmp/printify_secret.env
    supabase secrets set --env-file /tmp/printify_secret.env --project-ref "$SUPABASE_PROJECT_REF"
    rm -f /tmp/printify_secret.env
  fi

  echo "✅ Edge functions deployed."
fi

# ── HTTPS (Let's Encrypt) ─────────────────────────────────────────────────────
# Requires DNS for $DOMAIN to already point at this droplet.
# Uncomment to enable:
#   apt-get install -y certbot python3-certbot-nginx
#   certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
#     --non-interactive --agree-tos -m you@example.com --redirect

echo ""
echo "✅ Setup complete. App running at http://$DOMAIN"
echo "   Run certbot (see commented block above) to enable HTTPS."
