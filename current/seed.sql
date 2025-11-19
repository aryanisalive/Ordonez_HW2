-- Insert 10 riders into USER table
INSERT INTO "USER"(name,email,phone) VALUES
 ('Mia Lopez','mia.lopez@example.com','555-101-1001'),
 ('Jackson Miller','jackson.miller@example.com','555-101-1002'),
 ('Sophia Turner','sophia.turner@example.com','555-101-1003'),
 ('Ethan Brooks','ethan.brooks@example.com','555-101-1004'),
 ('Lily Carter','lily.carter@example.com','555-101-1005'),
 ('Aiden Hall','aiden.hall@example.com','555-101-1006'),
 ('Zoe Bennett','zoe.bennett@example.com','555-101-1007'),
 ('Noah Phillips','noah.phillips@example.com','555-101-1008'),
 ('Harper Gray','harper.gray@example.com','555-101-1009'),
 ('Logan Rivera','logan.rivera@example.com','555-101-1010'),
 ('Alice Rider', 'alice@example.com', '555-999-0001')
ON CONFLICT DO NOTHING;

-- Insert 50 drivers into USER table
INSERT INTO "USER"(name,email,phone) VALUES
 ('Oliver Smith','oliver.smith@example.com','555-201-0001'),
 ('Charlotte Johnson','charlotte.johnson@example.com','555-201-0002'),
 ('Liam Williams','liam.williams@example.com','555-201-0003'),
 ('Amelia Brown','amelia.brown@example.com','555-201-0004'),
 ('Elijah Jones','elijah.jones@example.com','555-201-0005'),
 ('Ava Garcia','ava.garcia@example.com','555-201-0006'),
 ('James Rodriguez','james.rodriguez@example.com','555-201-0007'),
 ('Isabella Martinez','isabella.martinez@example.com','555-201-0008'),
 ('Benjamin Hernandez','benjamin.hernandez@example.com','555-201-0009'),
 ('Evelyn Davis','evelyn.davis@example.com','555-201-0010'),
 ('Lucas Lopez','lucas.lopez@example.com','555-201-0011'),
 ('Scarlett Gonzalez','scarlett.gonzalez@example.com','555-201-0012'),
 ('Henry Wilson','henry.wilson@example.com','555-201-0013'),
 ('Aria Anderson','aria.anderson@example.com','555-201-0014'),
 ('Alexander Thomas','alexander.thomas@example.com','555-201-0015'),
 ('Chloe Taylor','chloe.taylor@example.com','555-201-0016'),
 ('Michael Moore','michael.moore@example.com','555-201-0017'),
 ('Ella Jackson','ella.jackson@example.com','555-201-0018'),
 ('Daniel Martin','daniel.martin@example.com','555-201-0019'),
 ('Grace Lee','grace.lee@example.com','555-201-0020'),
 ('Sebastian Perez','sebastian.perez@example.com','555-201-0021'),
 ('Victoria White','victoria.white@example.com','555-201-0022'),
 ('Matthew Harris','matthew.harris@example.com','555-201-0023'),
 ('Aurora Clark','aurora.clark@example.com','555-201-0024'),
 ('Jack Lewis','jack.lewis@example.com','555-201-0025'),
 ('Penelope Robinson','penelope.robinson@example.com','555-201-0026'),
 ('William Walker','william.walker@example.com','555-201-0027'),
 ('Nora Young','nora.young@example.com','555-201-0028'),
 ('Joseph Allen','joseph.allen@example.com','555-201-0029'),
 ('Hazel King','hazel.king@example.com','555-201-0030'),
 ('Samuel Wright','samuel.wright@example.com','555-201-0031'),
 ('Ellie Scott','ellie.scott@example.com','555-201-0032'),
 ('David Green','david.green@example.com','555-201-0033'),
 ('Violet Adams','violet.adams@example.com','555-201-0034'),
 ('Carter Baker','carter.baker@example.com','555-201-0035'),
 ('Natalie Nelson','natalie.nelson@example.com','555-201-0036'),
 ('Wyatt Hill','wyatt.hill@example.com','555-201-0037'),
 ('Emily Rivera','emily.rivera@example.com','555-201-0038'),
 ('Gabriel Campbell','gabriel.campbell@example.com','555-201-0039'),
 ('Hannah Mitchell','hannah.mitchell@example.com','555-201-0040'),
 ('Owen Carter','owen.carter@example.com','555-201-0041'),
 ('Layla Parker','layla.parker@example.com','555-201-0042'),
 ('Julian Evans','julian.evans@example.com','555-201-0043'),
 ('Zoey Edwards','zoey.edwards@example.com','555-201-0044'),
 ('Levi Collins','levi.collins@example.com','555-201-0045'),
 ('Stella Stewart','stella.stewart@example.com','555-201-0046'),
 ('Mason Sanchez','mason.sanchez@example.com','555-201-0047'),
 ('Paisley Morris','paisley.morris@example.com','555-201-0048'),
 ('Caleb Rogers','caleb.rogers@example.com','555-201-0049'),
 ('Madison Reed','madison.reed@example.com','555-201-0050'),
 ('Bob Driver',  'bob@example.com',   '555-999-0002')
ON CONFLICT DO NOTHING;

INSERT INTO DRIVER(user_id, license_no, vehicle, booked)
SELECT
    u.user_id,
    'LIC' || LPAD((row_number() OVER () + 1000)::text, 6, '0'),
    (ARRAY['Sedan','SUV','Pickup','XL','Executive','Van'])[floor(random()*6)+1],
    false
FROM "USER" u
WHERE u.email LIKE '%@example.com'
  AND u.name NOT LIKE '%Rider%'   -- exclude riders
  AND u.user_id NOT IN (SELECT user_id FROM DRIVER)
ON CONFLICT (user_id) DO NOTHING;


-- Categories
INSERT INTO CATEGORY(category_name, base_fee_cents, per_km_cents, per_min_cents, commission_pct) VALUES
 ('Standard', 200, 120, 40, 25.0),
 ('XL',       300, 170, 55, 28.0),
 ('Executive', 400, 220, 70, 31.0)
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

INSERT INTO RIDE_TIME(ride_id, _request_ts, accept_ts, pickup_ts, dropoff_ts)
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

-- Locks the columns status and captured_ts of the row where payment_id = :payment_id for update
SELECT status, captured_ts FROM PAYMENT WHERE payment_id = :payment_id FOR UPDATE;
UPDATE PAYMENT SET status='captured', captured_ts=NOW() WHERE payment_id = :payment_id;

-- Receipt lines
INSERT INTO RECEIPT_LINE(payment_id, line_no, line_type, qty, unit_price_cents)
VALUES (:payment_id, 1, 'base', 1, 1800),
       (:payment_id, 2, 'tax',  1, (SELECT tax_cents FROM PRICE WHERE ride_id=:ride_id));
