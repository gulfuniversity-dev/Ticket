// Adds N more tickets to a student, mirroring the import logic:
//   - bumps students.tickets_purchased by N
//   - inserts N new GU2026-NNNNNN tickets (next sequential ids, fresh QR tokens)
//   - updates total_tickets on all of that student's tickets
//
// Usage: node scripts/add-ticket.mjs <studentId> [count]            (dry run)
//        node scripts/add-ticket.mjs <studentId> [count] --commit   (apply)
import { randomBytes } from "node:crypto";
import { getPool } from "./db.mjs";

const sid = process.argv[2];
const COMMIT = process.argv.includes("--commit");
const count = Math.max(1, parseInt(process.argv[3], 10) || 1);
if (!sid) {
  console.error("Usage: node scripts/add-ticket.mjs <studentId> [count] [--commit]");
  process.exit(1);
}
const genToken = () => randomBytes(32).toString("base64url");
const pool = getPool();

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const stuRes = await client.query(
      "select student_name, tickets_purchased from students where student_id=$1 for update",
      [sid]
    );
    if (stuRes.rowCount === 0) throw new Error(`Student ${sid} not found`);
    const { student_name, tickets_purchased } = stuRes.rows[0];

    const cntRes = await client.query(
      "select count(*)::int as n from tickets where student_id=$1",
      [sid]
    );
    const existing = cntRes.rows[0].n;
    const newTotal = tickets_purchased + count;

    // Next sequential id from the numeric suffix of GU2026-NNNNNN ids.
    const seqRes = await client.query(
      `select coalesce(max((substring(ticket_id from 'GU2026-(\\d+)'))::int), 0) as maxseq
         from tickets where ticket_id ~ '^GU2026-\\d+$'`
    );
    let nextSeq = Number(seqRes.rows[0].maxseq) + 1;

    const planned = [];
    for (let i = 0; i < count; i++) {
      planned.push({
        ticketId: `GU2026-${String(nextSeq++).padStart(6, "0")}`,
        number: existing + 1 + i,
      });
    }

    console.log(`Student : ${student_name} (${sid})`);
    console.log(`Tickets : ${tickets_purchased} -> ${newTotal}`);
    for (const p of planned) console.log(`New row : ${p.ticketId}  (number ${p.number}/${newTotal})`);

    if (!COMMIT) {
      await client.query("rollback");
      console.log("\n** DRY RUN ** — no changes made. Re-run with --commit to apply.");
      return;
    }

    for (const p of planned) {
      await client.query(
        `insert into tickets (ticket_id, student_id, qr_token, ticket_number, total_tickets, status)
         values ($1,$2,$3,$4,$5,'unused')`,
        [p.ticketId, sid, genToken(), p.number, newTotal]
      );
    }
    await client.query(
      "update students set tickets_purchased=$1, updated_at=now() where student_id=$2",
      [newTotal, sid]
    );
    await client.query(
      "update tickets set total_tickets=$1, updated_at=now() where student_id=$2 and total_tickets<>$1",
      [newTotal, sid]
    );
    await client.query("commit");
    console.log(`\n✓ Added ${planned.map((p) => p.ticketId).join(", ")}. ${student_name} now has ${newTotal} tickets.`);
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
