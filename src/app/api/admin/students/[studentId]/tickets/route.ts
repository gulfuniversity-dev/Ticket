import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/guard";
import { generateQrToken } from "@/lib/tickets";

export const runtime = "nodejs";

// POST /api/admin/students/:studentId/tickets  { count?: number }
// Adds `count` (default 1) tickets to the student, mirroring the import logic:
//   - bumps students.tickets_purchased by count
//   - inserts new GU2026-NNNNNN tickets (next sequential ids, fresh QR tokens)
//   - updates total_tickets on all of that student's tickets
export const POST = handle(
  async (req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) => {
    await requireAdmin();
    const { studentId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { count?: number };
    const count = Math.max(1, Math.min(20, Math.floor(Number(body.count) || 1)));

    const client = await pool.connect();
    try {
      await client.query("begin");

      const stuRes = await client.query(
        "select student_name, tickets_purchased from students where student_id=$1 for update",
        [studentId]
      );
      if (stuRes.rowCount === 0) throw new HttpError(404, "Student not found");
      const { tickets_purchased } = stuRes.rows[0];

      const cntRes = await client.query(
        "select count(*)::int as n from tickets where student_id=$1",
        [studentId]
      );
      const existing = cntRes.rows[0].n as number;
      const newTotal = tickets_purchased + count;

      // Next sequential id from the numeric suffix of GU2026-NNNNNN ids.
      const seqRes = await client.query(
        `select coalesce(max((substring(ticket_id from 'GU2026-(\\d+)'))::int), 0) as maxseq
           from tickets where ticket_id ~ '^GU2026-\\d+$'`
      );
      let nextSeq = Number(seqRes.rows[0].maxseq) + 1;

      const added: string[] = [];
      for (let i = 0; i < count; i++) {
        const ticketId = `GU2026-${String(nextSeq++).padStart(6, "0")}`;
        await client.query(
          `insert into tickets (ticket_id, student_id, qr_token, ticket_number, total_tickets, status)
           values ($1,$2,$3,$4,$5,'unused')`,
          [ticketId, studentId, generateQrToken(), existing + 1 + i, newTotal]
        );
        added.push(ticketId);
      }

      await client.query(
        "update students set tickets_purchased=$1, updated_at=now() where student_id=$2",
        [newTotal, studentId]
      );
      await client.query(
        "update tickets set total_tickets=$1, updated_at=now() where student_id=$2 and total_tickets<>$1",
        [newTotal, studentId]
      );
      await client.query("commit");

      return NextResponse.json({ added, total: newTotal });
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
);
