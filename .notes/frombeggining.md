# BA Gateway — Full Redeploy (Step by Step)

SSH into the droplet and run these one at a time:

## 1. Stop and remove the app

```bash
pm2 delete bodyandsleeves
pm2 save
```

## 2. Pull latest code

```bash
cd /var/www/bodyandsleeves
git pull
```

## 3. Install dependencies

```bash
npm ci
```

## 4. Build

```bash
npm run build
```

## 5. Copy required files to standalone

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r node_modules/sharp .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/@img .next/standalone/node_modules/ 2>/dev/null || true
```

## 6. Generate ecosystem config from .env.local

```bash
node -e "
  const fs = require('fs');
  const env = {};
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
  const config = \`module.exports = { apps: [{ name: 'bodyandsleeves', script: '.next/standalone/server.js', interpreter: 'node', cwd: '/var/www/bodyandsleeves', env: \${JSON.stringify(env, null, 2)} }] };\`;
  fs.writeFileSync('ecosystem.config.js', config);
  console.log('Written', Object.keys(env).length, 'env vars');
"
```

## 7. Start PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 8. Reload nginx

```bash
nginx -s reload
```

## 9. Verify it's running

```bash
pm2 list
curl -I http://localhost:3000
```

Tell me what output you get on step 9.
