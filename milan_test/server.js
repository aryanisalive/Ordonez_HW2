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

