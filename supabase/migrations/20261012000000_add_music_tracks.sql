alter table settings
  add column if not exists music_tracks jsonb not null default '[]',
  add column if not exists music_shuffle boolean not null default false;
