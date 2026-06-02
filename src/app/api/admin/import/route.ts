import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { pool } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/guard";
import { generateQrToken } from "@/lib/tickets";

export const runtime = "nodejs";
export const maxDuration = 60;

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

function pick(row: Record<string, any>, names: string[]): any {
  const keys = Object.keys(row);
  const norm = (x: string) => x.toLowerCase().replace(/[\s_]/g, "");
  for (const name of names) {
    const k = keys.find((x) => norm(x) === norm(name));
    if (k !== undefined && row[k] !== null && s(row[k]) !== "") return row[k];
  }
  return null;
}

// POST /api/admin/import  (multipart form: file=<xlsx|csv>)
// Expected columns: StudentID, StudentName, Email, Phone, TicketsPurchased
export const POST = handle(async (req: NextRequest) => {
  await requireAdmin();

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "No file uploaded");

  const buf = Buffer.from(await (file as File).arrayBuffer());
  let wb: xlsx.WorkBook;
  try {
    wb = xlsx.read(buf, { type: "buffer" });
  } catch {
    throw new HttpError(400, "Could not read the file. Upload a valid Excel or CSV file.");
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });

  const roster = new Map<
    string,
    { student_id: string; name: string; email: string | null; phone: string | null; total: number }
  >();
  for (const r of rows) {
    const sid = s(pick(r, ["StudentID", "Student ID", "id"]));
    if (!sid) continue;
    const total = Math.max(
      0,
      parseInt(
        s(pick(r, ["TicketsPurchased", "Number of Tickets", "Tickets", "TotalTickets"])) || "0",
        10
      ) || 0
    );
    roster.set(sid, {
      student_id: sid,
      name: s(pick(r, ["StudentName", "Student Name", "name"])),
      email: s(pick(r, ["Email"])) || null,
      phone: s(pick(r, ["Phone", "Phone Number", "Mobile"])) || null,
      total,
    });
  }

  if (roster.size === 0)
    throw new HttpError(
      400,
      "No valid rows found. Required columns: StudentID, StudentName, TicketsPurchased."
    );

  const client = await pool.connect();
  let createdTickets = 0;
  let newStudents = 0;
  try {
    const seqRes = await client.query(
      `select coalesce(max(nullif(regexp_replace(ticket_id, '\\D', '', 'g'), '')::bigint), 0) as maxseq
         from tickets where ticket_id like 'GU2026-%'`
    );
    let seq = Number(seqRes.rows[0].maxseq) + 1;

    for (const stu of roster.values()) {
      await client.query("begin");
      const up = await client.query(
        `insert into students (student_id, student_name, email, phone, tickets_purchased)
         values ($1,$2,$3,$4,$5)
         on conflict (student_id) do update
           set student_name = excluded.student_name,
               email = coalesce(excluded.email, students.email),
               phone = coalesce(excluded.phone, students.phone),
               tickets_purchased = excluded.tickets_purchased,
               updated_at = now()
         returning (xmax = 0) as inserted`,
        [stu.student_id, stu.name, stu.email, stu.phone, stu.total]
      );
      if (up.rows[0]?.inserted) newStudents++;

      const cnt = await client.query(
        "select count(*)::int as n from tickets where student_id=$1",
        [stu.student_id]
      );
      const existing = cnt.rows[0].n as number;

      for (let n = existing + 1; n <= stu.total; n++) {
        const ticketId = `GU2026-${String(seq).padStart(6, "0")}`;
        seq++;
        await client.query(
          `insert into tickets (ticket_id, student_id, qr_token, ticket_number, total_tickets, status)
           values ($1,$2,$3,$4,$5,'unused')`,
          [ticketId, stu.student_id, generateQrToken(), n, stu.total]
        );
        createdTickets++;
      }
      await client.query(
        "update tickets set total_tickets=$1, updated_at=now() where student_id=$2 and total_tickets<>$1",
        [stu.total, stu.student_id]
      );
      await client.query("commit");
    }
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  return NextResponse.json({
    ok: true,
    studentsProcessed: roster.size,
    newStudents,
    ticketsCreated: createdTickets,
  });
});
