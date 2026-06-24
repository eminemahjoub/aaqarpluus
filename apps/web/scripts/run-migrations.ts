import { getDataSource } from "../src/lib/db/data-source";

async function main() {
  const ds = await getDataSource();
  const pending = await ds.showMigrations();
  if (!pending) {
    console.log("No pending migrations");
    await ds.destroy();
    return;
  }
  await ds.runMigrations();
  console.log("Migrations completed");
  await ds.destroy();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
