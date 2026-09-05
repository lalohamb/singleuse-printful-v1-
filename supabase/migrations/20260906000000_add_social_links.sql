alter table settings
  add column if not exists social_links jsonb not null default '{
    "instagram": {"url": "https://instagram.com/body_and_sleeves", "enabled": true},
    "tiktok":    {"url": "https://tiktok.com/@bodyandsleeves",      "enabled": true},
    "facebook":  {"url": "https://facebook.com/bodyandsleeves",     "enabled": true},
    "youtube":   {"url": "https://youtube.com/@bodyandsleeves",     "enabled": true},
    "pinterest": {"url": "https://pinterest.com/bodyandsleeves",    "enabled": true},
    "snapchat":  {"url": "https://snapchat.com/add/bodyandsleeves", "enabled": true},
    "threads":   {"url": "https://threads.net/@bodyandsleeves",     "enabled": true},
    "email":     {"url": "mailto:Hello.BodyandSleeves@gmail.com",   "enabled": true}
  }'::jsonb;
