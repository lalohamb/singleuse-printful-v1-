-- Enable RLS (safe to run even if already enabled)
alter table affiliates enable row level security;
alter table affiliate_clicks enable row level security;
alter table affiliate_conversions enable row level security;
alter table affiliate_payouts enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from admins where id = auth.uid())
$$;

-- Drop existing policies before recreating
drop policy if exists "admins_all_affiliates" on affiliates;
drop policy if exists "admins_all_affiliate_clicks" on affiliate_clicks;
drop policy if exists "admins_all_affiliate_conversions" on affiliate_conversions;
drop policy if exists "admins_all_affiliate_payouts" on affiliate_payouts;
drop policy if exists "public_insert_affiliates" on affiliates;

-- affiliates: admins can do everything
create policy "admins_all_affiliates" on affiliates
  for all using (is_admin()) with check (is_admin());

-- affiliate_clicks: admins can do everything
create policy "admins_all_affiliate_clicks" on affiliate_clicks
  for all using (is_admin()) with check (is_admin());

-- affiliate_conversions: admins can do everything
create policy "admins_all_affiliate_conversions" on affiliate_conversions
  for all using (is_admin()) with check (is_admin());

-- affiliate_payouts: admins can do everything
create policy "admins_all_affiliate_payouts" on affiliate_payouts
  for all using (is_admin()) with check (is_admin());

-- affiliates: public INSERT only (signup form uses anon key)
create policy "public_insert_affiliates" on affiliates
  for insert with check (true);
