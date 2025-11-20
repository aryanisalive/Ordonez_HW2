# Ride-Share Database Application

A full-stack PostgreSQL + Express + Vanilla JS project that demonstrates transactional logic, query analytics, and administrative operations for a ride-share platform.
Built for the **HW-DBApp** assignment (Phases 1 & 2).

---

## 🚀 Features

### Phase 1 — Database + App Integration

* **Relational schema** covering users, drivers, rides, pricing, payments, and accounts
* **Real transaction**: booking and payment capture update multiple tables atomically
* **JOIN / GROUP BY reports** for rides, commission, and payouts
* **Simulation**: one-click ride booking to populate realistic data
* **Admin panel**:

  * Create tables from `schema.sql`
  * Initialize lookup and demo data from `seed.sql`
  * Browse first 10 rows of any table
  * Truncate non-lookup tables
  * Download generated `transaction.sql` and `query.sql` trace files
* **Trace logging** automatically captures every executed SQL statement

### Phase 2 — Performance & Concurrency (in progress)

* Planned: concurrent transaction simulation with timing metrics (ms)
* Planned: “100 customers / hour” batch scenario

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

## 🧩 Admin Panel Guide

Accessible at the bottom of the home page.

| Button                                   | Purpose                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| **Create Tables**                        | Executes `schema.sql` to (re)create all DB objects    |
| **Initialize Lookups**                   | Executes `seed.sql` to populate reference + demo data |
| **Delete Rows (Danger)**                 | Truncates all non-lookup tables                       |
| **Browse 10**                            | Displays the first 10 rows of the selected table      |
| **Download transaction.sql / query.sql** | Exports all executed SQL statements                   |
| **Clear Traces**                         | Empties the trace buffers                             |

---

## 📊 Simulation & Reports

* **Simulate Ride**: inserts random rides and payments (multi-table transaction)
* **Reports**: run predefined SQL queries (joins, group-bys) to analyze commissions, driver stats, and payouts
* **Output**: visible in the results panel and recorded in `query.sql`

---

## 🧱 Lookup Tables (Protected from Truncate)

```
CATEGORY
APP_CONFIG
LOCATION
```

---

## 🧪 Phase 2 Planned Extensions

* Concurrent transaction demo (`Promise.all` bookings)
* Transaction-time measurement (avg/p95/max)
* “100 Customers / Hour” simulation preset
* Additional dashboards for throughput & latency

---

## 🧑‍💻 Development Notes

* **Node version**: ≥ 18
* **Database**: PostgreSQL 15+
* SQL tracing is applied globally by patching `pool.query()` in `server.js`
* All admin operations wrap statements in `BEGIN … COMMIT` for safety

---

## 🧾 Submission Checklist

* [x] ER Model (external PDF)
* [x] Working schema + transactions
* [x] Simulation and reports
* [x] Admin panel (create/init/truncate/browse)
* [x] Trace files generated
* [ ] README + demo video link (add below)

---

## 🎥 Demo Video & Links

* **Demo video:** [Add YouTube or Drive link here]
* **ER diagram:** [Add link to ERD PDF here]

---

## 📜 License

Educational use only — not for production.
© 2025 Ride-Share DB App Project.
