alter table settings
  add column if not exists hero_gradient_opacity    numeric,
  add column if not exists our_why_gradient_opacity numeric;

alter table settings
  alter column hero_gradient_opacity    type numeric using hero_gradient_opacity::numeric,
  alter column our_why_gradient_opacity type numeric using our_why_gradient_opacity::numeric;
