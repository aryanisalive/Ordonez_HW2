# Ordonez_HW2

Ride Web App backed by a PostgreSQL database hosted on the UHD DDL server.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with your DDL credentials. Either provide the individual
   parameters or a full connection string:
   ```ini
   # Option A – individual parameters
   PGUSER=your_ddl_username
   PGPASSWORD=your_ddl_password
   PGHOST=ddl.cs.uhd.edu
   PGPORT=5432
   PGDATABASE=your_database_name
   # Optional: require SSL if your DDL instance mandates it
   PGSSLMODE=require

   # Option B – single connection string
   DATABASE_URL=postgres://user:password@ddl.cs.uhd.edu:5432/database
   DATABASE_SSL=true
   ```
3. Start the API server:
   ```bash
   node server.js
   ```
4. Verify connectivity with the health check endpoint:
   ```bash
   curl http://localhost:3000/api/health
   ```

The Express server serves the static web assets from the `public/` directory
and proxies database requests to the DDL PostgreSQL instance using the
configuration above.
