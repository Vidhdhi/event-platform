-- 3 planners + 20 vendor accounts (password_hash is a placeholder;
-- real accounts will be created through the register API on Day 3)
INSERT INTO users (name, email, password_hash, role)
SELECT 'Planner ' || i, 'planner' || i || '@example.com', 'placeholder', 'user'
FROM generate_series(1, 3) AS i;

INSERT INTO users (name, email, password_hash, role)
SELECT 'Vendor Owner ' || i, 'vendor' || i || '@example.com', 'placeholder', 'vendor'
FROM generate_series(1, 20) AS i;

-- 20 vendor businesses across 5 cities
WITH u AS (
  SELECT user_id, row_number() OVER (ORDER BY email) AS n
  FROM users WHERE role = 'vendor'
)
INSERT INTO vendors (user_id, business_name, city, description)
SELECT user_id,
       'Vendor Business ' || n,
       (ARRAY['Colombo','Kandy','Galle','Negombo','Jaffna'])[1 + (n % 5)],
       'Sample event service provider'
FROM u;

-- 3 services per vendor, across 6 categories
WITH v AS (
  SELECT vendor_id, business_name, city,
         row_number() OVER (ORDER BY business_name) AS n
  FROM vendors
)
INSERT INTO services (vendor_id, category, title, description, price, city, is_negotiable)
SELECT v.vendor_id,
       c.cat,
       v.business_name || ' - ' || c.cat,
       'Professional ' || lower(c.cat) || ' service for weddings, birthdays and corporate events',
       ROUND((20000 + random() * 480000)::numeric, -3),
       v.city,
       random() > 0.5
FROM v
CROSS JOIN unnest(ARRAY['Photography','Catering','Venue','Decoration','Music & DJ','Makeup'])
     WITH ORDINALITY AS c(cat, idx)
WHERE (v.n + c.idx) % 2 = 0;

-- 3 sample events (one per planner)
INSERT INTO events (user_id, title, event_type, event_date, city, guest_count, total_budget)
SELECT user_id, 'Sample Wedding', 'wedding', NOW() + INTERVAL '90 days', 'Colombo', 150, 1500000
FROM users WHERE email = 'planner1@example.com';

INSERT INTO events (user_id, title, event_type, event_date, city, guest_count, total_budget)
SELECT user_id, 'Sample Birthday', 'birthday', NOW() + INTERVAL '30 days', 'Kandy', 50, 300000
FROM users WHERE email = 'planner2@example.com';

INSERT INTO events (user_id, title, event_type, event_date, city, guest_count, total_budget)
SELECT user_id, 'Sample Corporate Dinner', 'corporate', NOW() + INTERVAL '45 days', 'Galle', 100, 800000
FROM users WHERE email = 'planner3@example.com';

-- Some random reviews so ratings are not all zero
INSERT INTO reviews (user_id, service_id, rating, comment)
SELECT u.user_id, s.service_id, 3 + floor(random() * 3)::int, 'Sample review'
FROM (SELECT user_id FROM users WHERE role = 'user') u
CROSS JOIN LATERAL (
  SELECT service_id FROM services ORDER BY random() LIMIT 15
) s;