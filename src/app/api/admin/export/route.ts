import { NextRequest } from "next/server";
import * as xlsx from "xlsx";
import { query } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/export?type=checkins|tickets&format=xlsx|csv
export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  const type = req.nextUrl.searchParams.get("type") || "checkins";
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  let rows: any[];
  let name: string;

  if (type === "tickets") {
    rows = await query(
      `select t.ticket_id as "Ticket ID", t.student_id as "Student ID", s.student_name as "Student Name",
              t.ticket_number as "Ticket No", t.total_tickets as "Total", t.status as "Status",
              to_char(t.used_at,'YYYY-MM-DD HH24:MI:SS') as "Checked-in At",
              u.name as "Checked-in By"
         from tickets t
         join students s on s.student_id=t.student_id
         left join users u on u.id=t.checked_in_by
        order by s.student_name, t.ticket_number`
    );
    name = "tickets";
  } else {
    rows = await query(
      `select to_char(l.scanned_at,'YYYY-MM-DD HH24:MI:SS') as "Scanned At",
              l.action as "Action", l.ticket_id as "Ticket ID", l.student_id as "Student ID",
              s.student_name as "Student Name", u.name as "Staff", l.device_info as "Device"
         from check_in_logs l
         left join students s on s.student_id=l.student_id
         left join users u on u.id=l.scanned_by
        order by l.scanned_at desc`
    );
    name = "checkin-report";
  }

  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Report");

  if (format === "csv") {
    const csv = xlsx.utils.sheet_to_csv(ws);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
      },
    });
  }

  const out = xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  const body = out.buffer.slice(
    out.byteOffset,
    out.byteOffset + out.byteLength
  ) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
});
