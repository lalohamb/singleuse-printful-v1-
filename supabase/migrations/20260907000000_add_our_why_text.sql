alter table settings
  add column if not exists our_why_label text,
  add column if not exists our_why_quote text,
  add column if not exists our_why_body  text,
  add column if not exists our_why_image_scale integer,
  add column if not exists our_why_image_flip boolean,
  add column if not exists our_why_image_fit text,
  add column if not exists our_why_gradient_opacity integer,
  add column if not exists our_why_gradient_dir text;
