# Deployment & Ops Reference — Body & Sleeves

## Connection
```bash
# SSH into droplet
ssh -i ~/.ssh/id_rsa root@159.203.8.90

# SSH tunnel to view site (bypasses ISP hijacking of bare IPs)
ssh -i ~/.ssh/id_rsa -L 8181:localhost:80 root@159.203.8.90 -N
# then visit http://localhost:8181
```

## Standard Deploy (after `git push` locally)
```bash
ssh -i ~/.ssh/id_rsa root@159.203.8.90 "
cd /var/www/bodyandsleeves && \
GIT_SSH_COMMAND='ssh -i /root/.ssh/github_deploy' git pull origin main && \
npm run build && \
cp -r .next/static .next/standalone/.next/static && \
cp -r public .next/standalone/public && \
cp .env.local .next/standalone/.env.local && \
pm2 restart bodyandsleeves
"
```

## PM2
```bash
pm2 status bodyandsleeves
pm2 restart bodyandsleeves                       # keeps existing env
pm2 delete bodyandsleeves && pm2 start ecosystem.config.js && pm2 save   # full reset, picks up new env
pm2 logs bodyandsleeves --lines 30 --nostream
```

## Git
```bash
# Local
git add -A && git commit -m "message" && git push origin main

# On droplet (must use deploy key, not default SSH)
GIT_SSH_COMMAND='ssh -i /root/.ssh/github_deploy' git -C /var/www/bodyandsleeves pull origin main
```

## Regenerate ecosystem.config.js from .env.local
```bash
node - << 'JSEOF'
const fs = require('fs');
const raw = fs.readFileSync('/var/www/bodyandsleeves/.env.local','utf8');
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
JSEOF
```

## Supabase — Run SQL via Management API (no psql needed)
```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/<PROJECT_REF>/database/query" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query": "<SQL HERE>"}'
```

### Run destroy / schema / all migrations in order (Python helper)
```bash
python3 -c "
import json, urllib.request, urllib.error, os, glob

ACCESS_TOKEN = '<ACCESS_TOKEN>'
PROJECT_REF  = '<PROJECT_REF>'
URL = f'https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query'

files = sorted(glob.glob('supabase/migrations/*.sql'))
for fpath in files:
    with open(fpath) as f:
        sql = f.read()
    req = urllib.request.Request(URL, data=json.dumps({'query': sql}).encode(),
        headers={'Authorization': f'Bearer {ACCESS_TOKEN}', 'Content-Type': 'application/json'}, method='POST')
    try:
        urllib.request.urlopen(req)
        print(f'OK  {os.path.basename(fpath)}')
    except urllib.error.HTTPError as e:
        print(f'WARN {os.path.basename(fpath)}: {e.read().decode()[:120]}')
"
```

### Inspect table columns (diagnose "column not found" errors)
```bash
curl -s "https://<ref>.supabase.co/rest/v1/settings?select=*&limit=1" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(sorted(d[0].keys()))"
```

### Create admin auth user + insert into admins table
```bash
python3 -c "
import json, urllib.request, urllib.error

PROJECT_REF, SERVICE_ROLE_KEY = '<PROJECT_REF>', '<SERVICE_ROLE_KEY>'
ADMIN_EMAIL, ADMIN_PASSWORD = '<email>', '<password>'

req = urllib.request.Request(
    f'https://{PROJECT_REF}.supabase.co/auth/v1/admin/users',
    data=json.dumps({'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD, 'email_confirm': True}).encode(),
    headers={'apikey': SERVICE_ROLE_KEY, 'Authorization': f'Bearer {SERVICE_ROLE_KEY}', 'Content-Type': 'application/json'},
    method='POST')
with urllib.request.urlopen(req) as r:
    user_id = json.loads(r.read())['id']

req2 = urllib.request.Request(
    f'https://{PROJECT_REF}.supabase.co/rest/v1/admins',
    data=json.dumps({'id': user_id, 'email': ADMIN_EMAIL, 'role': 'super_admin'}).encode(),
    headers={'apikey': SERVICE_ROLE_KEY, 'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
             'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates'},
    method='POST')
urllib.request.urlopen(req2)
print('admin created:', user_id)
"
```

## Supabase Storage
```bash
# Create bucket
curl -s -X POST "https://<ref>.supabase.co/storage/v1/bucket" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"id":"store-images","name":"store-images","public":true,"file_size_limit":5242880,"allowed_mime_types":["image/jpeg","image/png","image/webp"]}'

# List bucket contents
curl -s "https://<ref>.supabase.co/storage/v1/object/list/store-images" -X POST \
  -H "apikey: <SERVICE_ROLE_KEY>" -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" -d '{"prefix":"","limit":100}'
```

## Supabase Edge Functions
```bash
npx supabase functions deploy <function-name> --project-ref <PROJECT_REF>
npx supabase secrets set KEY=value --project-ref <PROJECT_REF>
npx supabase secrets list --project-ref <PROJECT_REF>
```

## Printify — trigger sync (must run from droplet IP; local IP gets Cloudflare-blocked)
```bash
ssh -i ~/.ssh/id_rsa root@159.203.8.90 "curl -s -X POST \
  'https://<ref>.supabase.co/functions/v1/printify-proxy/sync?shop_id=<SHOP_ID>' \
  -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' -H 'Content-Type: application/json' -d '{}'"
```

## Printify — unstick a product from "Publishing" state
```bash
curl -s -X POST \
  "https://api.printify.com/v1/shops/<SHOP_ID>/products/<PRODUCT_ID>/publishing_succeeded.json" \
  -H "Authorization: Bearer <PRINTIFY_TOKEN>" -H "Content-Type: application/json" \
  -d '{"title":true,"description":true,"images":true,"variants":true,"tags":true}'
```

## Nginx — serve _next/static directly from disk
```nginx
location /_next/static/ {
    alias /var/www/bodyandsleeves/.next/standalone/.next/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
}
```
```bash
nginx -t && systemctl reload nginx
```

## Reboot & Verify Auto-Start
```bash
ssh -i ~/.ssh/id_rsa root@159.203.8.90 "reboot"
sleep 35 && ssh -i ~/.ssh/id_rsa root@159.203.8.90 "pm2 status"
```

---
**Known gotchas learned the hard way:**
- `ecosystem.config.js` needs `cwd` = `.next/standalone`, `script` = `server.js` (relative to that cwd) — NOT the app root.
- Nginx must serve `_next/static` directly; the standalone server does not serve it.
- Printify API calls from most residential/office IPs get Cloudflare-blocked (403/1010) — always run from the droplet.
- Stripe keys live in the DB (`settings` table), not `.env` — switching modes needs no restart.
