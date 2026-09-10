alter table categories
  add column if not exists gradient_opacity integer default 60,
  add column if not exists gradient_dir text default 'bottom';
