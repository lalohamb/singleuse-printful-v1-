#!/bin/bash
# Run ONCE on a fresh Ubuntu 22.04 droplet as root
# Usage: bash setup-droplet.sh

set -e

APP_DIR="/var/www/bodyandsleeves"
DOMAIN="yourdomain.com"        # <-- change this
REPO="https://github.com/yourusername/yourrepo.git"  # <-- change this

# --- Node.js 22 ---
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git nginx

# --- PM2 ---
npm install -g pm2

# --- Clone repo ---
mkdir -p $APP_DIR
git clone $REPO $APP_DIR
cd $APP_DIR

# --- Environment variables ---
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PRINTIFY_API_TOKEN=your-printify-token
EOF

# --- Build ---
npm install
npm run build

# --- PM2 ---
pm2 start npm --name "bodyandsleeves" -- start
pm2 startup
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
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/bodyandsleeves /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "✅ Done. App running at http://$DOMAIN"
echo "👉 Add SSL: apt install certbot python3-certbot-nginx -y && certbot --nginx -d $DOMAIN -d www.$DOMAIN"
