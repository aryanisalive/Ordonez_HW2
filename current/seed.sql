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



