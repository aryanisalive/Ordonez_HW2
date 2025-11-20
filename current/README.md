# Ride-Share Database Web Application

A full-stack PostgreSQL + Express + JavaScript application that demonstrates relational schema design, multi-table transactions, trace logging, analytics, and database concurrency.

The app makes core database systems concepts **visible and interactive** — users can create tables, seed data, book rides, run concurrent transactions, and inspect SQL traces.

---

## 🚀 Overview

This project implements the logic of a ride-share platform, focusing on:

- Data modeling
- Transactional ride booking with atomic updates
- Locking / isolation during concurrency
- Post-transaction financial and ride records
- SQL trace visibility
- Reporting and analytics

Everything is accessible interactively through a web UI.

---

## 🗂 Project Structure

├── server.js # Express API, admin panel, SQL tracing, concurrency handling
├── pool.js # PostgreSQL connection
├── app.js # Front-end fetch API, simulation logic, UI interactions
├── index.html # UI for simulation, admin, and reports
├── styles.css # Styling
├── schema.sql # CREATE TABLE definitions
├── seed.sql # Lookup/demo data population
├── README.md # Documentation
└── ER_diagram.pdf # Entity Relationship diagram

yaml
Copy code

---

## ⚙ Setup

### 1️⃣ Install dependencies
```bash
npm install express pg
2️⃣ Configure PostgreSQL (edit pool.js)
ini
Copy code
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=yourpassword
PGDATABASE=ridedb
PGPORT=5432
3️⃣ Start the server
bash
Copy code
node server.js
Then open:
➡ http://localhost:3000

🧩 Admin Panel (bottom of page)
Action	Description
Create Tables	Executes schema.sql
Initialize Lookups	Executes seed.sql
Delete Rows (Danger)	Truncates non-lookup tables
Browse 10	Shows first 10 rows of selected table
Download transaction.sql	Every SQL statement that occurs inside a transaction
Download query.sql	Every SQL statement executed (all queries)
Clear Traces	Reset SQL logs
README	Opens this file
Demo Video	Displays linked video demo

📊 Simulation Features
Click Simulate Ride on the home page.

Mode	Where it runs	Behavior	Use case
Local Simulation	Browser only	1 booking at a time	Quick correctness demo
Server Simulation	Backend	N concurrent bookings	Shows transaction & lock behavior

⚡ Concurrency Simulation (Phase-2 Requirement)
The simulator stress-tests the booking transaction by running overlapping ride requests and reporting how PostgreSQL behaves under contention.

### How to run it
1. In the Admin panel, click **Create Tables** and **Initialize Lookups**.
2. Scroll to **Simulation** → **Simulate Ride**.
3. When prompted for mode, type `server` to run the backend-driven concurrency test (the `local` option fires one booking at a time in the browser).
4. Enter the number of concurrent rides (e.g., `20`). The frontend calls `runServerSimulation()`, which prepares random booking payloads, defines `fireOneRide()` to POST `/api/book`, and launches *N* copies in parallel via `Promise.all(...)`.

This produces N overlapping transactions against PostgreSQL, allowing you to observe lock waits and isolation behavior.

### Understanding the output
After the batch finishes, the console prints a summary like:

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
Value	Meaning
Rides requested (concurrently)	N parallel transactions launched
Success	Committed booking/payment transactions
Failed	Errors returned by the API or transaction rollback
min	Fastest transaction
max	Slowest (often waiting on locks)
avg	Average transaction time
Total wall-clock time	Time for the entire concurrent batch (not per-ride)
```

Interpretation of each field:

- **Rides requested (concurrently)** – Number of parallel `/api/book` transactions launched.
- **Success** – Transactions that committed successfully (ride + payment recorded).
- **Failed** – Requests that returned an error or rolled back (often due to simulated constraints or lock timeouts).
- **Transaction time (min / max / avg)** – Per-transaction durations; high `max` values usually indicate lock waits or queueing.
- **Total wall-clock time** – Duration of the entire batch. When concurrency is real, this should be close to the slowest transaction time rather than `N × avg`.

### Viewing concurrency in the SQL logs
1. Open the **Admin** tab after running a simulation.
2. Download **transaction.sql** or **query.sql** to view every statement executed.
3. Look for interleaved `BEGIN`, `SELECT ... FOR UPDATE`, and `UPDATE` statements from multiple rides — this shows overlapping transactions and lock ordering in action.


📍 Lookup (Protected) Tables
These tables are not truncated when clicking Delete Rows (Danger):

objectivec
Copy code
CATEGORY
APP_CONFIG
LOCATION
🧑‍💻 Technical Notes
Node 18+

PostgreSQL 15+

SQL tracing implemented by wrapping pool.query()

All admin operations use explicit BEGIN and COMMIT

/api/book implements multi-table atomic transaction

Concurrency simulator intentionally stresses driver/payment locking


📜 License
Educational coursework — not for production deployment.
© 2025 Ride-Share DB App Project.

yaml
Copy code
