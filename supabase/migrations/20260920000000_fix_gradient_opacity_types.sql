alter table settings
  alter column hero_gradient_opacity    type numeric using hero_gradient_opacity::numeric,
  alter column our_why_gradient_opacity type numeric using our_why_gradient_opacity::numeric;
