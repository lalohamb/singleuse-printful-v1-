create table if not exists policies (
  id         text primary key, -- 'terms' | 'privacy' | 'refund'
  title      text not null,
  content    text not null default '',
  locked     boolean not null default false,
  updated_at timestamptz default now()
);

alter table policies enable row level security;

drop policy if exists "public_read_policies" on policies;
create policy "public_read_policies" on policies for select
  to anon, authenticated using (true);

drop policy if exists "admin_update_policies" on policies;
create policy "admin_update_policies" on policies for update
  to authenticated
  using     (exists (select 1 from admins where admins.id = auth.uid()))
  with check(exists (select 1 from admins where admins.id = auth.uid()));

drop policy if exists "admin_insert_policies" on policies;
create policy "admin_insert_policies" on policies for insert
  to authenticated with check (
    exists (select 1 from admins where admins.id = auth.uid())
  );

-- Seed default rows
insert into policies (id, title, content) values
  ('terms',   'Terms of Service',          ''),
  ('privacy', 'Privacy Policy',            ''),
  ('refund',  'Refund and Returns Policy', '')
on conflict (id) do nothing;
