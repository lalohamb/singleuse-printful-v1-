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
NEXT_PUBLIC_SUPABASE_URL=https://dpchsndriniqojjvtaqf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwY2hzbmRyaW5pcW9qanZ0YXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTczNzksImV4cCI6MjEwNDAzMzM3OX0.UYFi7h82RsFq2lBOoGHvAqEryNTB-ukLiXGV5akAYgY
PRINTIFY_API_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzN2Q0YmQzMDM1ZmUxMWU5YTgwM2FiN2VlYjNjY2M5NyIsImp0aSI6ImQ2ODc2MDc5NTQ0Njk1OThiY2UwYWUzMDE1YzZjOTI5MmQ2MmM2Y2QwNmJiOTE2NDQwMzliNzgyYjE4NTdiZjNiZmMxZWMyZmQ4M2QzMzM5IiwiaWF0IjoxNzg4NDcyNDIyLjE1MTc3NiwibmJmIjoxNzg4NDcyNDIyLjE1MTc3OCwiZXhwIjoxODIwMDA4NDIyLjE0NTk0Nywic3ViIjoiMjQzMjIyODciLCJzY29wZXMiOlsic2hvcHMubWFuYWdlIiwic2hvcHMucmVhZCIsImNhdGFsb2cucmVhZCIsIm9yZGVycy5yZWFkIiwib3JkZXJzLndyaXRlIiwicHJvZHVjdHMucmVhZCIsInByb2R1Y3RzLndyaXRlIiwid2ViaG9va3MucmVhZCIsIndlYmhvb2tzLndyaXRlIiwidXBsb2Fkcy5yZWFkIiwidXBsb2Fkcy53cml0ZSIsInByaW50X3Byb3ZpZGVycy5yZWFkIiwidXNlci5pbmZvIl19.Bdt1XjfbXUX2S3t7XDXfJukWZ78BvIzwdssQkLbQu7Qrwn7XOjtUUryNbN6s23lbYbQufNKjpb96pT_NH5HZYdIrACX1AIUoGNmgvlXSx1mL08Bdi1Yxx_G5W4ARr9EUuvarqTGvrHzy1tZQh-QivnBbNV470xpq_J8AXsnYTl_l7RDljvMG64TrIvrq1rg8IeRO6uroaSNDV3srAfzTL06DHb3FAWONY7UBmrxSmvSM8uR3EjKM6Jl_ngLb-pokc_g9Kn3ZooUYZnlOBBSoXgeaEZkF77XlK7uGDlopwZTyU2f3MCgihfIoc6jsc1s1OkOm64NFW8rDexHGbnKC_HD8nYf4_DDqEFKPLGdnniShF9kdN5JdFcnGY7Lh4Dez3rq0jFsx79DiY7miwZax_Y8boqhWmhfSfjSnEQn4zgfIbQb3VFd4PkbwqnpcicJ3vYuUd48oE0ww4a4gMvnS_6npMNTc_v4UKK8C3QvXl5wm-bhSPuTEELjR8rl4Q7De_D1e0J4_V68jRvEIzLrt-lCFN2PoX9FfBFGa2tQlfZaYgZvI_KjukGHsVV8O8F4TiK4sr5xQnkXN1i_9P4wZBMFUd5PbugVwpdzKbuPfIchY7hMisUqu3eXFsIjhusbxOhXYtPVFFJih39f1jbA6zCtxlyuei8q6PXsEf5RHI_8

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
