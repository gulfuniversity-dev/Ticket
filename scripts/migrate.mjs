// Applies db/schema.sql to the configured database.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPool, __dirname } from "./db.mjs";

const pool = getPool();

async function main() {
  const sql = readFileSync(resolve(__dirname, "..", "db", "schema.sql"), "utf8");
  console.log("Applying schema …");
  await pool.query(sql);
  console.log("✓ Schema applied successfully.");

  const { rows } = await pool.query(
    `select table_name from information_schema.tables
     where table_schema = 'public'
       and table_name in ('users','students','tickets','check_in_logs')
     order by table_name`
  );
  console.log("Tables present:", rows.map((r) => r.table_name).join(", "));
}

main()
  .catch((e) => {
    console.error("✗ Migration failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
