#!/bin/bash
set -e

APP_DIR="/var/www/bodyandsleeves"
APP_NAME="bodyandsleeves"

echo "🚀 Deploying $APP_NAME..."

cd $APP_DIR

echo "📦 Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo "🔧 Installing dependencies..."
npm ci --omit=dev

echo "🏗️  Building..."
npm run build

echo "📋 Copying sharp to standalone..."
cp -r node_modules/sharp .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/@img .next/standalone/node_modules/ 2>/dev/null || true
echo "♻️  Restarting PM2..."
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start node --name $APP_NAME -- .next/standalone/server.js
pm2 save

echo "🔄 Reloading nginx..."
nginx -s reload

echo ""
echo "✅ Deploy complete!"
echo "Build ID: $(cat .next/BUILD_ID)"
