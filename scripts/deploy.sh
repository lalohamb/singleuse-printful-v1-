#!/bin/bash
# Run on the droplet to deploy updates
# Usage: bash deploy.sh

set -e

APP_DIR="/var/www/bodyandsleeves"

cd $APP_DIR
git pull
npm install
npm run build
pm2 restart bodyandsleeves

echo "✅ Deployed successfully"
