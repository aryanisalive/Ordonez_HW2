# Ride-Share Database Application

A full-stack PostgreSQL + Express + Vanilla JS project that demonstrates transactional logic, query analytics, and administrative operations for a ride-share platform.
Built for the **HW-DBApp** assignment (Phases 1 & 2).

---

## 🚀 Overview

This app implements the backend logic of a ride-share platform together with a front-end UI that exposes the core concepts of **relational schema design**, **multi-table atomic transactions**, **logging**, and **concurrency**.

Users (or TAs) can:

- create database tables
- seed lookup/demo data
- simulate rides
- run concurrent transactions
- browse data
- export SQL traces
- observe lock behavior and timing statistics

---


## 🗂️ Project Structure

```
├── server.js         # Express backend + admin routes + SQL tracing
├── pool.js           # PostgreSQL pool connection
├── app.js            # Front-end logic / API calls
├── index.html        # UI for simulation, reports, and admin
├── styles.css        # Minimal Tailwind-style look
├── schema.sql        # All CREATE TABLE / DDL
├── seed.sql          # Demo data and lookup inserts
└── README.md         # You are here
```

---

## ⚙️ Setup & Run

### 1️⃣  Install dependencies

```bash
npm install express pg
```

### 2️⃣  Configure your database

Set a local Postgres connection string directly in pool.js:

```
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=yourpassword
PGDATABASE=ridedb
PGPORT=5432
```

### 3️⃣  Start the server

```bash
node server.js
```

Visit **[http://localhost:3000](http://localhost:3000)**

---

## 🧩 Admin Panel (Bottom of page)

| Button | Action |
|--------|--------|
| **Create Tables** | Runs `schema.sql` |
| **Initialize Lookups** | Runs `seed.sql` |
| **Delete Rows (Danger)** | Truncates application tables (not lookup tables) |
| **Browse 10** | Shows first 10 rows of selected table |
| **Download transaction.sql** | Exports all SQL inside `BEGIN`/`COMMIT` blocks |
| **Download query.sql** | Exports every executed SQL |
| **Clear Traces** | Clears log buffers |
| **README** | Opens this file |
| **Demo Video** | User-supplied link |

---

---

## 📊 Simulation Modes

Click **Simulate Ride** at the top of the UI.

| Mode | Runs in… | How many transactions | Purpose |
|------|----------|-----------------------|---------|
| **Local Simulation** | Browser only | 1 at a time | Quick test of booking |
| **Server Simulation** | Backend | N in **parallel** | Demonstrate concurrency |

---

## ⚡ Concurrency Demonstration (Main Phase-2 Feature)

Server-mode simulation uses true concurrency to show how database locking and transaction time are affected under load.

### How to run it

1. **Create Tables**
2. **Initialize Lookups**
3. Click **Simulate Ride**
4. Type `server` when asked for simulation mode
5. Enter # of rides (e.g., `20`)

The frontend then calls `runServerSimulation()` which:

- fetches available drivers
- generates N random booking payloads
- defines an internal function `fireOneRide()` that POSTs `/api/book`
- launches **N copies of `fireOneRide()` in parallel**:

```js
await Promise.all(
  Array.from({ length: N }, () => fireOneRide())
);
```
---

## 🧠 Interpreting the Results
When the batch completes, the app displays a report similar to:
```
Server concurrency simulation complete.
Rides requested (concurrently): 20
Success: 19
Failed: 1

Transaction time (ms):
  min = 37.88
  max = 128.20
  avg = 66.15
Total wall-clock time (ms): 452.91
```

Meaning of each value:

Rides requested (concurrently):	Number of parallel transactions launched
Success:	Successful commit of a full booking/payment transaction
Failed:	Request returned non-200 or { ok:false }
min:	Fastest single transaction duration
max:	Slowest transaction — often blocked by locks
avg:	Average duration across successes
Total wall-clock time:	Time for the entire batch, not per transaction

If concurrency is real, total time is close to the slowest transaction, rather than N × avg, showing parallel execution.


---

## 🧑‍💻 Development Notes

* **Node version**: ≥ 18
* **Database**: PostgreSQL 15+
* SQL tracing is applied globally by patching `pool.query()` in `server.js`
* All admin operations wrap statements in `BEGIN … COMMIT` for safety

---

## 📜 License

Educational use only — not for production.
© 2025 Ride-Share DB App Project.
