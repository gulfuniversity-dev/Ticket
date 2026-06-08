// One-off CLEAN REBUILD of the 2026 roster from the normalized import file.
// Wipes students + tickets (cascade) + check_in_logs, then regenerates every
// ticket fresh with new QR tokens. Safe because nothing has been distributed
// (the only "used" tickets were pre-launch tests).
//
// Usage: node scripts/rebuild-2026.mjs            (dry-run: prints plan only)
//        node scripts/rebuild-2026.mjs --commit   (performs the wipe + import)
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import xlsx from "xlsx";
import { getPool } from "./db.mjs";

const COMMIT = process.argv.includes("--commit");
const s = (v) => (v == null ? "" : String(v).trim());
const genToken = () => randomBytes(32).toString("base64url");

const file = resolve(process.cwd(), "data", "normalized-import-2026-06-08.xlsx");
const wb = xlsx.read(readFileSync(file), { type: "buffer" });
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

const roster = rows
  .map((r) => ({
    student_id: s(r.StudentID),
    name: s(r.StudentName),
    email: s(r.Email) || null,
    phone: s(r.Phone) || null,
    total: Math.max(0, parseInt(s(r.TicketsPurchased) || "0", 10)),
  }))
  .filter((r) => r.student_id);

const expectedTickets = roster.reduce((a, r) => a + r.total, 0);
console.log(`Roster: ${roster.length} students, ${expectedTickets} tickets expected.`);

const pool = getPool();
async function main() {
  const before = await pool.query(
    "select (select count(*) from students) s, (select count(*) from tickets) t, (select count(*) from check_in_logs) l"
  );
  console.log("Before:", JSON.stringify(before.rows[0]));

  if (!COMMIT) {
    console.log("\n** DRY RUN ** — no changes made. Re-run with --commit to apply.");
    return;
  }

  const client = await pool.connect();
  let created = 0;
  try {
    await client.query("begin");
    await client.query("truncate tickets, students, check_in_logs restart identity cascade");

    let seq = 1;
    for (const stu of roster) {
      await client.query(
        `insert into students (student_id, student_name, email, phone, tickets_purchased)
         values ($1,$2,$3,$4,$5)`,
        [stu.student_id, stu.name, stu.email, stu.phone, stu.total]
      );
      for (let n = 1; n <= stu.total; n++) {
        const ticketId = `GU2026-${String(seq).padStart(6, "0")}`;
        seq++;
        await client.query(
          `insert into tickets (ticket_id, student_id, qr_token, ticket_number, total_tickets, status)
           values ($1,$2,$3,$4,$5,'unused')`,
          [ticketId, stu.student_id, genToken(), n, stu.total]
        );
        created++;
      }
    }
    await client.query("commit");
    console.log(`✓ Wiped and rebuilt. Created ${created} tickets.`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  const after = await pool.query(
    `select (select count(*) from students) students,
            (select count(*) from tickets) tickets,
            (select count(*) from tickets where status='unused') unused,
            (select min(ticket_id) from tickets) first_id,
            (select max(ticket_id) from tickets) last_id`
  );
  console.log("After:", JSON.stringify(after.rows[0]));
}

main()
  .catch((e) => {
    console.error("✗ Rebuild failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
