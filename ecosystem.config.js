// ecosystem.config.js — PM2 configuration
// Values are populated by scripts/install.sh or the stripe-switch API route.
// Do NOT commit real credentials here — use .env.local instead.
module.exports = { apps: [{ name: '<PM2_APP_NAME>', script: '.next/standalone/server.js', interpreter: 'node', cwd: '<APP_ROOT>', env: {
  "APP_ROOT": "<APP_ROOT>",
  "PM2_APP_NAME": "<PM2_APP_NAME>",
  "NEXT_PUBLIC_SUPABASE_URL": "",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY": "",
  "SUPABASE_SERVICE_ROLE_KEY": "",
  "SUPABASE_ACCESS_TOKEN": "",
  "SUPABASE_PROJECT_REF": "",
  "PRINTIFY_SHOP_ID": "",
  "NEXT_PUBLIC_PRINTIFY_SHOP_ID": "",
  "PRINTIFY_API_TOKEN": "",
  "RESEND_API_KEY": "",
  "MAILER_LITE_API_KEY": "",
  "STRIPE_SECRET_KEY": "",
  "STRIPE_WEBHOOK_SECRET": "",
  "NEXT_PUBLIC_SITE_URL": "",
  "PLATFORM_DOMAIN": "",
  "LICENSE_HMAC_SECRET": ""
} }] };
