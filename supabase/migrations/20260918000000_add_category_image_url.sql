alter table categories
  add column if not exists category_image_url text default null;
