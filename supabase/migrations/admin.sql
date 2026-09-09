-- View all admins
SELECT id, email, role, created_at FROM admins;

-- Add an admin (must match a Supabase auth user)
INSERT INTO admins (id, email, role) VALUES ('<auth-user-uuid>', 'email@example.com', 'admin');

-- Delete an admin
DELETE FROM admins WHERE email = 'email@example.com';

-- Promote to super_admin
UPDATE admins SET role = 'super_admin' WHERE email = 'email@example.com';
