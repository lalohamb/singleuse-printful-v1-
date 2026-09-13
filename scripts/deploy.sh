#!/bin/bash
set -e

APP_DIR="/var/www/genderapparel"
APP_NAME="genderapparel"

echo "🚀 Deploying $APP_NAME..."

cd $APP_DIR

echo "📦 Pulling latest code..."
if git remote | grep -q origin; then
  git fetch origin
  git reset --hard origin/main
else
  echo "No git remote found — skipping pull (local mode)"
fi

echo "🔧 Installing dependencies..."
npm install --prefer-offline

echo "🏗️  Building..."
npm run build

echo "📋 Copying static assets to standalone..."
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp -r node_modules/sharp .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/@img .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/stripe .next/standalone/node_modules/ 2>/dev/null || true
# Copy env files so API routes can read them from process.cwd() in standalone
[ -f .env.live ] && cp .env.live .next/standalone/.env.live
[ -f .env.test ] && cp .env.test .next/standalone/.env.test
[ -f .env.local ] && cp .env.local .next/standalone/.env.local
echo "♻️  Restarting PM2..."
# Load .env.local into an ecosystem config so standalone server has all vars
node -e "
  const fs = require('fs');
  const env = {};
  fs.readFileSync('.env.local', 'utf8').split('\\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
  const config = \`module.exports = { apps: [{ name: 'bodyandsleeves', script: '.next/standalone/server.js', interpreter: 'node', cwd: '${APP_DIR}', env: \${JSON.stringify(env, null, 2)} }] };\`;
  fs.writeFileSync('ecosystem.config.js', config);
  console.log('ecosystem.config.js written with', Object.keys(env).length, 'env vars');
"
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "🔄 Reloading nginx..."
nginx -s reload

echo ""
echo "✅ Deploy complete!"
echo "Build ID: $(cat .next/BUILD_ID)"
