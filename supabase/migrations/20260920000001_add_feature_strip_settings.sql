alter table settings
  add column if not exists feature_strip_settings jsonb default null;
