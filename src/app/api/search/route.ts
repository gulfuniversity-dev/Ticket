import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handle, requireStaff } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/search?q=...   (searches ticket_id, student_id, student_name)
// Used by gate staff when the camera fails. Read-only.
export const GET = handle(async (req: NextRequest) => {
  await requireStaff();
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ tickets: [] });

  const rows = await query(
    `select t.id, t.ticket_id, t.qr_token, t.student_id, t.ticket_number, t.total_tickets,
            t.status, t.used_at, s.student_name, u.name as checked_in_by_name
       from tickets t
       join students s on s.student_id = t.student_id
       left join users u on u.id = t.checked_in_by
      where t.ticket_id ilike $1
         or t.student_id ilike $1
         or s.student_name ilike $1
      order by s.student_name, t.ticket_number
      limit 50`,
    [`%${q}%`]
  );

  return NextResponse.json({ tickets: rows });
});
