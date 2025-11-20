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
The concurrency simulator is a central educational feature.

How to run it
Create Tables

Initialize Lookups

Scroll to Simulation section → Simulate Ride

When prompted, type:
server

Enter number of concurrent rides (e.g., 20)

The frontend triggers runServerSimulation() → which:

prepares random booking payloads

defines fireOneRide() → POSTS /api/book

launches N bookings in parallel:

js
Copy code
await Promise.all(
  Array.from({ length: N }, () => fireOneRide())
);
This sends N concurrent transactions to PostgreSQL, exercising locking and isolation.

🔍 Interpreting the results
After execution, the simulation prints:

pgsql
Copy code
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

If concurrency is real, the total time will be close to the slowest transaction, not N × avg.

🧠 Viewing concurrency in the SQL logs
After running a concurrency simulation:

Go to Admin tab

Click Download transaction.sql or Download query.sql

Inside those files, you will see interleaved SQL from overlapping transactions, for example:

sql
Copy code
BEGIN
SELECT ... FOR UPDATE
UPDATE DRIVER ...
COMMIT

BEGIN
SELECT ... FOR UPDATE
UPDATE PAYMENT ...
COMMIT
This is direct evidence of concurrency and lock ordering.

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

📦 Submission Checklist
Requirement	Status
ER diagram	✔
Schema / Create Tables	✔
Seed data	✔
Multi-table booking transaction	✔
Simulation	✔
Concurrency & timing statistics	✔
SQL trace export	✔
Admin panel	✔
README + demo video	✔

🎥 Demo Video
Add your Google Drive / YouTube link here.

📜 License
Educational coursework — not for production deployment.
© 2025 Ride-Share DB App Project.

yaml
Copy code
