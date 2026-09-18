#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/bodyandsleeves"
PM2_NAME="bodyandsleeves"

echo "🚀 Deploying $PM2_NAME..."

cd "$APP_DIR"

# ── Pull latest code ──────────────────────────────────────────────────────────
echo "📦 Pulling latest code..."
GIT_SSH_COMMAND='ssh -i /root/.ssh/github_deploy' git pull

# ── Install + Build ───────────────────────────────────────────────────────────
echo "🔧 Installing dependencies..."
npm install --prefer-offline

echo "🏗️  Building..."
npm run build

# ── Copy assets to standalone ─────────────────────────────────────────────────
echo "📋 Copying assets to standalone..."
cp -r .next/server .next/standalone/.next/server
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp .env.local .next/standalone/.env.local

# ── Regenerate ecosystem.config.js ───────────────────────────────────────────
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
const config = 'module.exports = { apps: [{ name: "bodyandsleeves", script: ".next/standalone/server.js", interpreter: "node", cwd: "/var/www/bodyandsleeves", env: ' + JSON.stringify(env) + ' }] };';
fs.writeFileSync('/var/www/bodyandsleeves/ecosystem.config.js', config);
console.log('ecosystem.config.js written');
JSEOF

# ── Restart PM2 ───────────────────────────────────────────────────────────────
echo "♻️  Restarting PM2..."
pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# ── Deploy edge functions ─────────────────────────────────────────────────────
source_env() {
  grep "^${1}=" "$APP_DIR/.env.local" | cut -d'=' -f2- | tr -d '\r'
}

SUPABASE_ACCESS_TOKEN=$(source_env SUPABASE_ACCESS_TOKEN)
SUPABASE_PROJECT_REF=$(source_env SUPABASE_PROJECT_REF)

if [ -n "$SUPABASE_ACCESS_TOKEN" ] && [ -n "$SUPABASE_PROJECT_REF" ]; then
  echo "🔁 Deploying edge functions..."
  export SUPABASE_ACCESS_TOKEN
  supabase functions deploy printify-proxy printify-webhook stripe-checkout stripe-webhook \
    --project-ref "$SUPABASE_PROJECT_REF" 2>/dev/null || echo "⚠️  Edge function deploy failed — skipping."
else
  echo "⚠️  Skipping edge functions (SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF not set)."
fi

# ── Reload Nginx ──────────────────────────────────────────────────────────────
nginx -s reload

echo ""
echo "✅ Deploy complete! Build ID: $(cat .next/BUILD_ID)"
