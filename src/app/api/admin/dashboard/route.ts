import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireAdmin();

  const stats = await queryOne<{
    total_students: number;
    total_tickets: number;
    used: number;
    unused: number;
    cancelled: number;
  }>(`select
        (select count(*)::int from students) as total_students,
        (select count(*)::int from tickets) as total_tickets,
        (select count(*)::int from tickets where status='used') as used,
        (select count(*)::int from tickets where status='unused') as unused,
        (select count(*)::int from tickets where status='cancelled') as cancelled`);

  const duplicateAttempts = await queryOne<{ n: number }>(
    "select count(*)::int as n from check_in_logs where action = 'already_used'"
  );

  const recent = await query(
    `select l.action, l.ticket_id, l.student_id, l.scanned_at,
            s.student_name, u.name as staff_name
       from check_in_logs l
       left join students s on s.student_id = l.student_id
       left join users u on u.id = l.scanned_by
      where l.action in ('valid_entry','manual_checkin','already_used','undo_checkin')
      order by l.scanned_at desc
      limit 15`
  );

  const duplicates = await query(
    `select l.ticket_id, l.student_id, l.scanned_at, s.student_name, u.name as staff_name
       from check_in_logs l
       left join students s on s.student_id = l.student_id
       left join users u on u.id = l.scanned_by
      where l.action = 'already_used'
      order by l.scanned_at desc
      limit 15`
  );

  return NextResponse.json({
    stats: { ...stats, attendance: stats?.used ?? 0, duplicateAttempts: duplicateAttempts?.n ?? 0 },
    recent,
    duplicates,
  });
});
