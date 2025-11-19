import pkg from "pg";


const { Pool } = pkg;

const pool = new Pool({
  user: "dbs008",
  host: "54.227.44.99",
  password: "DKW45eq80NEv",
  port: 5432,
  database: "COSC3380",
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
