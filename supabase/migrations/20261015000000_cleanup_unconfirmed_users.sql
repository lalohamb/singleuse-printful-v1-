-- Auto-delete unconfirmed auth users older than 24 hours.
-- Runs every hour via pg_cron (enabled by default on Supabase).
-- Unconfirmed = email_confirmed_at IS NULL (never clicked the magic link).

select cron.schedule(
  'delete-unconfirmed-users',   -- job name
  '0 * * * *',                  -- every hour
  $$
    delete from auth.users
    where email_confirmed_at is null
      and created_at < now() - interval '24 hours';
  $$
);
