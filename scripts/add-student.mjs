// Creates a NEW student and generates their tickets (mirrors the import logic).
//
// Usage: node scripts/add-student.mjs <studentId> <count> "<name>"            (dry run)
//        node scripts/add-student.mjs <studentId> <count> "<name>" --commit   (apply)
import { randomBytes } from "node:crypto";
import { getPool } from "./db.mjs";

const sid = process.argv[2];
const count = Math.max(0, parseInt(process.argv[3], 10) || 0);
const name = process.argv[4];
const COMMIT = process.argv.includes("--commit");
if (!sid || !name) {
  console.error('Usage: node scripts/add-student.mjs <studentId> <count> "<name>" [--commit]');
  process.exit(1);
}
const genToken = () => randomBytes(32).toString("base64url");
const pool = getPool();

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const exists = await client.query("select 1 from students where student_id=$1", [sid]);
    if (exists.rowCount > 0) throw new Error(`Student ${sid} already exists`);

    const seqRes = await client.query(
      `select coalesce(max((substring(ticket_id from 'GU2026-(\\d+)'))::int), 0) as maxseq
         from tickets where ticket_id ~ '^GU2026-\\d+$'`
    );
    let nextSeq = Number(seqRes.rows[0].maxseq) + 1;

    const planned = [];
    for (let i = 0; i < count; i++) {
      planned.push({ ticketId: `GU2026-${String(nextSeq++).padStart(6, "0")}`, number: i + 1 });
    }

    console.log(`New student : ${name} (${sid})`);
    console.log(`Tickets     : ${count}`);
    for (const p of planned) console.log(`  ${p.ticketId}  (${p.number}/${count})`);

    if (!COMMIT) {
      await client.query("rollback");
      console.log("\n** DRY RUN ** — no changes made. Re-run with --commit to apply.");
      return;
    }

    await client.query(
      `insert into students (student_id, student_name, email, phone, tickets_purchased)
       values ($1,$2,$3,$4,$5)`,
      [sid, name, null, null, count]
    );
    for (const p of planned) {
      await client.query(
        `insert into tickets (ticket_id, student_id, qr_token, ticket_number, total_tickets, status)
         values ($1,$2,$3,$4,$5,'unused')`,
        [p.ticketId, sid, genToken(), p.number, count]
      );
    }
    await client.query("commit");
    console.log(`\n✓ Created ${name} with ${count} ticket(s): ${planned.map((p) => p.ticketId).join(", ")}`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error("✗ Failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
