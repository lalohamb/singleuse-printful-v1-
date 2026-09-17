alter table settings
  add column if not exists social_links jsonb not null default '{
    "instagram": {"url": "https://instagram.com/your_store", "enabled": true},
    "tiktok":    {"url": "https://tiktok.com/@yourstore", "enabled": true},
    "facebook":  {"url": "https://facebook.com/yourstore", "enabled": true},
    "youtube":   {"url": "https://youtube.com/@yourstore", "enabled": true},
    "pinterest": {"url": "https://pinterest.com/yourstore", "enabled": true},
    "snapchat":  {"url": "https://snapchat.com/add/yourstore", "enabled": true},
    "threads":   {"url": "https://threads.net/@yourstore", "enabled": true},
    "email":     {"url": "mailto:hello@your-store.example", "enabled": true}
  }'::jsonb;
