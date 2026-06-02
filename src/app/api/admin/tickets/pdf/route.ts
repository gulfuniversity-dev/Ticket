import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/guard";
import { buildTicketsPdf, type PdfTicket } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel caps function duration (60s on Hobby/Pro by default). The bulk
// "all tickets" PDF (hundreds of QR pages) may approach this — if it ever
// times out on the hosted plan, generate it locally with `npm run start`.
export const maxDuration = 60;

// GET /api/admin/tickets/pdf?studentId=XXX     (one student's tickets)
// GET /api/admin/tickets/pdf?all=1             (every student's tickets)
export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  const studentId = req.nextUrl.searchParams.get("studentId");
  const all = req.nextUrl.searchParams.get("all");

  let tickets: PdfTicket[];
  let filename: string;

  if (studentId) {
    tickets = await query<PdfTicket>(
      `select t.ticket_id, t.student_id, s.student_name, t.ticket_number, t.total_tickets, t.qr_token, t.status
         from tickets t join students s on s.student_id = t.student_id
        where t.student_id = $1 and t.status <> 'cancelled'
        order by t.ticket_number`,
      [studentId]
    );
    if (tickets.length === 0) throw new HttpError(404, "No active tickets for this student");
    filename = `tickets-${studentId}.pdf`;
  } else if (all) {
    tickets = await query<PdfTicket>(
      `select t.ticket_id, t.student_id, s.student_name, t.ticket_number, t.total_tickets, t.qr_token, t.status
         from tickets t join students s on s.student_id = t.student_id
        where t.status <> 'cancelled'
        order by s.student_name, t.ticket_number`
    );
    filename = `all-graduation-tickets.pdf`;
  } else {
    throw new HttpError(400, "Provide studentId or all=1");
  }

  const pdf = await buildTicketsPdf(tickets);
  const body = pdf.buffer.slice(
    pdf.byteOffset,
    pdf.byteOffset + pdf.byteLength
  ) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
