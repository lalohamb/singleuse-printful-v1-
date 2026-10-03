#!/bin/bash
# deploy.sh — Deploy for Body&Sleeves on a 1 vCPU / 2 GB Droplet.
#
# Build strategy: build ON the server, but stop PM2 first to free RAM.
# A 1 vCPU / 2 GB machine cannot safely run npm run build AND serve traffic
# simultaneously — the build peaks at 600-900 MB and will cause OOM.
#
# Stopping PM2 first frees ~165 MB and gives the build process the full
# 2 GB to work with. Downtime window is ~30-60 seconds (build time).
# This is acceptable for a low-traffic POD storefront.
#
# For zero-downtime deploys, use build-and-push.sh from your local machine.

set -euo pipefail

APP_DIR="/var/www/countybuys"
PM2_NAME="countybuys"
SKIP_BUILD="${1:-}"

echo "🚀 Deploying $PM2_NAME..."

cd "$APP_DIR"

if [[ "$SKIP_BUILD" != "--skip-build" ]]; then
  # ── Pull latest code ──────────────────────────────────────────────────────
  echo "📦 Pulling latest code..."
  git stash
  GIT_SSH_COMMAND='ssh -i /root/.ssh/github_deploy' git pull

  # ── Stop PM2 BEFORE building to free RAM ─────────────────────────────────
  # Build peaks at 600-900 MB. Running app uses 165 MB.
  # Combined on a 2 GB Droplet = OOM during build.
  # Stopping first gives the build the full machine.
  echo "⏸️  Stopping app to free RAM for build (~30-60s downtime)..."
  pm2 stop "$PM2_NAME" 2>/dev/null || true

  # ── Install + Build ───────────────────────────────────────────────────────
  echo "🔧 Installing dependencies..."
  npm install --prefer-offline

  echo "🏗️  Building... (app stopped, full RAM available)"
  npm run build
fi

# ── Copy assets to standalone ─────────────────────────────────────────────
echo "📋 Copying assets to standalone..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp .env.local .next/standalone/.env.local

# ── Regenerate ecosystem.config.js ───────────────────────────────────────
node - << 'JSEOF'
const fs = require('fs');
const raw = fs.readFileSync('/var/www/countybuys/.env.local', 'utf8');
const env = {};
raw.split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)/);
  if (m) env[m[1].trim()] = m[2].trim();
});
env.APP_ROOT = '/var/www/countybuys';
env.PM2_APP_NAME = 'countybuys';
env.PORT = '3000';
const app = {
  name: 'countybuys',
  script: 'server.js',
  interpreter: 'node',
  cwd: '/var/www/countybuys/.next/standalone',
  max_memory_restart: '400M',
  node_args: '--max-old-space-size=512',
  env,
};
const config = 'module.exports = { apps: [' + JSON.stringify(app) + '] };';
fs.writeFileSync('/var/www/countybuys/ecosystem.config.js', config);
console.log('ecosystem.config.js written (max_memory_restart=400M, max-old-space-size=512)');
JSEOF

# ── Start app ─────────────────────────────────────────────────────────────
echo "▶️  Starting app..."
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 start ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

# ── Deploy edge functions ─────────────────────────────────────────────────
source_env() {
  grep "^${1}=" "$APP_DIR/.env.local" | cut -d'=' -f2- | tr -d '\r'
}

SUPABASE_ACCESS_TOKEN=$(source_env SUPABASE_ACCESS_TOKEN)
SUPABASE_PROJECT_REF=$(source_env SUPABASE_PROJECT_REF)

if [ -n "$SUPABASE_ACCESS_TOKEN" ] && [ -n "$SUPABASE_PROJECT_REF" ]; then
  echo "🔁 Deploying edge functions..."
  export SUPABASE_ACCESS_TOKEN
  npx supabase functions deploy printful-proxy stripe-checkout stripe-webhook \
    --project-ref "$SUPABASE_PROJECT_REF" || echo "⚠️  Edge function deploy failed — skipping."

  # ── Sync active Stripe key to edge function secrets ───────────────────────
  # Edge function code is redeployed above but secrets are NOT automatically
  # re-synced. Read the active key from the DB and push it now so the
  # deployed function always boots with the correct key.
  echo "🔑 Syncing Stripe secrets to edge functions..."
  SUPABASE_URL=$(source_env NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY=$(source_env SUPABASE_SERVICE_ROLE_KEY)
  node - << STRIPE_SYNC_EOF
const https = require('https');
const url = '${SUPABASE_URL}/rest/v1/settings?select=stripe_mode,stripe_live_secret_key,stripe_test_secret_key,stripe_live_webhook_secret,stripe_test_webhook_secret';
const options = { headers: { apikey: '${SUPABASE_SERVICE_ROLE_KEY}', Authorization: 'Bearer ${SUPABASE_SERVICE_ROLE_KEY}' } };
https.get(url, options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const rows = JSON.parse(data);
      const s = rows[0];
      if (!s) { console.error('No settings row found'); process.exit(1); }
      const mode = s.stripe_mode || 'test';
      const secretKey = mode === 'live' ? s.stripe_live_secret_key : s.stripe_test_secret_key;
      const webhookSecret = mode === 'live' ? s.stripe_live_webhook_secret : s.stripe_test_webhook_secret;
      if (!secretKey) { console.error('No active Stripe key in DB for mode:', mode); process.exit(1); }
      const body = JSON.stringify([{ name: 'STRIPE_SECRET_KEY', value: secretKey }, { name: 'STRIPE_WEBHOOK_SECRET', value: webhookSecret || '' }]);
      const req = https.request({ hostname: 'api.supabase.com', path: '/v1/projects/${SUPABASE_PROJECT_REF}/secrets', method: 'POST', headers: { Authorization: 'Bearer ${SUPABASE_ACCESS_TOKEN}', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
        let rb = ''; r.on('data', c => rb += c);
        r.on('end', () => { if (r.statusCode >= 200 && r.statusCode < 300) { console.log('Stripe secrets synced (mode=' + mode + ')'); } else { console.error('Secret sync failed:', r.statusCode, rb); } });
      });
      // Also sync SITE_URL so CORS never drifts
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
      if (siteUrl) {
        const siteBody = JSON.stringify([{ name: 'SITE_URL', value: siteUrl }]);
        const siteReq = https.request({ hostname: 'api.supabase.com', path: '/v1/projects/${SUPABASE_PROJECT_REF}/secrets', method: 'POST', headers: { Authorization: 'Bearer ${SUPABASE_ACCESS_TOKEN}', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(siteBody) } }, (r) => {
          let rb = ''; r.on('data', c => rb += c);
          r.on('end', () => { if (r.statusCode >= 200 && r.statusCode < 300) { console.log('SITE_URL synced:', siteUrl); } else { console.warn('SITE_URL sync failed:', r.statusCode); } });
        });
        siteReq.on('error', e => console.warn('SITE_URL sync error:', e.message));
        siteReq.write(siteBody); siteReq.end();
      }
      req.on('error', e => console.error('Secret sync error:', e.message));
      req.write(body); req.end();
    } catch(e) { console.error('Secret sync parse error:', e.message); }
  });
}).on('error', e => console.error('DB fetch error:', e.message));
STRIPE_SYNC_EOF
else
  echo "⚠️  Skipping edge functions (SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF not set)."
fi

# ── Reload Nginx ──────────────────────────────────────────────────────────
nginx -s reload

echo ""
echo "✅ Deploy complete! Build ID: $(cat .next/BUILD_ID)"
