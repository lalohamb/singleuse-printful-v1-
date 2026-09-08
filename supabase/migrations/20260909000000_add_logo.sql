alter table settings
  add column if not exists logo_url  text,
  add column if not exists logo_size numeric default 40;
