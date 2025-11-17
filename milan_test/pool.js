import pkg from "pg";


const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",
  password: "1234",
  host: "localhost",
  port: 5433,
  database: "ride_app",
  ssl:false
})

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});


export async function checkDatabaseConnection() {
  const { rows } = await pool.query("SELECT NOW() AS time");
  return rows[0].time;
}

export default pool;
