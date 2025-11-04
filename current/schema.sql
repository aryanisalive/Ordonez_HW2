-- USER
CREATE TABLE IF NOT EXISTS "USER"(
  user_id SERIAL PRIMARY KEY,
  name    VARCHAR(100) NOT NULL,
  email   VARCHAR(100) UNIQUE NOT NULL,
  phone   VARCHAR(30)  UNIQUE
);

-- DRIVER (1:1 with USER via user_id UNIQUE)
CREATE TABLE IF NOT EXISTS DRIVER(
  driver_id  SERIAL PRIMARY KEY,
  user_id    INT UNIQUE REFERENCES "USER"(user_id) ON DELETE CASCADE,
  license_no VARCHAR(30) UNIQUE NOT NULL,
  vehicle    VARCHAR(80),
  booked     BOOLEAN NOT NULL DEFAULT false
);

-- CATEGORY (pricing params + commission)
CREATE TABLE IF NOT EXISTS CATEGORY(
  category_id   SERIAL PRIMARY KEY,
  category_name VARCHAR(40) UNIQUE NOT NULL,
  base_fee_cents INT NOT NULL DEFAULT 0,
  per_km_cents   INT NOT NULL DEFAULT 0,
  per_min_cents  INT NOT NULL DEFAULT 0,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 25.00
);

-- LOCATION
CREATE TABLE IF NOT EXISTS LOCATION(
  place_id SERIAL PRIMARY KEY,
  address  VARCHAR(200) UNIQUE NOT NULL
);

-- RIDE
CREATE TABLE IF NOT EXISTS RIDE(
  ride_id SERIAL PRIMARY KEY,
  rider_id INT NOT NULL REFERENCES "USER"(user_id) ON DELETE CASCADE,
  driver_id INT NOT NULL REFERENCES DRIVER(driver_id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES CATEGORY(category_id),
  pickup_place_id  INT NOT NULL REFERENCES LOCATION(place_id),
  dropoff_place_id INT NOT NULL REFERENCES LOCATION(place_id),
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','accepted','en_route','picked_up','completed','rider_canceled','driver_canceled'))
);

-- RIDE_TIME (1:1 with RIDE)
CREATE TABLE IF NOT EXISTS RIDE_TIME(
  ride_id    INT PRIMARY KEY REFERENCES RIDE(ride_id) ON DELETE CASCADE,
  request_ts TIMESTAMP NOT NULL DEFAULT NOW(),
  accept_ts  TIMESTAMP,
  pickup_ts  TIMESTAMP,
  dropoff_ts TIMESTAMP,
  cancel_ts  TIMESTAMP
);

-- PRICE (generated totals)
DROP TABLE IF EXISTS PRICE CASCADE;

CREATE TABLE PRICE(
  price_id SERIAL PRIMARY KEY,
  ride_id  INT UNIQUE NOT NULL REFERENCES RIDE(ride_id) ON DELETE CASCADE,

  base_cents     INT NOT NULL DEFAULT 0,
  distance_cents INT NOT NULL DEFAULT 0,
  time_cents     INT NOT NULL DEFAULT 0,
  booking_cents  INT NOT NULL DEFAULT 0,
  tax_rate_pct   NUMERIC(5,2) NOT NULL DEFAULT 8.25,

  -- OK: generated from base/distance/time/booking only
  subtotal_cents INT GENERATED ALWAYS AS (
    base_cents + distance_cents + time_cents + booking_cents
  ) STORED,

  -- OK: also generated only from base/distance/time/booking and tax_rate_pct
  tax_cents INT GENERATED ALWAYS AS (
    ROUND( (base_cents + distance_cents + time_cents + booking_cents) * (tax_rate_pct/100.0) )::INT
  ) STORED,

  -- OK: same principle
  total_cents INT GENERATED ALWAYS AS (
    (base_cents + distance_cents + time_cents + booking_cents)
    + ROUND( (base_cents + distance_cents + time_cents + booking_cents) * (tax_rate_pct/100.0) )::INT
  ) STORED
);


-- BANK_ACCOUNT
CREATE TABLE IF NOT EXISTS BANK_ACCOUNT(
  account_id    SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES "USER"(user_id) ON DELETE CASCADE,
  bank_num      VARCHAR(32) UNIQUE NOT NULL,
  balance_cents INT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  status        VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen'))
);

-- PAYMENT (one per ride)
CREATE TABLE IF NOT EXISTS PAYMENT(
  payment_id    SERIAL PRIMARY KEY,
  ride_id       INT UNIQUE NOT NULL REFERENCES RIDE(ride_id) ON DELETE CASCADE,
  payer_user_id INT NOT NULL REFERENCES "USER"(user_id) ON DELETE CASCADE,
  account_id    INT REFERENCES BANK_ACCOUNT(account_id) ON DELETE RESTRICT,
  amount_cents  INT NOT NULL CHECK (amount_cents >= 0),
  method        VARCHAR(16) NOT NULL CHECK (method IN ('card','wallet','cash')),
  status        VARCHAR(16) NOT NULL DEFAULT 'authorized'
     CHECK (status IN ('authorized','captured','refunded','failed')),
  created_ts    TIMESTAMP NOT NULL DEFAULT NOW(),
  captured_ts   TIMESTAMP,
  CONSTRAINT ck_payment_card_account
    CHECK (
      (method = 'card'  AND account_id IS NOT NULL) OR
      (method <> 'card' AND account_id IS NULL)
    )
);

-- RECEIPT_LINE (generated line total)
CREATE TABLE IF NOT EXISTS RECEIPT_LINE(
  payment_id INT NOT NULL REFERENCES PAYMENT(payment_id) ON DELETE CASCADE,
  line_no    INT NOT NULL,
  line_type  VARCHAR(16) NOT NULL CHECK (line_type IN ('base','distance','time','booking','tax','other')),
  qty        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price_cents INT NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  line_total_cents INT GENERATED ALWAYS AS (ROUND(qty * unit_price_cents)::INT) STORED,
  PRIMARY KEY (payment_id, line_no)
);

-- App config (tax/commission)
CREATE TABLE IF NOT EXISTS APP_CONFIG(
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 8.25,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 25.00
);
INSERT INTO APP_CONFIG(id) VALUES(true) ON CONFLICT (id) DO NOTHING;
