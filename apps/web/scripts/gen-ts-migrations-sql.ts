/**
 * Regenerates migrations/ts_migrations_combined.sql — the psql-appliable copy
 * of every TypeORM migration's up() SQL, plus the `migrations` ledger rows so
 * TypeORM sees them as already applied.
 *
 * The TypeORM migration classes (src/migrations/*.ts) are the single source of
 * truth; this file is a generated artifact. Re-run after adding a migration:
 *
 *   npx tsx scripts/gen-ts-migrations-sql.ts
 *
 * and commit the result together with the new migration.
 */
import { writeFile } from "fs/promises";
import path from "path";
import type { MigrationInterface, QueryRunner } from "typeorm";
import { ALL_MIGRATIONS } from "../src/migrations";

type CollectedQueryRunner = Pick<QueryRunner, "query"> & { __sql: string[] };

function collectingRunner(): CollectedQueryRunner {
  const sql: string[] = [];
  return {
    __sql: sql,
    query: async (q: string) => {
      sql.push(q.trim());
      return undefined as any;
    },
  };
}

async function main() {
  const sections: string[] = [];
  const ledger: { timestamp: number; name: string }[] = [];

  for (const MigrationClass of ALL_MIGRATIONS) {
    const migration: MigrationInterface = new MigrationClass();
    const name = migration.name ?? MigrationClass.name;
    const runner = collectingRunner();
    await migration.up(runner as unknown as QueryRunner);
    const timestamp = Number(name.replace(/\D/g, "").slice(0, 14));
    ledger.push({ timestamp, name });
    sections.push(`-- ============ ${name} ============\n${runner.__sql.map((s) => `${s};`).join("\n\n")}`);
  }

  const ledgerRows = ledger
    .map((l, i) => `  (${l.timestamp}, '${l.name}')${i < ledger.length - 1 ? "," : ""}`)
    .join("\n");

  const out = `-- GENERATED FILE — do not edit by hand.
-- Combined up() SQL of the ${ledger.length} TypeORM migrations (records them
-- in the \`migrations\` ledger so the app considers them applied).
-- Regenerate with: npx tsx scripts/gen-ts-migrations-sql.ts
-- Applied by scripts/prod-migrate.sh as step 1; idempotent (IF NOT EXISTS).

BEGIN;

${sections.join("\n\n")}

-- ============ TypeORM migrations ledger ============
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL
);
INSERT INTO migrations (timestamp, name) VALUES
${ledgerRows}
ON CONFLICT DO NOTHING;

COMMIT;
`;

  const target = path.join(process.cwd(), "migrations", "ts_migrations_combined.sql");
  await writeFile(target, out);
  console.log(`Wrote ${target} (${ledger.length} migrations)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
