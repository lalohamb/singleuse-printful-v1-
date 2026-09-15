-- View customer account profiles
SELECT
  id,
  email,
  username,
  full_name,
  phone,
  newsletter_opt_in,
  last_seen_at,
  created_at,
  updated_at
FROM customer_profiles
ORDER BY created_at DESC;

-- View customers with order totals
SELECT
  cp.email,
  cp.full_name,
  cp.username,
  cp.phone,
  cp.newsletter_opt_in,
  COUNT(o.id) AS order_count,
  COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('paid', 'fulfilled', 'shipped', 'delivered')), 0) AS total_spent,
  MAX(o.created_at) AS last_order_at
FROM customer_profiles cp
LEFT JOIN orders o ON lower(o.email) = lower(cp.email)
GROUP BY cp.id, cp.email, cp.full_name, cp.username, cp.phone, cp.newsletter_opt_in
ORDER BY last_order_at DESC NULLS LAST, cp.created_at DESC;

-- View newsletter subscribers
SELECT email, full_name, phone, updated_at
FROM customer_profiles
WHERE newsletter_opt_in = true
ORDER BY updated_at DESC;

-- Find a customer profile by email
SELECT *
FROM customer_profiles
WHERE lower(email) = lower('<customer-email@example.com>');
