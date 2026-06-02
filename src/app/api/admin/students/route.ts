import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const where = q
    ? `where s.student_id ilike $1 or s.student_name ilike $1`
    : "";
  const params = q ? [`%${q}%`] : [];

  const rows = await query(
    `select s.student_id, s.student_name, s.email, s.phone, s.tickets_purchased,
            count(t.id)::int                              as total_tickets,
            count(t.id) filter (where t.status='used')::int      as used,
            count(t.id) filter (where t.status='unused')::int    as unused,
            count(t.id) filter (where t.status='cancelled')::int as cancelled
       from students s
       left join tickets t on t.student_id = s.student_id
       ${where}
      group by s.student_id, s.student_name, s.email, s.phone, s.tickets_purchased
      order by s.student_name
      limit 1000`,
    params
  );

  return NextResponse.json({ students: rows });
});
