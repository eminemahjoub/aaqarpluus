import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function opt(name, fallback = null) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === "") return fallback;
  return v;
}

async function main() {
  const email = String(must("SUPERADMIN_EMAIL")).trim().toLowerCase();
  const password = String(must("SUPERADMIN_PASSWORD"));
  const fullName = String(opt("SUPERADMIN_NAME", "Super Admin"));
  const phone = opt("SUPERADMIN_PHONE", null);

  const client = new Client({
    host: opt("DB_HOST", "127.0.0.1"),
    port: Number(opt("DB_PORT", "5432")),
    user: opt("DB_USER", "postgres"),
    password: opt("DB_PASS", "postgres"),
    database: opt("DB_NAME", "property_crm"),
    ssl: false,
  });

  await client.connect();
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // Create or update by email (keep existing id)
    const existing = await client.query(
      `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );

    if (existing.rows.length === 0) {
      const inserted = await client.query(
        `
        INSERT INTO users (
          email, password_hash, full_name, phone,
          user_type, is_active, token_version,
          office_id, deleted_at, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,'superadmin',TRUE,0,NULL,NULL,NOW(),NOW())
        RETURNING id
        `,
        [email, passwordHash, fullName || null, phone]
      );
      console.log("✅ SuperAdmin created:", email, "id=", inserted.rows[0]?.id);
    } else {
      const id = existing.rows[0].id;
      await client.query(
        `
        UPDATE users
        SET
          password_hash = $2,
          full_name = $3,
          phone = $4,
          user_type = 'superadmin',
          is_active = TRUE,
          deleted_at = NULL,
          updated_at = NOW()
        WHERE id = $1
        `,
        [id, passwordHash, fullName || null, phone]
      );
      console.log("✅ SuperAdmin updated:", email, "id=", id);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ seed-superadmin failed:", err?.message ?? err);
  process.exit(1);
});

