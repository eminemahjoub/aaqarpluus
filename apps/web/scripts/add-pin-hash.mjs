import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASS ?? "postgres",
  database: process.env.DB_NAME ?? "property_crm",
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) NULL`);
    console.log("pin_hash column added to contacts");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
  }
  await pool.end();
}

main();
