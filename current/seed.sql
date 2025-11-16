INSERT INTO "USER"(name,email,phone) VALUES
 ('Alice Rider','alice@example.com','111-111-1111'),
 ('Bob Driver','bob@example.com','222-222-2222'),
 ('Cara Rider','cara@example.com','333-333-3333')
ON CONFLICT DO NOTHING;

-- Make Bob a DRIVER (tie to his USER row)
INSERT INTO DRIVER(user_id, license_no, vehicle, booked)
SELECT u.user_id, 'LIC1001', 'Sedan', false FROM "USER" u WHERE u.email='bob@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- Categories
INSERT INTO CATEGORY(category_name, base_fee_cents, per_km_cents, per_min_cents, commission_pct) VALUES
 ('Standard', 200, 120, 40, 25.0),
 ('XL',       300, 170, 55, 28.0)
ON CONFLICT (category_name) DO NOTHING;

-- Locations
INSERT INTO LOCATION(address) VALUES
 ('123 Main St'), ('500 Market Ave'), ('1 University Dr'), ('99 Airport Blvd')
ON CONFLICT DO NOTHING;

-- One finished ride for Alice with Bob
WITH ids AS (
  SELECT
    (SELECT user_id  FROM "USER"   WHERE email='alice@example.com') AS rider_id,
    (SELECT driver_id FROM DRIVER  d JOIN "USER" u ON u.user_id=d.user_id WHERE u.email='bob@example.com') AS driver_id,
    (SELECT category_id FROM CATEGORY WHERE category_name='Standard') AS category_id,
    (SELECT place_id FROM LOCATION WHERE address='123 Main St') AS p1,
    (SELECT place_id FROM LOCATION WHERE address='500 Market Ave') AS p2
)
INSERT INTO RIDE(rider_id, driver_id, category_id, pickup_place_id, dropoff_place_id, status)
SELECT rider_id, driver_id, category_id, p1, p2, 'completed' FROM ids
RETURNING ride_id \gset

INSERT INTO RIDE_TIME(ride_id, request_ts, accept_ts, pickup_ts, dropoff_ts)
VALUES (:ride_id, NOW()-INTERVAL '30 min', NOW()-INTERVAL '28 min', NOW()-INTERVAL '25 min', NOW()-INTERVAL '5 min');

-- Price: base only for demo; generated columns compute subtotal/tax/total
INSERT INTO PRICE(ride_id, base_cents, distance_cents, time_cents, booking_cents, tax_rate_pct)
VALUES (:ride_id, 1800, 0, 0, 0, 8.25);

-- Bank account for Alice
INSERT INTO BANK_ACCOUNT(user_id, bank_num, balance_cents)
SELECT user_id, 'ACC0001', 50000 FROM "USER" WHERE email='alice@example.com'
ON CONFLICT DO NOTHING;

-- Payment authorized then captured (amount = PRICE.total_cents)
INSERT INTO PAYMENT(ride_id, payer_user_id, account_id, amount_cents, method, status)
SELECT
  p.ride_id,
  r.rider_id,
  (SELECT account_id FROM BANK_ACCOUNT ba WHERE ba.user_id = r.rider_id AND ba.status='active' LIMIT 1),
  p.total_cents,
  'card',
  'authorized'
FROM PRICE p JOIN RIDE r ON r.ride_id=p.ride_id
WHERE p.ride_id = :ride_id
RETURNING payment_id \gset
-- Ensures Safe Update
SELECT * FROM PAYMENT WHERE payment_id = :payment_id FOR UPDATE;
UPDATE PAYMENT SET status='captured', captured_ts=NOW() WHERE payment_id = :payment_id;

-- Receipt lines
INSERT INTO RECEIPT_LINE(payment_id, line_no, line_type, qty, unit_price_cents)
VALUES (:payment_id, 1, 'base', 1, 1800),
       (:payment_id, 2, 'tax',  1, (SELECT tax_cents FROM PRICE WHERE ride_id=:ride_id));
