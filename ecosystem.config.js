// ecosystem.config.js — PM2 configuration
// Values are populated by scripts/install.sh or the stripe-switch API route.
// Do NOT commit real credentials here — use .env.local instead.
module.exports = { apps: [{ name: '<PM2_APP_NAME>', script: '.next/standalone/server.js', interpreter: 'node', cwd: '<APP_ROOT>', max_memory_restart: '400M', node_args: '--max-old-space-size=512', env: {
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
  "STRIPE_SECRET_KEY": "sk_test_51UEiW6KB3dxCEzFyHDS1XUdupz0sbyvBTb7RYm43SsWtH1o78HZq5VHD5UI1f9SFBWuE5LynY2liwNAnkWf2UZvb00ANyz6ByT",
  "STRIPE_WEBHOOK_SECRET": "whsec_af49BZjWXG544KmFFMOr2Y8ec6TW3Xtn",
  "NEXT_PUBLIC_SITE_URL": "https://bodyandsleeves.com",
  "PLATFORM_DOMAIN": "",
  "LICENSE_HMAC_SECRET": ""
} }] };
