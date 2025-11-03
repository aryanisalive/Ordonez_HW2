// server.js — CommonJS version
const express = require("express");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const path = require("path");

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
});

app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT NOW() as time");
    res.json({ ok: true, db: "connected", time: rows[0].time });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Server running on http://localhost:${process.env.PORT || 3000}`);
});

app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT user_id, name, email FROM "USER" ORDER BY user_id ASC');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// In server.js
app.get("/api/rides/demo", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.ride_id, rt.request_ts,
             u.name AS rider, du.name AS driver,
             l1.address AS pickup, l2.address AS dropoff,
             c.category_name,
             pr.base_cents, pr.tax_cents, pr.total_cents,
             pm.method, pm.status
        FROM RIDE r
   LEFT JOIN RIDE_TIME rt ON rt.ride_id = r.ride_id
   LEFT JOIN "USER" u ON u.user_id = r.rider_id
   LEFT JOIN DRIVER d ON d.driver_id = r.driver_id
   LEFT JOIN "USER" du ON du.user_id = d.user_id
   LEFT JOIN LOCATION l1 ON l1.place_id = r.pickup_place_id
   LEFT JOIN LOCATION l2 ON l2.place_id = r.dropoff_place_id
   LEFT JOIN CATEGORY c ON c.category_id = r.category_id
   LEFT JOIN PRICE pr ON pr.ride_id = r.ride_id
   LEFT JOIN PAYMENT pm ON pm.ride_id = r.ride_id
    ORDER BY rt.request_ts DESC
    LIMIT 20
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List users with their accounts (JOIN USER ← BANK_ACCOUNT)
// BANK: users with accounts
app.get("/api/bank/users", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.user_id, u.name, u.email,
             ba.account_id, ba.bank_num, ba.currency, ba.status, ba.balance_cents
        FROM "USER" u
   LEFT JOIN BANK_ACCOUNT ba ON ba.user_id = u.user_id
    ORDER BY u.name, ba.account_id
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BANK: drivers (user join) with accounts
app.get("/api/bank/drivers", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.driver_id, u.user_id, u.name, u.email,
             ba.account_id, ba.bank_num, ba.currency, ba.status, ba.balance_cents
        FROM DRIVER d
        JOIN "USER" u ON u.user_id = d.user_id
   LEFT JOIN BANK_ACCOUNT ba ON ba.user_id = u.user_id
    ORDER BY u.name, ba.account_id
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BANK: accounts by specific user
app.get("/api/bank/by-user/:userId", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.user_id, u.name, u.email,
             ba.account_id, ba.bank_num, ba.currency, ba.status, ba.balance_cents
        FROM "USER" u
   LEFT JOIN BANK_ACCOUNT ba ON ba.user_id = u.user_id
       WHERE u.user_id = $1
    ORDER BY ba.account_id
    `, [req.params.userId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BANK: accounts by specific driver
app.get("/api/bank/by-driver/:driverId", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.driver_id, u.user_id, u.name, u.email,
             ba.account_id, ba.bank_num, ba.currency, ba.status, ba.balance_cents
        FROM DRIVER d
        JOIN "USER" u ON u.user_id = d.user_id
   LEFT JOIN BANK_ACCOUNT ba ON ba.user_id = u.user_id
       WHERE d.driver_id = $1
    ORDER BY ba.account_id
    `, [req.params.driverId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SEED: inserts demo users/driver/bank accounts + 1 completed ride with payment (transaction)
app.post("/api/simulate/seed-basic", async (_req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const uAlice = await client.query(
      `INSERT INTO "USER"(name,email,phone)
       VALUES ('Alice Rider','alice@example.com','111-111-1111')
       ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
       RETURNING user_id`
    );
    const uBob = await client.query(
      `INSERT INTO "USER"(name,email,phone)
       VALUES ('Bob Driver','bob@example.com','222-222-2222')
       ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
       RETURNING user_id`
    );
    const aliceId = uAlice.rows[0].user_id;
    const bobUserId = uBob.rows[0].user_id;

    const dBob = await client.query(
      `INSERT INTO DRIVER(user_id, license_no, vehicle, booked)
       VALUES ($1, 'LIC1001', 'Sedan', FALSE)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING driver_id`,
      [bobUserId]
    );
    const bobDriverId = dBob.rows[0]?.driver_id ?? (await client.query(
      `SELECT driver_id FROM DRIVER WHERE user_id=$1`, [bobUserId]
    )).rows[0].driver_id;

    await client.query(
      `INSERT INTO BANK_ACCOUNT(user_id, bank_num, balance_cents, currency, status)
       VALUES
        ($1, 'ACC-ALICE-001', 50000, 'USD', 'active'),
        ($2, 'ACC-BOB-001',   120000,'USD', 'active')
       ON CONFLICT (bank_num) DO NOTHING`,
      [aliceId, bobUserId]
    );

    await client.query(
      `INSERT INTO CATEGORY(category_name, base_fee_cents, per_km_cents, per_min_cents, commission_pct)
       VALUES ('Standard',200,120,40,25.0), ('XL',300,170,55,28.0)
       ON CONFLICT (category_name) DO NOTHING`
    );
    await client.query(
      `INSERT INTO LOCATION(address) VALUES
        ('123 Main St'), ('500 Market Ave')
       ON CONFLICT (address) DO NOTHING`
    );

    const existRide = await client.query(
      `SELECT 1
         FROM RIDE r
         JOIN "USER" u   ON u.user_id=r.rider_id AND u.email='alice@example.com'
         JOIN DRIVER d   ON d.driver_id=r.driver_id
         JOIN "USER" du  ON du.user_id=d.user_id AND du.email='bob@example.com'
        LIMIT 1`
    );

    if (existRide.rowCount === 0) {
      const ids = await client.query(
        `WITH ids AS (
           SELECT
             $1::INT AS rider_id,
             $2::INT AS driver_id,
             (SELECT category_id FROM CATEGORY WHERE category_name='Standard') AS category_id,
             (SELECT place_id FROM LOCATION WHERE address='123 Main St')  AS p1,
             (SELECT place_id FROM LOCATION WHERE address='500 Market Ave') AS p2
         )
         INSERT INTO RIDE(rider_id, driver_id, category_id, pickup_place_id, dropoff_place_id, status)
         SELECT rider_id, $2, category_id, p1, p2, 'completed' FROM ids
         RETURNING ride_id`,
        [aliceId, bobDriverId]
      );
      const rideId = ids.rows[0].ride_id;

      await client.query(
        `INSERT INTO RIDE_TIME(ride_id, request_ts, accept_ts, pickup_ts, dropoff_ts)
         VALUES ($1, NOW()-INTERVAL '30 min', NOW()-INTERVAL '28 min',
                     NOW()-INTERVAL '25 min', NOW()-INTERVAL '5 min')`,
        [rideId]
      );
      await client.query(
        `INSERT INTO PRICE(ride_id, base_cents, distance_cents, time_cents, booking_cents, tax_rate_pct)
         VALUES ($1, 1800, 0, 0, 0, 8.25)`,
        [rideId]
      );
      await client.query(
        `INSERT INTO PAYMENT(ride_id, payer_user_id, account_id, amount_cents, method, status, created_ts, captured_ts)
         SELECT $1, $2,
                (SELECT account_id FROM BANK_ACCOUNT WHERE user_id=$2 AND status='active' LIMIT 1),
                (SELECT total_cents FROM PRICE WHERE ride_id=$1),
                'card','captured', NOW(), NOW()`,
        [rideId, aliceId]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true, message: "Seeded demo data. Refresh the Bank tab dropdowns." });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: e.message });
  } finally { client.release(); }
});
app.all("/api/dev/seed-drivers", async (_req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure some user rows
    const users = [
      ['Samir Patel','samir@example.com'],
      ['Jin Park','jin@example.com'],
      ['Lena Ortiz','lena@example.com']
    ];
    for (const [name,email] of users) {
      await client.query(
        `INSERT INTO "USER"(name,email) VALUES ($1,$2)
         ON CONFLICT (email) DO NOTHING`, [name,email]
      );
    }

    // Turn those users into drivers if not already
    await client.query(`
      INSERT INTO DRIVER(user_id, license_no, vehicle, booked)
      SELECT u.user_id, 'LIC-'||SUBSTRING(u.email FROM '^[^@]+'), 'Sedan', false
        FROM "USER" u
       WHERE u.email IN ('samir@example.com','jin@example.com','lena@example.com')
         AND NOT EXISTS (SELECT 1 FROM DRIVER d WHERE d.user_id=u.user_id)
    `);

    await client.query("COMMIT");
    res.json({ ok:true, message:"Seeded demo drivers." });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok:false, error:e.message });
  } finally { client.release(); }
});

// List available drivers (JOIN DRIVER → USER)
app.get("/api/drivers/available", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.driver_id, u.name, u.email, d.booked
        FROM DRIVER d
        JOIN "USER" u ON u.user_id = d.user_id
       WHERE d.booked = false
       ORDER BY u.name
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: e.message });
  }
});

app.get("/api/drivers/all", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.driver_id, u.name, u.email, d.booked
      FROM DRIVER d
      JOIN "USER" u ON u.user_id = d.user_id
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Book a ride (transaction): creates USER (if needed), ensures LOCATIONS,
// inserts RIDE, RIDE_TIME, PRICE (using APP_CONFIG.tax_rate), optionally PAYMENT
app.post("/api/book", async (req, res) => {
  const {
    userName,           // string (e.g., "Alice Rider")
    driverId,           // int (selected from dropdown)
    pickup, dropoff,    // strings (addresses)
    category,           // string (e.g., "Standard" | "XL" | "Executive")
    paymentMethod,      // "Card" | "Cash" | "Wallet"
    rideTime,           // ISO datetime-local string
    basePrice           // number in dollars (string/number)
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Ensure/Find USER
    // Try find by exact name first; if not found, insert with generated email
    let userId;
    {
      const f = await client.query(`SELECT user_id FROM "USER" WHERE name = $1 LIMIT 1`, [userName]);
      if (f.rowCount) {
        userId = f.rows[0].user_id;
      } else {
        const email = (userName || "user").toLowerCase().replace(/\s+/g, ".") + "@example.com";
        const ins = await client.query(
          `INSERT INTO "USER"(name,email) VALUES ($1,$2)
           ON CONFLICT (email) DO NOTHING
           RETURNING user_id`, [userName, email]
        );
        if (ins.rowCount) userId = ins.rows[0].user_id;
        else {
          // if email conflicted, fetch that one
          const f2 = await client.query(`SELECT user_id FROM "USER" WHERE email=$1`, [email]);
          userId = f2.rows[0].user_id;
        }
      }
    }

    // 2) Get category_id
    const catQ = await client.query(
      `SELECT category_id FROM CATEGORY WHERE category_name=$1`, [category]
    );
    if (!catQ.rowCount) throw new Error(`Unknown category: ${category}`);
    const categoryId = catQ.rows[0].category_id;

    // 3) Ensure Locations exist
    const pickQ = await client.query(
      `INSERT INTO LOCATION(address) VALUES ($1)
       ON CONFLICT (address) DO NOTHING
       RETURNING place_id`, [pickup]
    );
    let pickupId = pickQ.rows[0]?.place_id;
    if (!pickupId) {
      const f = await client.query(`SELECT place_id FROM LOCATION WHERE address=$1`, [pickup]);
      pickupId = f.rows[0].place_id;
    }

    const dropQ = await client.query(
      `INSERT INTO LOCATION(address) VALUES ($1)
       ON CONFLICT (address) DO NOTHING
       RETURNING place_id`, [dropoff]
    );
    let dropoffId = dropQ.rows[0]?.place_id;
    if (!dropoffId) {
      const f = await client.query(`SELECT place_id FROM LOCATION WHERE address=$1`, [dropoff]);
      dropoffId = f.rows[0].place_id;
    }

    // 4) Insert RIDE (requested) and RIDE_TIME
    const rideIns = await client.query(
      `INSERT INTO RIDE(rider_id, driver_id, category_id, pickup_place_id, dropoff_place_id, status)
       VALUES ($1,$2,$3,$4,$5,'requested')
       RETURNING ride_id`,
      [userId, driverId, categoryId, pickupId, dropoffId]
    );
    const rideId = rideIns.rows[0].ride_id;

    await client.query(
      `INSERT INTO RIDE_TIME(ride_id, request_ts, pickup_ts)
       VALUES ($1, NOW(), $2::timestamp)`,
      [rideId, rideTime || null]
    );

    // 5) PRICE (base from form, tax from APP_CONFIG)
    const baseCents = Math.round(Number(basePrice || 0) * 100);
    const taxCfg = await client.query(`SELECT tax_rate FROM APP_CONFIG WHERE id IS TRUE`);
    const taxRate = Number(taxCfg.rows[0]?.tax_rate ?? 8.25);

    await client.query(
      `INSERT INTO PRICE(ride_id, base_cents, distance_cents, time_cents, booking_cents, tax_rate_pct)
       VALUES ($1, $2, 0, 0, 0, $3)`,
      [rideId, baseCents, taxRate]
    );

    // 6) Optional PAYMENT (authorized)
    // If method is 'Card', attempt to find a bank account for the user; if none, create a small demo account.
    const method = (paymentMethod || '').toLowerCase(); // 'card'|'cash'|'wallet'
    let paymentRow = null;
    if (["card", "wallet", "cash"].includes(method)) {
      let accountId = null;
      if (method === "card") {
        const acc = await client.query(
          `SELECT account_id FROM BANK_ACCOUNT WHERE user_id=$1 AND status='active' ORDER BY account_id LIMIT 1`,
          [userId]
        );
        if (acc.rowCount) {
          accountId = acc.rows[0].account_id;
        } else {
          // create a tiny demo account with $200 balance
          const newAcc = await client.query(
            `INSERT INTO BANK_ACCOUNT(user_id, bank_num, balance_cents, currency, status)
             VALUES ($1, 'ACC-AUTO-'||TO_CHAR(NOW(),'YYYYMMDDHH24MISS'), 20000, 'USD', 'active')
             RETURNING account_id`,
            [userId]
          );
          accountId = newAcc.rows[0].account_id;
        }
      }

      const amt = await client.query(`SELECT total_cents FROM PRICE WHERE ride_id=$1`, [rideId]);
      const amountCents = amt.rows[0].total_cents;

      // If method='card', account_id must be non-null (constraint)
      paymentRow = await client.query(
        `INSERT INTO PAYMENT(ride_id, payer_user_id, account_id, amount_cents, method, status)
         VALUES ($1,$2,$3,$4,$5,'authorized')
         RETURNING payment_id, status`,
        [rideId, userId, accountId, amountCents, method]
      );
    }

    // (Optional) mark driver booked = true while ride is requested
    await client.query(`UPDATE DRIVER SET booked=true WHERE driver_id=$1`, [driverId]);

    await client.query("COMMIT");

    // Return a summary
    const summary = await client.query(`
      SELECT r.ride_id, u.name AS rider, du.name AS driver,
             l1.address AS pickup, l2.address AS dropoff,
             c.category_name, pr.base_cents, pr.tax_cents, pr.total_cents
        FROM RIDE r
        JOIN "USER" u   ON u.user_id  = r.rider_id
        JOIN DRIVER d   ON d.driver_id = r.driver_id
        JOIN "USER" du  ON du.user_id = d.user_id
        JOIN LOCATION l1 ON l1.place_id = r.pickup_place_id
        JOIN LOCATION l2 ON l2.place_id = r.dropoff_place_id
        JOIN CATEGORY c  ON c.category_id = r.category_id
        JOIN PRICE pr    ON pr.ride_id = r.ride_id
       WHERE r.ride_id = $1
    `, [rideId]);

    res.json({ ok:true, ride: summary.rows[0], payment: paymentRow?.rows?.[0] ?? null });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(400).json({ ok:false, error: e.message });
  } finally {
    client.release();
  }
});
app.post("/api/dev/seed-drivers", async (_req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure some user rows
    const users = [
      ['Samir Patel','samir@example.com'],
      ['Jin Park','jin@example.com'],
      ['Lena Ortiz','lena@example.com']
    ];
    for (const [name,email] of users) {
      await client.query(
        `INSERT INTO "USER"(name,email) VALUES ($1,$2)
         ON CONFLICT (email) DO NOTHING`, [name,email]
      );
    }

    // Turn those users into drivers if not already
    await client.query(`
      INSERT INTO DRIVER(user_id, license_no, vehicle, booked)
      SELECT u.user_id, 'LIC-'||SUBSTRING(u.email FROM '^[^@]+'), 'Sedan', false
        FROM "USER" u
       WHERE u.email IN ('samir@example.com','jin@example.com','lena@example.com')
         AND NOT EXISTS (SELECT 1 FROM DRIVER d WHERE d.user_id=u.user_id)
    `);

    await client.query("COMMIT");
    res.json({ ok:true, message:"Seeded demo drivers." });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok:false, error:e.message });
  } finally { client.release(); }
});
// GET /api/rides  (recent rides with optional filters)
// Query params: ?user=...&driver=...&category=...  (partial, case-insensitive)
app.get("/api/rides", async (req, res) => {
  const { user = "", driver = "", category = "" } = req.query;

  // Build dynamic WHERE with bind params
  const wh = [];
  const args = [];
  if (user)     { args.push(`%${user}%`);    wh.push(`u.name ILIKE $${args.length}`); }
  if (driver)   { args.push(`%${driver}%`);  wh.push(`du.name ILIKE $${args.length}`); }
  if (category) { args.push(`%${category}%`);wh.push(`c.category_name ILIKE $${args.length}`); }

  const whereSql = wh.length ? `WHERE ${wh.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(`
      SELECT
        r.ride_id,
        COALESCE(rt.request_ts, rt.pickup_ts, NOW()) AS ts,
        u.name  AS rider,
        du.name AS driver,
        l1.address AS pickup,
        l2.address AS dropoff,
        c.category_name,
        pr.base_cents, pr.tax_cents, pr.total_cents,
        pm.method, pm.status AS payment_status,
        r.status AS ride_status
      FROM RIDE r
      LEFT JOIN RIDE_TIME rt ON rt.ride_id = r.ride_id
      LEFT JOIN "USER" u     ON u.user_id  = r.rider_id
      LEFT JOIN DRIVER d     ON d.driver_id = r.driver_id
      LEFT JOIN "USER" du    ON du.user_id = d.user_id
      LEFT JOIN LOCATION l1  ON l1.place_id = r.pickup_place_id
      LEFT JOIN LOCATION l2  ON l2.place_id = r.dropoff_place_id
      LEFT JOIN CATEGORY c   ON c.category_id = r.category_id
      LEFT JOIN PRICE pr     ON pr.ride_id = r.ride_id
      LEFT JOIN PAYMENT pm   ON pm.ride_id = r.ride_id
      ${whereSql}
      ORDER BY ts DESC NULLS LAST
      LIMIT 200
    `, args);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: e.message });
  }
});
