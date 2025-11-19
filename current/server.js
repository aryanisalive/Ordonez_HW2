import fs from "fs";
import express from "express";   // keep your existing import
import path from "path";         // keep your existing import
import pool, { checkDatabaseConnection } from "./pool.js"; // keep this
const adminRouter = express.Router();

const app = express();
const publicDir = path.resolve(process.cwd(), "public");

// ---------- Lightweight SQL tracing ----------
let TRANSACTION_TRACE = [];
let QUERY_TRACE = [];

// Monkey-patch pool.query to capture SQL into traces.
// This is intentionally simple: SELECT -> query trace; everything else -> transaction trace.
const _origQuery = pool.query.bind(pool);
pool.query = async function patchedQuery(...args) {
  // arg[0] can be text or { text, values }
  const sql = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].text) || '';
  try {
    if (/^\s*select\b/i.test(sql)) {
      QUERY_TRACE.push(sql.trim() + ';');
    } else {
      TRANSACTION_TRACE.push(sql.trim() + ';');
    }
  } catch (e) {
    // ignore tracing errors
  }
  return _origQuery(...args);
};

// Helpers for writing traces on demand
function toDownload(res, filename, content) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
}

// ---------- Admin: DDL and seed (FILL THESE IN with your real SQL) ----------
// You can also `fs.readFileSync` a schema.sql if you keep DDL in a file.
const SCHEMA_SQL = fs.readFileSync("./schema.sql", "utf-8");

const LOOKUP_SQL = fs.readFileSync("./seed.sql", "utf-8");

// ---------- Admin Endpoints ----------

// Create tables from SCHEMA_SQL
adminRouter.post('/create-tables', async (_req, res) => {
  try {
    if (!SCHEMA_SQL.trim()) return res.status(400).json({ ok: false, error: 'SCHEMA_SQL is empty. Fill it in.' });
    await pool.query('BEGIN');
    await pool.query(SCHEMA_SQL);
    await pool.query('COMMIT');
    res.json({ ok: true, message: 'Tables created/verified.' });
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch {}
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Initialize lookups
adminRouter.post('/init-lookups', async (_req, res) => {
  try {
    if (!LOOKUP_SQL.trim()) return res.status(400).json({ ok: false, error: 'LOOKUP_SQL is empty. Fill it in.' });
    await pool.query('BEGIN');
    await pool.query(LOOKUP_SQL);
    await pool.query('COMMIT');
    res.json({ ok: true, message: 'Lookup/reference tables initialized.' });
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch {}
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List tables (public schema)
adminRouter.get('/tables', async (_req, res) => {
  try {
    const q = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type='BASE TABLE'
      ORDER BY table_name
    `;
    const { rows } = await pool.query(q);
    res.json({ ok: true, tables: rows.map(r => r.table_name) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Browse N rows (default 10) from a specific table (validated against information_schema)
adminRouter.get('/browse', async (_req, res) => {
  const table = (_req.query.table || '').toString().trim();
  const limit = Math.min(parseInt(_req.query.limit || '10', 10) || 10, 100); // max 100
  if (!table) return res.status(400).json({ ok: false, error: 'Missing ?table=' });

  try {
    const { rows: list } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
    );
    const allowed = new Set(list.map(r => r.table_name));
    if (!allowed.has(table)) {
      return res.status(400).json({ ok: false, error: `Table "${table}" not found or not allowed.` });
    }
    const sql = `SELECT * FROM "${table}" LIMIT ${limit}`;
    const { rows } = await pool.query(sql);
    res.json({ ok: true, table, limit, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Truncate data from non-lookup tables (you choose which are lookups here)
const LOOKUP_TABLES = new Set([
  // add your lookup tables here, e.g. 'category', 'app_config'
]);

adminRouter.post('/truncate', async (_req, res) => {
  const body = _req.body || {};
  const onlyNonLookup = body.onlyNonLookup !== false; // default true
  try {
    const { rows: list } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
    );
    const tables = list
      .map(r => r.table_name)
      .filter(t => (onlyNonLookup ? !LOOKUP_TABLES.has(t) : true));

    await pool.query('BEGIN');
    for (const t of tables) {
      await pool.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`);
    }
    await pool.query('COMMIT');
    res.json({ ok: true, truncated: tables });
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch {}
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Download traces
adminRouter.get('/download/transaction.sql', (_req, res) => {
  toDownload(res, 'transaction.sql', TRANSACTION_TRACE.join('\n') + '\n');
});
adminRouter.get('/download/query.sql', (_req, res) => {
  toDownload(res, 'query.sql', QUERY_TRACE.join('\n') + '\n');
});

// Clear traces (optional)
adminRouter.post('/clear-traces', (_req, res) => {
  TRANSACTION_TRACE = [];
  QUERY_TRACE = [];
  res.json({ ok: true, message: 'Traces cleared.' });
});

app.use('/api/admin', express.json(), adminRouter);
app.use(express.json());
app.use(express.static("public"));

// Healthcheck
app.get("/api/health", async (_req, res) => {
  try {
    const time = await checkDatabaseConnection();
    res.json({ ok: true, db: "connected", time });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Server running on http://localhost:${process.env.PORT || 3000}`);
});

// Users
app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT user_id, name, email, phone FROM "USER" ORDER BY user_id ASC');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ok: false, error: e.message });
  }
});

// BANK: users with accounts (JOIN USER ← BANK_ACCOUNT)
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
app.get("/api/bank/drivers", async (__req, res) => {
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
app.get("/api/bank/by-user/:userId", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.user_id, u.name, u.email,
             ba.account_id, ba.bank_num, ba.currency, ba.status, ba.balance_cents
        FROM "USER" u
   LEFT JOIN BANK_ACCOUNT ba ON ba.user_id = u.user_id
       WHERE u.user_id = $1
    ORDER BY ba.account_id
    `, [_req.params.userId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BANK: accounts by specific driver
app.get("/api/bank/by-driver/:driverId", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.driver_id, u.user_id, u.name, u.email,
             ba.account_id, ba.bank_num, ba.currency, ba.status, ba.balance_cents
        FROM DRIVER d
        JOIN "USER" u ON u.user_id = d.user_id
   LEFT JOIN BANK_ACCOUNT ba ON ba.user_id = u.user_id
       WHERE d.driver_id = $1
    ORDER BY ba.account_id
    `, [_req.params.driverId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BANK: create an active bank account for a user by name (used by booking UI)
app.post("/api/bank/create-for-user", async (_req, res) => {
  const { userName, bankNum, balanceDollars, currency } = _req.body || {};

  if (!userName || !bankNum) {
    return res.status(400).json({ ok: false, error: "userName and bankNum are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure / find USER (same pattern as /api/book)
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
           RETURNING user_id`,
          [userName, email]
        );
        if (ins.rowCount) {
          userId = ins.rows[0].user_id;
        } else {
          const f2 = await client.query(`SELECT user_id FROM "USER" WHERE email = $1`, [email]);
          userId = f2.rows[0].user_id;
        }
      }
    }

    // If user already has an active account, just return it
    const existing = await client.query(
      `SELECT account_id, bank_num, balance_cents, currency, status
         FROM BANK_ACCOUNT
        WHERE user_id = $1 AND status = 'active'
        ORDER BY account_id LIMIT 1`,
      [userId]
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return res.json({ ok: true, account: existing.rows[0], userId });
    }

    const balDollars = Number(balanceDollars || 0);
    const balanceCents = Math.round(isNaN(balDollars) ? 0 : balDollars * 100);
    const cur = (currency || "USD").toUpperCase().slice(0, 3);

    const insAcc = await client.query(
      `INSERT INTO BANK_ACCOUNT(user_id, bank_num, balance_cents, currency, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING account_id, bank_num, balance_cents, currency, status`,
      [userId, bankNum, balanceCents, cur]
    );

    await client.query("COMMIT");
    res.json({ ok: true, account: insAcc.rows[0], userId });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  } finally {
    client.release();
  }
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

// All drivers
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

// Book a ride (transaction)
// - ensures LOCATIONS
// - inserts RIDE, RIDE_TIME, PRICE (uses APP_CONFIG.tax_rate)
// - PAYMENT:
//     * card -> authorizes + CAPTURES and moves funds from payer account to company operating account
app.post("/api/book", async (_req, res) => {
  const {
    userName,           // string
    driverId,           // int (selected from dropdown)
    pickup, dropoff,    // strings (addresses)
    category,           // string (e.g., "Standard" | "XL" | "Executive")
    paymentMethod,      // "Card" | "Cash" | "Wallet"
    rideTime,           // ISO datetime-local string
    basePrice           // number in dollars (string/number)
  } = _req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Ensure/Find USER (by name)
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
      `INSERT INTO location(address) VALUES ($1)
       ON CONFLICT (address) DO NOTHING
       RETURNING place_id`, [dropoff]
    );
    let dropoffId = dropQ.rows[0]?.place_id;
    if (!dropoffId) {
      const f = await client.query(`SELECT place_id FROM LOCATION WHERE address=$1`, [dropoff]);
      dropoffId = f.rows[0].place_id;
    }

    // 4) Insert RIDE (_requested) and RIDE_TIME
    const rideIns = await client.query(
      `INSERT INTO RIDE(rider_id, driver_id, category_id, pickup_place_id, dropoff_place_id, status)
       VALUES ($1,$2,$3,$4,$5,'_requested')
       RETURNING ride_id`,
      [userId, driverId, categoryId, pickupId, dropoffId]
    );
    const rideId = rideIns.rows[0].ride_id;

    await client.query(
      `INSERT INTO RIDE_TIME(ride_id, _request_ts, pickup_ts)
       VALUES ($1, NOW(), $2::timestamp)`,
      [rideId, rideTime || null]
    );

    // 5) PRICE (base from form, tax from APP_CONFIG) + compute tax/total now for downstream logic
    const baseCents = Math.round(Number(basePrice || 0) * 100);
    const taxCfg = await client.query(`SELECT tax_rate FROM APP_CONFIG WHERE id IS TRUE`);
    const taxRate = Number(taxCfg.rows[0]?.tax_rate ?? 8.25);
    const taxCents = Math.round(baseCents * (taxRate / 100));
    const totalCents = baseCents + taxCents;

    await client.query(
      `INSERT INTO PRICE(ride_id, base_cents, distance_cents, time_cents, booking_cents, tax_rate_pct)
       VALUES ($1, $2, 0, 0, 0, $3)`,
      [rideId, baseCents, taxRate]
    );

    // 6) Optional PAYMENT (authorize; if card, CAPTURE and move funds between BANK_ACCOUNTs)
    const method = (paymentMethod || '').toLowerCase(); // 'card'|'cash'|'wallet'
    let paymentRow = null;
    if (["card", "wallet", "cash"].includes(method)) {
      let accountId = null;
      if (method === "card") {
        const acc = await client.query(
          `SELECT account_id FROM BANK_ACCOUNT WHERE user_id=$1 AND status='active' ORDER BY account_id LIMIT 1`,
          [userId]
        );
        if (!acc.rowCount) {
          throw new Error("No active payment account found for user");
        }
        accountId = acc.rows[0].account_id;
      }

      const amt = await client.query(`SELECT total_cents, base_cents FROM PRICE WHERE ride_id=$1`, [rideId]);
      const amountCents = amt.rows[0].total_cents;

      // Insert payment as authorized first
      const payIns = await client.query(
        `INSERT INTO PAYMENT(ride_id, payer_user_id, account_id, amount_cents, method, status)
         VALUES ($1,$2,$3,$4,$5,'authorized')
         RETURNING payment_id, status, account_id`,
        [rideId, userId, accountId, amountCents, method]
      );
      paymentRow = payIns;

      // If card, CAPTURE immediately and move funds between bank accounts
      if (method === 'card') {
        // Lock payer's status and captured timestamp
        await client.query(
          `SELECT status, captured_ts FROM PAYMENT WHERE payment_id = $1 FOR UPDATE`,
          [payIns.rows[0].payment_id]
        );
        await client.query(
          `UPDATE PAYMENT SET status = 'captured', captured_ts = NOW()
           WHERE payment_id = $1`,
           [payIns.rows[0].payment_id]
        );
      }
    }

    // (Optional) mark driver booked = true while ride is _requested
    // Doesn't really seem optional since this code will always execute, but okay.
    await client.query(`SELECT booked FROM DRIVER WHERE driver_id = $1 FOR UPDATE`, [driverId]); // Locked to prevent weirdness with bookings.
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

// GET /api/rides  (recent rides with optional filters)
// Query params: ?user=...&driver=...&category=...  (partial, case-insensitive)
app.get("/api/rides", async (_req, res) => {
  const { user = "", driver = "", category = "" } = _req.query;

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
        COALESCE(rt._request_ts, rt.pickup_ts, NOW()) AS ts,
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

/**
 * Reports (JOIN + GROUP BY)
 * All support optional ?start=YYYY-MM-DD&end=YYYY-MM-DD (inclusive on start; end is inclusive by day)
 */
function dateRangeWhere(alias = 'rt'){
  return `($1::date IS NULL OR COALESCE(${alias}._request_ts, ${alias}.pickup_ts) >= $1::date)
          AND ($2::date IS NULL OR COALESCE(${alias}._request_ts, ${alias}.pickup_ts) < ($2::date + INTERVAL '1 day'))`;
}

// 1) Commission by day & category
app.get('/api/reports/commission-by-day-category', async (_req, res) => {
  const start = _req.query.start || null;
  const end   = _req.query.end || null;
  try {
    const { rows } = await pool.query(`
      WITH cfg AS (
        SELECT COALESCE(commission_rate_pct, 20.0) AS rate
          FROM APP_CONFIG WHERE id IS TRUE
      )
      SELECT to_char(date_trunc('day', COALESCE(rt._request_ts, rt.pickup_ts)), 'YYYY-MM-DD') AS day,
             c.category_name,
             COUNT(*) AS rides,
             COALESCE(SUM(pr.base_cents),0)::bigint AS base_cents,
             ROUND(COALESCE(SUM(pr.base_cents),0) * (SELECT rate FROM cfg) / 100.0)::bigint AS commission_cents,
             COALESCE(SUM(pr.tax_cents),0)::bigint AS tax_cents,
             COALESCE(SUM(pr.total_cents),0)::bigint AS total_cents
        FROM RIDE r
   LEFT JOIN RIDE_TIME rt ON rt.ride_id = r.ride_id
   LEFT JOIN CATEGORY c   ON c.category_id = r.category_id
   LEFT JOIN PRICE pr     ON pr.ride_id = r.ride_id
       WHERE ${dateRangeWhere('rt')}
    GROUP BY 1,2
    ORDER BY 1 DESC, 2 ASC
    `, [start, end]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: e.message });
  }
});

// 2) Rides per driver per day
app.get('/api/reports/rides-per-driver-per-day', async (_req, res) => {
  const start = _req.query.start || null;
  const end   = _req.query.end || null;
  try {
    const { rows } = await pool.query(`
      SELECT to_char(date_trunc('day', COALESCE(rt._request_ts, rt.pickup_ts)), 'YYYY-MM-DD') AS day,
             du.name AS driver,
             COUNT(*) AS rides,
             COALESCE(SUM(pr.total_cents),0)::bigint AS gross_cents
        FROM RIDE r
   LEFT JOIN RIDE_TIME rt ON rt.ride_id = r.ride_id
   LEFT JOIN DRIVER d     ON d.driver_id = r.driver_id
   LEFT JOIN "USER" du    ON du.user_id  = d.user_id
   LEFT JOIN PRICE pr     ON pr.ride_id  = r.ride_id
       WHERE ${dateRangeWhere('rt')}
    GROUP BY 1,2
    ORDER BY 1 DESC, 3 DESC
    `, [start, end]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: e.message });
  }
});

// 3) Outstanding payouts (driver take still owed) per driver
app.get('/api/reports/outstanding-payouts', async (_req, res) => {
  const start = _req.query.start || null;
  const end   = _req.query.end || null;
  try {
    const { rows } = await pool.query(`
      WITH cfg AS (
        SELECT COALESCE(commission_rate_pct, 20.0) AS rate
          FROM APP_CONFIG WHERE id IS TRUE
      )
      SELECT du.name AS driver,
             COUNT(*) AS rides,
             -- owed = SUM(base) - company commission on base
             (COALESCE(SUM(pr.base_cents),0) - ROUND(COALESCE(SUM(pr.base_cents),0) * (SELECT rate FROM cfg) / 100.0))::bigint AS owed_cents
        FROM RIDE r
   LEFT JOIN RIDE_TIME rt ON rt.ride_id = r.ride_id
   LEFT JOIN DRIVER d     ON d.driver_id = r.driver_id
   LEFT JOIN "USER" du    ON du.user_id  = d.user_id
   LEFT JOIN PRICE pr     ON pr.ride_id  = r.ride_id
   LEFT JOIN PAYMENT pm   ON pm.ride_id  = r.ride_id
       WHERE ${dateRangeWhere('rt')}
         AND (pm.status IN ('authorized','captured') OR pm.status IS NULL)
    GROUP BY 1
    HAVING (COALESCE(SUM(pr.base_cents),0) - ROUND(COALESCE(SUM(pr.base_cents),0) * (SELECT rate FROM cfg) / 100.0)) > 0
    ORDER BY owed_cents DESC
    `, [start, end]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Static app fallback
app.use((_req, res, next) => {
  if (_req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});
