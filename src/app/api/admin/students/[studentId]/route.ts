import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(
  async (_req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) => {
    await requireAdmin();
    const { studentId } = await ctx.params;

    const student = await queryOne(
      "select * from students where student_id = $1",
      [studentId]
    );
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const tickets = await query(
      `select t.id, t.ticket_id, t.qr_token, t.ticket_number, t.total_tickets,
              t.status, t.used_at, t.checked_in_by, u.name as checked_in_by_name, t.created_at
         from tickets t
         left join users u on u.id = t.checked_in_by
        where t.student_id = $1
        order by t.ticket_number`,
      [studentId]
    );

    return NextResponse.json({ student, tickets });
  }
);
