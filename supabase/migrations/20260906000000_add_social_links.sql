alter table settings
  add column if not exists social_links jsonb not null default '{
    "instagram": {"url": "https://instagram.com/body_and_sleeves", "enabled": true},
    "tiktok":    {"url": "https://tiktok.com/@genderapparel", "enabled": true},
    "facebook":  {"url": "https://facebook.com/genderapparel", "enabled": true},
    "youtube":   {"url": "https://youtube.com/@genderapparel", "enabled": true},
    "pinterest": {"url": "https://pinterest.com/genderapparel", "enabled": true},
    "snapchat":  {"url": "https://snapchat.com/add/genderapparel", "enabled": true},
    "threads":   {"url": "https://threads.net/@genderapparel", "enabled": true},
    "email":     {"url": "mailto:hello@genderapparel.example", "enabled": true}
  }'::jsonb;
