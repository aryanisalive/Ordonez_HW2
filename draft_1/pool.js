import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const sslRequiredValues = new Set(["require", "true", "1"]);
const sslMode = (process.env.PGSSLMODE || process.env.DATABASE_SSL || "").toLowerCase();
const ssl = sslRequiredValues.has(sslMode) ? { rejectUnauthorized: false } : undefined;

function createPoolConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl,
    };
  }

  const config = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    database: process.env.PGDATABASE,
    ssl,
  };

  Object.keys(config).forEach((key) => {
    if (config[key] === undefined) {
      delete config[key];
    }
  });

  return config;
}

const pool = new Pool(createPoolConfig());

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

export async function checkDatabaseConnection() {
  const { rows } = await pool.query("SELECT NOW() AS time");
  return rows[0].time;
}

export default pool;
