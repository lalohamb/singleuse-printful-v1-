#!/bin/bash
# Run ONCE on a fresh Ubuntu 22.04 droplet as root
#
# Usage:
#   DOMAIN=bodyandsleeves.com \
#   REPO=git@github.com:lalohamb/bodyandsleeves-next.git \
#   bash setup-droplet.sh
#
# Secrets (Supabase, Printify, etc.) are NOT stored in this script.
# Provide them one of two ways before running:
#   1. Place a ready-made .env.local next to this script (scp it up), OR
#   2. Export the vars in your shell and they'll be written to .env.local:
#        NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
#
# REPO should use an SSH deploy key (git@github.com:...) so no token is
# ever written to disk. Generate one on the droplet with:
#   ssh-keygen -t ed25519 -f /root/.ssh/github_deploy -N ""
# then add the .pub as a read-only deploy key on the GitHub repo.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bodyandsleeves}"
DOMAIN="${DOMAIN:?Set DOMAIN, e.g. DOMAIN=bodyandsleeves.com}"
REPO="${REPO:?Set REPO, e.g. REPO=git@github.com:lalohamb/bodyandsleeves-next.git}"

# --- Node.js 22 ---
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git nginx

# --- PM2 ---
npm install -g pm2

# --- Clone repo ---
mkdir -p "$APP_DIR"
git clone "$REPO" "$APP_DIR"
cd "$APP_DIR"

# --- Environment variables ---
# Prefer an .env.local uploaded alongside this script; otherwise build one
# from the environment. Never commit .env.local — it holds secrets.
if [ -f "$(dirname "$0")/.env.local" ]; then
  cp "$(dirname "$0")/.env.local" "$APP_DIR/.env.local"
else
  : "${NEXT_PUBLIC_SUPABASE_URL:?Set NEXT_PUBLIC_SUPABASE_URL or provide .env.local}"
  : "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Set NEXT_PUBLIC_SUPABASE_ANON_KEY or provide .env.local}"
  cat > "$APP_DIR/.env.local" << EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
EOF
fi
chmod 600 "$APP_DIR/.env.local"

# --- Build ---
npm install
npm run build

# --- PM2 ---
pm2 start npm --name "bodyandsleeves" -- start
pm2 startup systemd -u root --hp /root
pm2 save

# --- Nginx config ---
cat > /etc/nginx/sites-available/bodyandsleeves << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

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

# --- HTTPS (Let's Encrypt) ---
# Requires DNS for $DOMAIN + www.$DOMAIN to already point at this droplet.
# Uncomment and set an email to enable:
#   apt-get install -y certbot python3-certbot-nginx
#   certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
#     --non-interactive --agree-tos -m you@example.com --redirect

echo ""
echo "✅ Done. App running at http://$DOMAIN"
echo "   Run certbot (see commented block above) to enable HTTPS."
