import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASS ?? "postgres",
  database: process.env.DB_NAME ?? "property_crm",
});

async function addColumnIfNotExists(client, table, column, type) {
  const exists = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  if (exists.rowCount === 0) {
    await client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`Added ${table}.${column}`);
  } else {
    console.log(`Skipped ${table}.${column} (already exists)`);
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await addColumnIfNotExists(client, "contacts", "pin_hash", "VARCHAR(255) NULL");
    await addColumnIfNotExists(client, "revenues", "unit_id", "UUID NULL");
    await addColumnIfNotExists(client, "revenues", "contact_id", "UUID NULL");
    await addColumnIfNotExists(client, "revenues", "payment_method", "VARCHAR(100) NULL");
    await addColumnIfNotExists(client, "expenses", "unit_id", "UUID NULL");
    await addColumnIfNotExists(client, "expenses", "contact_id", "UUID NULL");
    await addColumnIfNotExists(client, "expenses", "payment_method", "VARCHAR(100) NULL");
    await addColumnIfNotExists(client, "tasks", "type", "VARCHAR(50) NULL DEFAULT 'task'");
    await addColumnIfNotExists(client, "tasks", "tenant_id", "UUID NULL");
    await client.query("COMMIT");
    console.log("Migration complete");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
  }
  await pool.end();
}

main();
