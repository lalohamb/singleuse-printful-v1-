-- Fix infinite recursion in the admins SELECT policy.
--
-- The original "auth_read_admins" policy referenced the admins table from
-- inside its own USING clause:
--
--   auth.uid() = id OR EXISTS (
--     SELECT 1 FROM admins a WHERE a.id = auth.uid() AND a.role = 'super_admin'
--   )
--
-- Evaluating that SELECT re-triggers the same policy, so any query against
-- admins (including the app's checkAdmin lookup and every admin-gated
-- write on products/orders/settings that does EXISTS(SELECT 1 FROM admins ...))
-- fails with Postgres error 42P17 "infinite recursion detected in policy".
--
-- The application only ever reads the caller's own admin row, so a
-- self-contained policy is sufficient and non-recursive.

DROP POLICY IF EXISTS "auth_read_admins" ON admins;
CREATE POLICY "auth_read_admins" ON admins FOR SELECT
  TO authenticated USING (auth.uid() = id);
