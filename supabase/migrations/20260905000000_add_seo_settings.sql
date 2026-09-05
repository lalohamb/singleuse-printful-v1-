create table if not exists seo_settings (
  id uuid primary key default gen_random_uuid(),
  site_url text not null default 'https://bodyandsleeves.com',
  default_og_image text,
  sitemap_enabled boolean not null default true,
  robots_noindex_admin boolean not null default true,
  jsonld_enabled boolean not null default true,
  canonical_enabled boolean not null default true,
  meta_title_suffix text not null default '| Body & Sleeves',
  twitter_handle text default '@body_and_sleeves',
  google_site_verification text,
  updated_at timestamptz not null default now()
);

-- Only ever one row
insert into seo_settings (id) values ('00000000-0000-0000-0000-000000000001')
  on conflict (id) do nothing;

alter table seo_settings enable row level security;
create policy "admins_all" on seo_settings for all using (true) with check (true);
