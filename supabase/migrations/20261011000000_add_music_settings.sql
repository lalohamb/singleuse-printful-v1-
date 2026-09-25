alter table settings
  add column if not exists music_url text,
  add column if not exists music_enabled boolean not null default false;
