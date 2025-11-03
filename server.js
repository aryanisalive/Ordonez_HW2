/*
initialize commands: 
npm init -y
npm i express pg dotenv
*/

import express from "express";
import dotenv from "dotenv";
import pkg from "pg";
import path from "path";

dotenv.config();
const { Pool } = pkg;
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

// Example: get all users (from USER table)
app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT user_id, name, email FROM "USER" LIMIT 10');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Example: add a new user
app.post("/api/users", async (req, res) => {
  const { name, email } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO "USER"(name, email) VALUES ($1,$2) RETURNING *',
      [name, email]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.resolve("public", "index.html"));
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`✅ Server running at http://localhost:${process.env.PORT || 3000}`)
);
