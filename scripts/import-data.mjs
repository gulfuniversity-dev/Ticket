// ============================================================
// Imports graduating students and generates e-tickets.
//
// Data model for THIS dataset:
//   * Every student in the Graduation Fees report receives 1 base ticket
//     (included with their graduation fees).
//   * The Additional Tickets file lists students who bought extra tickets.
//   * total tickets per student = 1 (base) + additional purchased.
//
// The script is idempotent: re-running tops each student up to the
// correct number of tickets without duplicating existing ones.
//
// Usage:
//   node scripts/import-data.mjs                  (uses data/*.xlsx)
//   node scripts/import-data.mjs <fees.xlsx> <additional.xlsx>
//   node scripts/import-data.mjs --single <file.xlsx>
//       single normalized file with columns:
//       StudentID, StudentName, Email, Phone, TicketsPurchased
// ============================================================
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import xlsx from "xlsx";
import { getPool, __dirname } from "./db.mjs";

const pool = getPool();

function s(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function readSheet(path) {
  const wb = xlsx.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { defval: null });
}

// The "Additional Tickets" file has irregular headers (the Student ID column
// is headed "1" and column A is a blank row-counter). Parse it positionally:
//   - Student ID  = first cell in the row that is a 6+ digit number
//   - Tickets     = the column whose header mentions "ticket"/"total"
//   - Name        = the column whose header mentions "name"
function readAdditional(path) {
  const wb = xlsx.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!rows.length) return new Map();

  let headerIdx = rows.findIndex((r) =>
    r.some((c) => /studentname|student name|tickets/i.test(s(c)))
  );
  if (headerIdx < 0) headerIdx = 0;
  const header = rows[headerIdx].map((c) => s(c).toLowerCase());
  const nameCol = header.findIndex((h) => h.includes("name"));
  const tkCol = header.findIndex((h) => h.includes("ticket") || h.includes("total"));

  const map = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    let sid = "";
    for (const cell of r) {
      const v = s(cell);
      if (/^\d{6,}$/.test(v)) {
        sid = v;
        break;
      }
    }
    if (!sid) continue;
    const extra =
      tkCol >= 0 ? Math.max(0, parseInt(s(r[tkCol]).replace(/\D/g, "") || "0", 10)) : 0;
    const name = nameCol >= 0 ? s(r[nameCol]) : "";
    map.set(sid, { name, extra });
  }
  return map;
}

// Pick a value from a row using a list of possible header names (case-insensitive).
function pick(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const k = keys.find((x) => x.toLowerCase().replace(/[\s_]/g, "") === name.toLowerCase().replace(/[\s_]/g, ""));
    if (k !== undefined && row[k] !== null && s(row[k]) !== "") return row[k];
  }
  return null;
}

function genToken() {
  return randomBytes(32).toString("base64url"); // 256-bit, ~43 chars
}

async function buildRoster() {
  const args = process.argv.slice(2);

  // ---- Single normalized file mode ----
  if (args[0] === "--single" && args[1]) {
    const rows = readSheet(resolve(process.cwd(), args[1]));
    const roster = new Map();
    for (const r of rows) {
      const sid = s(pick(r, ["StudentID", "Student ID", "id"]));
      if (!sid) continue;
      roster.set(sid, {
        student_id: sid,
        name: s(pick(r, ["StudentName", "Student Name", "name"])),
        email: s(pick(r, ["Email"])) || null,
        phone: s(pick(r, ["Phone", "Phone Number", "Mobile"])) || null,
        total: Math.max(0, parseInt(s(pick(r, ["TicketsPurchased", "Number of Tickets", "Tickets", "TotalTickets"])) || "0", 10)),
      });
    }
    return [...roster.values()];
  }

  // ---- Two-file merge mode (default) ----
  const feesPath = args[0] || resolve(__dirname, "..", "data", "GraduationFeesReport.xlsx");
  const addPath = args[1] || resolve(__dirname, "..", "data", "AdditionalTickets.xlsx");

  const additional = readAdditional(addPath); // student_id -> { name, extra }

  const roster = new Map(); // student_id -> { ... , total }
  for (const r of readSheet(feesPath)) {
    const sid = s(pick(r, ["StudentID", "Student ID"]));
    if (!sid) continue;
    const add = additional.get(sid);
    const name = s(pick(r, ["StudentName", "Student Name"])) || (add ? add.name : "");
    const total = 1 + (add ? add.extra : 0); // 1 base + extras
    roster.set(sid, {
      student_id: sid,
      name,
      email: s(pick(r, ["Email"])) || null,
      phone: s(pick(r, ["Phone", "Phone Number", "Mobile"])) || null,
      total,
    });
  }

  // Include any additional-only students (defensive – none in current data).
  for (const [sid, add] of additional) {
    if (!roster.has(sid)) {
      roster.set(sid, { student_id: sid, name: add.name, email: null, phone: null, total: add.extra });
    }
  }

  return [...roster.values()];
}

async function nextTicketSeq(client) {
  const { rows } = await client.query(
    `select coalesce(max(nullif(regexp_replace(ticket_id, '\\D', '', 'g'), '')::bigint), 0) as maxseq
     from tickets where ticket_id like 'GU2026-%'`
  );
  return Number(rows[0].maxseq) + 1;
}

async function main() {
  const roster = await buildRoster();
  console.log(`Roster: ${roster.length} students, ${roster.reduce((a, r) => a + r.total, 0)} tickets expected.`);

  const client = await pool.connect();
  let createdTickets = 0;
  let touchedStudents = 0;
  try {
    let seq = await nextTicketSeq(client);

    for (const stu of roster) {
      await client.query("begin");
      // upsert student
      await client.query(
        `insert into students (student_id, student_name, email, phone, tickets_purchased)
         values ($1,$2,$3,$4,$5)
         on conflict (student_id) do update
           set student_name = excluded.student_name,
               email = coalesce(excluded.email, students.email),
               phone = coalesce(excluded.phone, students.phone),
               tickets_purchased = excluded.tickets_purchased,
               updated_at = now()`,
        [stu.student_id, stu.name, stu.email, stu.phone, stu.total]
      );

      // how many tickets already exist?
      const { rows: cnt } = await client.query(
        "select count(*)::int as n from tickets where student_id = $1",
        [stu.student_id]
      );
      const existing = cnt[0].n;

      for (let n = existing + 1; n <= stu.total; n++) {
        const ticketId = `GU2026-${String(seq).padStart(6, "0")}`;
        seq++;
        await client.query(
          `insert into tickets (ticket_id, student_id, qr_token, ticket_number, total_tickets, status)
           values ($1,$2,$3,$4,$5,'unused')`,
          [ticketId, stu.student_id, genToken(), n, stu.total]
        );
        createdTickets++;
      }
      // keep total_tickets consistent if student already had tickets
      await client.query(
        "update tickets set total_tickets = $1, updated_at = now() where student_id = $2 and total_tickets <> $1",
        [stu.total, stu.student_id]
      );
      await client.query("commit");
      touchedStudents++;
    }
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  const { rows: totals } = await pool.query(
    `select
       (select count(*) from students) as students,
       (select count(*) from tickets) as tickets,
       (select count(*) from tickets where status='unused') as unused`
  );
  console.log(`✓ Processed ${touchedStudents} students, created ${createdTickets} new tickets.`);
  console.log(`Totals in DB → students: ${totals[0].students}, tickets: ${totals[0].tickets}, unused: ${totals[0].unused}`);
}

main()
  .catch((e) => {
    console.error("✗ Import failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
