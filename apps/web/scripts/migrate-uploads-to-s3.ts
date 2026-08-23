/**
 * Migrate existing local uploads (public/uploads/**) to the configured
 * S3-compatible storage, updating DB rows (documents + property_images).
 *
 *   Dry-run (default):  npx tsx scripts/migrate-uploads-to-s3.ts
 *   Execute:           npx tsx scripts/migrate-uploads-to-s3.ts --execute
 *
 * Behavior:
 *  - only rows with storage_provider = 'local' are considered
 *  - key = path relative to public/ (e.g. uploads/1234.../doc.pdf)
 *  - missing local files are reported, never fatal
 *  - --execute uploads via getStorage() and updates public_url/storage_key/
 *    storage_provider; requires S3 env vars, otherwise it no-ops with a note
 */
import { readFile, access, stat } from "fs/promises";
import path from "path";
import { getDataSource } from "@/lib/db/data-source";
import { getStorage, isStorageConfigured } from "@/lib/storage";

const EXECUTE = process.argv.includes("--execute");

function keyFromObjectPath(objectPath: string): string | null {
  const marker = "public" + path.sep;
  const idx = objectPath.indexOf(marker);
  if (idx === -1) return null;
  const rel = objectPath.slice(idx + marker.length).split(path.sep).join("/");
  return rel;
}

async function exists(abs: string): Promise<boolean> {
  try {
    return (await stat(abs)).isFile();
  } catch {
    return false;
  }
}

async function migrateTable(
  ds: Awaited<ReturnType<typeof getDataSource>>,
  table: string,
  cols: { id: string; file: string; owner: string; hasMime: boolean }
) {
  const rows = await ds.query(
    `SELECT ${cols.id} AS id, ${cols.file} AS file_name, owner_id,
            object_path, public_url${cols.hasMime ? ", mime_type" : ""}
       FROM ${table}
      WHERE storage_provider = 'local' AND storage_key IS NULL`
  );

  let ok = 0;
  let missing = 0;

  for (const row of rows ?? []) {
    const objectPath = row.object_path ?? "";
    const rel = keyFromObjectPath(objectPath) ?? row.public_url?.replace(/^\/uploads\//, "uploads/") ?? "";
    if (!rel) {
      missing++;
      console.log(`  [skip] no resolvable path for ${row.file_name}`);
      continue;
    }

    const abs = path.join(process.cwd(), "public", ...rel.split("/"));
    if (!(await exists(abs))) {
      missing++;
      console.log(`  [missing] ${rel}`);
      continue;
    }

    if (EXECUTE) {
      const buf = await readFile(abs);
      const storage = getStorage();
      const mime = row.mime_type ?? "application/octet-stream";
      const url = await storage.upload(buf, rel, String(mime));
      await ds.query(
        `UPDATE ${table}
            SET storage_provider = 's3', storage_key = $2, public_url = $3
          WHERE id = $1`,
        [String(row.id), rel, url]
      );
      console.log(`  [ok] ${rel} -> ${url}`);
    } else {
      console.log(`  [dry-run] would upload ${rel}`);
    }
    ok++;
  }

  console.log(`${table}: ${ok} processed (${missing} missing/skipped)`);
  return { ok, missing };
}

async function main() {
  console.log(EXECUTE ? "EXECUTE MODE" : "DRY-RUN (use --execute to apply)");

  if (EXECUTE && !isStorageConfigured()) {
    console.log("S3 env vars not set — nothing to do. Add S3_ENDPOINT/BUCKET/KEYS first.");
    return;
  }

  const ds = await getDataSource();
  await migrateTable(ds, "documents", { id: "id", file: "file_name", owner: "owner_id", hasMime: true });
  await migrateTable(ds, "property_images", { id: "id", file: "file_name", owner: "owner_id", hasMime: false });

  if (EXECUTE) {
    console.log("Local files can now be deleted from public/uploads after verification.");
  }
}

main()
  .catch((err) => {
    console.error("migration failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));