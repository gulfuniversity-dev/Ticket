import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/guard";
import { buildTicketsPdf, type PdfTicket } from "@/lib/pdf";
import { sendTicketEmail, studentEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Allow either a logged-in admin (UI button) or a bearer secret (bulk script).
async function authorize(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.EMAIL_BULK_SECRET;
  if (secret && auth === `Bearer ${secret}`) return;
  await requireAdmin();
}

// POST /api/admin/students/:studentId/email  → email this student their tickets
export const POST = handle(
  async (req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) => {
    await authorize(req);
    const { studentId } = await ctx.params;

    const student = await queryOne<{ student_id: string; student_name: string }>(
      "select student_id, student_name from students where student_id = $1",
      [studentId]
    );
    if (!student) throw new HttpError(404, "Student not found");

    const tickets = await query<PdfTicket>(
      `select t.ticket_id, t.student_id, s.student_name, t.ticket_number,
              t.total_tickets, t.qr_token, t.status
         from tickets t join students s on s.student_id = t.student_id
        where t.student_id = $1 and t.status <> 'cancelled'
        order by t.ticket_number`,
      [studentId]
    );
    if (tickets.length === 0)
      throw new HttpError(404, "No active tickets for this student");

    const to = studentEmail(studentId);

    try {
      const pdf = await buildTicketsPdf(tickets);
      await sendTicketEmail({
        to,
        studentName: student.student_name,
        studentId,
        ticketCount: tickets.length,
        pdf,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await query(
        `insert into email_log (student_id, recipient, ticket_count, status, error)
         values ($1,$2,$3,'failed',$4)`,
        [studentId, to, tickets.length, error]
      );
      throw new HttpError(502, `Email failed: ${error}`);
    }

    await query(
      `insert into email_log (student_id, recipient, ticket_count, status)
       values ($1,$2,$3,'sent')`,
      [studentId, to, tickets.length]
    );
    await query(
      "update students set last_emailed_at = now(), updated_at = now() where student_id = $1",
      [studentId]
    );

    return NextResponse.json({ ok: true, recipient: to, tickets: tickets.length });
  }
);
