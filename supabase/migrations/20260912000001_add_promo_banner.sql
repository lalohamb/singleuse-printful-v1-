alter table settings
  add column if not exists promo_banner_active    boolean default false,
  add column if not exists promo_banner_title     text,
  add column if not exists promo_banner_body      text,
  add column if not exists promo_banner_cta_label text,
  add column if not exists promo_banner_cta_url   text,
  add column if not exists promo_banner_bg_color  text default '#1a1a1a';
