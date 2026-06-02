import { NextRequest, NextResponse } from "next/server";
import { pool, queryOne } from "@/lib/db";
import { handle, requireStaff } from "@/lib/guard";

export const runtime = "nodejs";

type Result = "valid" | "already_used" | "cancelled" | "invalid";

function payload(
  result: Result,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return { result, message, ...extra };
}

// POST /api/scan  { token }
export const POST = handle(async (req: NextRequest) => {
  const user = await requireStaff();
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token || "").trim();
  const device = req.headers.get("user-agent")?.slice(0, 250) || null;

  if (!token) {
    return NextResponse.json(payload("invalid", "Invalid Ticket"), { status: 200 });
  }

  const client = await pool.connect();
  try {
    // Atomic claim: only succeeds if the ticket exists AND is currently unused.
    // This single statement makes double-scans impossible even under a race.
    const claim = await client.query(
      `update tickets
          set status='used', used_at=now(), checked_in_by=$2, updated_at=now()
        where qr_token=$1 and status='unused'
        returning ticket_id, student_id, ticket_number, total_tickets, used_at`,
      [token, user.id]
    );

    if (claim.rowCount === 1) {
      const t = claim.rows[0];
      const student = await queryOne<{ student_name: string }>(
        "select student_name from students where student_id=$1",
        [t.student_id]
      );
      await client.query(
        `insert into check_in_logs (ticket_id, student_id, action, scanned_by, device_info)
         values ($1,$2,'valid_entry',$3,$4)`,
        [t.ticket_id, t.student_id, user.id, device]
      );
      return NextResponse.json(
        payload("valid", "Valid Ticket — Entry Allowed", {
          ticket: {
            ticket_id: t.ticket_id,
            student_id: t.student_id,
            student_name: student?.student_name ?? "",
            ticket_number: t.ticket_number,
            total_tickets: t.total_tickets,
            used_at: t.used_at,
          },
        })
      );
    }

    // Claim failed → figure out why.
    const existing = await client.query(
      `select t.ticket_id, t.student_id, t.status, t.used_at, t.ticket_number, t.total_tickets,
              s.student_name, u.name as checked_in_by_name
         from tickets t
         left join students s on s.student_id = t.student_id
         left join users u on u.id = t.checked_in_by
        where t.qr_token = $1`,
      [token]
    );

    if (existing.rowCount === 0) {
      await client.query(
        `insert into check_in_logs (ticket_id, student_id, action, scanned_by, device_info)
         values (null, null, 'invalid_ticket', $1, $2)`,
        [user.id, device]
      );
      return NextResponse.json(payload("invalid", "Invalid Ticket"));
    }

    const t = existing.rows[0];
    if (t.status === "cancelled") {
      await client.query(
        `insert into check_in_logs (ticket_id, student_id, action, scanned_by, device_info)
         values ($1,$2,'cancelled_ticket',$3,$4)`,
        [t.ticket_id, t.student_id, user.id, device]
      );
      return NextResponse.json(
        payload("cancelled", "Cancelled Ticket — Entry Not Allowed", {
          ticket: {
            ticket_id: t.ticket_id,
            student_name: t.student_name,
            student_id: t.student_id,
            ticket_number: t.ticket_number,
            total_tickets: t.total_tickets,
          },
        })
      );
    }

    // status === 'used'  → duplicate scan attempt
    await client.query(
      `insert into check_in_logs (ticket_id, student_id, action, scanned_by, device_info)
       values ($1,$2,'already_used',$3,$4)`,
      [t.ticket_id, t.student_id, user.id, device]
    );
    return NextResponse.json(
      payload("already_used", "Already Used — Entry Not Allowed", {
        ticket: {
          ticket_id: t.ticket_id,
          student_name: t.student_name,
          student_id: t.student_id,
          ticket_number: t.ticket_number,
          total_tickets: t.total_tickets,
          used_at: t.used_at,
          checked_in_by_name: t.checked_in_by_name,
        },
      })
    );
  } finally {
    client.release();
  }
});
