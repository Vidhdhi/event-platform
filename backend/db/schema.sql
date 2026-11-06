-- Re-runnable in development: wipes and rebuilds everything
DROP VIEW  IF EXISTS service_ratings;
DROP TABLE IF EXISTS budget_items, reviews, bookings, events, services, vendors, users CASCADE;
DROP TYPE  IF EXISTS user_role, booking_status;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('user', 'vendor', 'admin');
CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');

CREATE TABLE users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE vendors (
  vendor_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  city          VARCHAR(100) NOT NULL,
  description   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE services (
  service_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  category      VARCHAR(50) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  price         DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  currency      VARCHAR(10) NOT NULL DEFAULT 'LKR',
  is_negotiable BOOLEAN NOT NULL DEFAULT FALSE,
  city          VARCHAR(100) NOT NULL,
  image_urls    TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
  event_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  event_type   VARCHAR(50) NOT NULL,
  event_date   TIMESTAMP NOT NULL,
  city         VARCHAR(100) NOT NULL,
  guest_count  INT NOT NULL DEFAULT 0 CHECK (guest_count >= 0),
  total_budget DECIMAL(12,2) NOT NULL CHECK (total_budget >= 0),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
  booking_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  service_id    UUID NOT NULL REFERENCES services(service_id),
  status        booking_status NOT NULL DEFAULT 'pending',
  agreed_price  DECIMAL(12,2),
  message       TEXT,
  booking_date  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, service_id)
);

CREATE TABLE reviews (
  review_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, service_id)
);

-- Manual expenses that are not bookings (FR3 budget tracking)
CREATE TABLE budget_items (
  item_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  category   VARCHAR(50) NOT NULL,
  amount     DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  note       TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Average rating per service, calculated on demand
CREATE VIEW service_ratings AS
SELECT s.service_id,
       COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS average_rating,
       COUNT(r.review_id) AS review_count
FROM services s
LEFT JOIN reviews r ON r.service_id = s.service_id
GROUP BY s.service_id;

-- Indexes for search and filtering (FR5, NFR3)
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_city     ON services(city);
CREATE INDEX idx_services_price    ON services(price);
CREATE INDEX idx_events_user       ON events(user_id);
CREATE INDEX idx_bookings_event    ON bookings(event_id);
CREATE INDEX idx_reviews_service   ON reviews(service_id);