// Seeds the default admin + gate staff accounts (idempotent upsert by email).
import bcrypt from "bcryptjs";
import { getPool } from "./db.mjs";

const pool = getPool();

const accounts = [
  {
    name: "System Administrator",
    email: process.env.ADMIN_EMAIL || "admin@gulfuniversity.edu.bh",
    password: process.env.ADMIN_PASSWORD || "Admin@2026",
    role: "admin",
  },
  {
    name: "Gate Staff",
    email: process.env.GATE_EMAIL || "gate@gulfuniversity.edu.bh",
    password: process.env.GATE_PASSWORD || "Gate@2026",
    role: "gate_staff",
  },
];

async function main() {
  for (const a of accounts) {
    const hash = await bcrypt.hash(a.password, 10);
    await pool.query(
      `insert into users (name, email, password, role)
       values ($1, $2, $3, $4)
       on conflict (email) do update
         set name = excluded.name,
             password = excluded.password,
             role = excluded.role,
             updated_at = now()`,
      [a.name, a.email.toLowerCase(), hash, a.role]
    );
    console.log(`✓ ${a.role.padEnd(10)} ${a.email}  (password: ${a.password})`);
  }
  console.log("\nDone. You can log in with the credentials above.");
}

main()
  .catch((e) => {
    console.error("✗ Seed failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
