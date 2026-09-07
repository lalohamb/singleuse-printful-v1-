alter table settings
  add column if not exists story_object_position  text    default '0px 0px',
  add column if not exists story_image_scale      numeric default 100,
  add column if not exists story_image_flip       boolean default false,
  add column if not exists story_image_fit        text    default 'cover',
  add column if not exists story_gradient_opacity numeric default 40,
  add column if not exists story_gradient_dir     text    default 'full';
