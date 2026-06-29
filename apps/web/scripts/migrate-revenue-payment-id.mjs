import { readFile } from "fs/promises";
import { Client } from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadEnv() {
  try {
    const envPath = join(__dirname, "..", ".env.local");
    const content = await readFile(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore if no .env.local
  }
}

await loadEnv();

const client = new Client({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASS ?? "postgres",
  database: process.env.DB_NAME ?? "property_crm",
  ssl: false,
});

await client.connect();

try {
  await client.query(`
    ALTER TABLE revenues
    ADD COLUMN IF NOT EXISTS payment_id uuid DEFAULT NULL
  `);

  await client.query(`
    UPDATE revenues
    SET payment_id = (
      CASE
        WHEN position('#' in description) > 0 THEN
          trim(both ' ' from split_part(description, '#', 1))
        ELSE NULL
      END
    )::uuid,
    description = 'دفعة إيجار'
    WHERE description IS NOT NULL
      AND description LIKE '%# دفعة إيجار'
  `);

  await client.query(`
    UPDATE revenues
    SET payment_id = (
      CASE
        WHEN position('#' in description) > 0 THEN
          trim(both ' ' from split_part(description, '#', 2))
        ELSE NULL
      END
    )::uuid,
    description = 'دفعة إيجار'
    WHERE description IS NOT NULL
      AND description LIKE 'دفعة إيجار #%'
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS IDX_revenues_payment_id
    ON revenues (payment_id)
  `);

  console.log("Migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
