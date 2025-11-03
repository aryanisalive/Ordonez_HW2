/*
initialize commands: 
npm init -y
npm i express pg dotenv
*/

import express from "express";
import path from "path";

import pool, { checkDatabaseConnection } from "./db/pool.js";

const app = express();
const publicDir = path.resolve(process.cwd(), "public");

app.use(express.json());
app.use(express.static(publicDir));

app.get("/api/health", async (_req, res) => {
  try {
    const time = await checkDatabaseConnection();
    res.json({ ok: true, db: "connected", time });
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
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`✅ Server running at http://localhost:${process.env.PORT || 3000}`)
);
