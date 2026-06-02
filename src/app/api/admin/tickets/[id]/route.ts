import { NextRequest, NextResponse } from "next/server";
import { pool, queryOne } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/guard";

export const runtime = "nodejs";

type Action = "cancel" | "reactivate" | "mark_used" | "undo";

// POST /api/admin/tickets/:id  { action }
export const POST = handle(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { action } = (await req.json().catch(() => ({}))) as { action?: Action };

    const ticket = await queryOne<{
      id: string;
      ticket_id: string;
      student_id: string;
      status: string;
    }>("select id, ticket_id, student_id, status from tickets where id = $1", [id]);
    if (!ticket) throw new HttpError(404, "Ticket not found");

    const client = await pool.connect();
    try {
      await client.query("begin");
      let logAction = "";

      switch (action) {
        case "cancel":
          if (ticket.status === "cancelled") throw new HttpError(400, "Ticket already cancelled");
          await client.query(
            "update tickets set status='cancelled', updated_at=now() where id=$1",
            [id]
          );
          logAction = "cancel";
          break;

        case "reactivate":
          if (ticket.status !== "cancelled")
            throw new HttpError(400, "Only cancelled tickets can be reactivated");
          await client.query(
            "update tickets set status='unused', used_at=null, checked_in_by=null, updated_at=now() where id=$1",
            [id]
          );
          logAction = "reactivate";
          break;

        case "mark_used":
          if (ticket.status === "used") throw new HttpError(400, "Ticket already used");
          if (ticket.status === "cancelled")
            throw new HttpError(400, "Cannot use a cancelled ticket");
          await client.query(
            "update tickets set status='used', used_at=now(), checked_in_by=$2, updated_at=now() where id=$1",
            [id, admin.id]
          );
          logAction = "manual_checkin";
          break;

        case "undo":
          if (ticket.status !== "used")
            throw new HttpError(400, "Only used tickets can be undone");
          await client.query(
            "update tickets set status='unused', used_at=null, checked_in_by=null, updated_at=now() where id=$1",
            [id]
          );
          logAction = "undo_checkin";
          break;

        default:
          throw new HttpError(400, "Unknown action");
      }

      await client.query(
        `insert into check_in_logs (ticket_id, student_id, action, scanned_by, device_info)
         values ($1,$2,$3,$4,$5)`,
        [ticket.ticket_id, ticket.student_id, logAction, admin.id, "admin-panel"]
      );
      await client.query("commit");
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    const updated = await queryOne(
      `select t.id, t.ticket_id, t.status, t.used_at, u.name as checked_in_by_name
         from tickets t left join users u on u.id = t.checked_in_by
        where t.id = $1`,
      [id]
    );
    return NextResponse.json({ ticket: updated });
  }
);
